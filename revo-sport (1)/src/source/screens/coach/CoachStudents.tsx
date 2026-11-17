import { localize, localizeStatic } from "../../../i18n";
import { useState, type ReactNode } from "react";
import {
  Plus, Pencil, Trash2, Ban, ChevronLeft, Save, Dumbbell, History, LineChart, MessageCircle,
  User as UserIcon, Flame, Trophy, Moon, Timer, Target, Mail, Phone, ChevronDown, CheckCircle, Circle, Send, ClipboardCheck,
} from "lucide-react";
import { useStore, defaultStudent } from "../../lib/store";
import type { Student, GoalKind, WorkoutLog } from "../../data/types";
import { fa } from "../../lib/core";
import { formatDateTime, formatJalaliDate, formatRelative } from "../../lib/time";
import { daysSinceWorkout as dsw, liveSubStatus, subDaysLeft, weekLogCount, workoutStreak, xpOf } from "../../lib/metrics";
import { ExThumb, resolveExercise } from "../../components/exercise";
import { Back, BrandBtn, Empty, Field, GhostBtn, Modal, Pill, ProgressBar, SearchBox, inputCls, money, subTone } from "../../components/ui";
import type { CoachView } from "./CoachApp";
import { CoachCheckins } from "../../components/checkin";
import { calculateAdherence } from "../../lib/adherence";
import { trainingAnalytics } from "../../lib/training";

const GOALS: GoalKind[] = ["عضله‌سازی", "کاهش وزن", "چربی‌سوزی", "افزایش قدرت", "فیتنس", "افزایش استقامت", "تغییر ترکیب بدنی"];

