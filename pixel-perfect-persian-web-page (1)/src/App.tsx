import { useCallback, useEffect, useRef, useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { LanguageProvider } from "./lib/i18n";
import { copyText, go, hashPath } from "./lib/core";
import { detectServer, type PublicStats } from "./lib/remote";
import { setRemoteMedia } from "./lib/media";
import { Zap, WifiOff } from "lucide-react";
import { ToastView } from "./components/ui";
import Auth from "./screens/Auth";
import CoachApp, { type CoachView } from "./screens/coach/CoachApp";
import StudentApp, { type StudentView } from "./screens/student/StudentApp";

function parse(): { role: "auth" | "coach" | "student"; view: string; id: string | null } {
  const raw = hashPath().replace(/^\//, "");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts[0] === "login") return { role: "auth", view: "login", id: null };
  if (parts[0] === "coach") return { role: "coach", view: parts[1] || "dash", id: parts[2] || null };
  if (parts[0] === "student") return { role: "student", view: parts[1] || "home", id: null };
  return { role: "auth", view: "login", id: null };
}

const COACH_VIEWS: CoachView[] = [
  "dash", "students", "student", "programs", "library", "moves",
  "calendar", "chat", "reports", "ai", "billing", "plans", "profile", "settings", "admin",
];
const STUDENT_VIEWS: StudentView[] = ["home", "workout", "history", "progress", "chat", "subscription", "profile"];

function Splash({ text }: { text: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[var(--color-bg)]" dir="rtl">
      <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl bg-[#e9e400] shadow-[0_16px_44px_-10px_rgba(233,228,0,0.6)]">
        <Zap size={30} strokeWidth={3} className="text-black" fill="currentColor" />
      </span>
      <b className="text-[18px] font-black" dir="ltr">Revo sport</b>
      <p className="text-[12px] text-[var(--color-mute)]">{text}</p>
    </div>
  );
}

function Shell() {
  const { session, ready, serverMode, sync } = useStore();
  const [route, setRoute] = useState(parse);
  const [toast, setToast] = useState<{ title: string; desc: string } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const fn = () => setRoute(parse());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);

  useEffect(() => {
    if (!session) {
      if (route.role !== "auth") go("/login");
      return;
    }
    if (session.role === "student" && route.role !== "student") go("/student");
    if ((session.role === "coach" || session.role === "admin") && route.role !== "coach") {
      go(session.role === "admin" ? "/coach/admin" : "/coach");
    }
  }, [session, route.role]);

  const onToast = useCallback((title: string, desc: string) => {
    setToast({ title, desc });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const onShare = async () => {
    const ok = await copyText(window.location.href);
    onToast(ok ? "لینک کپی شد" : "کپی نشد", ok ? "برای بقیه بفرست تا همین صفحه را ببینند" : "از نوار آدرس کپی کن");
  };

  const coachView = (COACH_VIEWS.includes(route.view as CoachView) ? route.view : "dash") as CoachView;
  const studentView = (STUDENT_VIEWS.includes(route.view as StudentView) ? route.view : "home") as StudentView;

  if (!ready) return <Splash text="در حال اتصال به سرور…" />;

  const offline = serverMode && !!session && sync === "offline" && (
    <div className="fixed left-1/2 top-3 z-[90] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/40 bg-[var(--color-card)] px-4 py-2 text-[11.5px] font-bold text-amber-500 shadow-lg" dir="rtl">
      <WifiOff size={14} /> ارتباط با سرور قطع است؛ تغییرات بعد از وصل شدن خودکار ارسال می‌شود
    </div>
  );

  if (!session) {
    return (
      <>
        <Auth onToast={onToast} />
        <ToastView toast={toast} />
      </>
    );
  }

  if (session.role === "student") {
    return (
      <>
        {offline}
        <StudentApp
          view={studentView}
          onView={(v) => go(v === "home" ? "/student" : `/student/${v}`)}
          onToast={onToast}
          onShare={onShare}
        />
        <ToastView toast={toast} />
      </>
    );
  }

  return (
    <>
      {offline}
      <CoachApp
        view={(coachView === "students" || coachView === "student") ? (route.id ? "student" : "students") : coachView}
        studentId={route.id}
        onView={(v, sid) => {
          if (v === "student" && sid) go(`/coach/students/${sid}`);
          else if (v === "dash") go("/coach");
          else if (v === "students") go("/coach/students");
          else go(`/coach/${v}`);
        }}
        onToast={onToast}
      />
      <ToastView toast={toast} />
    </>
  );
}

export default function App() {
  // اگر سرور دیتابیس مرکزی در دسترس باشد، خودکار به حالت «دیتابیس مشترک» می‌رود
  const [boot, setBoot] = useState<{ done: boolean; remote: boolean; stats?: PublicStats }>({ done: false, remote: false });

  useEffect(() => {
    let live = true;
    detectServer().then((r) => {
      setRemoteMedia(r.ok);
      if (live) setBoot({ done: true, remote: r.ok, stats: r.stats });
    });
    return () => {
      live = false;
    };
  }, []);

  if (!boot.done) return <Splash text="در حال بررسی اتصال…" />;

  return (
    <LanguageProvider>
      <StoreProvider remote={boot.remote} initialStats={boot.stats}>
        <Shell />
      </StoreProvider>
    </LanguageProvider>
  );
}
