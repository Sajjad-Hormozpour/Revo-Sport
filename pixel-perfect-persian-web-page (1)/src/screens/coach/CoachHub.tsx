import { useEffect, useState } from "react";
import { Sparkles, Plus, Check, X, Ban, Shield, Copy, CheckCheck, Users } from "lucide-react";
import { useStore } from "../../lib/store";
import { EXERCISES } from "../../data/library";
import { copyText, fa } from "../../lib/core";
import { dayKey, formatDateTime, formatRelative, localToIso, nowIso } from "../../lib/time";
import { daysSinceWorkout, liveSubStatus, programDaysLeft, weekLogCount } from "../../lib/metrics";
import { BrandBtn, Empty, Field, Pill, SearchBox, inputCls, money, subTone } from "../../components/ui";
import { ChatThread } from "../../components/chat";
import { calculateAdherence } from "../../lib/adherence";
import { trainingAnalytics } from "../../lib/training";
import type { CoachView } from "./CoachApp";

export default function CoachHub({
  view, onView, onToast,
}: {
  view: CoachView;
  onView: (v: CoachView, sid?: string) => void;
  onToast: (t: string, d: string) => void;
}) {
  if (view === "calendar") return <Calendar onToast={onToast} />;
  if (view === "chat") return <Chat onToast={onToast} />;
  if (view === "reports") return <Reports onView={onView} />;
  if (view === "ai") return <AI onToast={onToast} />;
  if (view === "billing") return <Billing onToast={onToast} />;
  if (view === "admin") return <Admin onToast={onToast} />;
  return <Empty text="این بخش را از منو انتخاب کن" />;
}

function useNames() {
  const { data, userById } = useStore();
  return (sid: string) => userById(data.students.find((s) => s.id === sid)?.userId ?? "")?.name ?? "شاگرد";
}

