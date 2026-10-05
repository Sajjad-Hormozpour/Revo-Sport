import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Zap, ChevronLeft, Eye, EyeOff, Mail, Lock, User as UserIcon, Phone, KeyRound,
  ShieldCheck, ArrowRight, Check, RefreshCw, Dumbbell, Users, Ticket,
} from "lucide-react";
import { useStore } from "../lib/store";
import { useLang } from "../lib/i18n";
import type { RegisterInput } from "../lib/store";
import type { GoalKind } from "../data/types";
import { ClockLive, inputCls } from "../components/ui";
import { StrengthBar } from "../components/profile";
import { fa, formatClock } from "../lib/core";
import { isValidPhone, maskPhone, normalizePhone } from "../lib/phone";
import { useNow } from "../lib/time";

const GOALS: GoalKind[] = ["عضله‌سازی", "کاهش وزن", "چربی‌سوزی", "افزایش قدرت", "فیتنس", "افزایش استقامت", "تغییر ترکیب بدنی"];
const HERO = "images/login-hero.jpg";
const HERO_FALLBACK =
  "https://images.pexels.com/photos/32996772/pexels-photo-32996772.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1400&w=1000";

function AccountStats({ compact = false }: { compact?: boolean }) {
  const { stats } = useStore();
  const items = [
    { icon: ShieldCheck, v: stats.users, l: "کل حساب‌ها" },
    { icon: Users, v: stats.coaches, l: "مربی" },
    { icon: Dumbbell, v: stats.students, l: "ورزشکار" },
  ];
  if (compact) {
    return (
      <div className="mb-4 grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div key={it.l} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-2 py-2.5 text-center">
            <b className="tnum block text-[17px] font-black">{fa(it.v)}</b>
            <span className="text-[10.5px] font-bold text-[var(--color-mute)]">{it.l}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl">
      {items.map((it, i) => (
        <div key={it.l} className={`px-4 py-4 ${i > 0 ? "border-r border-white/10" : ""}`}>
          <it.icon size={16} className="text-[#e9e400]" />
          <b className="tnum mt-2 block text-[26px] font-black leading-none text-white">{fa(it.v)}</b>
          <span className="mt-1.5 block text-[11.5px] font-bold text-white/55">{it.l}</span>
        </div>
      ))}
    </div>
  );
}

function IconInput({
  icon, right, className = "", ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode; right?: ReactNode }) {
  return (
    <div className="group relative">
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] transition group-focus-within:text-[#e9e400]">
        {icon}
      </span>
      <input {...rest} className={`${inputCls} h-12 rounded-2xl pr-10 ${right ? "pl-11" : ""} ${className}`} />
      {right && <span className="absolute left-3 top-1/2 -translate-y-1/2">{right}</span>}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[12px] font-bold text-[var(--color-mute)]">{children}</span>;
}

function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex items-center justify-center rounded-2xl bg-[#e9e400] shadow-[0_10px_30px_-8px_rgba(233,228,0,0.7)] ${size === "lg" ? "h-12 w-12" : "h-10 w-10"}`}>
        <Zap size={size === "lg" ? 24 : 20} strokeWidth={3} className="text-black" fill="currentColor" />
      </span>
      <span className="leading-tight">
        <b className={`block font-black tracking-tight ${size === "lg" ? "text-[22px] text-white" : "text-[17px]"}`} dir="ltr">Revo sport</b>
        <span className={`block text-[10px] font-bold tracking-[0.25em] ${size === "lg" ? "text-[#e9e400]/80" : "text-[var(--color-mute)]"}`}>COACH • ATHLETE</span>
      </span>
    </span>
  );
}

interface PendingPhone {
  challengeId: string;
  purpose: "login" | "register";
  email: string;
  phone: string;
  password?: string;
  signup?: RegisterInput;
  expiresAt: number;
  resendAt: number;
  demoCode?: string;
}

export default function Auth({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { requestPhoneCode, verifyPhoneCode, accountsCount, serverMode } = useStore();
  const { t, dir, lang, setLang } = useLang();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"login" | "register" | "forgot">(serverMode || accountsCount > 0 ? "login" : "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [invite, setInvite] = useState("");
  const [role, setRole] = useState<"coach" | "student">("coach");
  const [age, setAge] = useState("25");
  const [gender, setGender] = useState<"مرد" | "زن">("مرد");
  const [height, setHeight] = useState("170");
  const [weight, setWeight] = useState("70");
  const [goal, setGoal] = useState<GoalKind>("فیتنس");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [regStep, setRegStep] = useState(0);
  const [challenge, setChallenge] = useState<PendingPhone | null>(null);

  const goRegister = () => {
    setTab("register");
    setRegStep(0);
    setErr("");
  };

  const issuePhoneCode = async (
    purpose: PendingPhone["purpose"],
    emailAddress: string,
    mobile: string,
    secret?: string,
    signup?: RegisterInput,
  ): Promise<string | null> => {
    const response = await requestPhoneCode(purpose, { email: emailAddress, phone: mobile, password: secret });
    if (response.error || !response.challengeId) return response.error ?? "ارسال کد ناموفق بود";
    setChallenge({
      challengeId: response.challengeId,
      purpose,
      email: emailAddress,
      phone: mobile,
      password: secret,
      signup,
      expiresAt: Date.now() + (response.expiresIn ?? 180) * 1000,
      resendAt: Date.now() + (response.retryAfter ?? 60) * 1000,
      demoCode: response.demoCode,
    });
    return null;
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (!isValidPhone(phone)) return setErr("شماره موبایل معتبر با ۰۹ وارد کن");
    setBusy(true);
    try {
      const error = await issuePhoneCode("login", email.trim().toLowerCase(), normalizePhone(phone), password);
      if (error) setErr(error);
      else onToast(serverMode ? "کد ورود ارسال شد" : "کد نمایشی آماده است", "برای ورود، کد شش‌رقمی را تأیید کن");
    } finally {
      setBusy(false);
    }
  };

  const submitReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (!name.trim()) return setErr("نام را وارد کن");
    if (password.length < 4) return setErr("رمز عبور حداقل ۴ کاراکتر باشد");
    if (!isValidPhone(phone)) return setErr("شماره موبایل معتبر با ۰۹ وارد کن");
    const signup: RegisterInput = {
      name: name.trim(), email: email.trim().toLowerCase(), password, role, phone: normalizePhone(phone), invite,
      age: Number(age) || 25, gender, height: Number(height) || 170, weight: Number(weight) || 70, goal,
    };
    setBusy(true);
    try {
      const error = await issuePhoneCode("register", signup.email, signup.phone!, undefined, signup);
      if (error) setErr(error);
      else onToast(serverMode ? "کد ثبت‌نام ارسال شد" : "کد نمایشی آماده است", "برای ساخت حساب، موبایلت را تأیید کن");
    } finally {
      setBusy(false);
    }
  };

  const eyeBtn = (
    <button type="button" onClick={() => setShow((s) => !s)} className="text-[var(--color-mute)]" aria-label="نمایش رمز">
      {show ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-bg)]" dir={dir}>
      {/* visual side */}
      <div className="relative hidden w-[46%] overflow-hidden bg-black lg:block">
        <img
          src={HERO}
          alt=""
          onError={(e) => {
            if (e.currentTarget.src !== HERO_FALLBACK) e.currentTarget.src = HERO_FALLBACK;
          }}
          className="login-hero absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/50" />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#e9e400]/50 to-transparent" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#e9e400]/20 blur-[110px]" />
        <div className="on-dark relative flex h-full flex-col justify-between p-10">
          <Brand size="lg" />
          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e9e400]/30 bg-black/40 px-3 py-1.5 text-[11px] font-bold text-[#e9e400] backdrop-blur">
              <span className="animate-ticker-dot h-1.5 w-1.5 rounded-full bg-[#e9e400]" /> آمار زنده
            </span>
            <h1 className="mt-4 text-[34px] font-black leading-[1.45] text-white">
              قوی‌تر از <span className="text-[#e9e400]">دیروز.</span>
            </h1>
            <p className="mb-6 mt-2 text-[14px] leading-7 text-white/60">مربی و ورزشکار، کنار هم در یک اپ.</p>
            <AccountStats />
          </div>
        </div>
      </div>

      {/* form side */}
      <div className="grid-dash relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[520px] -translate-x-1/2 rounded-full bg-[#e9e400]/10 blur-[100px]" />
        <div className="relative flex items-center justify-between p-5 sm:p-8">
          <span className="lg:hidden"><Brand /></span>
          <div className="mr-auto flex items-center gap-2">
            <div className="flex rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]/80 p-0.5 backdrop-blur" role="group" aria-label="Language / زبان">
              {(["fa", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`press rounded-lg px-2.5 py-1 text-[11px] font-black ${lang === l ? "bg-[#e9e400] text-black" : "text-[var(--color-mute)]"}`}
                >
                  {l === "fa" ? "فا" : "EN"}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]/80 px-3 py-2 backdrop-blur">
              <ClockLive />
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md flex-1 px-5 pb-10 sm:px-0">
          <div className="lg:hidden">
            <p className="mb-3 text-center text-[13px] font-bold text-[var(--color-mute)]">قوی‌تر از <span className="text-[#e9e400]">دیروز</span> — مربی و ورزشکار، کنار هم.</p>
            <AccountStats compact />
          </div>
          <div className="screen-in rounded-[28px] border border-[var(--color-line)] bg-[var(--color-card)]/90 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-7">
            {challenge ? (
              <PhoneOtp
                key={challenge.challengeId}
                challenge={challenge}
                onBack={() => { setChallenge(null); setErr(""); }}
                onResend={async () => issuePhoneCode(
                  challenge.purpose, challenge.email, challenge.phone, challenge.password, challenge.signup,
                )}
                onVerify={async (code) => {
                  const error = await verifyPhoneCode(challenge.challengeId, code, challenge.signup);
                  if (!error) onToast(challenge.purpose === "login" ? "خوش برگشتی" : "حساب ساخته شد", "شماره موبایل تأیید شد");
                  return error;
                }}
              />
            ) : tab === "forgot" ? (
              <ForgotFlow
                initialEmail={email}
                onBack={(mail) => {
                  if (mail) setEmail(mail);
                  setTab("login");
                  setErr("");
                }}
                onToast={onToast}
              />
            ) : (
              <>
                {tab === "login" ? (
                  <>
                    <h2 className="text-[22px] font-black">{t("auth.welcome")}</h2>
                    <form className="mt-5 space-y-3.5" onSubmit={submitLogin}>
                      <label className="block">
                        <Label>{t("auth.email")}</Label>
                        <IconInput icon={<Mail size={17} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" placeholder="you@example.com" />
                      </label>
                      <label className="block">
                        <div className="flex items-center justify-between">
                          <Label>{t("auth.password")}</Label>
                          <button type="button" onClick={() => { setTab("forgot"); setErr(""); }} className="mb-1.5 text-[11.5px] font-bold text-[#e9e400]">
                            {t("auth.forgot")}
                          </button>
                        </div>
                        <IconInput icon={<Lock size={17} />} right={eyeBtn} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" placeholder="••••••" />
                      </label>
                      <label className="block">
                        <Label>{t("auth.phone")}</Label>
                        <IconInput
                          icon={<Phone size={17} />}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          dir="ltr"
                          placeholder="09123456789"
                          required
                        />
                      </label>
                      {err && <ErrorBox>{err}</ErrorBox>}
                      <SubmitBtn disabled={busy}>{busy ? "…" : t("auth.getCodeLogin")}</SubmitBtn>
                    </form>
                    <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-[var(--color-mute)]">
                      <span>{t("auth.noAccount")}</span>
                      <button type="button" onClick={goRegister} className="font-black text-[#e9e400]">{t("auth.doRegister")}</button>
                    </div>
                  </>

                ) : (
                  <>
                    <button type="button" onClick={() => { setTab("login"); setRegStep(0); setErr(""); }} className="press mb-4 flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-mute)]">
                      <ArrowRight size={15} /> {t("auth.backLogin")}
                    </button>
                    <div className="mb-5 flex items-center gap-1.5" aria-label="مراحل ثبت‌نام">
                      {(role === "student" ? [t("auth.stepRole"), t("auth.stepAccount"), t("auth.stepInfo")] : [t("auth.stepRole"), t("auth.stepAccount"), t("auth.stepReview")]).map((s, i) => (
                        <div key={s} className="flex flex-1 items-center gap-1.5">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${regStep > i ? "bg-[#e9e400] text-black" : regStep === i ? "border-2 border-[#e9e400] text-[#e9e400]" : "bg-white/10 text-[var(--color-mute)]"}`}>
                            {regStep > i ? <Check size={13} strokeWidth={3} /> : fa(i + 1)}
                          </span>
                          <span className={`text-[11px] font-bold ${regStep === i ? "" : "text-[var(--color-mute)]"}`}>{s}</span>
                          {i < 2 && <span className={`h-0.5 flex-1 rounded-full ${regStep > i ? "bg-[#e9e400]" : "bg-white/10"}`} />}
                        </div>
                      ))}
                    </div>

                    <h2 className="text-[22px] font-black">{t("auth.create")}</h2>
                    <form className="mt-5 space-y-3" onSubmit={submitReg}>
                      {regStep === 0 && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            {(["coach", "student"] as const).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={`press flex items-center gap-2 rounded-2xl border p-3 text-right transition ${role === r ? "border-[#e9e400] bg-[#e9e400]/10" : "border-[var(--color-line)]"}`}
                              >
                                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${role === r ? "bg-[#e9e400] text-black" : "bg-white/10"}`}>
                                  {r === "coach" ? <Users size={16} /> : <Dumbbell size={16} />}
                                </span>
                                <b className="block text-[13px]">{r === "coach" ? t("auth.coach") : t("auth.student")}</b>
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setErr(""); setRegStep(1); }} className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black">
                            {t("auth.next")} <ChevronLeft size={17} strokeWidth={2.6} />
                          </button>
                        </>
                      )}

                      {regStep === 1 && (
                        <>
                          <label className="block"><Label>{t("auth.name")}</Label><IconInput icon={<UserIcon size={17} />} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
                          <label className="block"><Label>{t("auth.email")}</Label><IconInput icon={<Mail size={17} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" /></label>
                          <label className="block">
                            <Label>{t("auth.password")}</Label>
                            <IconInput icon={<Lock size={17} />} right={eyeBtn} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" dir="ltr" />
                            <StrengthBar value={password} />
                          </label>
                          <label className="block">
                            <Label>{t("auth.phone")}</Label>
                            <IconInput icon={<Phone size={17} />} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="09123456789" required />
                          </label>
                          {err && <ErrorBox>{err}</ErrorBox>}
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => { setErr(""); setRegStep(0); }} className="press h-12 rounded-2xl border border-[var(--color-line)] text-[13px] font-bold">{t("auth.prev")}</button>
                            <button
                              type="button"
                              onClick={() => {
                                setErr("");
                                if (!name.trim()) return setErr("نام را وارد کن");
                                if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("ایمیل معتبر وارد کن");
                                if (password.length < 4) return setErr("رمز عبور حداقل ۴ کاراکتر باشد");
                                if (!isValidPhone(phone)) return setErr("شماره موبایل معتبر با ۰۹ وارد کن");
                                setRegStep(2);
                              }}
                              className="press flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black"
                            >
                              {t("auth.next")} <ChevronLeft size={17} strokeWidth={2.6} />
                            </button>
                          </div>
                        </>
                      )}

                      {regStep === 2 && (
                        <>
                          {role === "student" ? (
                            <div className="space-y-3 rounded-2xl bg-[var(--color-bg)] p-3">
                              <label className="block">
                                <Label>{t("auth.code")}</Label>
                                <IconInput icon={<Ticket size={17} />} value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="مثلاً A3K9PQ" dir="ltr" className="tracking-[0.25em]" />
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <label><Label>{t("auth.age")}</Label><input className={inputCls} type="number" value={age} onChange={(e) => setAge(e.target.value)} /></label>
                                <label><Label>{t("auth.gender")}</Label><select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as "مرد" | "زن")}><option>مرد</option><option>زن</option></select></label>
                                <label><Label>{t("auth.height")}</Label><input className={inputCls} type="number" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
                                <label><Label>{t("auth.weight")}</Label><input className={inputCls} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
                              </div>
                              <label className="block"><Label>{t("auth.goal")}</Label><select className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value as GoalKind)}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></label>
                            </div>
                          ) : (
                            <div className="space-y-2 rounded-2xl bg-[var(--color-bg)] p-4 text-[12.5px] leading-7">
                              <div className="flex justify-between"><span className="text-[var(--color-mute)]">نام</span><b>{name.trim() || "—"}</b></div>
                              <div className="flex justify-between"><span className="text-[var(--color-mute)]">ایمیل</span><b dir="ltr">{email.trim() || "—"}</b></div>
                              <div className="flex justify-between"><span className="text-[var(--color-mute)]">موبایل</span><b dir="ltr">{phone.trim() || "—"}</b></div>
                              <div className="flex justify-between"><span className="text-[var(--color-mute)]">نقش</span><b>مربی</b></div>
                              <p className="text-[11.5px] text-[var(--color-mute)]">با تأیید، کد شش‌رقمی به موبایلت ارسال می‌شود.</p>
                            </div>
                          )}
                          {err && <ErrorBox>{err}</ErrorBox>}
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => { setErr(""); setRegStep(1); }} className="press h-12 rounded-2xl border border-[var(--color-line)] text-[13px] font-bold">{t("auth.prev")}</button>
                            <SubmitBtn disabled={busy}>{busy ? "…" : t("auth.getCodeRegister")}</SubmitBtn>
                          </div>
                        </>
                      )}
                    </form>
                  </>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-400">{children}</p>;
}

function SubmitBtn({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black shadow-[0_14px_36px_-12px_rgba(233,228,0,0.7)] disabled:opacity-50"
    >
      {children} <ChevronLeft size={17} strokeWidth={2.6} />
    </button>
  );
}

function PhoneOtp({
  challenge,
  onBack,
  onResend,
  onVerify,
}: {
  challenge: PendingPhone;
  onBack: () => void;
  onResend: () => Promise<string | null>;
  onVerify: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const now = useNow(1000).getTime();
  const left = Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000));
  const resendLeft = Math.max(0, Math.ceil((challenge.resendAt - now) / 1000));

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const digits = normalizePhone(code).replace(/\D/g, "");
    if (digits.length !== 6) return setError("کد شش‌رقمی را کامل وارد کن");
    if (left <= 0) return setError("اعتبار کد تمام شد؛ کد جدید بگیر");
    setBusy(true);
    try {
      const result = await onVerify(digits);
      if (result) setError(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-in space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="press flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-mute)]"
      >
        <ArrowRight size={15} /> ویرایش اطلاعات ورود
      </button>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9e400]/15 text-[#e9e400]">
        <Phone size={23} />
      </span>
      <div>
        <h2 className="text-[21px] font-black">تأیید شماره موبایل</h2>
        <p className="mt-1 text-[12.5px] leading-7 text-[var(--color-mute)]">
          کد شش‌رقمی {challenge.purpose === "login" ? "ورود" : "ثبت‌نام"} به شماره
          <b className="tnum mx-1 text-[var(--color-ink)]" dir="ltr">{fa(maskPhone(challenge.phone))}</b>
          {challenge.demoCode ? "آماده شده" : "ارسال شده"} است.
        </p>
      </div>

      {challenge.demoCode && (
        <div className="rounded-2xl border border-[#e9e400]/30 bg-[#e9e400]/[0.07] px-4 py-3">
          <p className="text-[11px] font-bold text-[var(--color-mute)]">حالت نمایشی محلی (بدون سرویس پیامک)</p>
          <p className="tnum mt-1 text-center text-[25px] font-black tracking-[0.2em] text-[#e9e400]" dir="ltr">
            {fa(challenge.demoCode)}
          </p>
        </div>
      )}

      <form onSubmit={verify} className="space-y-3">
        <label className="block">
          <Label>کد تأیید</Label>
          <input
            value={code}
            onChange={(event) => {
              setCode(normalizePhone(event.target.value).replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            inputMode="numeric"
            type="text"
            autoComplete="one-time-code"
            pattern="[0-9۰-۹٠-٩]{6}"
            maxLength={6}
            placeholder="ــــــ"
            dir="ltr"
            aria-label="کد شش‌رقمی تأیید موبایل"
            className={`${inputCls} tnum h-14 rounded-2xl text-center text-[21px] font-black tracking-[0.4em]`}
          />
        </label>
        {error && <ErrorBox>{error}</ErrorBox>}
        <SubmitBtn disabled={busy || left <= 0}>
          {busy ? "در حال تأیید…" : challenge.purpose === "login" ? "تأیید کد و ورود" : "تأیید کد و ساخت حساب"}
        </SubmitBtn>
      </form>

      <div className="flex items-center justify-between gap-2 text-[11.5px]">
        <span className={`tnum font-bold ${left > 20 ? "text-[var(--color-mute)]" : "text-red-400"}`}>
          {left > 0 ? `اعتبار کد: ${formatClock(left)}` : "اعتبار کد تمام شد"}
        </span>
        <button
          type="button"
          disabled={busy || resendLeft > 0}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await onResend();
              if (result) setError(result);
            } finally {
              setBusy(false);
            }
          }}
          className="press flex items-center gap-1 font-black text-[#e9e400] disabled:opacity-45"
        >
          <RefreshCw size={13} /> {resendLeft ? `ارسال مجدد (${fa(resendLeft)} ث)` : "ارسال مجدد کد"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- professional forgot-password flow ---------------- */
function ForgotFlow({
  initialEmail, onBack, onToast,
}: {
  initialEmail: string;
  onBack: (email?: string) => void;
  onToast: (t: string, d: string) => void;
}) {
  const { emailExists, resetPassword, serverMode, requestReset, confirmReset } = useStore();
  const [serverCode, setServerCode] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [expires, setExpires] = useState(0);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [attempts, setAttempts] = useState(0);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const now = useNow(1000);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const left = Math.max(0, Math.round((expires - now.getTime()) / 1000));

  const sendCode = async () => {
    if (serverMode) {
      const r = await requestReset(email.trim());
      if (r) {
        setErr(r);
        return false;
      }
      setCode("");
      setExpires(Date.now() + 600_000);
    } else {
      const c = String(Math.floor(100000 + Math.random() * 900000));
      setCode(c);
      setExpires(Date.now() + 120_000);
    }
    setOtp(Array(6).fill(""));
    setAttempts(0);
    setErr("");
    return true;
  };

  useEffect(() => {
    if (step === 2) refs.current[0]?.focus();
  }, [step]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("ایمیل معتبر وارد کن");
    if (!serverMode && !emailExists(email)) return setErr("حسابی با این ایمیل روی این دستگاه ثبت نشده");
    const ok = await sendCode();
    if (!ok) return;
    setStep(2);
    onToast(serverMode ? "درخواست ثبت شد" : "کد تأیید ساخته شد", "کد ۶ رقمی را وارد کن");
  };

  const verify = (digits: string[]) => {
    const entered = digits.join("");
    if (entered.length < 6) return;
    if (serverMode) {
      // در حالت سرور، کد در مرحلهٔ آخر توسط سرور بررسی می‌شود
      setServerCode(entered);
      setErr("");
      setStep(3);
      return;
    }
    if (left <= 0) return setErr("کد منقضی شده؛ کد جدید بگیر");
    if (entered !== code) {
      const a = attempts + 1;
      setAttempts(a);
      setErr(a >= 5 ? "تعداد تلاش زیاد شد؛ کد جدید بگیر" : `کد اشتباه است (${fa(5 - a)} تلاش باقی‌مانده)`);
      if (a >= 5) setExpires(0);
      return;
    }
    setErr("");
    setStep(3);
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) {
      const arr = d.slice(0, 6).split("");
      const next = Array(6).fill("").map((_, k) => arr[k] ?? "");
      setOtp(next);
      refs.current[Math.min(5, arr.length)]?.focus();
      verify(next);
      return;
    }
    const next = [...otp];
    next[i] = d;
    setOtp(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
    verify(next);
  };

  const submitPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pass.length < 4) return setErr("رمز حداقل ۴ کاراکتر باشد");
    if (pass !== pass2) return setErr("تکرار رمز یکی نیست");
    if (serverMode) {
      const r = await confirmReset(email.trim(), serverCode, pass);
      if (r) {
        setErr(r);
        if (/کد/.test(r)) setStep(2);
        return;
      }
      setStep(4);
      onToast("رمز عبور تغییر کرد", "با رمز جدید وارد شو");
      return;
    }
    const r = resetPassword(email, pass);
    if (r) return setErr(r);
    setStep(4);
    onToast("رمز عبور تغییر کرد", "با رمز جدید وارد شو");
  };

  const steps = ["ایمیل", "تأیید", "رمز جدید"];

  return (
    <div>
      <button onClick={() => onBack()} className="press mb-4 flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-mute)]">
        <ArrowRight size={15} /> بازگشت به ورود
      </button>

      <div className="mb-5 flex items-center gap-2">
        {steps.map((s, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${done || step === 4 ? "bg-[#e9e400] text-black" : active ? "border-2 border-[#e9e400] text-[#e9e400]" : "bg-white/10 text-[var(--color-mute)]"}`}>
                {done || step === 4 ? <Check size={13} strokeWidth={3} /> : fa(n)}
              </span>
              <span className={`text-[11px] font-bold ${active ? "" : "text-[var(--color-mute)]"}`}>{s}</span>
              {i < 2 && <span className={`h-0.5 flex-1 rounded-full ${step > n ? "bg-[#e9e400]" : "bg-white/10"}`} />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <form onSubmit={submitEmail} className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9e400]/15"><KeyRound size={24} className="text-[#e9e400]" /></div>
          <div>
            <h2 className="text-[21px] font-black">بازیابی رمز عبور</h2>
            <p className="mt-1 text-[12.5px] leading-6 text-[var(--color-mute)]">ایمیل حسابت را وارد کن تا کد تأیید یک‌بارمصرف برایت ساخته شود.</p>
          </div>
          <label className="block"><Label>ایمیل حساب</Label><IconInput icon={<Mail size={17} />} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" type="email" /></label>
          {err && <ErrorBox>{err}</ErrorBox>}
          <SubmitBtn>دریافت کد تأیید</SubmitBtn>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[21px] font-black">کد تأیید را وارد کن</h2>
            <p className="mt-1 text-[12.5px] leading-6 text-[var(--color-mute)]">
              کد ۶ رقمی برای <b dir="ltr" className="text-[var(--color-ink)]">{email}</b> صادر شد.
            </p>
          </div>
          {serverMode ? (
            <div className="rounded-2xl border border-dashed border-[#e9e400]/40 bg-[#e9e400]/[0.07] p-3">
              <p className="text-[11px] font-bold text-[var(--color-mute)]">ارسال کد از طریق سرور</p>
              <p className="mt-1 text-[12px] leading-6">
                اگر حسابی با این ایمیل وجود داشته باشد، کد ۶ رقمی برایش صادر شده است. کد را از مدیر سیستم یا از ایمیلت بگیر.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#e9e400]/40 bg-[#e9e400]/[0.07] p-3">
              <p className="text-[11px] font-bold text-[var(--color-mute)]">صندوق پیام امن (حالت آفلاین)</p>
              <p className="mt-1 text-[12.5px]">
                کد تأیید Revo sport شما: <b dir="ltr" className="tnum text-[18px] tracking-[0.3em] text-[#e9e400]">{left > 0 ? code : "••••••"}</b>
              </p>
            </div>
          )}
          <div className="flex justify-center gap-2" dir="ltr">
            {otp.map((d, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                value={d}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
                }}
                className={`tnum h-13 w-11 rounded-xl border bg-[var(--color-bg)] py-3 text-center text-[20px] font-black outline-none transition focus:border-[#e9e400] ${d ? "border-[#e9e400]/60" : "border-[var(--color-line)]"}`}
              />
            ))}
          </div>
          {err && <ErrorBox>{err}</ErrorBox>}
          <div className="flex items-center justify-between text-[12px]">
            <span className={`tnum font-bold ${left > 20 ? "text-[var(--color-mute)]" : "text-red-400"}`}>
              {left > 0 ? `اعتبار کد: ${formatClock(left)}` : "کد منقضی شد"}
            </span>
            <button onClick={() => void sendCode()} disabled={serverMode ? left > 540 : left > 90} className="press flex items-center gap-1 font-bold text-[#e9e400] disabled:opacity-40">
              <RefreshCw size={13} /> ارسال مجدد
            </button>
          </div>
          <button onClick={() => { setStep(1); setErr(""); }} className="w-full text-center text-[11.5px] text-[var(--color-mute)]">ایمیل را اشتباه زدی؟ تغییر ایمیل</button>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={submitPass} className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15"><ShieldCheck size={24} className="text-emerald-400" /></div>
          <div>
            <h2 className="text-[21px] font-black">رمز جدید بساز</h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-mute)]">هویتت تأیید شد. یک رمز قوی انتخاب کن.</p>
          </div>
          <label className="block">
            <Label>رمز جدید</Label>
            <IconInput
              icon={<Lock size={17} />}
              right={<button type="button" onClick={() => setShow((s) => !s)} className="text-[var(--color-mute)]">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
              type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} dir="ltr" autoComplete="new-password"
            />
            <StrengthBar value={pass} />
          </label>
          <label className="block">
            <Label>تکرار رمز جدید</Label>
            <IconInput icon={<Lock size={17} />} type={show ? "text" : "password"} value={pass2} onChange={(e) => setPass2(e.target.value)} dir="ltr" autoComplete="new-password" />
            {pass2 && <span className={`mt-1 block text-[11px] font-bold ${pass === pass2 ? "text-emerald-400" : "text-red-400"}`}>{pass === pass2 ? "رمزها یکی هستند ✓" : "رمزها یکی نیستند"}</span>}
          </label>
          {err && <ErrorBox>{err}</ErrorBox>}
          <SubmitBtn>ذخیره رمز جدید</SubmitBtn>
        </form>
      )}

      {step === 4 && (
        <div className="space-y-4 py-4 text-center">
          <div className="pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e9e400] shadow-[0_16px_40px_-10px_rgba(233,228,0,0.7)]">
            <Check size={36} strokeWidth={3} className="text-black" />
          </div>
          <h2 className="text-[21px] font-black">رمز با موفقیت تغییر کرد</h2>
          <p className="text-[12.5px] text-[var(--color-mute)]">حالا با رمز جدید وارد حسابت شو.</p>
          <button onClick={() => onBack(email)} className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black">
            ورود به حساب <ChevronLeft size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
