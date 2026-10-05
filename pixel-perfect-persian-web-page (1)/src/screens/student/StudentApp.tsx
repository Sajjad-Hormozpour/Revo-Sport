import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Home, Dumbbell, ClipboardList, TrendingUp, MessagesSquare, MessageCircle, Crown,
  Play, Check, Moon, Bell, LogOut, Flame, Trophy, Pause, SkipForward, ChevronLeft, ChevronDown,
  Plus, Target, Sun, ArrowRight, Timer, Zap, Ticket, CalendarDays, X, Scale, Info, Palette,
  RotateCcw, CheckCircle, Lock, Coffee, Globe,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { notifVisible, useNotifPrefs } from "../../lib/i18n";
import { LanguageSection, NotificationSection, SettingsSection } from "../../components/settings-blocks";
import { useLang } from "../../lib/i18n";
import { ExThumb, ExVideo, resolveExercise } from "../../components/exercise";
import { fa, formatClock, go } from "../../lib/core";
import { BrandBtn, ClockLive, Empty, Field, Pill, ProgressBar, inputCls } from "../../components/ui";
import { ChatThread } from "../../components/chat";
import SubscriptionView from "./Subscription";
import { StudentCheckin } from "../../components/checkin";
import { calculateAdherence } from "../../lib/adherence";
import { trainingAnalytics } from "../../lib/training";
import { ProfileEditor } from "../../components/profile";
import { AppearanceSettings } from "../../components/appearance";
import { LogsList } from "../coach/CoachStudents";
import {
  WEEK, addDays, dayKey, daysBetween, formatDateTime, formatJalaliDate, formatJalaliLong,
  formatRelative, greetingAt, nowIso, useNow, weekdayName,
} from "../../lib/time";
import { weekLogCount, workoutStreak, xpOf } from "../../lib/metrics";
import type { AppData, WorkoutDay, WorkoutProgram } from "../../data/types";

export type StudentView = "home" | "workout" | "history" | "progress" | "chat" | "subscription" | "profile";

const NAV: { id: StudentView; label: string; icon: typeof Home }[] = [
  { id: "workout", label: "snav.workout", icon: Dumbbell },
  { id: "history", label: "snav.history", icon: ClipboardList },
  { id: "home", label: "snav.home", icon: Home },
  { id: "progress", label: "snav.progress", icon: TrendingUp },
  { id: "chat", label: "snav.chat", icon: MessagesSquare },
  { id: "subscription", label: "snav.subscription", icon: Crown },
];

const TITLES: Record<StudentView, string> = {
  home: "stitle.home",
  workout: "stitle.workout",
  history: "stitle.history",
  progress: "stitle.progress",
  chat: "stitle.chat",
  subscription: "stitle.subscription",
  profile: "stitle.profile",
};

