import { currentLanguage, localize, localizeStatic } from "../../i18n";
import { useState } from "react";
import { ClipboardCheck, Save } from "lucide-react";
import { useStore } from "../lib/store";
import type { WeeklyCheckin } from "../data/types";
import { fa, uid } from "../lib/core";
import { dayKey, formatDateTime, startOfWeek, nowIso } from "../lib/time";
import { BrandBtn, Empty, Field, Pill, inputCls } from "./ui";

const ratings = [
  ["energy", "انرژی"], ["stress", "استرس"], ["hunger", "گرسنگی"],
  ["difficulty", "سختی تمرین"], ["soreness", "کوفتگی"],
] as const;

export function StudentCheckin({ studentId, onToast }: { studentId: string; onToast: (title: string, detail: string) => void }) {
  const { data, saveCheckin } = useStore();
  const week = dayKey(startOfWeek());
  const previous = data.checkins.find((c) => c.studentId === studentId && c.weekStart === week);
  const [entry, setEntry] = useState<WeeklyCheckin>(() => previous || { id: uid("check"), studentId, weekStart: week, submittedAt: nowIso(), weight: 70,
    energy: 5, sleep: 7, stress: 5, hunger: 5, difficulty: 5, nutritionAdherence: 0, feeling: "", soreness: 5, notes: "", status: "pending" });
  const set = (patch: Partial<WeeklyCheckin>) => setEntry((e) => ({ ...e, ...patch }));
  return <div className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
    <div className="flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-[14px] font-black"><ClipboardCheck size={16} className="text-[#e9e400]" />{localizeStatic(" چک‌این هفتگی")}</h3>{localize(previous && <Pill tone={previous.status === "approved" ? "ok" : previous.status === "changes_requested" ? "warn" : "info"}>{localize(previous.status === "approved" ? "تأیید شد" : previous.status === "changes_requested" ? "نیاز به اصلاح" : "در انتظار مربی")}</Pill>)}</div>
    <p className="text-[11.5px] text-[var(--color-mute)]">{localizeStatic("هفته شروع‌شده از ")}{localize(week)}{localizeStatic(" • هر هفته یک‌بار ثبت می‌شود.")}</p>
    {localize(previous?.coachNote && <p className="rounded-xl bg-[#e9e400]/10 p-2 text-[12px]">{localizeStatic("نظر مربی: ")}{previous.coachNote}</p>)}
    {localize(previous?.status === "approved" ? <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("این چک‌این بررسی و تأیید شده است.")}</p> : <>
      <div className="grid grid-cols-2 gap-2"><Field label={localizeStatic("وزن (کیلو)")}><input type="number" min="20" max="400" step="0.1" className={inputCls} value={entry.weight} onChange={(e) => set({weight:Number(e.target.value)})}/></Field><Field label={localizeStatic("خواب (ساعت)")}><input type="number" min="0" max="24" step="0.5" className={inputCls} value={entry.sleep} onChange={(e) => set({sleep:Number(e.target.value)})}/></Field></div>
      <div className="grid grid-cols-2 gap-2">{localize(ratings.map(([key,label]) => <Field key={key} label={`${localize(label)} (${currentLanguage() === "fa" ? "۱ تا ۱۰" : "1 to 10"})`}><input type="number" min="1" max="10" className={inputCls} value={entry[key]} onChange={(e) => set({[key]:Number(e.target.value)})}/></Field>))}</div>
      <Field label={localizeStatic("پایبندی تغذیه (درصد)")}><input type="number" min="0" max="100" className={inputCls} value={entry.nutritionAdherence} onChange={(e) => set({nutritionAdherence:Number(e.target.value)})}/></Field>
      <Field label={localizeStatic("حال کلی")}><input className={inputCls} value={entry.feeling} onChange={(e) => set({feeling:e.target.value})} placeholder={localizeStatic("این هفته چه حسی داشتی؟")} /></Field>
      <Field label={localizeStatic("توضیحات برای مربی")}><textarea className={`${inputCls} h-20 py-2`} value={entry.notes} onChange={(e) => set({notes:e.target.value})} /></Field>
      <BrandBtn className="w-full" onClick={() => { if (!Number.isFinite(entry.weight) || entry.weight < 20 || entry.weight > 400 || ratings.some(([k]) => entry[k] < 1 || entry[k] > 10)) return onToast("اعداد را بررسی کن", ""); saveCheckin(entry); onToast("چک‌این ارسال شد", "مربی می‌تواند آن را بررسی کند"); }}><Save size={15}/>{localizeStatic("ارسال چک‌این")}</BrandBtn>
    </>)}
  </div>;
}

export function CoachCheckins({ studentId, onToast }: { studentId: string; onToast: (title: string, detail: string) => void }) {
  const { data, reviewCheckin } = useStore();
  const [notes, setNotes] = useState<Record<string,string>>({});
  const entries = data.checkins.filter((c) => c.studentId === studentId).sort((a,b) => b.weekStart.localeCompare(a.weekStart));
  if (!entries.length) return <Empty text="هنوز چک‌این هفتگی ثبت نشده است." />;
  return <div className="space-y-2">{localize(entries.map((c) => <section key={c.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3">
    <div className="flex items-center justify-between"><b className="text-[13px]">{localizeStatic("هفته ")}{localize(c.weekStart)}</b><Pill tone={c.status === "approved" ? "ok" : c.status === "changes_requested" ? "warn" : "info"}>{localize(c.status === "approved" ? "تأیید" : c.status === "changes_requested" ? "اصلاح" : "در انتظار")}</Pill></div>
    <p className="mt-1 text-[11px] text-[var(--color-mute)]">{localizeStatic("ثبت: ")}{localize(formatDateTime(c.submittedAt))}</p>
    <div className="mt-2 grid grid-cols-2 gap-1 text-[12px] sm:grid-cols-4"><span>{localizeStatic("وزن: ")}{localize(fa(c.weight))}{localizeStatic(" کیلو")}</span><span>{localizeStatic("خواب: ")}{localize(fa(c.sleep))}{localizeStatic(" ساعت")}</span>{localize(ratings.map(([k,label]) => <span key={k}>{localize(label)}: {localize(fa(c[k]))}{localizeStatic("/۱۰")}</span>))}<span>{localizeStatic("تغذیه: ")}{localize(fa(c.nutritionAdherence))}{localizeStatic("٪")}</span></div>
    {localize(c.feeling && <p className="mt-2 text-[12px]">{localizeStatic("حال کلی: ")}{c.feeling}</p>)}{localize(c.notes && <p className="mt-1 text-[12px] text-[var(--color-mute)]">{localizeStatic("یادداشت شاگرد: ")}{c.notes}</p>)}
    <Field label={localizeStatic("یادداشت مربی")}><textarea className={`${inputCls} mt-1 h-16 py-2`} value={notes[c.id] ?? c.coachNote ?? ""} onChange={(e) => setNotes((n) => ({...n,[c.id]:e.target.value}))}/></Field>
    <div className="mt-2 flex flex-wrap gap-2">{localize(([['approved','تأیید'],['changes_requested','درخواست اصلاح'],['pending','در حال بررسی']] as const).map(([status,label]) => <button key={status} onClick={() => {reviewCheckin(c.id,status,notes[c.id] ?? c.coachNote ?? "");onToast("وضعیت ثبت شد",label);}} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${status === 'approved' ? 'bg-[#e9e400] text-black' : 'border border-[var(--color-line)]'}`}>{localize(label)}</button>))}</div>
  </section>))}</div>;
}