export default function CoachStudents({
  focusId, onOpen, onBack, onGo, onToast,
}: {
  focusId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
  onGo: (v: CoachView) => void;
  onToast: (t: string, d: string) => void;
}) {
  const { data, userById, upsertStudent, removeStudent, setStudentStatus, createStudent, renameUser } = useStore();
  const [q, setQ] = useState("");
  const [goal, setGoal] = useState("همه");
  const [sub, setSub] = useState("همه");
  const [level, setLevel] = useState("همه");
  const [edit, setEdit] = useState<Student | null>(null);

  const focus = data.students.find((s) => s.id === focusId);

  const onSave = async (s: Student, name: string, extra: { email: string; password: string }) => {
    const exists = data.users.some((u) => u.id === s.userId);
    if (!exists) {
      const err = await Promise.resolve(createStudent({
        name, email: extra.email, password: extra.password, age: s.age, gender: s.gender, height: s.height,
        weight: s.weight, goal: s.goal, level: s.level, notes: s.notes, assessment: s.assessment,
      }));
      if (err) return onToast(err, "اطلاعات را بررسی کن");
      onToast("شاگرد اضافه شد", `ورود شاگرد: ${extra.email}`);
    } else {
      upsertStudent(s);
      renameUser(s.userId, name);
      onToast("ذخیره شد", formatDateTime(new Date()));
    }
    setEdit(null);
  };

  if (focus) {
    return (
      <>
        <StudentDetail student={focus} onBack={onBack} onEdit={() => setEdit(focus)} onGo={onGo} onToast={onToast} />
        {localize(edit && <StudentForm key={edit.id} student={edit} onClose={() => setEdit(null)} onSave={onSave} />)}
      </>
    );
  }

  const list = data.students.filter((s) => {
    const name = userById(s.userId)?.name ?? "";
    if (q && !name.includes(q) && !s.goal.includes(q)) return false;
    if (goal !== "همه" && s.goal !== goal) return false;
    if (sub !== "همه" && liveSubStatus(s) !== sub) return false;
    if (level !== "همه" && s.level !== level) return false;
    return true;
  });

  return (
    <div className="screen-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-black">{localizeStatic("شاگردان من (")}{localize(fa(list.length))})</h2>
          <p className="text-[11.5px] text-[var(--color-mute)]">{localizeStatic("فقط شاگردان متصل به حساب تو")}</p>
        </div>
        <BrandBtn onClick={() => setEdit(defaultStudent())}><Plus size={16} />{localizeStatic(" شاگرد جدید")}</BrandBtn>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <SearchBox value={q} onChange={setQ} placeholder={localizeStatic("نام یا هدف…")} />
        <select className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value)}><option value="همه">{localizeStatic("همه")}</option>{localize(GOALS.map((g) => <option key={g} value={g}>{localize(g)}</option>))}</select>
        <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}><option value="همه">{localizeStatic("همه")}</option><option value="مبتدی">{localizeStatic("مبتدی")}</option><option value="متوسط">{localizeStatic("متوسط")}</option><option value="پیشرفته">{localizeStatic("پیشرفته")}</option></select>
        <select className={inputCls} value={sub} onChange={(e) => setSub(e.target.value)}><option value="همه">{localizeStatic("همه")}</option><option value="فعال">{localizeStatic("فعال")}</option><option value="در حال اتمام">{localizeStatic("در حال اتمام")}</option><option value="منقضی">{localizeStatic("منقضی")}</option><option value="غیرفعال">{localizeStatic("غیرفعال")}</option></select>
      </div>
      {localize(list.length === 0 && <Empty text={data.students.length === 0 ? "هنوز شاگردی نداری. «شاگرد جدید» را بزن یا کد مربی را برای شاگرد بفرست." : "شاگردی با این فیلتر پیدا نشد"} />)}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {localize(list.map((s) => {
          const u = userById(s.userId);
          const idle = dsw(data, s.id);
          const prog = data.programs.find((p) => p.studentId === s.id && p.status !== "تمام‌شده");
          const logs = data.logs.filter((l) => l.studentId === s.id).length;
          return (
            <div key={s.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3">
              <button onClick={() => onOpen(s.id)} className="press flex w-full items-center gap-3 text-right">
                <img src={u?.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14px]">{u?.name}</b>
                  <span className="text-[11.5px] text-[var(--color-mute)]">{localize(s.goal)} • {localize(s.level)} • {localize(fa(s.weight))}{localizeStatic(" کیلو")}</span>
                </span>
                <ChevronLeft size={16} className="text-[var(--color-mute)]" />
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Pill tone={subTone(liveSubStatus(s))}>{localize(liveSubStatus(s))}</Pill>
                {localize(typeof idle === "number" && idle >= 3 && <Pill tone="danger">{localize(fa(idle))}{localizeStatic(" روز بی‌تمرین")}</Pill>)}
                <Pill tone="info">{localize(fa(logs))}{localizeStatic(" تمرین ثبت‌شده")}</Pill>
              </div>
              <p className="mt-2 truncate text-[11px] text-[var(--color-mute)]">{localize(prog ? `برنامه: ${prog.name}` : "بدون برنامه فعال")}</p>
              <div className="mt-2 flex gap-1">
                <IconBtn onClick={() => onOpen(s.id)} title={localizeStatic("مشاهده کامل")}><UserIcon size={14} /></IconBtn>
                <IconBtn onClick={() => setEdit(s)} title={localizeStatic("ویرایش")}><Pencil size={14} /></IconBtn>
                <IconBtn onClick={() => { setStudentStatus(s.id, s.status === "active" ? "inactive" : "active"); onToast("وضعیت تغییر کرد", ""); }} title={localizeStatic("فعال/غیرفعال")}><Ban size={14} /></IconBtn>
                <IconBtn onClick={() => { if (confirm("شاگرد و برنامه‌هایش حذف شود؟")) { removeStudent(s.id); onToast("حذف شد", ""); } }} title={localizeStatic("حذف")}><Trash2 size={14} /></IconBtn>
              </div>
            </div>
          );
        }))}
      </div>
      {localize(edit && <StudentForm key={edit.id} student={edit} onClose={() => setEdit(null)} onSave={onSave} />)}
    </div>
  );
}

type Tab = "overview" | "programs" | "logs" | "checkins" | "progress" | "chat";

