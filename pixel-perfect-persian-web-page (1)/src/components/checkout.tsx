import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, Check, CreditCard, Lock, ShieldCheck, Ticket, Loader2, Copy, RefreshCw, X, Clock,
  MessageSquare, AlertTriangle, Building2, Mail, KeyRound, CalendarDays, Hash, CircleCheck,
} from "lucide-react";
import type { PlanDef } from "../data/plans";
import { COUPONS } from "../data/plans";
import { copyText, fa, formatClock } from "../lib/core";
import { formatDateTime, toJalali } from "../lib/time";
import { money } from "./ui";

type Step = "review" | "connecting" | "bank" | "verifying" | "done" | "canceled";

interface Gateway {
  id: string;
  psp: string;
  bank: string;
  color: string;
  soft: string;
}

const GATEWAYS: Gateway[] = [
  { id: "mellat", psp: "به‌پرداخت ملت", bank: "بانک ملت", color: "#c8102e", soft: "#fdecef" },
  { id: "saman", psp: "سامان کیش (سپ)", bank: "بانک سامان", color: "#0a57a4", soft: "#e8f1fb" },
  { id: "parsian", psp: "تاپ پارسیان", bank: "بانک پارسیان", color: "#7a1f3d", soft: "#f6e9ee" },
  { id: "melli", psp: "سداد (بانک ملی)", bank: "بانک ملی ایران", color: "#00733e", soft: "#e6f4ec" },
];

/** پیش‌شماره کارت‌های شبکه شتاب */
const BINS: [string, string][] = [
  ["603799", "ملی"], ["589210", "سپه"], ["627648", "توسعه صادرات"], ["207177", "توسعه صادرات"],
  ["627961", "صنعت و معدن"], ["603770", "کشاورزی"], ["639217", "کشاورزی"], ["628023", "مسکن"],
  ["627760", "پست بانک"], ["502908", "توسعه تعاون"], ["627412", "اقتصاد نوین"], ["622106", "پارسیان"],
  ["639194", "پارسیان"], ["627884", "پارسیان"], ["502229", "پاسارگاد"], ["639347", "پاسارگاد"],
  ["627488", "کارآفرین"], ["502910", "کارآفرین"], ["621986", "سامان"], ["639346", "سینا"],
  ["639607", "سرمایه"], ["636214", "آینده"], ["502806", "شهر"], ["504706", "شهر"], ["502938", "دی"],
  ["603769", "صادرات"], ["610433", "ملت"], ["991975", "ملت"], ["627353", "تجارت"], ["585983", "تجارت"],
  ["589463", "رفاه"], ["627381", "انصار"], ["639370", "مهر اقتصاد"], ["505785", "ایران زمین"],
  ["636949", "حکمت"], ["606373", "مهر ایران"], ["505416", "گردشگری"], ["505801", "کوثر"],
  ["628157", "توسعه اعتباری"], ["507677", "نور"], ["585947", "خاورمیانه"], ["606256", "ملل"], ["636795", "مرکزی"],
];

const onlyDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d]/g, "");

function issuer(card: string): string | undefined {
  return BINS.find((b) => card.startsWith(b[0]))?.[1];
}

function luhn(n: string): boolean {
  let s = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
  }
  return s % 10 === 0;
}

