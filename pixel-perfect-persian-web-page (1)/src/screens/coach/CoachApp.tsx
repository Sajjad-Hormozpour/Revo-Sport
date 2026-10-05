import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Users, Dumbbell, Library, CalendarDays, MessageCircle,
  LineChart, Sparkles, CreditCard, Shield, Search,
  Menu, X, Zap, AlertTriangle, Clock, ChevronLeft, ChevronDown, ChevronUp, Send, Video, History,
  CheckCircle, Settings, UserRound, SlidersHorizontal,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { useLang } from "../../lib/i18n";
import { fa } from "../../lib/core";
import { ClockLive, Pill, StatCard, subTone } from "../../components/ui";
import { InviteCard, ProfileEditor } from "../../components/profile";
import { dayKey, daysBetween, formatDateTime, formatRelative, greetingAt, parseDate, WEEK_S } from "../../lib/time";
import { daysSinceWorkout, liveSubStatus, programDaysLeft, weekMinutes } from "../../lib/metrics";
import CoachStudents from "./CoachStudents";
import CoachTraining from "./CoachTraining";
import CoachMoves from "./CoachMoves";
import CoachSubscriptions from "./CoachSubscriptions";
import CoachSettings from "./CoachSettings";
import CoachNotifications from "./CoachNotifications";
import { calculateAdherence } from "../../lib/adherence";
import CoachHub from "./CoachHub";

export type CoachView =
  | "dash" | "students" | "student" | "programs" | "library" | "moves"
  | "calendar" | "chat" | "reports" | "ai" | "billing" | "plans" | "profile" | "settings" | "admin";

const NAV: { id: CoachView; label: string; icon: typeof LayoutDashboard; admin?: boolean }[] = [
  { id: "dash", label: "nav.dash", icon: LayoutDashboard },
  { id: "students", label: "nav.students", icon: Users },
  { id: "programs", label: "nav.programs", icon: Dumbbell },
  { id: "moves", label: "nav.moves", icon: Video },
  { id: "library", label: "nav.library", icon: Library },
  { id: "calendar", label: "nav.calendar", icon: CalendarDays },
  { id: "chat", label: "nav.chat", icon: MessageCircle },
  { id: "reports", label: "nav.reports", icon: LineChart },
  { id: "ai", label: "nav.ai", icon: Sparkles },
  { id: "billing", label: "nav.billing", icon: CreditCard },
  { id: "settings", label: "nav.settings", icon: Settings },
  { id: "admin", label: "nav.admin", icon: Shield, admin: true },
];

