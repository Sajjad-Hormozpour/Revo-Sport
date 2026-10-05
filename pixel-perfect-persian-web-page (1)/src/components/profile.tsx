import { useEffect, useRef, useState } from "react";
import { Camera, Copy, Crop, KeyRound, Mail, Phone, Save, Share2, ShieldCheck, User as UserIcon, Ruler, Scale } from "lucide-react";
import { useStore, DEFAULT_AVATAR } from "../lib/store";
import type { GoalKind } from "../data/types";
import { copyText, fa } from "../lib/core";
import { formatDateTime, formatRelative } from "../lib/time";
import { BrandBtn, Field, Modal, inputCls } from "./ui";
import ImageCropper from "./cropper";

const GOALS: GoalKind[] = ["عضله‌سازی", "کاهش وزن", "چربی‌سوزی", "افزایش قدرت", "فیتنس", "افزایش استقامت", "تغییر ترکیب بدنی"];

export function passwordStrength(p: string): { score: number; label: string; color: string } {
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const score = Math.min(4, s);
  const labels = ["خیلی ضعیف", "ضعیف", "متوسط", "خوب", "قوی"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
  return { score, label: labels[score], color: colors[score] };
}

export function StrengthBar({ value }: { value: string }) {
  const st = passwordStrength(value);
  if (!value) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1" dir="ltr">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i < Math.max(1, st.score) ? st.color : "var(--color-line)" }} />
        ))}
      </div>
      <p className="mt-1 text-[11px] font-bold" style={{ color: st.color }}>قدرت رمز: {st.label}</p>
    </div>
  );
}