function randDigits(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function mask(card: string) {
  return `${card.slice(0, 4)}-${card.slice(4, 6)}**-****-${card.slice(12)}`;
}

interface CaptchaData {
  code: string;
  lines: number[][];
}

function newCaptcha(): CaptchaData {
  return {
    code: randDigits(5),
    lines: Array.from({ length: 5 }).map(() => [Math.random() * 120, Math.random() * 44, Math.random() * 120, Math.random() * 44]),
  };
}

function Captcha({ data, onRefresh }: { data: CaptchaData; onRefresh: () => void }) {
  const colors = ["#334155", "#1e3a8a", "#7c2d12", "#166534", "#581c87"];
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <svg viewBox="0 0 120 44" className="h-11 w-[120px] shrink-0 select-none rounded-lg border border-slate-200 bg-slate-100" aria-label="کد امنیتی">
        {data.lines.map((l, i) => (
          <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={colors[i % 5]} strokeOpacity="0.35" strokeWidth="1.2" />
        ))}
        {data.code.split("").map((c, i) => {
          const x = 14 + i * 21;
          const y = 30 + (i % 2 ? -3 : 3);
          return (
            <text key={i} x={x} y={y} fontSize="23" fontWeight="800" fontFamily="monospace" fill={colors[i % 5]} transform={`rotate(${(i % 2 ? -1 : 1) * (7 + i * 3)} ${x} ${y - 8})`}>
              {c}
            </text>
          );
        })}
      </svg>
      <button type="button" onClick={onRefresh} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="کد جدید">
        <RefreshCw size={15} />
      </button>
    </div>
  );
}

export interface PaidInfo {
  amount: number;
  coupon?: string;
  method: string;
  cardLast4: string;
  rrn: string;
  terminal: string;
  cardBank?: string;
}