export default function StudentApp({
  view, onView, onToast,
}: {
  view: StudentView;
  onView: (v: StudentView) => void;
  onToast: (t: string, d: string) => void;
  onShare: () => void;
}) {
  const { session, studentOf, userById, data, logout, light, toggleLight } = useStore();
  const { t, dir } = useLang();
  const st = studentOf(session!.userId);
  const me = userById(session!.userId);
  const stack = useRef<StudentView[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [view]);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (view !== "home") onView("home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nav = (v: StudentView) => {
    if (v === view) return;
    stack.current.push(view);
    onView(v);
  };
  const back = () => {
    const prev = stack.current.pop();
    onView(prev ?? "home");
  };
  const tab = (v: StudentView) => {
    stack.current = v === "home" ? [] : ["home"];
    if (v !== view) onView(v);
  };

  if (!st || !me) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center">
        <div>
          <p className="font-black">پروفایل شاگرد پیدا نشد</p>
          <button className="mt-3 text-[#e9e400]" onClick={() => { logout(); go("/login"); }}>بازگشت به ورود</button>
        </div>
      </div>
    );
  }

  const unreadNotifs = data.notifs.filter((n) => !n.read).length;
  const unreadChat = data.messages.some((m) => m.from === "coach" && m.unread);
  const idx = Math.max(0, NAV.findIndex((n) => n.id === (view === "profile" ? "subscription" : view)));

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col bg-[var(--color-bg)] sm:border-x sm:border-[var(--color-line)]" dir={dir}>
      {view === "home" ? (
        <header className="glass-strong mobile-safe-top flex shrink-0 items-center justify-between gap-2 border-x-0 border-t-0 px-3 py-2.5 sm:px-4 sm:py-3">
          <button onClick={() => nav("profile")} className="press flex min-w-0 items-center gap-2.5 text-right">
            <span className="relative shrink-0">
              <img src={me.avatar} alt="" className="h-11 w-11 rounded-2xl object-cover ring-2 ring-[#e9e400]/50" />
              <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-card)] bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold text-[#e9e400]">{greetingAt()}</p>
              <b className="block truncate text-[14.5px] leading-5">{me.name}</b>
            </div>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="glass-subtle hidden rounded-xl px-2.5 py-1 min-[380px]:block"><ClockLive compact /></div>
            <HeaderBtn onClick={toggleLight} label="تم">{light ? <Moon size={16} /> : <Sun size={16} />}</HeaderBtn>
            <HeaderBtn onClick={() => nav("profile")} label="اعلان‌ها">
              <Bell size={16} />
              {unreadNotifs > 0 && <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--color-card)]" />}
            </HeaderBtn>
          </div>
        </header>
      ) : (
        <header className="glass-strong mobile-safe-top flex shrink-0 items-center gap-2 border-x-0 border-t-0 px-2.5 py-2">
          <button onClick={back} className="press glass-subtle flex h-11 min-w-[92px] items-center justify-center gap-1.5 rounded-2xl px-3 text-[12.5px] font-black" aria-label="بازگشت">
            <ArrowRight size={17} /> بازگشت
          </button>
          <b className="flex-1 truncate text-center text-[14px] font-black sm:text-[14.5px]">{t(TITLES[view])}</b>
          <div className="glass-subtle min-w-[76px] rounded-2xl px-2 py-1 text-left"><ClockLive compact /></div>
        </header>
      )}

      <div
        ref={scroller}
        className={view === "chat" ? "min-h-0 flex-1 overflow-hidden" : "noscroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1"}
      >
        {view === "home" && <HomeView stId={st.id} nav={nav} />}
        {view === "workout" && <WorkoutView stId={st.id} onToast={onToast} nav={nav} />}
        {view === "history" && <HistoryView stId={st.id} />}
        {view === "progress" && <ProgressView stId={st.id} onToast={onToast} />}
        {view === "chat" && <ChatView stId={st.id} nav={nav} />}
        {view === "subscription" && <SubscriptionView stId={st.id} onGo={(v) => nav(v)} />}
        {view === "profile" && <ProfileView stId={st.id} onToast={onToast} />}
      </div>

      <nav className="mobile-safe-bottom shrink-0 px-2.5 pt-1.5 sm:px-3">
        <div className="glass-strong relative grid grid-cols-6 rounded-[24px] p-1.5 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.65)]">
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 top-1.5 rounded-[20px] bg-[#e9e400] shadow-[0_10px_24px_-10px_rgba(233,228,0,0.9)] transition-[right] duration-300 ease-out"
            style={{ width: "calc((100% - 12px) / 6)", right: `calc(6px + ${idx} * (100% - 12px) / 6)` }}
          />
          {NAV.map((n, i) => {
            const active = i === idx;
            const badge = n.id === "chat" && unreadChat;
            const isHome = n.id === "home";
            return (
              <button
                key={n.id}
                onClick={() => tab(n.id)}
                aria-label={t(n.label)}
                aria-current={active ? "page" : undefined}
                className="press relative z-10 flex flex-col items-center justify-center gap-1 py-2"
              >
                <span className={`relative flex items-center justify-center rounded-full transition-colors duration-300 ${isHome && !active ? "bg-[#e9e400]/15 p-1" : ""}`}>
                  <n.icon size={isHome ? 23 : 21} strokeWidth={active ? 2.4 : 1.8} className={`transition-colors duration-300 ${active ? "text-black" : isHome ? "text-[#e9e400]" : "text-[var(--color-mute)]"}`} />
                  {badge && <span className="absolute -left-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-card)] bg-red-500" />}
                </span>
                <span className={`text-[9.5px] font-black leading-none transition-colors duration-300 ${active ? "text-black" : "text-[var(--color-mute)]"}`}>{t(n.label)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HeaderBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="press relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-card)]">
      {children}
    </button>
  );
}

function useStudentBasics(stId: string) {
  const { data, userById } = useStore();
  const st = data.students.find((s) => s.id === stId)!;
  const coach = st?.coachId ? userById(st.coachId) : undefined;
  const programs = data.programs.filter((p) => p.studentId === stId && (p.status === "فعال" || p.status === "در حال اتمام"));
  return { st, coach, programs };
}

/** جلسه امروز بر اساس روز واقعی هفته (شنبه تا جمعه) */
function todaySession(data: AppData, stId: string, programs: WorkoutProgram[]) {
  const today = weekdayName();
  const tk = dayKey();
  const sorted = [...programs].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const program = sorted.find((p) => p.days.some((d) => d.weekday === today && d.items.length > 0)) ?? sorted[0];
  const todays = program ? program.days.filter((d) => d.weekday === today && d.items.length > 0) : [];
  const loggedFor = (dayId: string) => data.logs.find((l) => l.studentId === stId && l.dayId === dayId && l.date === tk);
  const day = todays.find((d) => !loggedFor(d.id)) ?? todays[0];
  const log = day ? loggedFor(day.id) : undefined;
  let next: { date: Date; day: WorkoutDay } | null = null;
  if (program) {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(new Date(), i);
      const pd = program.days.find((x) => x.weekday === weekdayName(d) && x.items.length > 0);
      if (pd) {
        next = { date: d, day: pd };
        break;
      }
    }
  }
  return { program, day, log, next, today };
}

/* ================= HOME ================= */
function HomeView({ stId, nav }: { stId: string; nav: (v: StudentView) => void }) {
  const { data } = useStore();
  const { coach, programs } = useStudentBasics(stId);
  const { program, day, log, next, today } = todaySession(data, stId, programs);
  const streak = workoutStreak(data, stId);
  const lastMsg = [...data.messages].reverse().find((m) => m.studentId === stId && m.from === "coach");
  const upcoming = [...data.appts]
    .filter((a) => a.status === "رزرو" && new Date(a.startAt).getTime() > Date.now())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  const logs = [...data.logs.filter((l) => l.studentId === stId)].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const adherence = calculateAdherence(data, stId);

  return (
    <div className="screen-in space-y-3 pb-2">
      {coach ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3">
          <img src={coach.avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[#e9e400]/40" />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold text-[#e9e400]">مربی تو</p>
            <b className="block truncate text-[14px]">{coach.name}</b>
          </div>
          <button onClick={() => nav("chat")} className="press flex h-9 items-center gap-1 rounded-full bg-[#e9e400] px-3 text-[11.5px] font-black text-black"><MessageCircle size={14} /> پیام</button>
        </div>
      ) : (
        <button onClick={() => nav("profile")} className="press flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#e9e400]/40 bg-[#e9e400]/[0.06] p-3 text-right">
          <Ticket size={22} className="text-[#e9e400]" />
          <span className="flex-1">
            <b className="block text-[13px]">هنوز به مربی وصل نیستی</b>
            <span className="text-[11px] text-[var(--color-mute)]">کد مربی را در پروفایل وارد کن</span>
          </span>
          <ChevronLeft size={16} />
        </button>
      )}

      <button onClick={() => nav("workout")} className="press relative block w-full overflow-hidden rounded-3xl text-right">
        {day?.items[0] ? (
          <ExThumb exerciseId={day.items[0].exerciseId} data={data} className="h-44 w-full object-cover" />
        ) : (
          <div className="h-44 w-full bg-gradient-to-br from-[#e9e400]/30 via-[#2a2c10] to-black" />
        )}
        <div className="on-dark absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10 p-4">
          <div className="flex items-center justify-between">
            <Pill tone="brand">تمرین امروز • {today}</Pill>
            {log && <Pill tone="ok">انجام شد ✓</Pill>}
          </div>
          <div className="absolute inset-x-4 bottom-4">
            <b className="block text-[19px] text-white">{day ? day.focus : program ? "امروز روز استراحت است" : "برنامه‌ای نداری"}</b>
            <span className="tnum block text-[12px] text-white/70">
              {day
                ? `${fa(day.items.length)} حرکت • ${fa(day.items.reduce((a, i) => a + i.sets, 0))} ست`
                : next
                  ? `جلسه بعدی: ${next.day.weekday} ${formatJalaliDate(next.date)}`
                  : program
                    ? "جلسه‌ای در برنامه نیست"
                    : "مربی هنوز برنامه نفرستاده"}
            </span>
            {program && <span className="mt-0.5 block text-[11px] text-[#e9e400]">{program.name}{coach ? ` • طراحی: ${coach.name}` : ""}</span>}
          </div>
        </div>
      </button>

      <div className="grid grid-cols-4 gap-2">
        <Mini icon={<Flame size={15} />} v={fa(streak)} l="روز متوالی" />
        <Mini icon={<Trophy size={15} />} v={fa(xpOf(data, stId))} l="XP" />
        <Mini icon={<CalendarDays size={15} />} v={fa(weekLogCount(data, stId))} l="این هفته" />
        <Mini icon={<CheckCircle size={15} />} v={fa(logs.length)} l="کل تمرین" />
      </div>

      <button onClick={() => nav("progress")} className="press flex w-full items-center justify-between rounded-2xl bg-[var(--color-card)] p-3 text-right"><b className="text-[12px]">پایبندی کلی این هفته</b><span className="tnum text-[13px] font-black text-[#e9e400]">{adherence.overall === null ? "—" : `${fa(adherence.overall)}٪`}</span></button>

      {lastMsg && (
        <button onClick={() => nav("chat")} className="press flex w-full items-center gap-3 rounded-2xl bg-[var(--color-card)] p-3 text-right">
          <img src={coach?.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
          <span className="min-w-0 flex-1">
            <b className="block text-[12.5px]">آخرین پیام {coach?.name ?? "مربی"}</b>
            <span className="block truncate text-[11.5px] text-[var(--color-mute)]">{lastMsg.text}</span>
            <span className="block text-[10px] text-[var(--color-mute)]">{formatRelative(lastMsg.time)}</span>
          </span>
          <ChevronLeft size={16} />
        </button>
      )}

      {upcoming && (
        <div className="rounded-2xl border border-[#e9e400]/25 bg-[#e9e400]/10 p-3">
          <b className="flex items-center gap-1.5 text-[13px]"><CalendarDays size={15} className="text-[#e9e400]" /> جلسه آینده</b>
          <p className="mt-1 text-[12px] text-[var(--color-mute)]">{upcoming.title} — {formatDateTime(upcoming.startAt)} ({formatRelative(upcoming.startAt)})</p>
        </div>
      )}

      {logs.length > 0 && (
        <button onClick={() => nav("history")} className="press flex w-full items-center justify-between rounded-2xl bg-[var(--color-card)] p-3 text-right">
          <span>
            <b className="block text-[13px]">آخرین تمرین ثبت‌شده</b>
            <span className="tnum text-[11.5px] text-[var(--color-mute)]">{formatDateTime(logs[0].at)} • {fa(logs[0].durationMin)} دقیقه</span>
          </span>
          <ChevronLeft size={16} />
        </button>
      )}
    </div>
  );
}

function Mini({ icon, v, l }: { icon: ReactNode; v: string; l: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-card)] p-2.5 text-center">
      <div className="flex justify-center text-[#e9e400]">{icon}</div>
      <b className="tnum mt-1 block text-[15px]">{v}</b>
      <span className="text-[9.5px] text-[var(--color-mute)]">{l}</span>
    </div>
  );
}

/* ================= WORKOUT (read-only prescription) ================= */
interface Draft {
  date: string;
  programId: string;
  dayId: string;
  startedAt: string | null;
  done: Record<string, boolean[]>;
}

const draftKey = (stId: string) => `revo-draft-${stId}`;

function loadDraft(stId: string): Draft | null {
  try {
    const r = localStorage.getItem(draftKey(stId));
    if (!r) return null;
    const d = JSON.parse(r) as Draft;
    if (!d || d.date !== dayKey() || !d.done || typeof d.done !== "object") return null;
    return d;
  } catch {
    return null;
  }
}

function num(s: string): number {
  const m = String(s ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

const RING = 2 * Math.PI * 64;

function WorkoutView({ stId, onToast, nav }: { stId: string; onToast: (t: string, d: string) => void; nav: (v: StudentView) => void }) {
  const { data, logWorkout } = useStore();
  const { coach, programs } = useStudentBasics(stId);
  const { program, day, log, next, today } = todaySession(data, stId, programs);
  const now = useNow(1000);
  const todayKey = dayKey(now);
  const fresh = (): Draft => ({ date: dayKey(), programId: program?.id ?? "", dayId: day?.id ?? "", startedAt: null, done: {} });
  const [draft, setDraft] = useState<Draft>(() => {
    const s = loadDraft(stId);
    return s && s.programId === (program?.id ?? "") && s.dayId === (day?.id ?? "") ? s : fresh();
  });
  const [open, setOpen] = useState<string | null>(day?.items[0]?.id ?? null);
  const [rest, setRest] = useState<{ left: number; total: number } | null>(null);
  const [restRun, setRestRun] = useState(true);
  const [video, setVideo] = useState<string | null>(null);
  const [summary, setSummary] = useState(false);

  // با عوض شدن روز (مثلاً رد شدن از نیمه‌شب) جلسه جدید آماده می‌شود
  useEffect(() => {
    if (draft.dayId !== (day?.id ?? "") || draft.date !== todayKey) {
      setDraft({ date: todayKey, programId: program?.id ?? "", dayId: day?.id ?? "", startedAt: null, done: {} });
      setOpen(day?.items[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.id, todayKey]);

  useEffect(() => {
    if (draft.startedAt || Object.keys(draft.done).length) localStorage.setItem(draftKey(stId), JSON.stringify(draft));
  }, [draft, stId]);

  useEffect(() => {
    if (!rest || !restRun) return;
    if (rest.left <= 0) {
      setRest(null);
      try {
        navigator.vibrate?.(300);
      } catch {
        /* ignore */
      }
      return;
    }
    const t = window.setTimeout(() => setRest((r) => (r ? { ...r, left: r.left - 1 } : r)), 1000);
    return () => window.clearTimeout(t);
  }, [rest, restRun]);

  if (!program) {
    return (
      <div className="screen-in py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#e9e400]/15"><Dumbbell size={28} className="text-[#e9e400]" /></div>
        <b className="mt-3 block text-[16px]">هنوز برنامه تمرینی نداری</b>
        <p className="mt-1 text-[12.5px] leading-6 text-[var(--color-mute)]">
          {coach ? `${coach.name} به‌زودی برنامه‌ات را می‌فرستد. می‌توانی به او پیام بدهی.` : "اول با کد مربی به یک مربی وصل شو."}
        </p>
        <BrandBtn className="mx-auto mt-4" onClick={() => nav(coach ? "chat" : "profile")}>{coach ? "پیام به مربی" : "وارد کردن کد مربی"}</BrandBtn>
      </div>
    );
  }

  const estMin = day ? Math.max(1, Math.round(day.items.reduce((a, i) => a + i.sets * (i.rest + 45), 0) / 60)) : 0;

  const header = (
    <div className="rounded-3xl border border-[var(--color-line)] bg-gradient-to-bl from-[#e9e400]/15 via-[var(--color-card)] to-[var(--color-card)] p-4">
      <div className="flex items-center gap-2.5">
        {coach && <img src={coach.avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-[#e9e400]/40" />}
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-[#e9e400]">{program.name}</p>
          <p className="truncate text-[11px] text-[var(--color-mute)]">طراحی‌شده توسط مربی: <b className="text-[var(--color-ink)]">{coach?.name ?? "—"}</b></p>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] font-bold text-[var(--color-mute)]">{formatJalaliLong(now)}</p>
      {day ? (
        <>
          <h2 className="mt-0.5 text-[20px] font-black">{day.focus}</h2>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Stat v={fa(day.items.length)} l="حرکت" />
            <Stat v={fa(day.items.reduce((a, i) => a + i.sets, 0))} l="ست" />
            <Stat v={`~${fa(estMin)}`} l="دقیقه" />
          </div>
        </>
      ) : (
        <h2 className="mt-0.5 text-[20px] font-black">روز استراحت</h2>
      )}
    </div>
  );

  /* ---------- rest day ---------- */
  if (!day) {
    return (
      <div className="screen-in space-y-3 pb-6">
        {header}
        <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-500/15"><Coffee size={28} className="text-sky-400" /></div>
          <b className="mt-3 block text-[17px]">امروز ({today}) تمرینی نداری</b>
          <p className="mt-1 text-[12.5px] leading-6 text-[var(--color-mute)]">مربی برای امروز جلسه‌ای تعیین نکرده. ریکاوری هم بخشی از پیشرفت است.</p>
          {next && (
            <div className="mt-4 rounded-2xl bg-[var(--color-bg)] p-3 text-right">
              <p className="text-[11px] font-bold text-[#e9e400]">جلسه بعدی</p>
              <b className="block text-[14px]">{next.day.weekday} — {next.day.focus}</b>
              <span className="tnum text-[11.5px] text-[var(--color-mute)]">{formatJalaliLong(next.date)} • {fa(Math.max(1, daysBetween(now, next.date)))} روز دیگر</span>
            </div>
          )}
        </div>
        <WeekPlan program={program} today={today} />
      </div>
    );
  }

  /* ---------- already logged today ---------- */
  if (log) {
    const lDone = log.items.reduce((a, i) => a + i.sets.filter((s) => s.done).length, 0);
    const lAll = log.items.reduce((a, i) => a + i.sets.length, 0);
    const lVol = log.items.reduce((a, i) => a + i.sets.filter((s) => s.done).reduce((x, s) => x + s.weight * s.reps, 0), 0);
    return (
      <div className="screen-in space-y-3 pb-6">
        {header}
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <div className="pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={30} strokeWidth={3} /></div>
          <b className="mt-3 block text-[17px]">تمرین امروز ثبت شد</b>
          <p className="mt-1 text-[12px] text-[var(--color-mute)]">{formatDateTime(log.at || log.date)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat v={fa(log.durationMin)} l="دقیقه" />
            <Stat v={`${fa(lDone)}/${fa(lAll)}`} l="ست" />
            <Stat v={fa(Math.round(lVol))} l="حجم kg" />
          </div>
          {next && <p className="mt-3 text-[12px] text-[var(--color-mute)]">جلسه بعدی: <b className="text-[var(--color-ink)]">{next.day.weekday} {formatJalaliDate(next.date)}</b></p>}
          <BrandBtn className="mx-auto mt-4" onClick={() => nav("history")}><ClipboardList size={15} /> مشاهده در سوابق</BrandBtn>
        </div>
        <WeekPlan program={program} today={today} />
      </div>
    );
  }

  /* ---------- active session ---------- */
  const marksOf = (itemId: string, sets: number) => Array.from({ length: sets }).map((_, k) => !!draft.done[itemId]?.[k]);
  const allSets = day.items.reduce((a, i) => a + i.sets, 0);
  const doneSets = day.items.reduce((a, it) => a + marksOf(it.id, it.sets).filter(Boolean).length, 0);
  const volume = day.items.reduce((a, it) => a + marksOf(it.id, it.sets).filter(Boolean).length * num(it.weight) * num(it.reps), 0);
  const reps = day.items.reduce((a, it) => a + marksOf(it.id, it.sets).filter(Boolean).length * num(it.reps), 0);
  const elapsed = draft.startedAt ? Math.max(0, Math.floor((now.getTime() - new Date(draft.startedAt).getTime()) / 1000)) : 0;
  const pct = allSets ? (doneSets / allSets) * 100 : 0;

  const toggle = (idx: number, i: number) => {
    const it = day.items[idx];
    const willDone = !draft.done[it.id]?.[i];
    setDraft((d) => {
      const arr = Array.from({ length: it.sets }).map((_, k) => !!d.done[it.id]?.[k]);
      arr[i] = willDone;
      return { ...d, startedAt: d.startedAt ?? nowIso(), done: { ...d.done, [it.id]: arr } };
    });
    if (willDone) {
      const after = marksOf(it.id, it.sets);
      after[i] = true;
      if (after.every(Boolean) && day.items[idx + 1]) setOpen(day.items[idx + 1].id);
      if (it.rest > 0) {
        setRest({ left: it.rest, total: it.rest });
        setRestRun(true);
      }
    }
  };

  const lastFor = (exId: string) => {
    const logs = [...data.logs].filter((l) => l.studentId === stId).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    for (const l of logs) {
      const it = l.items.find((x) => x.exerciseId === exId);
      const best = it?.sets.filter((s) => s.done).sort((a, b) => b.weight - a.weight)[0];
      if (best) return `${fa(best.weight)} kg × ${fa(best.reps)} • ${formatRelative(l.at)}`;
    }
    return "";
  };

  const save = () => {
    const durationMin = Math.max(1, Math.round(elapsed / 60));
    const items = day.items.map((it) => ({
      exerciseId: it.exerciseId,
      sets: marksOf(it.id, it.sets).map((done, i) => ({ set: i + 1, weight: num(it.weight), reps: num(it.reps), rpe: it.rpe, done })),
    }));
    logWorkout({ studentId: stId, programId: program.id, dayId: day.id, durationMin, items, startedAt: draft.startedAt ?? nowIso() });
    localStorage.removeItem(draftKey(stId));
    setDraft(fresh());
    setSummary(false);
    onToast("تمرین ذخیره شد 🎉", `${fa(durationMin)} دقیقه • ${formatDateTime(new Date())}`);
    nav("history");
  };

  return (
    <div className="screen-in space-y-3 pb-2">
      {header}

      {draft.startedAt ? (
        <div className="sticky top-0 z-10 rounded-2xl border border-[#e9e400]/30 bg-[var(--color-bg2)]/95 p-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="animate-ticker-dot h-2 w-2 rounded-full bg-red-500" />
              <b className="tnum text-[20px] font-black text-[#e9e400]">{formatClock(elapsed)}</b>
            </span>
            <span className="tnum text-[11.5px] text-[var(--color-mute)]">{fa(doneSets)}/{fa(allSets)} ست • {fa(Math.round(volume))} kg</span>
          </div>
          <ProgressBar pct={pct} className="mt-2 h-2" />
        </div>
      ) : (
        <button
          onClick={() => setDraft((d) => ({ ...d, startedAt: nowIso() }))}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e9e400] py-3.5 text-[15px] font-black text-black shadow-[0_14px_36px_-12px_rgba(233,228,0,0.7)]"
        >
          <Play size={18} fill="currentColor" /> شروع تمرین امروز
        </button>
      )}

      {day.items.map((it, idx) => {
        const e = resolveExercise(it.exerciseId, data);
        const marks = marksOf(it.id, it.sets);
        const doneCount = marks.filter(Boolean).length;
        const isOpen = open === it.id;
        const complete = doneCount === it.sets;
        const prev = lastFor(it.exerciseId);
        return (
          <div key={it.id} className={`overflow-hidden rounded-2xl border bg-[var(--color-card)] transition ${complete ? "border-emerald-500/40" : isOpen ? "border-[#e9e400]/40" : "border-[var(--color-line)]"}`}>
            <button onClick={() => setOpen(isOpen ? null : it.id)} className="press flex w-full items-center gap-3 p-3 text-right">
              <span className="relative shrink-0">
                <ExThumb exerciseId={it.exerciseId} data={data} className="h-14 w-14 rounded-xl object-cover" />
                <span className={`tnum absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${complete ? "bg-emerald-500 text-white" : "bg-[#e9e400] text-black"}`}>
                  {complete ? <Check size={13} strokeWidth={3} /> : fa(idx + 1)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14px]">
                  {e.name}
                  {e.isCustom && <span className="mr-1.5 rounded-full bg-[#e9e400]/15 px-1.5 py-0.5 text-[9px] font-black text-[#e9e400]">مربی</span>}
                </b>
                <span className="tnum block text-[11.5px] text-[var(--color-mute)]">{fa(it.sets)} ست × {fa(it.reps)} تکرار • {fa(it.weight)}</span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#e9e400] transition-all" style={{ width: `${(doneCount / it.sets) * 100}%` }} /></span>
              </span>
              <span className="tnum shrink-0 text-[11px] font-black text-[var(--color-mute)]">{fa(doneCount)}/{fa(it.sets)}</span>
              <ChevronLeft size={16} className={`shrink-0 transition ${isOpen ? "-rotate-90" : ""}`} />
            </button>
            {isOpen && (
              <div className="border-t border-[var(--color-line)] px-3 pb-3 pt-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <Pill>استراحت {fa(it.rest)} ثانیه</Pill>
                  <Pill>RPE {fa(it.rpe)}</Pill>
                  <Pill>Tempo {fa(it.tempo)}</Pill>
                  <Pill tone="info">{e.muscle}</Pill>
                  <button onClick={() => setVideo(it.exerciseId)} className="press flex items-center gap-1 rounded-full bg-[#e9e400] px-3 py-1 text-[10.5px] font-black text-black"><Play size={11} fill="currentColor" /> ویدیو آموزشی</button>
                </div>
                {(it.notes || e.tips) && (
                  <p className="mt-2 flex gap-1.5 rounded-xl bg-[#e9e400]/[0.07] p-2.5 text-[11.5px] leading-6">
                    <Info size={14} className="mt-1 shrink-0 text-[#e9e400]" />
                    <span><b>نکته {coach?.name ?? "مربی"}: </b>{it.notes || e.tips}</span>
                  </p>
                )}
                {prev && <p className="mt-1.5 text-[11px] text-[var(--color-mute)]">دفعه قبل: <b className="text-[var(--color-ink)]">{prev}</b></p>}
                <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-[var(--color-bg)] px-2.5 py-1.5 text-[10.5px] font-bold text-[var(--color-mute)]">
                  <Lock size={11} className="shrink-0" /> ست، تکرار و وزن را {coach?.name ?? "مربی"} تعیین کرده و قابل تغییر نیست
                </p>
                <div className="mt-2 grid grid-cols-[34px_1fr_1fr_44px] items-center gap-1.5 text-center text-[10.5px] font-bold text-[var(--color-mute)]">
                  <span>ست</span><span>وزن</span><span>تکرار</span><span>انجام</span>
                </div>
                {marks.map((d, i) => (
                  <div key={i} className={`mt-1.5 grid grid-cols-[34px_1fr_1fr_44px] items-center gap-1.5 rounded-xl p-1 transition ${d ? "bg-emerald-500/10" : ""}`}>
                    <span className="tnum text-center text-[13px] font-black">{fa(i + 1)}</span>
                    <span className="tnum flex h-10 items-center justify-center truncate rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-1 text-[12.5px] font-black">{fa(it.weight)}</span>
                    <span className="tnum flex h-10 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] text-[12.5px] font-black">{fa(it.reps)}</span>
                    <button
                      onClick={() => toggle(idx, i)}
                      className={`press mx-auto flex h-10 w-10 items-center justify-center rounded-full ${d ? "bg-emerald-500 text-white" : "border border-[var(--color-line)] bg-[var(--color-bg)]"}`}
                      aria-label={`انجام ست ${i + 1}`}
                    >
                      <Check size={17} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <WeekPlan program={program} today={today} />

      {draft.startedAt && (
        <div className="sticky bottom-2 z-20 flex gap-2 pt-1">
          <button
            onClick={() => {
              if (confirm("تمرین لغو شود؟ تیک‌های این جلسه پاک می‌شود.")) {
                localStorage.removeItem(draftKey(stId));
                setDraft(fresh());
              }
            }}
            className="press flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]"
            aria-label="لغو"
          >
            <RotateCcw size={17} />
          </button>
          <button
            onClick={() => (doneSets === 0 ? onToast("هنوز ستی انجام نشده", "حداقل یک ست را تیک بزن") : setSummary(true))}
            className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black shadow-[0_14px_36px_-12px_rgba(233,228,0,0.7)]"
          >
            <CheckCircle size={17} /> پایان و ثبت تمرین
          </button>
        </div>
      )}

      {rest && (
        <div className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-[var(--color-card)] p-6 text-center">
            <p className="text-[12px] font-black tracking-widest text-sky-300">REST • استراحت</p>
            <div className="relative mx-auto mt-3 h-40 w-40">
              <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90">
                <circle cx="75" cy="75" r="64" fill="none" stroke="var(--color-line)" strokeWidth="10" />
                <circle cx="75" cy="75" r="64" fill="none" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - rest.left / rest.total)} className="ring-anim" />
              </svg>
              <span className="tnum absolute inset-0 flex items-center justify-center text-[36px] font-black">{formatClock(rest.left)}</span>
            </div>
            <div className="mt-4 flex justify-center gap-2 text-[12px] font-black">
              <button onClick={() => setRest((r) => (r ? { ...r, left: Math.max(0, r.left - 15) } : r))} className="press rounded-full bg-[var(--color-bg)] px-3 py-2">−۱۵</button>
              <button onClick={() => setRestRun((v) => !v)} className="press flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg)]" aria-label="توقف/ادامه">{restRun ? <Pause size={16} /> : <Play size={16} />}</button>
              <button onClick={() => setRest((r) => (r ? { left: r.left + 15, total: r.total + 15 } : r))} className="press rounded-full bg-[var(--color-bg)] px-3 py-2">+۱۵</button>
            </div>
            <button onClick={() => setRest(null)} className="press mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-[#e9e400] text-[13px] font-black text-black"><SkipForward size={16} /> رد کردن استراحت</button>
          </div>
        </div>
      )}

      {video && (
        <div className="overlay-in fixed inset-0 z-50 flex items-end bg-black/75 sm:items-center sm:justify-center sm:p-6" onClick={() => setVideo(null)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-[var(--color-card)] p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const e = resolveExercise(video, data);
              return (
                <>
                  <div className="mb-2 flex items-center justify-between"><b>{e.name}</b><button onClick={() => setVideo(null)} aria-label="بستن"><X size={18} /></button></div>
                  <ExVideo exerciseId={video} data={data} />
                  {e.how && <p className="mt-2 text-[12.5px] leading-6 text-[var(--color-mute)]">{e.how}</p>}
                  <p className="mt-1 text-[12px]"><b>عضله: </b>{e.muscle} • <b>وسیله: </b>{e.equipment}</p>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {summary && (
        <div className="overlay-in fixed inset-0 z-50 flex items-end bg-black/75 sm:items-center sm:justify-center sm:p-6">
          <div className="w-full max-w-lg rounded-t-3xl bg-[var(--color-card)] p-5 text-center sm:rounded-3xl">
            <div className="pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e9e400]"><Trophy size={28} className="text-black" /></div>
            <h3 className="mt-3 text-[19px] font-black">آفرین! جلسه تمام شد</h3>
            <p className="text-[12px] text-[var(--color-mute)]">{day.weekday} — {day.focus} • {formatDateTime(new Date())}</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <Stat v={formatClock(elapsed)} l="زمان" />
              <Stat v={`${fa(doneSets)}/${fa(allSets)}`} l="ست" />
              <Stat v={fa(reps)} l="تکرار" />
              <Stat v={fa(Math.round(volume))} l="حجم kg" />
            </div>
            {doneSets < allSets && <p className="mt-3 text-[11.5px] text-amber-400">{fa(allSets - doneSets)} ست انجام نشده — مربی این را می‌بیند.</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setSummary(false)} className="press h-12 flex-1 rounded-2xl border border-[var(--color-line)] text-[13px] font-bold">ادامه تمرین</button>
              <button onClick={save} className="press h-12 flex-[2] rounded-2xl bg-[#e9e400] text-[14px] font-black text-black">ذخیره و ارسال برای مربی</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekPlan({ program, today }: { program: WorkoutProgram; today: string }) {
  const { data } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const days = [...program.days].sort((a, b) => WEEK.indexOf(a.weekday) - WEEK.indexOf(b.weekday));
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3.5">
      <b className="flex items-center gap-1.5 text-[13.5px]"><CalendarDays size={15} className="text-[#e9e400]" /> برنامه هفتگی</b>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--color-mute)]"><Lock size={11} /> فقط مشاهده — هر روز فقط تمرین همان روز باز می‌شود</p>
      <div className="mt-2.5 space-y-1.5">
        {days.map((d) => {
          const isToday = d.weekday === today;
          const isOpen = open === d.id;
          return (
            <div key={d.id} className={`overflow-hidden rounded-xl border ${isToday ? "border-[#e9e400]/40 bg-[#e9e400]/[0.06]" : "border-[var(--color-line)] bg-[var(--color-bg)]"}`}>
              <button onClick={() => setOpen(isOpen ? null : d.id)} className="flex w-full items-center gap-2 p-2.5 text-right">
                <b className="text-[12.5px]">{d.weekday}</b>
                {isToday && <Pill tone="brand">امروز</Pill>}
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--color-mute)]">{d.focus}</span>
                <span className="tnum shrink-0 text-[11px] text-[var(--color-mute)]">{fa(d.items.length)} حرکت</span>
                <ChevronDown size={14} className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="space-y-1.5 border-t border-[var(--color-line)] p-2.5">
                  {d.items.length === 0 && <p className="text-[11px] text-[var(--color-mute)]">حرکتی ندارد</p>}
                  {d.items.map((it, i) => (
                    <div key={it.id} className="flex items-center gap-2">
                      <span className="tnum w-4 text-[10.5px] font-black text-[#e9e400]">{fa(i + 1)}</span>
                      <ExThumb exerciseId={it.exerciseId} data={data} className="h-8 w-8 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{resolveExercise(it.exerciseId, data).name}</span>
                      <span className="tnum shrink-0 text-[11px] text-[var(--color-mute)]">{fa(it.sets)}×{fa(it.reps)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-1 py-2">
      <b className="tnum block text-[14px]">{v}</b>
      <span className="text-[10px] text-[var(--color-mute)]">{l}</span>
    </div>
  );
}

/* ================= HISTORY ================= */
function HistoryView({ stId }: { stId: string }) {
  const { data } = useStore();
  const logs = [...data.logs.filter((l) => l.studentId === stId)].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const analytics = trainingAnalytics(data, stId);
  const mins = logs.reduce((a, l) => a + l.durationMin, 0);
  const vol = logs.reduce((a, l) => a + l.items.reduce((x, i) => x + i.sets.filter((s) => s.done).reduce((y, s) => y + s.weight * s.reps, 0), 0), 0);
  return (
    <div className="screen-in space-y-3 pb-4">
      <div className="grid grid-cols-4 gap-2">
        <Mini icon={<CheckCircle size={15} />} v={fa(logs.length)} l="جلسه" />
        <Mini icon={<Timer size={15} />} v={fa(mins)} l="دقیقه" />
        <Mini icon={<Flame size={15} />} v={fa(workoutStreak(data, stId))} l="روز متوالی" />
        <Mini icon={<Scale size={15} />} v={fa(Math.round(vol / 1000))} l="تن حجم" />
      </div>
      <p className="text-[11.5px] text-[var(--color-mute)]">همه جلسه‌ها با تاریخ و ساعت دقیق ذخیره شده‌اند و مربی هم آن‌ها را می‌بیند.</p>
      {!!analytics.records.length && <div className="rounded-2xl border border-[#e9e400]/20 bg-[var(--color-card)] p-3"><b className="text-[13px]">رکوردهای شخصی</b>{analytics.records.slice(0,6).map((r,i) => <div key={`${r.exerciseId}-${i}`} className="mt-2 flex justify-between gap-2 text-[11px]"><span className="truncate">{resolveExercise(r.exerciseId,data).name}</span><b className="tnum shrink-0 text-[#e9e400]">{fa(r.previous)} → {fa(r.weight)} kg × {fa(r.reps)}</b></div>)}</div>}
      <LogsList logs={logs} />
    </div>
  );
}

/* ================= PROGRESS ================= */
function ProgressView({ stId, onToast }: { stId: string; onToast: (t: string, d: string) => void }) {
  const { data, addProgress, addSleep, addGoal, updateMyStudent } = useStore();
  const pr = [...data.progress.filter((p) => p.studentId === stId)].sort((a, b) => a.date.localeCompare(b.date));
  const goals = data.goals.filter((g) => g.studentId === stId);
  const sleeps = data.sleep[stId] ?? [];
  const logsCount = data.logs.filter((l) => l.studentId === stId).length;
  const [w, setW] = useState("");
  const [waist, setWaist] = useState("");
  const [bed, setBed] = useState("23:30");
  const [wake, setWake] = useState("07:00");
  const [gTitle, setGTitle] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gCur, setGCur] = useState("");
  const streak = workoutStreak(data, stId);
  const xp = xpOf(data, stId);
  const level = Math.floor(xp / 400) + 1;
  const badges = [
    { t: "اولین تمرین", ok: logsCount >= 1 },
    { t: "۱۰ تمرین", ok: logsCount >= 10 },
    { t: "۷ روز متوالی", ok: streak >= 7 },
    { t: "۳۰ تمرین", ok: logsCount >= 30 },
    { t: "۳۰ روز متوالی", ok: streak >= 30 },
    { t: "۱۰۰ تمرین", ok: logsCount >= 100 },
  ];
  const ws = pr.map((p) => p.weight);
  const min = ws.length ? Math.min(...ws) - 2 : 0;
  const max = ws.length ? Math.max(...ws) + 1 : 1;

  const sleepHours = () => {
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = wake.split(":").map(Number);
    const mins = ((wh * 60 + wm) - (bh * 60 + bm) + 1440) % 1440;
    return +(mins / 60).toFixed(1);
  };

  return (
    <div className="screen-in space-y-3 pb-4">
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-l from-[#e9e400]/15 to-[var(--color-card)] p-3.5">
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-[#e9e400] text-black">
          <Zap size={14} fill="currentColor" />
          <b className="tnum text-[15px] leading-4">{fa(level)}</b>
        </div>
        <div className="flex-1">
          <b>سطح {fa(level)}</b>
          <ProgressBar pct={((xp % 400) / 400) * 100} className="mt-1.5" />
          <p className="tnum mt-1 text-[11px] text-[var(--color-mute)]">{fa(xp)} XP • {fa(400 - (xp % 400))} تا سطح بعد</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {badges.map((b) => (
          <div key={b.t} className={`rounded-2xl p-2.5 text-center ${b.ok ? "bg-[#e9e400]/15" : "bg-[var(--color-card)] opacity-45"}`}>
            <Trophy size={17} className={`mx-auto ${b.ok ? "text-[#e9e400]" : ""}`} />
            <p className="mt-1 text-[10.5px] font-bold">{b.t}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[var(--color-card)] p-3.5">
        <b className="flex items-center gap-1.5"><Scale size={15} className="text-[#e9e400]" /> ثبت وزن و دور کمر</b>
        {pr.length > 0 && (
          <div className="mt-3 flex h-24 items-end gap-1.5">
            {pr.slice(-10).map((p) => (
              <div key={p.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="tnum text-[9px]">{fa(p.weight)}</span>
                <div className="w-full rounded-t bg-[#e9e400]" style={{ height: `${Math.max(8, ((p.weight - min) / (max - min || 1)) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <input className={inputCls} placeholder="وزن (kg)" value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" />
          <input className={inputCls} placeholder="کمر (cm)" value={waist} onChange={(e) => setWaist(e.target.value)} inputMode="decimal" />
          <BrandBtn onClick={() => {
            const val = num(w);
            if (!val) return onToast("وزن را وارد کن", "");
            addProgress({ studentId: stId, date: nowIso(), weight: val, arm: 0, waist: num(waist), chest: 0, thigh: 0 });
            updateMyStudent({ weight: val });
            onToast("ثبت شد", `${fa(val)} کیلو • ${formatDateTime(new Date())}`);
            setW("");
            setWaist("");
          }}>ثبت</BrandBtn>
        </div>
        {pr.length > 0 && (
          <div className="mt-3 max-h-36 space-y-1 overflow-y-auto">
            {[...pr].reverse().map((p) => (
              <p key={p.id} className="flex justify-between text-[11.5px]"><span className="text-[var(--color-mute)]">{formatDateTime(p.date)}</span><b className="tnum">{fa(p.weight)} kg{p.waist ? ` • کمر ${fa(p.waist)}` : ""}</b></p>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-[var(--color-card)] p-3.5">
        <b className="flex items-center gap-1.5"><Target size={15} className="text-[#e9e400]" /> اهداف من</b>
        {goals.map((g) => {
          const pct = ((g.current - g.start) / ((g.target - g.start) || 1)) * 100;
          return (
            <div key={g.id} className="mt-2.5">
              <div className="flex justify-between text-[12px]"><b>{g.title}</b><span className="tnum">{fa(g.current)} → {fa(g.target)} {g.unit}</span></div>
              <ProgressBar pct={pct} className="mt-1" />
            </div>
          );
        })}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input className={inputCls} placeholder="عنوان (مثلاً وزن)" value={gTitle} onChange={(e) => setGTitle(e.target.value)} />
          <input className={inputCls} placeholder="فعلی" value={gCur} onChange={(e) => setGCur(e.target.value)} inputMode="decimal" />
          <input className={inputCls} placeholder="هدف" value={gTarget} onChange={(e) => setGTarget(e.target.value)} inputMode="decimal" />
        </div>
        <button
          onClick={() => {
            const c = num(gCur);
            const t = num(gTarget);
            if (!gTitle.trim() || !t) return onToast("عنوان و هدف لازم است", "");
            addGoal({ studentId: stId, title: gTitle.trim(), unit: "", start: c, current: c, target: t });
            setGTitle("");
            setGCur("");
            setGTarget("");
            onToast("هدف اضافه شد", "");
          }}
          className="press mt-2 flex items-center gap-1 rounded-full bg-[var(--color-bg)] px-3 py-2 text-[12px] font-bold"
        >
          <Plus size={13} /> افزودن هدف
        </button>
      </div>

      <div className="rounded-2xl bg-[var(--color-card)] p-3.5">
        <b className="flex items-center gap-1.5"><Moon size={15} className="text-[#e9e400]" /> ثبت خواب</b>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="ساعت خواب"><input className={inputCls} type="time" value={bed} onChange={(e) => setBed(e.target.value)} /></Field>
          <Field label="ساعت بیداری"><input className={inputCls} type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
        </div>
        <button onClick={() => { const h = sleepHours(); addSleep(stId, h, bed, wake); onToast("خواب ثبت شد", `${fa(h)} ساعت`); }} className="press mt-2 w-full rounded-full bg-[var(--color-bg)] py-2.5 text-[12.5px] font-black">
          ثبت خواب امروز ({fa(sleepHours())} ساعت)
        </button>
        {sleeps.slice(-5).reverse().map((s, i) => (
          <p key={i} className="mt-1.5 flex justify-between text-[11.5px] text-[var(--color-mute)]"><span>{formatJalaliDate(s.date)}</span><span className="tnum">{fa(s.hours)} ساعت ({fa(s.bed)} تا {fa(s.wake)})</span></p>
        ))}
      </div>
      <StudentCheckin studentId={stId} onToast={onToast} />
    </div>
  );
}

/* ================= CHAT ================= */
function ChatView({ stId, nav }: { stId: string; nav: (v: StudentView) => void }) {
  const { data, markChatRead } = useStore();
  const { coach } = useStudentBasics(stId);
  const msgs = data.messages.filter((m) => m.studentId === stId);

  useEffect(() => {
    markChatRead(stId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);

  if (!coach) {
    return (
      <div className="py-10">
        <Empty text="برای گفتگو، اول با کد مربی به مربی‌ات وصل شو." />
        <BrandBtn className="mx-auto mt-3" onClick={() => nav("profile")}>وارد کردن کد مربی</BrandBtn>
      </div>
    );
  }

  return (
    <div className="screen-in flex h-full min-h-0 flex-col">
      <div className="mx-3 mb-2 mt-2 flex shrink-0 items-center gap-2.5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-2.5">
        <img src={coach.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[13px]">{coach.name}</b>
          <span className="text-[10.5px] text-[var(--color-mute)]">مربی شما • آخرین ورود {formatRelative(coach.lastLoginAt)}</span>
        </div>
        <span className="tnum shrink-0 text-[10.5px] text-[var(--color-mute)]">{fa(msgs.length)} پیام</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl border-t border-[var(--color-line)] bg-[var(--color-bg2)]">
        <ChatThread
          studentId={stId}
          me="student"
          peerName={coach.name}
          peerAvatar={coach.avatar}
          placeholder={`پیام به ${coach.name}…`}
          compact
        />
      </div>
    </div>
  );
}

/* ================= PROFILE ================= */
function ProfileView({ stId, onToast }: { stId: string; onToast: (t: string, d: string) => void }) {
  const { data, logout, joinCoach, markNotif } = useStore();
  const { t } = useLang();
  const [notifPrefs] = useNotifPrefs();
  const { coach } = useStudentBasics(stId);
  const [code, setCode] = useState("");
  const notifs = data.notifs.filter((n) => notifVisible(n.title, notifPrefs));

  return (
    <div className="screen-in space-y-3 pb-6">
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b className="flex items-center gap-1.5 text-[14px]"><Ticket size={16} className="text-[#e9e400]" /> مربی من</b>
        {coach ? (
          <div className="mt-3 flex items-center gap-3">
            <img src={coach.avatar} className="h-12 w-12 rounded-full object-cover" alt="" />
            <div>
              <b className="block text-[14px]">{coach.name}</b>
              <span className="text-[11.5px] text-[var(--color-mute)]" dir="ltr">{coach.email}</span>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-[12px] text-[var(--color-mute)]">کد ۶ حرفی که مربی به تو داده را وارد کن.</p>
            <div className="mt-2 flex gap-2">
              <input className={`${inputCls} tracking-[0.3em]`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A3K9PQ" dir="ltr" maxLength={8} />
              <BrandBtn onClick={async () => { const e = await Promise.resolve(joinCoach(code)); if (e) onToast(e, ""); else { onToast("به مربی وصل شدی", "حالا برنامه‌ات را از او می‌گیری"); setCode(""); } }}>اتصال</BrandBtn>
            </div>
          </>
        )}
      </div>

      <ProfileEditor onToast={onToast} />

      <SettingsSection icon={<Palette size={17} />} title={t("set.appearance")}>
        <AppearanceSettings onToast={onToast} />
      </SettingsSection>

      <SettingsSection icon={<Globe size={17} />} title={t("set.language")}>
        <LanguageSection />
      </SettingsSection>

      <SettingsSection icon={<Bell size={17} />} title={t("set.notifications")}>
        <NotificationSection />
        <div className="mt-3 border-t border-[var(--color-line)] pt-3">
          {notifs.length === 0 && <p className="mt-2 text-[12px] text-[var(--color-mute)]">اعلانی نداری.</p>}
          {notifs.slice(0, 10).map((n) => (
            <button key={n.id} onClick={() => markNotif(n.id)} className="press mt-2 flex w-full items-start gap-2 rounded-xl bg-[var(--color-bg)] p-2.5 text-right">
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#e9e400]" />}
              <span className="flex-1">
                <b className="block text-[12.5px]">{n.title}</b>
                <span className="block text-[11.5px] text-[var(--color-mute)]">{n.body}</span>
                <span className="text-[10px] text-[var(--color-mute)]">{formatRelative(n.time)}</span>
              </span>
            </button>
          ))}
        </div>
      </SettingsSection>

      <button onClick={() => { logout(); go("/login"); }} className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/15 py-3.5 text-[13px] font-black text-red-400">
        <LogOut size={16} /> خروج از حساب
      </button>
      <p className="text-center text-[10.5px] text-[var(--color-mute)]" dir="ltr">Revo sport</p>
    </div>
  );
}