function StudentDetail({
  student: s, onBack, onEdit, onGo, onToast,
}: {
  student: Student;
  onBack: () => void;
  onEdit: () => void;
  onGo: (v: CoachView) => void;
  onToast: (t: string, d: string) => void;
}) {
  const { data, userById, upsertStudent, setStudentStatus, sendMessage, markChatRead } = useStore();
  const u = userById(s.userId);
  const [tab, setTab] = useState<Tab>("overview");
  const [notes, setNotes] = useState(s.notes);
  const [msg, setMsg] = useState("");
  const programs = data.programs.filter((p) => p.studentId === s.id);
  const logs = [...data.logs.filter((l) => l.studentId === s.id)].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const prog = [...data.progress.filter((p) => p.studentId === s.id)].sort((a, b) => a.date.localeCompare(b.date));
  const photos = data.photos.filter((p) => p.studentId === s.id);
  const goals = data.goals.filter((g) => g.studentId === s.id);
  const msgs = data.messages.filter((m) => m.studentId === s.id);
  const sleeps = data.sleep[s.id] ?? [];

  const idle = dsw(data, s.id);
  const streak = workoutStreak(data, s.id);
  const totalMin = logs.reduce((a, l) => a + l.durationMin, 0);
  const a = s.assessment;
  const status = liveSubStatus(s);
  const stInvoices = [...data.invoices.filter((i) => i.studentId === s.id)].sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  const planStartMs = s.planStartedAt ? new Date(s.planStartedAt).getTime() : 0;
  const planSessionsUsed = logs.filter((l) => new Date(l.at || l.date).getTime() >= planStartMs).length;
  const training = trainingAnalytics(data, s.id);
  const adherence = calculateAdherence(data, s.id);

  const tabs: { id: Tab; label: string; icon: typeof Dumbbell; n?: number }[] = [
    { id: "overview", label: "مشخصات", icon: UserIcon },
    { id: "programs", label: "برنامه و تمرین‌ها", icon: Dumbbell, n: programs.length },
    { id: "logs", label: "تمرین‌های ثبت‌شده", icon: History, n: logs.length },
    { id: "checkins", label: "چک‌این", icon: ClipboardCheck, n: data.checkins.filter((c) => c.studentId === s.id).length },
    { id: "progress", label: "پیشرفت", icon: LineChart },
    { id: "chat", label: "پیام‌ها", icon: MessageCircle, n: msgs.length },
  ];

  return (
    <div className="screen-in mx-auto max-w-6xl">
      <Back onClick={onBack} title={localizeStatic("پروفایل کامل شاگرد")} />

      <div className="relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-gradient-to-l from-[#e9e400]/12 via-[var(--color-card)] to-[var(--color-card)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <img src={u?.avatar} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#e9e400]/50" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[21px] font-black">{u?.name}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--color-mute)]">
              <span className="flex items-center gap-1" dir="ltr"><Mail size={12} /> {localize(u?.email)}</span>
              {localize(u?.phone && <span className="flex items-center gap-1" dir="ltr"><Phone size={12} /> {localize(u.phone)}</span>)}
              <span>{localizeStatic("عضو از ")}{localize(formatJalaliDate(s.startDate))}</span>
              <span>{localizeStatic("آخرین ورود ")}{localize(formatRelative(u?.lastLoginAt ?? ""))}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill tone={subTone(status)}>{localize(status)} • {localize(fa(Math.max(0, subDaysLeft(s))))}{localizeStatic(" روز مانده")}</Pill>
              <Pill tone={s.status === "active" ? "ok" : "mute"}>{localize(s.status === "active" ? "حساب فعال" : "غیرفعال")}</Pill>
              {localize(s.planTitle && <Pill tone="info">{localizeStatic("پلن ")}{localize(s.planTitle)}</Pill>)}
              <Pill tone="brand">{localize(s.goal)}</Pill>
              <Pill>{localize(s.level)}</Pill>
            </div>
          </div>
          <div className="flex gap-2">
            <GhostBtn onClick={onEdit}><Pencil size={14} />{localizeStatic(" ویرایش")}</GhostBtn>
            <GhostBtn onClick={() => { setStudentStatus(s.id, s.status === "active" ? "inactive" : "active"); onToast("وضعیت تغییر کرد", ""); }}>
              {localize(s.status === "active" ? "غیرفعال" : "فعال")}
            </GhostBtn>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Mini icon={<Flame size={14} />} v={fa(streak)} l={localizeStatic("روز متوالی")} />
          <Mini icon={<Trophy size={14} />} v={fa(xpOf(data, s.id))} l={localizeStatic("امتیاز XP")} />
          <Mini icon={<History size={14} />} v={fa(logs.length)} l={localizeStatic("کل تمرین")} />
          <Mini icon={<Timer size={14} />} v={fa(totalMin)} l={localizeStatic("دقیقه تمرین")} />
          <Mini icon={<CheckCircle size={14} />} v={fa(weekLogCount(data, s.id))} l={localizeStatic("این هفته")} />
          <Mini icon={<Target size={14} />} v={idle === null ? "—" : fa(idle)} l={localizeStatic("روز از آخرین تمرین")} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3 text-[11px]">
          <b className="text-[var(--color-mute)]">{localizeStatic("پایبندی این هفته:")}</b>
          {localize(([['تمرین',adherence.workout],['چک‌این',adherence.checkin],['کلی',adherence.overall]] as const).map(([label,value]) => <span key={label} className="rounded-full bg-[var(--color-card2)] px-2 py-1">{localize(label)}: <b className="tnum text-[#e9e400]">{localize(value === null ? "—" : `${fa(value)}٪`)}</b></span>))}
        </div>
      </div>

      <div className="noscroll my-3 flex gap-1.5 overflow-x-auto">
        {localize(tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === "chat") markChatRead(s.id); }}
            className={`press flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-black ${tab === t.id ? "bg-[#e9e400] text-black" : "bg-[var(--color-card)] text-[var(--color-mute)]"}`}
          >
            <t.icon size={14} /> {localize(t.label)}
            {localize(t.n !== undefined && <span className={`tnum rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-black/15" : "bg-white/10"}`}>{localize(fa(t.n))}</span>)}
          </button>
        )))}
      </div>

      {localize(tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Box title={localizeStatic("مشخصات بدنی")}>
            <div className="grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-3">
              <Row k={localizeStatic("سن")} v={`${fa(s.age)} سال`} />
              <Row k={localizeStatic("جنسیت")} v={s.gender} />
              <Row k={localizeStatic("قد")} v={`${fa(s.height)} سانتی‌متر`} />
              <Row k={localizeStatic("وزن")} v={`${fa(s.weight)} کیلو`} />
              <Row k={localizeStatic("BMI")} v={fa((s.weight / ((s.height / 100) ** 2)).toFixed(1))} />
              <Row k={localizeStatic("سابقه")} v={s.experience || a.history || "—"} />
            </div>
          </Box>
          <Box title={localizeStatic("ارزیابی اولیه")}>
            <div className="grid grid-cols-2 gap-2 text-[12.5px]">
              <Row k={localizeStatic("هدف اصلی")} v={a.mainGoal} />
              <Row k={localizeStatic("روز در هفته")} v={fa(a.daysPerWeek)} />
              <Row k={localizeStatic("مدت جلسه")} v={`${fa(a.sessionMinutes)} دقیقه`} />
              <Row k={localizeStatic("خواب")} v={`${fa(a.sleepHours)} ساعت`} />
              <Row k={localizeStatic("فعالیت روزانه")} v={a.dailyActivity || "—"} />
              <Row k={localizeStatic("سبک زندگی")} v={a.lifestyle || "—"} />
            </div>
            <p className="mt-2 text-[12px] text-[var(--color-mute)]">{localizeStatic("تجهیزات: ")}{localize(a.equipment.join("، ") || "—")}</p>
            <p className="mt-1 text-[12px]"><b className="text-red-400">{localizeStatic("محدودیت/آسیب: ")}</b>{localize(a.limitations || "ندارد")}</p>
          </Box>
          <Box title={localizeStatic("یادداشت خصوصی مربی (فقط تو می‌بینی)")}>
            <textarea className={`${inputCls} h-24 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={localizeStatic("نکات، آسیب‌ها، برنامه آینده…")} />
            <button onClick={() => { upsertStudent({ ...s, notes }); onToast("یادداشت ذخیره شد", ""); }} className="press mt-2 flex items-center gap-1.5 rounded-full bg-[#e9e400] px-4 py-2 text-[12px] font-black text-black">
              <Save size={13} />{localizeStatic(" ذخیره یادداشت")}</button>
          </Box>
          <Box title={localizeStatic("اشتراک و پرداخت‌ها")}>
            {localize(s.planTitle ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
                  <div className="rounded-xl bg-[var(--color-bg)] p-2"><b className="tnum block text-[15px]">{localize(fa(s.sessionsTotal ?? 0))}</b>{localizeStatic("جلسه خریداری")}</div>
                  <div className="rounded-xl bg-[var(--color-bg)] p-2"><b className="tnum block text-[15px]">{localize(fa(planSessionsUsed))}</b>{localizeStatic("انجام‌شده")}</div>
                  <div className="rounded-xl bg-[var(--color-bg)] p-2"><b className="tnum block text-[15px]">{localize(fa(Math.max(0, (s.sessionsTotal ?? 0) - planSessionsUsed)))}</b>{localizeStatic("باقی‌مانده")}</div>
                </div>
                <ProgressBar pct={((s.sessionsTotal ?? 0) ? (planSessionsUsed / (s.sessionsTotal ?? 1)) * 100 : 0)} className="mt-2" />
                <p className="mt-2 text-[11.5px] text-[var(--color-mute)]">{localizeStatic("پلن فعلی: ")}<b className="text-[var(--color-ink)]">{localize(s.planTitle)}</b>{localizeStatic(" • خرید در ")}{localize(s.planStartedAt ? formatJalaliDate(s.planStartedAt) : "—")}</p>
              </>
            ) : (
              <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("هنوز پلنی نخریده است.")}</p>
            ))}
            <div className="mt-3 space-y-1.5">
              {localize(stInvoices.length === 0 && <p className="text-[11.5px] text-[var(--color-mute)]">{localizeStatic("پرداختی ثبت نشده.")}</p>)}
              {localize(stInvoices.slice(0, 4).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] p-2.5 text-[11.5px]">
                  <span className="min-w-0">
                    <b className="block truncate text-[12px]">{localize(i.plan)}</b>
                    <span className="text-[10.5px] text-[var(--color-mute)]">{localize(formatDateTime(i.date))}{localize(i.refId ? ` • پیگیری ${i.refId}` : "")}</span>
                  </span>
                  <span className="shrink-0 text-left">
                    <b className="tnum block">{localize(money(i.amount))}</b>
                    <Pill tone={i.status === "پرداخت‌شده" ? "ok" : i.status === "در انتظار" ? "warn" : "danger"}>{localize(i.status)}</Pill>
                  </span>
                </div>
              )))}
            </div>
          </Box>
          <Box title={localizeStatic("اهداف")}>
            {localize(goals.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("هدفی ثبت نشده.")}</p>)}
            {localize(goals.map((g) => {
              const pct = ((g.current - g.start) / (g.target - g.start || 1)) * 100;
              return (
                <div key={g.id} className="mb-2">
                  <div className="flex justify-between text-[12px]"><b>{g.title}</b><span className="tnum">{localize(fa(g.current))} / {localize(fa(g.target))} {localize(g.unit)}</span></div>
                  <ProgressBar pct={pct} className="mt-1" />
                </div>
              );
            }))}
          </Box>
        </div>
      ))}

      {localize(tab === "programs" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <BrandBtn onClick={() => onGo("programs")}><Plus size={15} />{localizeStatic(" ساخت / ویرایش برنامه")}</BrandBtn>
          </div>
          {localize(programs.length === 0 && <Empty text="این شاگرد هنوز برنامه تمرینی ندارد." />)}
          {localize(programs.map((p) => {
            const totalEx = p.days.reduce((x, d) => x + d.items.length, 0);
            return (
              <div key={p.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b className="text-[15px]">{p.name}</b>
                    <p className="tnum text-[11.5px] text-[var(--color-mute)]">
                      {localize(p.goal)} • {localize(fa(p.weeks))}{localizeStatic(" هفته • ")}{localize(fa(p.days.length))}{localizeStatic(" روز • ")}{localize(fa(totalEx))}{localizeStatic(" حرکت • ")}{localize(formatJalaliDate(p.startDate))}{localizeStatic(" تا ")}{localize(formatJalaliDate(p.endDate))}
                    </p>
                  </div>
                  <Pill tone={p.status === "فعال" ? "ok" : p.status === "پیش‌نویس" ? "info" : "warn"}>{localize(p.status)}</Pill>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {localize(p.days.map((d) => (
                    <div key={d.id} className="rounded-xl bg-[var(--color-bg)] p-3">
                      <p className="mb-2 text-[13px] font-black">{localize(d.weekday)} <span className="font-bold text-[var(--color-mute)]">— {localize(d.focus)}</span></p>
                      {localize(d.items.length === 0 && <p className="text-[11.5px] text-[var(--color-mute)]">{localizeStatic("حرکتی ثبت نشده")}</p>)}
                      {localize(d.items.map((it, i) => {
                        const e = resolveExercise(it.exerciseId, data);
                        return (
                          <div key={it.id} className="mb-1.5 flex items-center gap-2 border-b border-[var(--color-line)] pb-1.5 last:border-0">
                            <span className="tnum w-4 text-[11px] font-black text-[#e9e400]">{localize(fa(i + 1))}</span>
                            <ExThumb exerciseId={it.exerciseId} data={data} className="h-9 w-9 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <b className="block truncate text-[12.5px]">{localize(e.name)}</b>
                              <span className="tnum text-[10.5px] text-[var(--color-mute)]">
                                {localize(fa(it.sets))}{localizeStatic(" ست × ")}{localize(fa(it.reps))} • {localize(it.weight)}{localizeStatic(" • استراحت ")}{localize(fa(it.rest))}{localizeStatic("ث • RPE ")}{localize(fa(it.rpe))}
                              </span>
                              {localize(it.notes && <span className="block text-[10.5px] text-[#e9e400]/80">{it.notes}</span>)}
                            </div>
                          </div>
                        );
                      }))}
                    </div>
                  )))}
                </div>
              </div>
            );
          }))}
        </div>
      ))}

      {localize(tab === "logs" && <LogsList logs={logs} />)}

      {localize(tab === "logs" && <div className="mt-3 space-y-2 rounded-2xl bg-[var(--color-card)] p-4">
        <b className="text-[13px]">{localizeStatic("تحلیل تمرین و رکوردها")}</b>
        <div className="tnum grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4"><span>{localizeStatic("حجم: ")}{localize(fa(Math.round(training.volume)))}{localizeStatic(" kg")}</span><span>{localizeStatic("ست: ")}{localize(fa(training.sets))}</span><span>{localizeStatic("تکرار: ")}{localize(fa(training.reps))}</span><span>{localizeStatic("RPE میانگین: ")}{localize(fa(training.averageRpe))}</span></div>
        <div className="flex h-28 items-end gap-1">{localize(training.weekly.map((week) => <div key={week.week} className="flex h-full flex-1 flex-col items-center justify-end"><span className="tnum text-[9px]">{localize(fa(Math.round(week.volume)))}</span><span className="w-full rounded-t bg-[#e9e400]" style={{height:`${Math.max(4,week.volume / Math.max(1,...training.weekly.map(w => w.volume)) * 80)}%`}}/><span className="text-[9px] text-[var(--color-mute)]">{localize(week.week.slice(-5))}</span></div>))}</div>
        {localize(training.records.slice(0,5).map((record,i) => <p key={`${record.exerciseId}-${i}`} className="text-[11px]">{localizeStatic("PR • ")}{localize(resolveExercise(record.exerciseId,data).name)}: {localize(fa(record.previous))} → {localize(fa(record.weight))}{localizeStatic(" kg × ")}{localize(fa(record.reps))}</p>))}
      </div>)}

      {localize(tab === "checkins" && <CoachCheckins studentId={s.id} onToast={onToast} />)}

      {localize(tab === "progress" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Box title={localizeStatic("روند وزن")}>
            {localize(prog.length === 0 ? <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("وزنی ثبت نشده.")}</p> : (
              <>
                <div className="flex h-28 items-end gap-1.5">
                  {localize(prog.slice(-12).map((p) => {
                    const ws = prog.map((x) => x.weight);
                    const min = Math.min(...ws) - 2;
                    const max = Math.max(...ws) + 1;
                    return (
                      <div key={p.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                        <span className="tnum text-[9px] text-[#e9e400]">{localize(fa(p.weight))}</span>
                        <div className="w-full rounded-t bg-[#e9e400]/70" style={{ height: `${((p.weight - min) / (max - min || 1)) * 100}%` }} />
                      </div>
                    );
                  }))}
                </div>
                <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                  {localize([...prog].reverse().map((p) => (
                    <p key={p.id} className="flex justify-between text-[12px]"><span className="text-[var(--color-mute)]">{localize(formatDateTime(p.date))}</span><b className="tnum">{localize(fa(p.weight))}{localizeStatic(" کیلو")}</b></p>
                  )))}
                </div>
              </>
            ))}
          </Box>
          <Box title={localizeStatic("خواب")}>
            <p className="mb-1 flex items-center gap-1 text-[12.5px] font-bold"><Moon size={14} className="text-[#e9e400]" />{localizeStatic(" خواب اخیر")}</p>
            {localize(sleeps.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("ثبت نشده")}</p>)}
            {localize(sleeps.slice(-5).reverse().map((sl, i) => (
              <p key={i} className="flex justify-between text-[12px] text-[var(--color-mute)]"><span>{localize(formatJalaliDate(sl.date))}</span><span className="tnum">{localize(fa(sl.hours))}{localizeStatic(" ساعت (")}{localize(fa(sl.bed))}{localizeStatic(" تا ")}{localize(fa(sl.wake))})</span></p>
            )))}
          </Box>
          <Box title={localizeStatic("عکس‌های پیشرفت")}>
            <div className="flex gap-2 overflow-x-auto">
              {localize(photos.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("عکسی ثبت نشده")}</p>)}
              {localize(photos.map((p) => (
                <div key={p.id} className="w-24 shrink-0">
                  <img src={p.url} alt="" className="h-32 w-24 rounded-xl object-cover" />
                  <p className="mt-1 text-[10px]">{localize(p.angle)} • {localize(formatJalaliDate(p.date))}</p>
                </div>
              )))}
            </div>
          </Box>
          <Box title={localizeStatic("رکوردهای حرکات (بیشترین وزن)")}>
            <Records logs={logs} />
          </Box>
        </div>
      ))}

      {localize(tab === "chat" && (
        <div className="flex min-h-[50vh] flex-col rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
          <div className="noscroll max-h-[55vh] flex-1 space-y-2 overflow-y-auto p-4">
            {localize(msgs.length === 0 && <p className="text-center text-[12px] text-[var(--color-mute)]">{localizeStatic("پیامی رد و بدل نشده.")}</p>)}
            {localize(msgs.map((m) => (
              <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-6 ${m.from === "coach" ? "mr-auto bg-[#e9e400] text-black" : "bg-[var(--color-bg)]"}`}>
                {m.text}
                <span className="mt-1 block text-[10px] opacity-60">{localize(formatRelative(m.time))}</span>
              </div>
            )))}
          </div>
          <div className="flex gap-2 border-t border-[var(--color-line)] p-3">
            <input className={inputCls} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={localize(`پیام به ${u?.name ?? "شاگرد"}…`)} onKeyDown={(e) => { if (e.key === "Enter" && msg.trim()) { sendMessage(s.id, "coach", msg.trim()); setMsg(""); } }} />
            <BrandBtn onClick={() => { if (!msg.trim()) return; sendMessage(s.id, "coach", msg.trim()); setMsg(""); onToast("ارسال شد", ""); }}><Send size={15} /></BrandBtn>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LogsList({ logs }: { logs: WorkoutLog[] }) {
  const { data } = useStore();
  const [open, setOpen] = useState<string | null>(logs[0]?.id ?? null);
  if (logs.length === 0) return <Empty text="هنوز تمرینی ثبت نشده." />;
  return (
    <div className="space-y-2">
      {localize(logs.map((l) => {
        const prog = data.programs.find((p) => p.id === l.programId);
        const day = prog?.days.find((d) => d.id === l.dayId);
        const doneSets = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).length, 0);
        const allSets = l.items.reduce((a, i) => a + i.sets.length, 0);
        const reps = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).reduce((x, s) => x + s.reps, 0), 0);
        const vol = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).reduce((x, s) => x + s.weight * s.reps, 0), 0);
        const isOpen = open === l.id;
        return (
          <div key={l.id} className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
            <button onClick={() => setOpen(isOpen ? null : l.id)} className="press flex w-full items-center gap-3 p-3 text-right">
              <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#e9e400]/15 text-[#e9e400]">
                <CheckCircle size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[13.5px]">{localize(day ? `${day.weekday} — ${day.focus}` : "جلسه تمرین")}</b>
                <span className="tnum block text-[11px] text-[var(--color-mute)]">{localize(formatDateTime(l.at || l.date))}</span>
                <span className="tnum mt-0.5 block text-[11px] text-[var(--color-mute)]">
                  {localize(fa(l.durationMin))}{localizeStatic(" دقیقه • ")}{localize(fa(doneSets))}/{localize(fa(allSets))}{localizeStatic(" ست • ")}{localize(fa(reps))}{localizeStatic(" تکرار • ")}{localize(fa(Math.round(vol)))}{localizeStatic(" کیلو حجم")}</span>
              </span>
              <ChevronDown size={16} className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {localize(isOpen && (
              <div className="space-y-2 border-t border-[var(--color-line)] p-3">
                {localize(l.items.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("جزئیات ست ثبت نشده.")}</p>)}
                {localize(l.items.map((it, idx) => {
                  const e = resolveExercise(it.exerciseId, data);
                  return (
                    <div key={idx} className="rounded-xl bg-[var(--color-bg)] p-2.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <ExThumb exerciseId={it.exerciseId} data={data} className="h-8 w-8 rounded-lg object-cover" />
                        <b className="text-[12.5px]">{localize(e.name)}</b>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
                        <span className="text-[var(--color-mute)]">{localizeStatic("ست")}</span>
                        <span className="text-[var(--color-mute)]">{localizeStatic("وزن")}</span>
                        <span className="text-[var(--color-mute)]">{localizeStatic("تکرار")}</span>
                        <span className="text-[var(--color-mute)]">{localizeStatic("وضعیت")}</span>
                        {localize(it.sets.map((st) => (
                          <SetRow key={st.set} n={st.set} w={st.weight} r={st.reps} done={st.done} />
                        )))}
                      </div>
                    </div>
                  );
                }))}
              </div>
            ))}
          </div>
        );
      }))}
    </div>
  );
}

