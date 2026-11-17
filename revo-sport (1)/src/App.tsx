import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import SourceApp from "./source/App";
import PremiumAuth from "./auth/PremiumAuth";
import { LanguageProvider } from "./source/lib/i18n";
import { clearSignupDraft, hasSession } from "./auth/handoff";
import { installStudentChrome } from "./auth/studentChrome";
import { installCoachDialogs } from "./coach/coachDialogs";



function syncAuthSurface(mount: HTMLElement) {
  const path = window.location.hash.replace(/^#/, "") || "/";
  const routeIsAuth = path === "/" || path.startsWith("/login");
  const authRoot = mount.firstElementChild;
  const authIsMounted = !!authRoot?.className.toString().includes("overflow-hidden bg-[var(--color-bg)]");
  document.documentElement.classList.toggle("revo-auth-active", routeIsAuth && authIsMounted);
}

function BrandMark() {
  return (
    <span className="revo-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.1 1.5 4.8 13.1h5.6l-.7 9.4 9.5-12.7h-5.7l1.2-8.3z" />
      </svg>
    </span>
  );
}

function SourceApplication() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let active = true;
    let sourceRoot: Root | null = null;
    let removeStudentChrome: (() => void) | null = null;
    const removeCoachDialogs = installCoachDialogs(mount);
    setLoading(true);
    setFailed(false);

    const assetObserver = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) syncAuthSurface(mount);
    });
    assetObserver.observe(mount, { subtree: true, childList: true });
    const handleRouteChange = () => syncAuthSurface(mount);
    window.addEventListener("hashchange", handleRouteChange);

    const start = () => {
      try {
        if (!active) return;
        sourceRoot = createRoot(mount);
        sourceRoot.render(
          <StrictMode>
            <SourceApp />
          </StrictMode>,
        );
        // Student navigation chrome: subscription moves to the top bar,
        // the theme button stays out of the header (Settings keeps it).
        removeStudentChrome = installStudentChrome(mount);
        setLoading(false);
      } catch {
        if (!active) return;
        setLoading(false);
        setFailed(true);
      }
    };

    const startTimer = window.setTimeout(start, 0);
    return () => {
      active = false;
      window.clearTimeout(startTimer);
      assetObserver.disconnect();
      window.removeEventListener("hashchange", handleRouteChange);
      document.documentElement.classList.remove("revo-auth-active");
      removeCoachDialogs();
      removeStudentChrome?.();
      const root = sourceRoot;
      // Defer unmount to avoid unmounting during the outer render cycle.
      if (root) queueMicrotask(() => root.unmount());
    };
  }, [attempt]);

  return (
    <main className="revo-shell" dir="rtl">
      <div className="revo-remote-root" ref={mountRef} />
      {loading && (
        <div className="revo-boot-screen" role="status" aria-live="polite">
          <BrandMark />
          <b className="revo-boot-title" dir="ltr">Revo sport</b>
          <p className="revo-boot-copy">در حال بررسی اتصال…</p>
        </div>
      )}
      {failed && (
        <div className="revo-boot-screen revo-load-error" role="alert">
          <BrandMark />
          <b className="revo-boot-title" dir="ltr">Revo sport</b>
          <p className="revo-boot-copy">بارگذاری برنامه ممکن نشد؛ اتصال اینترنت را بررسی کن.</p>
          <button className="revo-retry" onClick={() => setAttempt((value) => value + 1)}>
            تلاش دوباره
          </button>
        </div>
      )}
    </main>
  );
}

export default function App() {
  const [phase, setPhase] = useState<"auth" | "app">(() => (hasSession() ? "app" : "auth"));

  useEffect(() => {
    if (phase !== "app") return;
    const watch = () => {
      if (!hasSession()) {
        // Never carry the previous account's photo or profile into the next sign-up.
        clearSignupDraft();
        setPhase("auth");
      }
    };
    const timer = window.setInterval(watch, 1000);
    window.addEventListener("hashchange", watch);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("hashchange", watch);
    };
  }, [phase]);

  if (phase === "auth") return <LanguageProvider><PremiumAuth onEnter={() => setPhase("app")} /></LanguageProvider>;
  return <SourceApplication />;
}