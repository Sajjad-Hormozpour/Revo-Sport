import { useEffect, useRef, useState } from "react";
import PremiumAuth from "./auth/PremiumAuth";
import { clearSignupDraft, hasSession } from "./auth/handoff";
import { installStudentChrome } from "./auth/studentChrome";
import { installCoachDialogs } from "./coach/coachDialogs";

const SOURCE_COMMIT = "9b1ca6bca5266820b9cd468d84bb49d745a6652b";
const SOURCE_ROOT = `https://raw.githubusercontent.com/Sajjad-Hormozpour/Revo-Sport/${SOURCE_COMMIT}/pixel-perfect-persian-web-page%20(1)`;
const SOURCE_CSS = `${SOURCE_ROOT}/src/index.css`;
const HERO_IMAGE = `${SOURCE_ROOT}/public/images/login-hero.jpg`;
const APP_MODULE = `https://esm.sh/gh/Sajjad-Hormozpour/Revo-Sport@${SOURCE_COMMIT}/pixel-perfect-persian-web-page%20(1)/src/App.tsx?external=react,react-dom,react-dom/client,react/jsx-runtime,lucide-react`;
const REACT_MODULE = "https://esm.sh/react@19.2.6";
const REACT_DOM_MODULE = "https://esm.sh/react-dom@19.2.6/client?external=react";
const TAILWIND_BROWSER = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.17/dist/index.global.js";

type RemoteRoot = {
  render: (element: unknown) => void;
  unmount: () => void;
};

type RemoteReact = {
  StrictMode: unknown;
  createElement: (component: unknown, props?: Record<string, unknown> | null) => unknown;
};

type RemoteClient = {
  createRoot: (container: HTMLElement) => RemoteRoot;
};

type RemoteAppModule = {
  default: unknown;
};

let sourceCssPromise: Promise<void> | null = null;
let tailwindPromise: Promise<void> | null = null;

function loadSourceStyles() {
  if (document.getElementById("revo-source-styles")) return Promise.resolve();
  if (!sourceCssPromise) {
    sourceCssPromise = fetch(SOURCE_CSS, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Stylesheet unavailable");
        const style = document.createElement("style");
        style.id = "revo-source-styles";
        style.type = "text/tailwindcss";
        style.textContent = await response.text();
        document.head.append(style);
      })
      .catch((error: unknown) => {
        sourceCssPromise = null;
        throw error;
      });
  }
  return sourceCssPromise;
}

function loadTailwindBrowser() {
  if (!tailwindPromise) {
    const pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TAILWIND_BROWSER;
      script.async = true;
      script.dataset.revoTailwind = "true";
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error("Tailwind runtime unavailable"));
      };
      document.head.append(script);
    });
    tailwindPromise = pending.catch((error: unknown) => {
      tailwindPromise = null;
      throw error;
    });
  }
  return tailwindPromise;
}

function rewriteAssetValue(value: string) {
  if (!value.includes("login-hero.jpg") || value.includes("raw.githubusercontent.com")) return value;
  return value.replace(/(?:\.\/|\/)?images\/login-hero\.jpg/g, HERO_IMAGE);
}

function rewriteSourceAsset(element: Element) {
  for (const attribute of ["src", "srcset", "poster", "style"]) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const rewritten = rewriteAssetValue(value);
    if (rewritten !== value) element.setAttribute(attribute, rewritten);
  }
}

function rewriteSourceAssets(node: Node) {
  if (!(node instanceof Element)) return;
  rewriteSourceAsset(node);
  node.querySelectorAll("[src], [srcset], [poster], [style]").forEach(rewriteSourceAsset);
}

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

function RemoteApplication() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let active = true;
    let remoteRoot: RemoteRoot | null = null;
    let removeStudentChrome: (() => void) | null = null;
    const removeCoachDialogs = installCoachDialogs(mount);
    setLoading(true);
    setFailed(false);

    const assetObserver = new MutationObserver((records) => {
      let structureChanged = false;
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element) {
          rewriteSourceAsset(record.target);
        } else if (record.type === "childList") {
          structureChanged = true;
          for (const node of record.addedNodes) rewriteSourceAssets(node);
        }
      }
      if (structureChanged) syncAuthSurface(mount);
    });
    assetObserver.observe(mount, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "poster", "style"],
    });
    const handleRouteChange = () => syncAuthSurface(mount);
    window.addEventListener("hashchange", handleRouteChange);

    const start = async () => {
      try {
        await loadSourceStyles().catch(() => undefined);
        await loadTailwindBrowser();
        const [react, client, app] = await Promise.all([
          import(/* @vite-ignore */ REACT_MODULE) as Promise<RemoteReact>,
          import(/* @vite-ignore */ REACT_DOM_MODULE) as Promise<RemoteClient>,
          import(/* @vite-ignore */ APP_MODULE) as Promise<RemoteAppModule>,
        ]);
        if (!active) return;
        remoteRoot = client.createRoot(mount);
        remoteRoot.render(
          react.createElement(react.StrictMode, {
            children: react.createElement(app.default),
          }),
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

    void start();
    return () => {
      active = false;
      assetObserver.disconnect();
      window.removeEventListener("hashchange", handleRouteChange);
      document.documentElement.classList.remove("revo-auth-active");
      removeCoachDialogs();
      removeStudentChrome?.();
      remoteRoot?.unmount();
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

  if (phase === "auth") return <PremiumAuth onEnter={() => setPhase("app")} />;
  return <RemoteApplication />;
}