function SetRow({ n, w, r, done }: { n: number; w: number; r: number; done: boolean }) {
  return (
    <>
      <span className="tnum font-black">{localize(fa(n))}</span>
      <span className="tnum">{localize(fa(w))}{localizeStatic(" kg")}</span>
      <span className="tnum">{localize(fa(r))}</span>
      <span className="flex justify-center">{localize(done ? <CheckCircle size={14} className="text-emerald-400" /> : <Circle size={14} className="text-[var(--color-mute)]" />)}</span>
    </>
  );
}

function Records({ logs }: { logs: WorkoutLog[] }) {
  const { data } = useStore();
  const best: Record<string, { w: number; r: number; at: string }> = {};
  logs.forEach((l) =>
    l.items.forEach((it) =>
      it.sets.forEach((s) => {
        if (!s.done) return;
        const cur = best[it.exerciseId];
        if (!cur || s.weight > cur.w || (s.weight === cur.w && s.reps > cur.r)) best[it.exerciseId] = { w: s.weight, r: s.reps, at: l.at || l.date };
      })
    )
  );
  const keys = Object.keys(best);
  if (keys.length === 0) return <p className="text-[12px] text-[var(--color-mute)]">{localizeStatic("رکوردی ثبت نشده.")}</p>;
  return (
    <div className="space-y-1.5">
      {localize(keys.map((k) => (
        <div key={k} className="flex items-center justify-between rounded-lg bg-[var(--color-bg)] px-2.5 py-1.5 text-[12px]">
          <span>{localize(resolveExercise(k, data).name)}</span>
          <span className="tnum font-black text-[#e9e400]">{localize(fa(best[k].w))}{localizeStatic(" kg × ")}{localize(fa(best[k].r))}</span>
        </div>
      )))}
    </div>
  );
}