export function InviteCard({ compact = false, onToast }: { compact?: boolean; onToast: (t: string, d: string) => void }) {
  const { myInvite, userById, session } = useStore();
  const code = myInvite();
  const me = session ? userById(session.userId) : undefined;
  if (!code) return null;
  const msg = `سلام! برای عضویت در برنامه تمرینی من در Revo sport، هنگام ثبت‌نام این کد مربی را وارد کن: ${code}\n${window.location.origin}${window.location.pathname}`;
  return (
    <div className={`rounded-2xl border border-[#e9e400]/30 bg-gradient-to-br from-[#e9e400]/15 to-transparent ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-[var(--color-mute)]">کد مربی (دائمی)</p>
          <p dir="ltr" className={`font-black tracking-[0.3em] text-[#e9e400] ${compact ? "text-[17px]" : "text-[24px]"}`}>{code}</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={async () => onToast((await copyText(code)) ? "کد کپی شد" : "کپی نشد", "به شاگردت بده تا با آن ثبت‌نام کند")}
            className="press flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9e400] text-black"
            aria-label="کپی کد"
          >
            <Copy size={15} />
          </button>
          {!compact && (
            <button
              onClick={async () => onToast((await copyText(msg)) ? "پیام دعوت کپی شد" : "کپی نشد", "در واتس‌اپ یا تلگرام برای شاگرد بفرست")}
              className="press flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"
              aria-label="کپی پیام دعوت"
            >
              <Share2 size={15} />
            </button>
          )}
        </div>
      </div>
      {!compact && (
        <p className="mt-2 text-[11.5px] leading-6 text-[var(--color-mute)]">
          این کد مخصوص {me?.name ?? "شما"} است و هیچ‌وقت عوض یا پاک نمی‌شود. شاگرد با وارد کردنش فقط به پنل شما وصل می‌شود.
        </p>
      )}
    </div>
  );
}

export function ProfileEditor({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { session, userById, updateProfile, changePassword, studentOf, updateMyStudent } = useStore();
  const me = userById(session!.userId)!;
  const st = session?.role === "student" ? studentOf() : undefined;
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [phone, setPhone] = useState(me.phone);
  const [avatar, setAvatar] = useState(me.avatar || DEFAULT_AVATAR);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [age, setAge] = useState(String(st?.age ?? ""));
  const [gender, setGender] = useState<"مرد" | "زن">(st?.gender ?? "مرد");
  const [height, setHeight] = useState(String(st?.height ?? ""));
  const [weight, setWeight] = useState(String(st?.weight ?? ""));
  const [goal, setGoal] = useState<GoalKind>(st?.goal ?? "فیتنس");
  const [limits, setLimits] = useState(st?.assessment.limitations ?? "");
  const [days, setDays] = useState(String(st?.assessment.daysPerWeek ?? 3));
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [pErr, setPErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const closeCropper = () => {
    setCropSrc(null);
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return onToast("فایل معتبر نیست", "یک عکس انتخاب کن");
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(f);
    objectUrl.current = url;
    setCropSrc(url);
  };

  const saveInfo = () => {
    setErr("");
    const e = updateProfile({ name: name.trim(), email, phone: phone.trim(), avatar });
    if (e) return setErr(e);
    if (st) {
      updateMyStudent({
        age: Number(age) || st.age,
        gender,
        height: Number(height) || st.height,
        weight: Number(weight) || st.weight,
        goal,
        assessment: { ...st.assessment, mainGoal: goal, limitations: limits, daysPerWeek: Number(days) || st.assessment.daysPerWeek },
      });
    }
    onToast("پروفایل ذخیره شد", formatDateTime(new Date()));
  };

  const savePass = async () => {
    setPErr("");
    if (next !== confirm) return setPErr("تکرار رمز با رمز جدید یکی نیست");
    const e = await Promise.resolve(changePassword(cur, next));
    if (e) return setPErr(e);
    setCur("");
    setNext("");
    setConfirm("");
    onToast("رمز عبور تغییر کرد", "دفعه بعد با رمز جدید وارد شو");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <div className="relative shrink-0">
          <img src={avatar} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#e9e400]/50" />
          <button
            onClick={() => fileRef.current?.click()}
            className="press absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#e9e400] text-black shadow"
            aria-label="تغییر عکس"
          >
            <Camera size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[17px] font-black">{me.name}</b>
          <p className="truncate text-[12px] text-[var(--color-mute)]" dir="ltr" style={{ textAlign: "right" }}>{me.email}</p>
          <p className="mt-1 text-[11px] text-[var(--color-mute)]">
            عضو از {formatDateTime(me.createdAt)} • آخرین ورود {formatRelative(me.lastLoginAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={() => fileRef.current?.click()} className="press flex items-center gap-1 rounded-full bg-[#e9e400] px-3 py-1.5 text-[11px] font-black text-black">
              <Camera size={12} /> عکس جدید
            </button>
            {avatar.startsWith("data:") && (
              <button onClick={() => setCropSrc(avatar)} className="press flex items-center gap-1 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[11px] font-bold">
                <Crop size={12} /> ویرایش و برش
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b className="mb-3 flex items-center gap-1.5 text-[14px]"><UserIcon size={16} className="text-[#e9e400]" /> اطلاعات حساب</b>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام و نام خانوادگی"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="ایمیل">
            <div className="relative">
              <Mail size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]" />
              <input className={`${inputCls} pr-9`} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
          </Field>
          <Field label="موبایل">
            <div className="relative">
              <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]" />
              <input className={`${inputCls} pr-9`} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="09xxxxxxxxx" />
            </div>
          </Field>
          <Field label="لینک عکس (اختیاری)">
            <input className={inputCls} value={avatar.startsWith("data:") ? "عکس آپلود شده" : avatar} onChange={(e) => setAvatar(e.target.value)} dir="ltr" disabled={avatar.startsWith("data:")} />
          </Field>
        </div>

        {st && (
          <>
            <b className="mb-3 mt-5 flex items-center gap-1.5 text-[14px]"><Ruler size={16} className="text-[#e9e400]" /> اطلاعات بدنی و هدف</b>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="سن"><input className={inputCls} type="number" value={age} onChange={(e) => setAge(e.target.value)} /></Field>
              <Field label="جنسیت">
                <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as "مرد" | "زن")}><option>مرد</option><option>زن</option></select>
              </Field>
              <Field label="قد (سانتی‌متر)"><input className={inputCls} type="number" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
              <Field label="وزن (کیلو)">
                <div className="relative">
                  <Scale size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]" />
                  <input className={`${inputCls} pr-8`} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
              </Field>
              <Field label="هدف">
                <select className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value as GoalKind)}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select>
              </Field>
              <Field label="روز تمرین در هفته"><input className={inputCls} type="number" min={1} max={7} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
              <div className="col-span-2">
                <Field label="آسیب یا محدودیت"><input className={inputCls} value={limits} onChange={(e) => setLimits(e.target.value)} placeholder="مثلاً درد زانو" /></Field>
              </div>
            </div>
          </>
        )}
        {err && <p className="mt-3 text-[12px] font-bold text-red-400">{err}</p>}
        <BrandBtn className="mt-4 w-full sm:w-auto" onClick={saveInfo}><Save size={15} /> ذخیره تغییرات</BrandBtn>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b className="mb-3 flex items-center gap-1.5 text-[14px]"><KeyRound size={16} className="text-[#e9e400]" /> تغییر رمز عبور</b>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="رمز فعلی"><input className={inputCls} type="password" value={cur} onChange={(e) => setCur(e.target.value)} dir="ltr" autoComplete="current-password" /></Field>
          <Field label="رمز جدید">
            <input className={inputCls} type="password" value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" autoComplete="new-password" />
            <StrengthBar value={next} />
          </Field>
          <Field label="تکرار رمز جدید"><input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" autoComplete="new-password" /></Field>
        </div>
        {pErr && <p className="mt-2 text-[12px] font-bold text-red-400">{pErr}</p>}
        <button onClick={savePass} className="press mt-3 flex h-11 items-center gap-2 rounded-full border border-[var(--color-line)] px-5 text-[13px] font-extrabold">
          <ShieldCheck size={15} className="text-[#e9e400]" /> به‌روزرسانی رمز
        </button>
        <p className="mt-2 text-[11px] text-[var(--color-mute)]">{fa(4)} کاراکتر حداقل — ترکیب عدد و حروف امن‌تر است.</p>
      </div>

      <Modal open={!!cropSrc} onClose={closeCropper} title="ویرایش عکس پروفایل">
        {cropSrc && (
          <ImageCropper
            key={cropSrc}
            src={cropSrc}
            onCancel={closeCropper}
            onSave={(dataUrl) => {
              setAvatar(dataUrl);
              const e = updateProfile({ avatar: dataUrl });
              closeCropper();
              if (e) onToast("ذخیره نشد", e);
              else onToast("عکس پروفایل ذخیره شد", formatDateTime(new Date()));
            }}
          />
        )}
      </Modal>
    </div>
  );
}