export default function CoachApp({
  view, studentId, onView, onToast,
}: {
  view: CoachView;
  studentId: string | null;
  onView: (v: CoachView, sid?: string) => void;
  onToast: (t: string, d: string) => void;
}) {
  const { data, session, userById } = useStore();
  const { t, dir } = useLang();
  const me = userById(session!.userId)!;
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const unreadChat = data.messages.filter((m) => m.unread && m.from === "student").length;

  const stats = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const sts = data.students;
    const active = sts.filter((s) => s.status === "active").length;
    const news = sts.filter((s) => {
      const d = parseDate(s.startDate);
      return d ? daysBetween(d, now) <= 7 : false;
    }).length;
    const progActive = data.programs.filter((p) => p.status === "فعال").length;
    const ending = data.programs.filter((p) => {
      const l = programDaysLeft(p.endDate, now);
      return l <= 7 && l >= 0;
    }).length;
    const todayAp = data.appts.filter((a) => (a.date === today || dayKey(parseDate(a.startAt) ?? new Date(0)) === today) && a.status === "رزرو").length;
    const idle = sts
      .map((s) => {
        const dsw = daysSinceWorkout(data, s.id, now);
        const joined = parseDate(s.startDate);
        const idleDays = dsw === null ? (joined ? daysBetween(joined, now) : 0) : dsw;
        return { id: s.id, userId: s.userId, daysSinceWorkout: idleDays, subscription: liveSubStatus(s, now) };
      })
      .filter((s) => s.daysSinceWorkout >= 3);
    const payWait = data.invoices.filter((i) => i.status === "در انتظار").length;
    const todayLogs = data.logs.filter((l) => l.date === today).length;
    return { total: sts.length, active, news, progActive, ending, todayAp, idle, payWait, todayLogs };
  }, [data]);

  const navView = view === "plans" ? "billing" : view;
  const title = NAV.find((n) => n.id === navView)?.label
    ? t(NAV.find((n) => n.id === navView)!.label)
    : view === "student" ? t("nav.students") : view === "profile" ? t("nav.profile") : t("nav.dash");
  const results = q.trim() ? data.students.filter((s) => userById(s.userId)?.name.includes(q.trim())) : [];

  useEffect(() => {
    setProfileOpen(false);
    const main = mainRef.current;
    if (main) {
      main.scrollTo({ top: 0 });
      setScrollProgress(0);
      setShowTop(false);
    }
  }, [view, studentId]);

  useEffect(() => {
    if (!profileOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [profileOpen]);

  // Reveal only when content enters the coach scroll container.
  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      }),
      { root, threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );
    items.forEach((item, index) => {
      item.style.setProperty("--reveal-delay", `${Math.min(index % 8, 7) * 45}ms`);
      observer.observe(item);
    });
    return () => observer.disconnect();
  }, [view, studentId, q, data.coachExercises.length]);

  const handleScroll = () => {
    const main = mainRef.current;
    if (!main) return;
    const max = main.scrollHeight - main.clientHeight;
    setScrollProgress(max > 0 ? Math.min(100, (main.scrollTop / max) * 100) : 0);
    setShowTop(main.scrollTop > 420);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-bg)]" dir={dir}>
      {open && <div className="fixed inset-0 z-[60] bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 right-0 z-[70] flex w-[min(82vw,300px)] flex-col border-l border-[var(--color-line)] bg-[var(--color-bg2)] transition-transform lg:static lg:w-[276px] lg:translate-x-0 ${open ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e9e400] shadow-[0_8px_24px_-8px_rgba(233,228,0,0.7)]">
              <Zap size={19} strokeWidth={3} className="text-black" fill="currentColor" />
            </span>
            <span>
              <b className="block text-[15px] font-black" dir="ltr">Revo sport</b>
              <span className="text-[10.5px] text-[var(--color-mute)]">{me.role === "admin" ? "مدیر سیستم" : "پنل اختصاصی مربی"}</span>
            </span>
          </span>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="بستن"><X size={18} /></button>
        </div>
        <nav className="noscroll flex-1 overflow-y-auto px-2 pb-3">
          {NAV.filter((n) => !n.admin || me.role === "admin").map((n) => {
            const active = navView === n.id || (n.id === "students" && view === "student");
            const badge = n.id === "chat" ? unreadChat : 0;
            return (
              <button
                key={n.id}
                onClick={() => { onView(n.id); setOpen(false); setQ(""); }}
                aria-current={active ? "page" : undefined}
                className={`press mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold ${active ? "bg-[#e9e400] text-black" : "text-[var(--color-mute)] hover:bg-white/5 hover:text-[var(--color-ink)]"}`}
              >
                <n.icon size={17} />
                <span className="flex-1 text-right">{t(n.label)}</span>
                {badge > 0 && !active && <span className="tnum rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">{fa(badge)}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-[var(--color-line)] px-3 py-2 text-center text-[10px] text-[var(--color-mute)]">
          Revo sport • Coach workspace
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-strong relative z-50 flex shrink-0 flex-wrap items-center gap-2 border-x-0 border-t-0 px-3 py-2 mobile-safe-top sm:h-[68px] sm:flex-nowrap sm:px-5">
          <button className="press glass-subtle flex h-10 w-10 items-center justify-center rounded-2xl lg:hidden" onClick={() => setOpen(true)} aria-label="منو">
            <Menu size={18} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[13px] font-black sm:hidden">{title}</h1>
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-[15px] font-black">{title}</h1>
            <span className="block text-[9.5px] font-bold tracking-[0.16em] text-[var(--color-mute)]" dir="ltr">REVO SPORT COACH</span>
          </div>
          <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:mr-auto sm:w-auto sm:flex-1 sm:max-w-[340px]">
            <div className="glass-subtle flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2.5 transition focus-within:border-[#e9e400]/50">
              <Search size={15} className="shrink-0 text-[var(--color-mute)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو شاگرد…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--color-mute)]" />
            </div>
          </div>
          <div className="glass-subtle hidden items-center rounded-2xl px-3 py-1.5 md:block"><ClockLive /></div>
          <CoachNotifications onView={(nextView, sid) => { setQ(""); onView(nextView, sid); }} />
          <div ref={profileRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              aria-label="منوی پروفایل مربی"
              aria-expanded={profileOpen}
              className={`press flex h-10 items-center gap-2 rounded-2xl border px-1.5 pl-2 text-right outline-none transition focus-visible:ring-2 focus-visible:ring-[#e9e400] ${
                profileOpen || view === "profile" ? "border-[#e9e400]/40 bg-[#e9e400]/10" : "border-[var(--color-line)] bg-[var(--color-card)]"
              }`}
            >
              <span className="relative">
                <img src={me.avatar} alt="" className="h-7 w-7 rounded-xl object-cover" />
                <span className="absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-full border-2 border-[var(--color-card)] bg-emerald-500" />
              </span>
              <span className="hidden max-w-28 min-w-0 lg:block">
                <b className="block truncate text-[11px] leading-4">{me.name}</b>
                <span className="block truncate text-[9px] text-[var(--color-mute)]">{me.role === "admin" ? "مدیر سیستم" : "مربی"}</span>
              </span>
              <ChevronDown size={13} className={`text-[var(--color-mute)] transition ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="screen-in glass-strong absolute left-0 top-[calc(100%+10px)] z-[65] w-[270px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[20px]">
                <div className="flex items-center gap-3 border-b border-[var(--color-line)] p-3.5">
                  <img src={me.avatar} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-[#e9e400]/40" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px]">{me.name}</b>
                    <span className="block truncate text-[10.5px] text-[var(--color-mute)]" dir="ltr" style={{ textAlign: "right" }}>{me.email}</span>
                  </div>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="آنلاین" />
                </div>
                <div className="space-y-1 p-2">
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); setQ(""); onView("profile"); }}
                    className={`press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold ${view === "profile" ? "bg-[#e9e400] text-black" : "hover:bg-[var(--color-bg)]"}`}
                  >
                    <UserRound size={15} /> پروفایل من
                    <ChevronLeft size={13} className="mr-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); setQ(""); onView("settings"); }}
                    className={`press flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold ${view === "settings" ? "bg-[#e9e400] text-black" : "hover:bg-[var(--color-bg)]"}`}
                  >
                    <SlidersHorizontal size={15} /> تنظیمات
                    <ChevronLeft size={13} className="mr-auto" />
                  </button>
                </div>
                <div className="border-t border-[var(--color-line)] px-3 py-2 text-center text-[9.5px] text-[var(--color-mute)]">Revo sport • Coach workspace</div>
              </div>
            )}
          </div>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--color-line)]">
            <span className="block h-full bg-[#e9e400] transition-[width] duration-150" style={{ width: `${scrollProgress}%` }} />
          </span>
        </header>

        <main
          ref={mainRef}
          onScroll={handleScroll}
          className={`coach-scroll min-h-0 flex-1 ${view === "chat" && !q.trim() ? "overflow-hidden p-0 sm:p-3" : "overflow-y-auto p-3 sm:p-5"}`}
        >
          {q.trim() ? (
            <div className="screen-in space-y-2">
              <p className="text-[12px] text-[var(--color-mute)]">نتایج جستجو ({fa(results.length)})</p>
              {results.map((s) => (
                <button key={s.id} onClick={() => { onView("student", s.id); setQ(""); }} className="press flex w-full items-center gap-3 rounded-2xl bg-[var(--color-card)] p-3 text-right">
                  <img src={userById(s.userId)?.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
                  <span className="flex-1">
                    <b className="block text-[13px]">{userById(s.userId)?.name}</b>
                    <span className="text-[11px] text-[var(--color-mute)]">{s.goal} • {s.level}</span>
                  </span>
                  <ChevronLeft size={16} />
                </button>
              ))}
            </div>
          ) : view === "dash" ? (
            <Dashboard stats={stats} onView={onView} coachName={me.name} onToast={onToast} />
          ) : view === "students" || view === "student" ? (
            <CoachStudents
              focusId={view === "student" ? studentId : null}
              onOpen={(id) => onView("student", id)}
              onBack={() => onView("students")}
              onGo={(v) => onView(v)}
              onToast={onToast}
            />
          ) : view === "programs" || view === "library" ? (
            <CoachTraining mode={view} onToast={onToast} onGoMoves={() => onView("moves")} />
          ) : view === "plans" || view === "billing" ? (
            <CoachSubscriptions
              tab={view === "plans" ? "plans" : "payments"}
              onTabChange={(tab) => onView(tab === "plans" ? "plans" : "billing")}
              onToast={onToast}
            />
          ) : view === "moves" ? (
            <CoachMoves onToast={onToast} />
          ) : view === "profile" ? (
            <div className="screen-in mx-auto max-w-3xl space-y-3">
              {me.role === "coach" && <InviteCard onToast={onToast} />}
              <ProfileEditor onToast={onToast} />
            </div>
          ) : view === "settings" ? (
            <CoachSettings onToast={onToast} />
          ) : (
            <CoachHub view={view} onView={onView} onToast={onToast} />
          )}
        </main>
        <button
          type="button"
          onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="بازگشت به بالای صفحه"
          className={`press fixed bottom-5 left-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#e9e400]/30 bg-[var(--color-card)] text-[#e9e400] shadow-[0_14px_35px_-12px_rgba(0,0,0,0.65)] transition-all duration-300 ${
            showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          <ChevronUp size={18} />
        </button>
      </div>
    </div>
  );
}

function Dashboard({
  stats, onView, coachName, onToast,
}: {
  stats: {
    total: number; active: number; news: number; progActive: number; ending: number; todayAp: number;
    idle: { id: string; userId: string; daysSinceWorkout: number; subscription: string }[];
    payWait: number; todayLogs: number;
  };
  onView: (v: CoachView, sid?: string) => void;
  coachName: string;
  onToast: (t: string, d: string) => void;
}) {
  const { data, userById, markNotif } = useStore();
  const today = dayKey();
  const mins = weekMinutes(data);
  const maxM = Math.max(30, ...mins);
  const recentLogs = [...data.logs].sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 6);
  const stName = (sid: string) => userById(data.students.find((s) => s.id === sid)?.userId ?? "")?.name ?? "شاگرد";
  const tasks = data.students.flatMap((student) => {
    const task: { id: string; label: string; detail: string; view: CoachView; sid?: string }[] = [];
    const name = stName(student.id);
    const inactive = daysSinceWorkout(data, student.id);
    if (inactive !== null && inactive >= 3) task.push({id:`idle-${student.id}`,label:`${name} • غیرفعال`,detail:`${fa(inactive)} روز بدون تمرین`,view:'student',sid:student.id});
    if (data.checkins.some((c) => c.studentId === student.id && c.status === 'pending')) task.push({id:`check-${student.id}`,label:`${name} • چک‌این جدید`,detail:'نیاز به بررسی مربی',view:'student',sid:student.id});
    const rate = calculateAdherence(data,student.id);
    if (rate.overall !== null && rate.overall < 60) task.push({id:`rate-${student.id}`,label:`${name} • پایبندی پایین`,detail:`${fa(rate.overall)}٪ این هفته`,view:'student',sid:student.id});
    if (data.programs.some((p) => p.studentId === student.id && p.status === 'فعال' && programDaysLeft(p.endDate) >= 0 && programDaysLeft(p.endDate) <= 2)) task.push({id:`end-${student.id}`,label:`${name} • پایان برنامه`,detail:'برنامه جدید آماده کن',view:'programs',sid:student.id});
    return task;
  });

  return (
    <div className="screen-in space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-gradient-to-l from-[#e9e400]/15 via-[var(--color-card)] to-[var(--color-card)] p-5">
          <p className="text-[12px] font-bold text-[#e9e400]">{greetingAt()} • ذخیره خودکار فعال</p>
          <h2 className="mt-1 text-[22px] font-black">{coachName}، پنل اختصاصی تو</h2>
          <p className="mt-1 text-[12.5px] leading-6 text-[var(--color-mute)]">
            فقط شاگردانی که با کد تو ثبت‌نام کرده‌اند یا خودت اضافه کرده‌ای اینجا دیده می‌شوند.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => onView("students")} className="press rounded-full bg-[#e9e400] px-4 py-2 text-[12px] font-black text-black">شاگردان</button>
            <button onClick={() => onView("programs")} className="press rounded-full border border-[var(--color-line)] px-4 py-2 text-[12px] font-bold">برنامه جدید</button>
            <button onClick={() => onView("moves")} className="press rounded-full border border-[var(--color-line)] px-4 py-2 text-[12px] font-bold">حرکت جدید</button>
          </div>
        </div>
        <InviteCard onToast={onToast} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="کل شاگردان" value={fa(stats.total)} hint={`${fa(stats.active)} فعال • ${fa(stats.news)} جدید`} icon={<Users size={16} className="text-[#e9e400]" />} />
        <StatCard label="برنامه‌های فعال" value={fa(stats.progActive)} hint={`${fa(stats.ending)} رو به اتمام`} icon={<Dumbbell size={16} className="text-[#e9e400]" />} />
        <StatCard label="تمرین ثبت‌شده امروز" value={fa(stats.todayLogs)} hint={`${fa(stats.todayAp)} جلسه امروز`} icon={<CheckCircle size={16} className="text-[#e9e400]" />} />
        <StatCard label="پرداخت در انتظار" value={fa(stats.payWait)} hint="نیاز به پیگیری" icon={<CreditCard size={16} className="text-[#e9e400]" />} />
      </div>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between"><h3 className="text-[14px] font-black">کارهای امروز مربی</h3><Pill tone={tasks.length ? 'warn' : 'ok'}>{fa(tasks.length)} مورد</Pill></div>
        {tasks.length === 0 ? <p className="mt-2 text-[12px] text-[var(--color-mute)]">در حال حاضر مورد فوری برای پیگیری نیست.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{tasks.slice(0,12).map((task) => <button key={task.id} onClick={() => onView(task.view,task.sid)} className="press flex items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] p-3 text-right"><span><b className="block text-[12px]">{task.label}</b><span className="text-[11px] text-[var(--color-mute)]">{task.detail}</span></span><ChevronLeft size={15} className="text-[#e9e400]" /></button>)}</div>}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <b className="flex items-center gap-1.5 text-[14px]"><History size={16} className="text-[#e9e400]" /> تمرین‌های ثبت‌شده اخیر</b>
            <Pill tone="brand">{fa(data.logs.length)} کل</Pill>
          </div>
          {recentLogs.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">هنوز شاگردی تمرین ثبت نکرده.</p>}
          <div className="space-y-2">
            {recentLogs.map((l) => {
              const sets = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).length, 0);
              const vol = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).reduce((x, s) => x + s.weight * s.reps, 0), 0);
              return (
                <button key={l.id} onClick={() => onView("student", l.studentId)} className="press flex w-full items-center gap-3 rounded-xl bg-[var(--color-bg)] p-3 text-right">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400"><CheckCircle size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[13px]">{stName(l.studentId)}</b>
                    <span className="tnum block text-[11px] text-[var(--color-mute)]">{formatDateTime(l.at || l.date)} • {fa(l.durationMin)} دقیقه • {fa(sets)} ست • {fa(Math.round(vol))} کیلو حجم</span>
                  </span>
                  <ChevronLeft size={15} className="text-[var(--color-mute)]" />
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <b className="text-[14px]">هشدارها و اعلان‌ها</b>
            <Pill tone="danger">{fa(data.notifs.filter((n) => !n.read).length)} جدید</Pill>
          </div>
          {data.notifs.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">اعلانی نیست.</p>}
          <div className="space-y-2">
            {data.notifs.slice(0, 6).map((n) => (
              <button key={n.id} onClick={() => { markNotif(n.id); if (n.studentId) onView("student", n.studentId); }} className="press flex w-full items-start gap-2.5 rounded-xl bg-[var(--color-bg)] p-2.5 text-right">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${n.type === "alert" ? "bg-red-500/15 text-red-400" : n.type === "success" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`}>
                  {n.type === "alert" ? <AlertTriangle size={14} /> : n.type === "success" ? <CheckCircle size={14} /> : <Send size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[12.5px]">{n.title}</b>
                  <span className="block truncate text-[11px] text-[var(--color-mute)]">{n.body}</span>
                  <span className="block text-[10px] text-[var(--color-mute)]">{formatRelative(n.time)}</span>
                </span>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#e9e400]" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <b>شاگردانی که تمرین نکرده‌اند</b>
            <button onClick={() => onView("students")} className="text-[12px] font-bold text-[#e9e400]">همه</button>
          </div>
          {stats.idle.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">{stats.total === 0 ? "اول یک شاگرد اضافه کن یا کد مربی را بفرست." : "در ۳ روز اخیر همه تمرین ثبت کرده‌اند."}</p>}
          {stats.idle.map((s) => (
            <button key={s.id} onClick={() => onView("student", s.id)} className="press mb-2 flex w-full items-center gap-3 rounded-xl bg-[var(--color-bg)] p-2.5 text-right">
              <img src={userById(s.userId)?.avatar} className="h-9 w-9 rounded-full object-cover" alt="" />
              <span className="flex-1">
                <b className="block text-[13px]">{userById(s.userId)?.name}</b>
                <span className="tnum text-[11px] text-red-400">{fa(s.daysSinceWorkout)} روز بدون تمرین</span>
              </span>
              <Pill tone={subTone(s.subscription)}>{s.subscription}</Pill>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <b className="flex items-center gap-1.5"><Clock size={15} className="text-[#e9e400]" /> جلسات امروز</b>
            <button onClick={() => onView("calendar")} className="text-[12px] font-bold text-[#e9e400]">تقویم</button>
          </div>
          {data.appts.filter((a) => a.date === today || dayKey(parseDate(a.startAt) ?? new Date(0)) === today).length === 0 && (
            <p className="text-[12px] text-[var(--color-mute)]">جلسه‌ای برای امروز رزرو نشده.</p>
          )}
          {data.appts.filter((a) => a.date === today || dayKey(parseDate(a.startAt) ?? new Date(0)) === today).map((a) => (
            <div key={a.id} className="mb-2 flex items-center justify-between rounded-xl bg-[var(--color-bg)] p-3">
              <span>
                <b className="block text-[13px]">{a.title}</b>
                <span className="text-[11px] text-[var(--color-mute)]">{stName(a.studentId)}</span>
              </span>
              <span className="tnum text-[13px] font-black text-[#e9e400]">{fa(a.time)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b>دقایق تمرین شاگردان در این هفته</b>
        <div className="mt-4 flex h-28 items-end gap-2">
          {mins.map((v, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="tnum text-[9px] text-[var(--color-mute)]">{v ? fa(v) : ""}</span>
              <div className="w-full rounded-t-lg bg-[#e9e400]" style={{ height: `${Math.max(6, (v / maxM) * 100)}%`, opacity: v ? 0.9 : 0.2 }} />
              <span className="text-[10px] text-[var(--color-mute)]">{WEEK_S[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