function Mini({ icon, v, l }: { icon: ReactNode; v: string; l: string }) {
  return (
    <div className="rounded-xl bg-black/20 p-2.5 text-center">
      <span className="flex justify-center text-[#e9e400]">{localize(icon)}</span>
      <b className="tnum mt-1 block text-[15px]">{localize(v)}</b>
      <span className="text-[10px] text-[var(--color-mute)]">{localize(l)}</span>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: ReactNode; onClick: () => void; title?: string }) {
  return <button onClick={onClick} title={localize(title)} className="press flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-mute)] hover:text-[var(--color-ink)]">{localize(children)}</button>;
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2 rounded-lg bg-[var(--color-bg)] px-2 py-1.5"><span className="text-[var(--color-mute)]">{localize(k)}</span><b className="truncate">{localize(v)}</b></div>;
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4"><b className="mb-2 block text-[13.5px]">{localize(title)}</b>{localize(children)}</div>;
}

function StudentForm({ student, onClose, onSave }: { student: Student; onClose: () => void; onSave: (s: Student, name: string, extra: { email: string; password: string }) => void }) {
  const { data } = useStore();
  const isNew = !data.users.some((u) => u.id === student.userId);
  const [name, setName] = useState(data.users.find((u) => u.id === student.userId)?.name ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("1234");
  const [s, setS] = useState<Student>(student);
  const set = (p: Partial<Student>) => setS({ ...s, ...p });

  return (
    <Modal open onClose={onClose} title={localize(isNew ? "افزودن شاگرد جدید" : "ویرایش شاگرد")} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={localizeStatic("نام")}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {localize(isNew && (
          <>
            <Field label={localizeStatic("ایمیل ورود شاگرد")}><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></Field>
            <Field label={localizeStatic("رمز ورود شاگرد")}><input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></Field>
          </>
        ))}
        <Field label={localizeStatic("سن")}><input className={inputCls} type="number" value={s.age} onChange={(e) => set({ age: Number(e.target.value) })} /></Field>
        <Field label={localizeStatic("جنسیت")}>
          <select className={inputCls} value={s.gender} onChange={(e) => set({ gender: e.target.value as "مرد" | "زن" })}><option value="مرد">{localizeStatic("مرد")}</option><option value="زن">{localizeStatic("زن")}</option></select>
        </Field>
        <Field label={localizeStatic("قد")}><input className={inputCls} type="number" value={s.height} onChange={(e) => set({ height: Number(e.target.value) })} /></Field>
        <Field label={localizeStatic("وزن")}><input className={inputCls} type="number" value={s.weight} onChange={(e) => set({ weight: Number(e.target.value) })} /></Field>
        <Field label={localizeStatic("هدف")}>
          <select className={inputCls} value={s.goal} onChange={(e) => set({ goal: e.target.value as GoalKind })}>{localize(GOALS.map((g) => <option key={g} value={g}>{localize(g)}</option>))}</select>
        </Field>
        <Field label={localizeStatic("سطح")}>
          <select className={inputCls} value={s.level} onChange={(e) => set({ level: e.target.value })}><option value="مبتدی">{localizeStatic("مبتدی")}</option><option value="متوسط">{localizeStatic("متوسط")}</option><option value="پیشرفته">{localizeStatic("پیشرفته")}</option></select>
        </Field>
        <Field label={localizeStatic("پایان اشتراک")}>
          <input className={inputCls} type="date" value={(s.subEndsAt || "").slice(0, 10)} onChange={(e) => set({ subEndsAt: new Date(e.target.value + "T23:59:00").toISOString() })} />
        </Field>
        <Field label={localizeStatic("یادداشت مربی")}><input className={inputCls} value={s.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <Field label={localizeStatic("محدودیت / آسیب")}><input className={inputCls} value={s.assessment.limitations} onChange={(e) => set({ assessment: { ...s.assessment, limitations: e.target.value } })} /></Field>
      </div>
      <BrandBtn className="mt-4 w-full" onClick={() => onSave(s, name, { email, password })}><Save size={16} />{localizeStatic(" ذخیره")}</BrandBtn>
    </Modal>
  );
}