export default function Checkout({
  plan, studentName, merchantName, onClose, onPaid,
}: {
  plan: PlanDef;
  studentName: string;
  merchantName: string;
  onClose: () => void;
  onPaid: (p: PaidInfo) => string;
}) {
  const [step, setStep] = useState<Step>("review");
  const [gw, setGw] = useState<Gateway>(GATEWAYS[0]);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; off: number } | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [receipt, setReceipt] = useState<{ ref: string; rrn: string; terminal: string; card: string; bank?: string; at: Date } | null>(null);
  const orderId = useMemo(() => randDigits(10), []);
  const terminal = useMemo(() => randDigits(8), []);

  const off = applied ? Math.round(plan.price * applied.off) : 0;
  const total = plan.price - off;

  useEffect(() => {
    if (step !== "connecting") return;
    const t = window.setTimeout(() => setStep("bank"), 1600);
    return () => window.clearTimeout(t);
  }, [step]);

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    setCouponErr("");
    if (!code) return;
    const v = COUPONS[code];
    if (!v) {
      setApplied(null);
      setCouponErr("کد تخفیف معتبر نیست");
      return;
    }
    setApplied({ code, off: v });
  };

  /* ---------- 1. review (in app) ---------- */
  if (step === "review") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-[#e9e400]/30 bg-[#e9e400]/[0.07] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <b className="text-[16px]">پلن {plan.title}</b>
              <p className="tnum mt-0.5 text-[11.5px] text-[var(--color-mute)]">{fa(plan.days)} روز اعتبار • هر جلسه {money(plan.perSession)}</p>
            </div>
            <span className="tnum text-[18px] font-black text-[#e9e400]">{money(plan.price)}</span>
          </div>
          {plan.perks.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {plan.perks.map((p) => (
                <li key={p} className="flex items-center gap-1.5 text-[12px] text-[var(--color-mute)]">
                  <Check size={13} className="shrink-0 text-emerald-400" /> {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
          <b className="flex items-center gap-1.5 text-[12.5px]"><Ticket size={14} className="text-[#e9e400]" /> کد تخفیف</b>
          <div className="mt-2 flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="مثلاً REVO10"
              dir="ltr"
              className="h-11 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 text-[13px] tracking-widest outline-none focus:border-[#e9e400]/50"
            />
            <button onClick={applyCoupon} className="press rounded-xl border border-[var(--color-line)] px-4 text-[12.5px] font-black">اعمال</button>
          </div>
          {couponErr && <p className="mt-1.5 text-[11.5px] font-bold text-red-400">{couponErr}</p>}
          {applied && <p className="mt-1.5 text-[11.5px] font-bold text-emerald-400">کد {applied.code} اعمال شد — {fa(Math.round(applied.off * 100))}٪ تخفیف</p>}
        </div>

        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
          <b className="flex items-center gap-1.5 text-[12.5px]"><Building2 size={14} className="text-[#e9e400]" /> انتخاب درگاه بانکی (شبکه شاپرک)</b>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {GATEWAYS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGw(g)}
                className={`press flex items-center gap-2 rounded-xl border p-2.5 text-right transition ${gw.id === g.id ? "border-[#e9e400] bg-[#e9e400]/10" : "border-[var(--color-line)] bg-[var(--color-card)]"}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white" style={{ background: g.color }}>
                  {g.bank.replace("بانک ", "").slice(0, 3)}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-[12px]">{g.bank}</b>
                  <span className="block truncate text-[10px] text-[var(--color-mute)]">{g.psp}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3.5 text-[12.5px]">
          <Row k="خریدار" v={studentName} />
          <Row k="پذیرنده" v={`Revo sport — ${merchantName}`} />
          <Row k="تعداد جلسات" v={`${fa(plan.sessions)} جلسه`} />
          <Row k="مبلغ پلن" v={money(plan.price)} />
          {off > 0 && <Row k="تخفیف" v={`− ${money(off)}`} green />}
          <div className="mt-2 flex items-center justify-between border-t border-[var(--color-line)] pt-2">
            <b className="text-[13px]">مبلغ قابل پرداخت</b>
            <b className="tnum text-[18px] font-black text-[#e9e400]">{money(total)}</b>
          </div>
        </div>

        <button onClick={() => setStep("connecting")} className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black">
          <Lock size={16} /> انتقال به درگاه {gw.bank}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-[10.5px] leading-5 text-[var(--color-mute)]">
          <ShieldCheck size={12} className="shrink-0 text-emerald-400" /> درگاه در حالت آزمایشی (Sandbox) است و مبلغی از کارت کسر نمی‌شود
        </p>
      </div>
    );
  }

  /* ---------- 2. connecting ---------- */
  if (step === "connecting") {
    return (
      <div className="space-y-4 py-8 text-center">
        <div className="relative mx-auto h-20 w-20">
          <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: gw.color }} />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full text-white" style={{ background: gw.color }}>
            <Lock size={30} />
          </span>
        </div>
        <b className="block text-[16px]">در حال انتقال به درگاه امن {gw.bank}…</b>
        <p className="text-[12px] text-[var(--color-mute)]">اتصال رمزگذاری‌شده به شبکه پرداخت شاپرک</p>
        <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-[var(--color-bg)]">
          <div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full" style={{ background: gw.color }} />
        </div>
      </div>
    );
  }

  /* ---------- 3-5. bank page (full screen) ---------- */
  return createPortal(
    <BankPage
      gw={gw}
      step={step}
      total={total}
      orderId={orderId}
      terminal={terminal}
      merchantName={merchantName}
      planTitle={plan.title}
      cancelReason={cancelReason}
      receipt={receipt}
      onCancel={(reason) => { setCancelReason(reason); setStep("canceled"); }}
      onRetry={() => { setCancelReason(""); setStep("review"); }}
      onVerify={() => setStep("verifying")}
      onFinish={(card, bank) => {
        const rrn = randDigits(12);
        const ref = onPaid({ amount: total, coupon: applied?.code, method: gw.psp, cardLast4: card.slice(-4), rrn, terminal, cardBank: bank });
        setReceipt({ ref, rrn, terminal, card: mask(card), bank, at: new Date() });
        setStep("done");
      }}
      onClose={onClose}
    />,
    document.body,
  );
}

function BankPage({
  gw, step, total, orderId, terminal, merchantName, planTitle, cancelReason, receipt,
  onCancel, onRetry, onVerify, onFinish, onClose,
}: {
  gw: Gateway;
  step: Step;
  total: number;
  orderId: string;
  terminal: string;
  merchantName: string;
  planTitle: string;
  cancelReason: string;
  receipt: { ref: string; rrn: string; terminal: string; card: string; bank?: string; at: Date } | null;
  onCancel: (reason: string) => void;
  onRetry: () => void;
  onVerify: () => void;
  onFinish: (card: string, bank?: string) => void;
  onClose: () => void;
}) {
  const [card, setCard] = useState("");
  const [cvv, setCvv] = useState("");
  const [mm, setMm] = useState("");
  const [yy, setYy] = useState("");
  const [cap, setCap] = useState<CaptchaData>(newCaptcha);
  const [capIn, setCapIn] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpUntil, setOtpUntil] = useState(0);
  const [sms, setSms] = useState(false);
  const [email, setEmail] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [left, setLeft] = useState(600);
  const [now, setNow] = useState(Date.now());
  const [vStage, setVStage] = useState(0);
  const cvvRef = useRef<HTMLInputElement>(null);
  const bank = issuer(card);
  const otpLeft = Math.max(0, Math.round((otpUntil - now) / 1000));
  const rial = total * 10;

  useEffect(() => {
    if (step !== "bank") return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      setLeft((v) => v - 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step === "bank" && left <= 0) onCancel("زمان مجاز پرداخت (۱۰ دقیقه) به پایان رسید.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, step]);

  useEffect(() => {
    if (step !== "verifying") return;
    setVStage(0);
    const t1 = window.setTimeout(() => setVStage(1), 800);
    const t2 = window.setTimeout(() => setVStage(2), 1600);
    const t3 = window.setTimeout(() => setVStage(3), 2400);
    const t4 = window.setTimeout(() => onFinish(card, bank), 3000);
    return () => [t1, t2, t3, t4].forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const requestOtp = () => {
    const e: Record<string, string> = {};
    if (card.length !== 16 || !luhn(card)) e.card = "برای دریافت رمز پویا، اول شماره کارت معتبر وارد کن";
    setErrs(e);
    if (Object.keys(e).length) return;
    setOtpCode(randDigits(6));
    setOtpUntil(Date.now() + 120_000);
    setNow(Date.now());
    setSms(true);
    setOtp("");
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (card.length !== 16) e.card = "شماره کارت باید ۱۶ رقم باشد";
    else if (!luhn(card)) e.card = "شماره کارت نامعتبر است";
    if (cvv.length < 3) e.cvv = "CVV2 را وارد کن";
    const m = Number(mm);
    if (mm.length !== 2 || m < 1 || m > 12 || yy.length !== 2) e.exp = "تاریخ انقضا نامعتبر است";
    else {
      const j = toJalali(new Date());
      if (Number(yy) * 100 + m < (j.jy % 100) * 100 + j.jm) e.exp = "کارت منقضی شده است";
    }
    if (onlyDigits(capIn) !== cap.code) e.cap = "کد امنیتی اشتباه است";
    if (!otpCode) e.otp = "ابتدا رمز پویا را دریافت کن";
    else if (otpLeft <= 0) e.otp = "رمز پویا منقضی شده؛ دوباره دریافت کن";
    else if (otp !== otpCode) e.otp = "رمز دوم پویا اشتباه است";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "ایمیل نامعتبر است";
    setErrs(e);
    if (e.cap) {
      setCap(newCaptcha());
      setCapIn("");
    }
    if (Object.keys(e).length === 0) onVerify();
  };

  const inputBase =
    "tnum h-11 w-full rounded-lg border bg-white px-3 text-center text-[14px] font-bold text-slate-800 outline-none transition focus:ring-2";
  const ring = (k: string) => (errs[k] ? "border-red-400 focus:ring-red-100" : "border-slate-300 focus:border-slate-500 focus:ring-slate-100");

  return (
    <div className="overlay-in fixed inset-0 z-[95] overflow-y-auto bg-slate-100 text-slate-800" dir="rtl">
      {/* top bar */}
      <div className="sticky top-0 z-10 shadow-sm" style={{ background: gw.color }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-[12px] font-black">{gw.bank.replace("بانک ", "").slice(0, 3)}</span>
            <div className="leading-tight">
              <b className="block text-[14.5px]">{gw.bank}</b>
              <span className="text-[10.5px] text-white/75">درگاه پرداخت اینترنتی {gw.psp} • شبکه شاپرک</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold sm:inline">محیط آزمایشی</span>
            {step === "bank" && (
              <span className="tnum flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[12px] font-bold" dir="ltr">
                <Clock size={13} /> {formatClock(Math.max(0, left))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SMS notification */}
      {sms && step === "bank" && (
        <div className="toast-in fixed left-1/2 top-3 z-20 w-[calc(100%-24px)] max-w-sm -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"><MessageSquare size={17} /></span>
            <div className="min-w-0 flex-1 text-[12px] leading-6">
              <b className="block text-[12.5px]">پیامک • {bank ? `بانک ${bank}` : gw.bank}</b>
              رمز دوم پویا خرید از <b>Revo sport</b> به مبلغ <b className="tnum">{fa(rial.toLocaleString("en-US"))}</b> ریال:
              <b className="tnum mx-1 text-[15px] tracking-[0.2em]" dir="ltr">{otpCode}</b>
              <span className="block text-[10.5px] text-slate-500">اعتبار: ۲ دقیقه — این رمز را در اختیار دیگران قرار ندهید.</span>
            </div>
            <button onClick={() => setSms(false)} className="text-slate-400" aria-label="بستن"><X size={15} /></button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-5">
        {step === "bank" && (
          <div className="grid gap-4 md:grid-cols-[1fr_300px]">
            {/* form */}
            <div className="order-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:order-1 sm:p-5">
              <b className="flex items-center gap-1.5 text-[14px]"><CreditCard size={17} style={{ color: gw.color }} /> اطلاعات کارت</b>

              <label className="mt-4 block">
                <span className="mb-1.5 flex items-center justify-between text-[12px] font-bold text-slate-600">
                  شماره کارت
                  {bank && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-black" style={{ background: gw.soft, color: gw.color }}>بانک {bank}</span>}
                </span>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={card.replace(/(\d{4})(?=\d)/g, "$1 - ")}
                  onChange={(e) => {
                    const v = onlyDigits(e.target.value).slice(0, 16);
                    setCard(v);
                    if (v.length === 16) cvvRef.current?.focus();
                  }}
                  placeholder="____ - ____ - ____ - ____"
                  className={`${inputBase} h-12 text-[16px] tracking-wider ${ring("card")}`}
                />
                {errs.card && <span className="mt-1 block text-[11px] font-bold text-red-500">{errs.card}</span>}
              </label>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-slate-600">CVV2</span>
                  <input ref={cvvRef} dir="ltr" inputMode="numeric" type="password" autoComplete="cc-csc" value={cvv} onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))} placeholder="•••" className={`${inputBase} ${ring("cvv")}`} />
                  {errs.cvv && <span className="mt-1 block text-[11px] font-bold text-red-500">{errs.cvv}</span>}
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-slate-600"><CalendarDays size={13} /> تاریخ انقضا</span>
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <input dir="ltr" inputMode="numeric" value={yy} onChange={(e) => setYy(onlyDigits(e.target.value).slice(0, 2))} placeholder="سال" className={`${inputBase} ${ring("exp")}`} />
                    <span className="text-slate-400">/</span>
                    <input dir="ltr" inputMode="numeric" value={mm} onChange={(e) => setMm(onlyDigits(e.target.value).slice(0, 2))} placeholder="ماه" className={`${inputBase} ${ring("exp")}`} />
                  </div>
                  {errs.exp && <span className="mt-1 block text-[11px] font-bold text-red-500">{errs.exp}</span>}
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-slate-600"><Hash size={13} /> کد امنیتی</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input dir="ltr" inputMode="numeric" value={capIn} onChange={(e) => setCapIn(onlyDigits(e.target.value).slice(0, 5))} placeholder="کد تصویر" className={`${inputBase} max-w-[150px] ${ring("cap")}`} />
                  <Captcha data={cap} onRefresh={() => { setCap(newCaptcha()); setCapIn(""); }} />
                </div>
                {errs.cap && <span className="mt-1 block text-[11px] font-bold text-red-500">{errs.cap}</span>}
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-slate-600"><KeyRound size={13} /> رمز دوم (پویا)</span>
                <div className="flex gap-2">
                  <input dir="ltr" inputMode="numeric" type="password" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(onlyDigits(e.target.value).slice(0, 8))} placeholder="••••••" className={`${inputBase} tracking-[0.3em] ${ring("otp")}`} />
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={otpLeft > 0}
                    className="shrink-0 rounded-lg px-3 text-[11.5px] font-black text-white transition disabled:opacity-60"
                    style={{ background: gw.color }}
                  >
                    {otpLeft > 0 ? <span className="tnum" dir="ltr">{formatClock(otpLeft)}</span> : otpCode ? "ارسال مجدد" : "دریافت رمز پویا"}
                  </button>
                </div>
                {errs.otp && <span className="mt-1 block text-[11px] font-bold text-red-500">{errs.otp}</span>}
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 flex items-center gap-1 text-[12px] font-bold text-slate-600"><Mail size={13} /> ایمیل (اختیاری)</span>
                <input dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${inputBase} text-left text-[13px] font-medium ${ring("email")}`} />
                {errs.email && <span className="mt-1 block text-[11px] font-bold text-red-500">{errs.email}</span>}
              </label>

              <div className="mt-5 flex gap-2">
                <button onClick={submit} className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl text-[14px] font-black text-white shadow-md transition active:scale-[0.98]" style={{ background: gw.color }}>
                  <Lock size={16} /> پرداخت
                </button>
                <button onClick={() => onCancel("پرداخت توسط شما لغو شد.")} className="h-12 flex-1 rounded-xl border border-slate-300 bg-white text-[13px] font-bold text-slate-600 transition hover:bg-slate-50">
                  انصراف
                </button>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-5 text-slate-500">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                محیط آزمایشی: شماره کارت ذخیره نمی‌شود و مبلغی کسر نمی‌گردد. رمز پویا به‌صورت پیامک شبیه‌سازی‌شده بالای صفحه نمایش داده می‌شود.
              </p>
            </div>

            {/* merchant info */}
            <div className="order-1 h-fit space-y-3 md:order-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <b className="text-[13px] text-slate-500">اطلاعات پذیرنده</b>
                <div className="mt-3 space-y-2 text-[12.5px]">
                  <Info k="نام پذیرنده" v="Revo sport" />
                  <Info k="فروشنده" v={merchantName} />
                  <Info k="بابت" v={`اشتراک ${planTitle}`} />
                  <Info k="شماره ترمینال" v={fa(terminal)} ltr />
                  <Info k="شماره سفارش" v={fa(orderId)} ltr />
                </div>
                <div className="mt-4 rounded-xl p-3 text-center" style={{ background: gw.soft }}>
                  <span className="text-[11px] font-bold text-slate-500">مبلغ قابل پرداخت</span>
                  <b className="tnum block text-[22px] font-black" style={{ color: gw.color }}>{fa(rial.toLocaleString("en-US"))} <span className="text-[12px]">ریال</span></b>
                  <span className="tnum text-[11px] text-slate-500">معادل {money(total)}</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-bold text-slate-500 shadow-sm">
                <ShieldCheck size={15} className="text-emerald-600" /> عضو شبکه شتاب و شاپرک
              </div>
            </div>
          </div>
        )}

        {step === "verifying" && (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <Loader2 size={40} className="mx-auto animate-spin" style={{ color: gw.color }} />
            <b className="mt-3 block text-[16px]">در حال پردازش تراکنش…</b>
            <p className="mt-1 text-[12px] text-slate-500">لطفاً صفحه را نبندید</p>
            <div className="mt-5 space-y-2.5 text-right">
              {["ارسال درخواست به شاپرک", `تأیید بانک صادرکننده${bank ? ` (${bank})` : ""}`, "بازگشت به سایت پذیرنده"].map((s, i) => (
                <div key={s} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${vStage > i ? "bg-emerald-500 text-white" : vStage === i ? "border-2 border-slate-400" : "border border-slate-200"}`}>
                    {vStage > i ? <Check size={13} strokeWidth={3} /> : vStage === i ? <Loader2 size={12} className="animate-spin text-slate-500" /> : null}
                  </span>
                  <span className={vStage >= i ? "font-bold text-slate-700" : "text-slate-400"}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "done" && receipt && (
          <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-emerald-600 p-5 text-center text-white">
              <CircleCheck size={46} className="pop mx-auto" />
              <b className="mt-2 block text-[17px]">تراکنش موفق</b>
              <span className="tnum text-[12px] text-white/85">{fa(rial.toLocaleString("en-US"))} ریال</span>
            </div>
            <div className="space-y-2 p-4 text-[12.5px]">
              <Info k="شماره پیگیری" v={receipt.ref} ltr copy />
              <Info k="شماره مرجع" v={fa(receipt.rrn)} ltr copy={receipt.rrn} />
              <Info k="شماره ترمینال" v={fa(receipt.terminal)} ltr />
              <Info k="شماره کارت" v={fa(receipt.card)} ltr />
              {receipt.bank && <Info k="بانک صادرکننده" v={`بانک ${receipt.bank}`} />}
              <Info k="درگاه" v={gw.psp} />
              <Info k="پذیرنده" v={`Revo sport — ${merchantName}`} />
              <Info k="تاریخ و ساعت" v={formatDateTime(receipt.at)} />
            </div>
            <div className="border-t border-dashed border-slate-200 p-4">
              <p className="mb-3 text-center text-[11.5px] text-slate-500">اشتراک {planTitle} فعال شد و به مربی اطلاع داده شد.</p>
              <button onClick={onClose} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-black text-white" style={{ background: gw.color }}>
                <ArrowRight size={16} /> بازگشت به Revo sport
              </button>
            </div>
          </div>
        )}

        {step === "canceled" && (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500"><AlertTriangle size={30} /></span>
            <b className="mt-3 block text-[16px]">تراکنش ناموفق</b>
            <p className="mt-1 text-[12.5px] text-slate-600">{cancelReason}</p>
            <p className="mt-1 text-[11.5px] text-slate-500">هیچ مبلغی از حساب شما کسر نشده است.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={onRetry} className="h-11 flex-1 rounded-xl text-[13px] font-black text-white" style={{ background: gw.color }}>تلاش مجدد</button>
              <button onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-300 text-[13px] font-bold text-slate-600">بازگشت</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ k, v, ltr, copy }: { k: string; v: string; ltr?: boolean; copy?: boolean | string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <b className="tnum truncate text-slate-800" dir={ltr ? "ltr" : undefined}>{v}</b>
        {copy && (
          <button
            onClick={async () => { await copyText(typeof copy === "string" ? copy : v); setOk(true); window.setTimeout(() => setOk(false), 1500); }}
            className="shrink-0 text-slate-400 hover:text-slate-600"
            aria-label={`کپی ${k}`}
          >
            {ok ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>
        )}
      </span>
    </div>
  );
}

function Row({ k, v, green }: { k: string; v: string; green?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-bg)] px-2 py-1.5">
      <span className="text-[var(--color-mute)]">{k}</span>
      <b className={`tnum truncate ${green ? "text-emerald-400" : ""}`}>{v}</b>
    </div>
  );
}