function Calendar({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, userById, addAppt, setApptStatus } = useStore();
  const name = useNames();
  const [title, setTitle] = useState("جلسه آنلاین");
  const [sid, setSid] = useState(data.students[0]?.id ?? "");
  const [date, setDate] = useState(dayKey());
  const [time, setTime] = useState("18:00");
  const [dur, setDur] = useState(30);
  const now = Date.now();
  const sorted = [...data.appts].sort((a, b) => (a.startAt || "").localeCompare(b.startAt || ""));
  const upcoming = sorted.filter((a) => a.status === "رزرو" && new Date(a.startAt).getTime() >= now - 3600_000);
  const past = sorted.filter((a) => !upcoming.includes(a));

  const Item = ({ a }: { a: (typeof sorted)[0] }) => (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] p-3">
      <div className="min-w-0">
        <b className="block text-[13px]">{a.title}</b>
        <span className="block text-[11.5px] text-[var(--color-mute)]">{name(a.studentId)} • {formatDateTime(a.startAt)} • {fa(a.duration)} دقیقه</span>
        <span className="text-[10.5px] text-[#e9e400]">{formatRelative(a.startAt)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Pill tone={a.status === "رزرو" ? "info" : a.status === "انجام‌شده" ? "ok" : "danger"}>{a.status}</Pill>
        {a.status === "رزرو" && (
          <>
            <button onClick={() => { setApptStatus(a.id, "انجام‌شده"); onToast("انجام شد", a.title); }} className="text-emerald-400" aria-label="انجام شد"><Check size={16} /></button>
            <button onClick={() => { setApptStatus(a.id, "لغو"); onToast("لغو شد", a.title); }} className="text-red-400" aria-label="لغو"><X size={16} /></button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="screen-in grid gap-3 lg:grid-cols-[1fr_330px]">
      <div className="space-y-3">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <b>جلسات پیش رو ({fa(upcoming.length)})</b>
          <div className="mt-3 space-y-2">
            {upcoming.length === 0 && <Empty text="جلسه‌ای رزرو نشده." />}
            {upcoming.map((a) => <Item key={a.id} a={a} />)}
          </div>
        </div>
        {past.length > 0 && (
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <b>سوابق جلسات</b>
            <div className="mt-3 space-y-2">{past.reverse().map((a) => <Item key={a.id} a={a} />)}</div>
          </div>
        )}
      </div>
      <div className="h-fit rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b>رزرو جلسه با زمان دقیق</b>
        <div className="mt-3 space-y-2">
          <Field label="عنوان"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="شاگرد">
            <select className={inputCls} value={sid} onChange={(e) => setSid(e.target.value)}>
              {data.students.map((s) => <option key={s.id} value={s.id}>{userById(s.userId)?.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="تاریخ"><input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="ساعت"><input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
          <Field label="مدت (دقیقه)"><input className={inputCls} type="number" value={dur} onChange={(e) => setDur(Number(e.target.value) || 30)} /></Field>
          <BrandBtn className="w-full" onClick={() => {
            if (!sid) return onToast("شاگرد نیست", "اول شاگرد اضافه کن");
            const startAt = localToIso(date, time);
            addAppt({ studentId: sid, title, date, time, startAt, duration: dur, status: "رزرو" });
            onToast("رزرو شد", formatDateTime(startAt));
          }}><Plus size={16} /> ثبت جلسه</BrandBtn>
        </div>
      </div>
    </div>
  );
}

function Chat({ onToast }: { onToast: (t: string, d: string) => void }) {
  void onToast;
  const { data, userById, markChatRead } = useStore();
  const [sid, setSid] = useState(data.students[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [openList, setOpenList] = useState(false);
  const msgs = data.messages.filter((m) => m.studentId === sid);
  const current = data.students.find((s) => s.id === sid);
  const currentUser = current ? userById(current.userId) : undefined;
  const totalUnread = data.messages.filter((m) => m.unread && m.from === "student").length;

  useEffect(() => {
    if (sid) markChatRead(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, msgs.length]);

  if (data.students.length === 0) return <Empty text="برای پیام دادن، اول شاگرد اضافه کن." />;

  const rows = data.students
    .map((s) => {
      const u = userById(s.userId);
      const last = [...data.messages].reverse().find((m) => m.studentId === s.id);
      const unread = data.messages.filter((m) => m.studentId === s.id && m.unread && m.from === "student").length;
      return { s, u, last, unread };
    })
    .filter((r) => !q.trim() || (r.u?.name ?? "").includes(q.trim()))
    .sort((a, b) => (b.last?.time ?? "").localeCompare(a.last?.time ?? ""));

  const list = (
    <div className="noscroll h-full min-h-0 overflow-y-auto p-2">
      <div className="mb-2 px-1"><SearchBox value={q} onChange={setQ} placeholder="جستجوی شاگرد…" /></div>
      {rows.length === 0 && <p className="p-4 text-center text-[12px] text-[var(--color-mute)]">موردی پیدا نشد</p>}
      {rows.map(({ s, u, last, unread }) => (
        <button
          key={s.id}
          onClick={() => { setSid(s.id); markChatRead(s.id); setOpenList(false); }}
          className={`press mb-1 flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-right transition ${sid === s.id ? "bg-[#e9e400]/15 ring-1 ring-[#e9e400]/30" : "hover:bg-[var(--color-bg)]"}`}
        >
          <img src={u?.avatar} className="h-11 w-11 shrink-0 rounded-full object-cover" alt="" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <b className="truncate text-[12.5px]">{u?.name}</b>
              {last && <span className="shrink-0 text-[9.5px] text-[var(--color-mute)]">{formatRelative(last.time)}</span>}
            </span>
            <span className="mt-0.5 flex items-center gap-1">
              {last?.from === "coach" && <CheckCheck size={12} className="shrink-0 text-[var(--color-mute)]" />}
              <span className={`truncate text-[11px] ${unread ? "font-bold text-[var(--color-ink)]" : "text-[var(--color-mute)]"}`}>{last?.text ?? "بدون پیام"}</span>
            </span>
          </span>
          {unread > 0 && <span className="tnum shrink-0 rounded-full bg-[#e9e400] px-1.5 py-0.5 text-[10px] font-black text-black">{fa(unread)}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen-in flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-3">
      <div className="hidden min-h-0 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] lg:block">{list}</div>

      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-[var(--color-line)] bg-[var(--color-card)] lg:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line)] p-2.5 sm:gap-2.5 sm:p-3">
          <button onClick={() => setOpenList(true)} className="press flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-bg)] px-2.5 text-[11.5px] font-bold lg:hidden" aria-label="فهرست گفتگوها">
            <Users size={16} /> <span className="hidden min-[360px]:inline">گفتگوها</span>
            {totalUnread > 0 && <span className="tnum rounded-full bg-[#e9e400] px-1.5 text-[10px] text-black">{fa(totalUnread)}</span>}
          </button>
          <img src={currentUser?.avatar} className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10" alt="" />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px]">{currentUser?.name}</b>
            <span className="block truncate text-[10.5px] text-[var(--color-mute)]">
              {current ? `${current.goal} • ${current.level}` : ""} • آخرین ورود {formatRelative(currentUser?.lastLoginAt ?? "")}
            </span>
          </div>
          <span className="tnum hidden shrink-0 text-[10.5px] text-[var(--color-mute)] sm:block">{fa(msgs.length)} پیام</span>
        </div>

        {sid && (
          <ChatThread
            key={sid}
            studentId={sid}
            me="coach"
            peerName={currentUser?.name ?? "شاگرد"}
            peerAvatar={currentUser?.avatar}
            placeholder="پیام به شاگرد…"
            compact
          />
        )}
      </div>

      {openList && (
        <div className="overlay-in fixed inset-0 z-[80] flex bg-black/60 lg:hidden" onClick={() => setOpenList(false)}>
          <div className="drawer-in mr-auto flex h-full w-[min(88vw,360px)] flex-col bg-[var(--color-card)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] p-3">
              <b className="text-[13.5px]">گفتگوها</b>
              <button onClick={() => setOpenList(false)} aria-label="بستن"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1">{list}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Reports({ onView }: { onView: (v: CoachView, sid?: string) => void }) {
  const { data, userById } = useStore();
  const paid = data.invoices.filter((i) => i.status === "پرداخت‌شده").reduce((a, b) => a + b.amount, 0);
  const totalLogs = data.logs.length;
  const totalMin = data.logs.reduce((a, l) => a + l.durationMin, 0);
  const allSets = data.logs.reduce((a, l) => a + l.items.reduce((x, i) => x + i.sets.length, 0), 0);
  const doneSets = data.logs.reduce((a, l) => a + l.items.reduce((x, i) => x + i.sets.filter((s) => s.done).length, 0), 0);
  const completion = allSets ? Math.round((doneSets / allSets) * 100) : 0;
  return (
    <div className="screen-in space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["درآمد پرداخت‌شده", money(paid)],
          ["نرخ تکمیل ست‌ها", `${fa(completion)}٪`],
          ["کل تمرین‌های ثبت‌شده", fa(totalLogs)],
          ["کل دقایق تمرین", fa(totalMin)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <p className="text-[11px] text-[var(--color-mute)]">{l}</p>
            <p className="tnum mt-1 text-[16px] font-black">{v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b>گزارش هر شاگرد</b>
        {data.students.length === 0 && <p className="mt-2 text-[12px] text-[var(--color-mute)]">شاگردی نیست.</p>}
        <div className="mt-3 space-y-2">
          {data.students.map((s) => {
            const pr = [...data.progress.filter((p) => p.studentId === s.id)].sort((a, b) => a.date.localeCompare(b.date));
            const delta = pr.length >= 2 ? +(pr[pr.length - 1].weight - pr[0].weight).toFixed(1) : 0;
            const logs = data.logs.filter((l) => l.studentId === s.id).length;
            const idle = daysSinceWorkout(data, s.id);
            const adherence = calculateAdherence(data, s.id);
            const training = trainingAnalytics(data, s.id);
            return (
              <button key={s.id} onClick={() => onView("student", s.id)} className="press flex w-full items-center gap-3 rounded-xl bg-[var(--color-bg)] p-3 text-right">
                <img src={userById(s.userId)?.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
                <span className="min-w-0 flex-1">
                  <b className="block text-[13px]">{userById(s.userId)?.name}</b>
                  <span className="tnum text-[11px] text-[var(--color-mute)]">
                    {fa(logs)} تمرین • این هفته {fa(weekLogCount(data, s.id))} • {idle === null ? "هنوز تمرین نکرده" : `آخرین تمرین ${fa(idle)} روز پیش`}
                  </span>
                  <span className="tnum block text-[10px] text-[#e9e400]">پایبندی: {adherence.overall === null ? "—" : `${fa(adherence.overall)}٪`} • حجم تمرین: {fa(Math.round(training.volume))} kg • PR: {fa(training.records.length)}</span>
                </span>
                <span className={`tnum text-[13px] font-black ${delta < 0 ? "text-emerald-400" : delta > 0 ? "text-sky-400" : "text-[var(--color-mute)]"}`}>{delta ? `${fa(delta)} کیلو` : "—"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AI({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, userById } = useStore();
  const [sid, setSid] = useState(data.students[0]?.id ?? "");
  const [q, setQ] = useState("وضعیت این شاگرد را تحلیل کن و یک برنامه پیشنهاد بده.");
  const [out, setOut] = useState("");

  const ask = () => {
    const st = data.students.find((s) => s.id === sid);
    if (!st) {
      const alerts = data.students.filter((s) => (daysSinceWorkout(data, s.id) ?? 99) >= 3).length;
      setOut(`خلاصه کل: ${fa(data.students.length)} شاگرد، ${fa(alerts)} نفر بیش از ۳ روز تمرین نکرده‌اند، ${fa(data.programs.filter((p) => programDaysLeft(p.endDate) <= 7).length)} برنامه رو به اتمام.`);
      return;
    }
    const name = userById(st.userId)?.name ?? "شاگرد";
    const idle = daysSinceWorkout(data, st.id);
    const logs = data.logs.filter((l) => l.studentId === st.id);
    const prog = data.programs.find((p) => p.studentId === st.id && p.status !== "تمام‌شده");
    const days = st.assessment.daysPerWeek || 3;
    const focus = ["سینه + پشت بازو", "پشت + جلو بازو", "پا + باسن", "شانه + شکم", "تمام بدن"];
    const byMuscle = (m: string) => EXERCISES.filter((e) => e.muscle === m).slice(0, 2).map((e) => e.name).join("، ");
    const muscles = [["سینه", "پشت بازو"], ["پشت", "جلو بازو"], ["پا", "باسن"], ["شانه", "شکم"], ["تمام بدن", "شکم"]];
    const plan = Array.from({ length: Math.min(days, 5) })
      .map((_, i) => `• روز ${fa(i + 1)} (${focus[i]}): ${byMuscle(muscles[i][0])}${byMuscle(muscles[i][1]) ? "، " + byMuscle(muscles[i][1]) : ""} — ۳ تا ۴ ست × ۸–۱۲ تکرار`)
      .join("\n");
    setOut(
      `تحلیل ${name} (${formatDateTime(nowIso())}):\n` +
      `• هدف: ${st.goal} • سطح: ${st.level} • ${fa(st.weight)} کیلو / ${fa(st.height)} سانتی‌متر\n` +
      `• تمرین‌های ثبت‌شده: ${fa(logs.length)} • ${idle === null ? "هنوز هیچ تمرینی ثبت نکرده" : `آخرین تمرین ${fa(idle)} روز پیش`}\n` +
      `• اشتراک: ${liveSubStatus(st)}\n` +
      `• برنامه فعلی: ${prog ? prog.name : "ندارد"}\n` +
      `• محدودیت: ${st.assessment.limitations || "ثبت نشده"}\n\n` +
      `پیشنهاد پیش‌نویس ${fa(days)} روزه:\n${plan}\n\n` +
      `${idle !== null && idle >= 3 ? "⚠️ پیشنهاد: یک پیام انگیزشی بفرست و جلسه چک‌آپ بگذار.\n" : ""}` +
      `این فقط پیشنهاد است؛ از «برنامه‌های تمرینی» بررسی و تأیید کن.`
    );
    onToast("پاسخ دستیار آماده شد", "قابل ویرایش توسط تو");
  };

  return (
    <div className="screen-in mx-auto max-w-2xl">
      <div className="rounded-2xl border border-[#e9e400]/30 bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-2 text-[#e9e400]"><Sparkles size={18} /><b>دستیار هوشمند مربی</b></div>
        <p className="mt-2 text-[12.5px] leading-7 text-[var(--color-mute)]">بر اساس داده‌های واقعی شاگردانت تحلیل می‌کند. هیچ چیزی خودکار برای شاگرد ارسال نمی‌شود.</p>
        <Field label="شاگرد">
          <select className={inputCls} value={sid} onChange={(e) => setSid(e.target.value)}>
            <option value="">— همه شاگردان —</option>
            {data.students.map((s) => <option key={s.id} value={s.id}>{userById(s.userId)?.name}</option>)}
          </select>
        </Field>
        <textarea className={`${inputCls} mt-3 h-20 py-3`} value={q} onChange={(e) => setQ(e.target.value)} />
        <BrandBtn className="mt-3" onClick={ask}><Sparkles size={16} /> تحلیل کن</BrandBtn>
        {out && (
          <div className="mt-4">
            <pre className="whitespace-pre-wrap rounded-2xl bg-[var(--color-bg)] p-4 text-[13px] leading-7">{out}</pre>
            <button onClick={async () => onToast((await copyText(out)) ? "کپی شد" : "کپی نشد", "")} className="press mt-2 flex items-center gap-1 text-[12px] font-bold text-[#e9e400]"><Copy size={13} /> کپی متن</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Billing({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, userById, addInvoice, setInvoiceStatus } = useStore();
  const name = useNames();
  const [sid, setSid] = useState(data.students[0]?.id ?? "");
  const [plan, setPlan] = useState("کوچینگ آنلاین ماهانه");
  const [amount, setAmount] = useState(2500000);
  const [coupon, setCoupon] = useState("");
  const discount = coupon.trim() ? 0.1 : 0;
  const final = Math.round(amount * (1 - discount));

  return (
    <div className="screen-in grid gap-3 lg:grid-cols-[1fr_320px]">
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)]">
        <table className="w-full min-w-[560px] text-right text-[12.5px]">
          <thead className="bg-[var(--color-card)]"><tr>{["شاگرد", "سرویس", "مبلغ", "تاریخ", "وضعیت", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>
            {data.invoices.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[var(--color-mute)]">فاکتوری صادر نشده.</td></tr>}
            {[...data.invoices].reverse().map((i) => (
              <tr key={i.id} className="border-t border-[var(--color-line)]">
                <td className="p-3">{name(i.studentId)}</td>
                <td className="p-3">{i.plan} {i.coupon && <Pill tone="brand">{i.coupon}</Pill>}</td>
                <td className="p-3">{money(i.amount)}</td>
                <td className="p-3">{formatDateTime(i.date)}</td>
                <td className="p-3"><Pill tone={i.status === "پرداخت‌شده" ? "ok" : i.status === "در انتظار" ? "warn" : "danger"}>{i.status}</Pill></td>
                <td className="p-3">
                  {i.status === "در انتظار" && (
                    <button onClick={() => { setInvoiceStatus(i.id, "پرداخت‌شده"); onToast("پرداخت ثبت شد", ""); }} className="text-[11.5px] font-black text-[#e9e400]">ثبت پرداخت</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-fit rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b>صدور فاکتور</b>
        <div className="mt-3 space-y-2">
          <Field label="شاگرد">
            <select className={inputCls} value={sid} onChange={(e) => setSid(e.target.value)}>
              {data.students.map((s) => <option key={s.id} value={s.id}>{userById(s.userId)?.name}</option>)}
            </select>
          </Field>
          <Field label="سرویس">
            <select className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {["کوچینگ آنلاین ماهانه", "کوچینگ سه‌ماهه", "برنامه تمرینی", "جلسات حضوری", "تمدید اشتراک"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="مبلغ (تومان)"><input className={inputCls} type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} /></Field>
          <Field label="کد تخفیف (۱۰٪)"><input className={inputCls} value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} dir="ltr" /></Field>
          <p className="text-[12px]">مبلغ نهایی: <b className="text-[#e9e400]">{money(final)}</b></p>
          <BrandBtn className="w-full" onClick={() => {
            if (!sid) return onToast("شاگرد نیست", "");
            addInvoice({ studentId: sid, plan, amount: final, date: nowIso(), status: "در انتظار", coupon: coupon || undefined });
            onToast("فاکتور صادر شد", formatDateTime(nowIso()));
          }}>صدور فاکتور</BrandBtn>
        </div>
      </div>
    </div>
  );
}

function Admin({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, setStudentStatus } = useStore();
  const coaches = data.users.filter((u) => u.role === "coach");
  return (
    <div className="screen-in space-y-3">
      <div className="flex items-center gap-2"><Shield size={18} className="text-[#e9e400]" /><h2 className="text-[18px] font-black">مدیریت سیستم</h2></div>
      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ["کاربران", data.users.length],
          ["مربیان", coaches.length],
          ["شاگردان", data.students.length],
          ["تمرین‌های ثبت‌شده", data.logs.length],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl bg-[var(--color-card)] p-4"><p className="text-[11px] text-[var(--color-mute)]">{l as string}</p><p className="tnum text-[22px] font-black">{fa(v as number)}</p></div>
        ))}
      </div>
      <div className="rounded-2xl bg-[var(--color-card)] p-4">
        <b>مربیان و تعداد شاگرد</b>
        {coaches.map((c) => (
          <div key={c.id} className="mt-2 flex items-center justify-between rounded-xl bg-[var(--color-bg)] p-2.5 text-[12.5px]">
            <span>{c.name} <span className="text-[var(--color-mute)]" dir="ltr">({c.inviteCode})</span></span>
            <b className="tnum">{fa(data.students.filter((s) => s.coachId === c.id).length)} شاگرد</b>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-[var(--color-card)] p-4">
        <b>همه کاربران</b>
        {data.users.map((u) => {
          const st = data.students.find((s) => s.userId === u.id);
          return (
            <div key={u.id} className="mt-2 flex items-center justify-between rounded-xl bg-[var(--color-bg)] p-2.5">
              <span className="flex items-center gap-2">
                <img src={u.avatar} className="h-8 w-8 rounded-full object-cover" alt="" />
                <span><b className="block text-[13px]">{u.name}</b><span className="text-[11px] text-[var(--color-mute)]">{u.role} • {u.email}</span></span>
              </span>
              {st && (
                <span className="flex items-center gap-2">
                  <Pill tone={subTone(liveSubStatus(st))}>{liveSubStatus(st)}</Pill>
                  <button onClick={() => { setStudentStatus(st.id, st.status === "active" ? "inactive" : "active"); onToast("وضعیت کاربر عوض شد", u.name); }} className="text-[var(--color-mute)]" aria-label="تغییر وضعیت"><Ban size={16} /></button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
