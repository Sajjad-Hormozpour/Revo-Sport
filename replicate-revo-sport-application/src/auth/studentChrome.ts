import "./studentChrome.css";
import "./iconPolish.css";

/**
 * Student navigation chrome for the mounted Revo Sport shell.
 *
 * The student screens are rendered by the existing application. This module only
 * adapts their navigation chrome and never touches business logic:
 *
 *  - removes the subscription entry from the bottom bar
 *  - adds a subscription button beside the notification bell (top bar)
 *  - removes the light/dark theme button from the top bar (Settings keeps it)
 *  - rebuilds the bottom bar into five evenly spaced items with an animated,
 *    correctly aligned active pill and hover micro-interactions
 */

const SUBSCRIPTION_HASH = "/student/subscription";
const MARK = "data-revo-student-sub";

function isStudentRoute(): boolean {
  return window.location.hash.startsWith("#/student");
}

function syncRouteFlag() {
  document.documentElement.classList.toggle("revo-student-route", isStudentRoute());
  document.documentElement.classList.toggle("revo-coach-route", window.location.hash.startsWith("#/coach"));
}

/* ---------------- top bar ---------------- */

function bellHost(mount: HTMLElement): HTMLElement | null {
  const bellSvg = mount.querySelector("header svg.lucide-bell, header svg[class*='lucide-bell']");
  const button = bellSvg?.closest("button, a");
  return button?.parentElement ?? null;
}

function ensureSubscriptionAction(mount: HTMLElement) {
  const host = bellHost(mount);
  if (!host) return;

  let button = host.querySelector<HTMLButtonElement>(`[${MARK}]`);
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.setAttribute(MARK, "true");
    button.setAttribute("aria-label", "اشتراک");
    button.title = "اشتراک";
    button.className = "revo-student-sub";
    button.innerHTML = `
      <span class="revo-student-sub-halo" aria-hidden="true"></span>
      <svg class="lucide lucide-crown" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m2 8 4 3 6-7 6 7 4-3-1.5 11h-17L2 8Z"></path>
        <path d="M4.5 19h15"></path>
      </svg>`;
    button.addEventListener("click", () => {
      if (window.location.hash !== `#${SUBSCRIPTION_HASH}`) window.location.hash = SUBSCRIPTION_HASH;
    });
    host.insertBefore(button, host.lastElementChild?.nextSibling ?? null);
  }

  const onSubscription = window.location.hash.includes("/student/subscription");
  if (onSubscription && button.getAttribute("aria-current") !== "page") button.setAttribute("aria-current", "page");
  else if (!onSubscription && button.hasAttribute("aria-current")) button.removeAttribute("aria-current");
}

/* ---------------- bottom bar ---------------- */

function isSubscriptionButton(button: HTMLButtonElement, index: number, total: number): boolean {
  const label = button.getAttribute("aria-label") ?? "";
  if (/اشتراک|subscription|\bplan\b/i.test(label)) return true;
  if (button.querySelector("svg.lucide-crown, svg[class*='lucide-crown']")) return true;
  // The subscription entry is always the last item of the six-slot student bar.
  return total === 6 && index === total - 1;
}

function navContainer(mount: HTMLElement): HTMLElement | null {
  return mount.querySelector<HTMLElement>("nav div.grid-cols-6");
}

function setStyle(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
}

function syncBottomNav(mount: HTMLElement) {
  const container = navContainer(mount);
  if (!container) return;

  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(":scope > button"));
  if (!buttons.length) return;

  const subscription = new Set<HTMLButtonElement>();
  buttons.forEach((button, index) => {
    if (!isSubscriptionButton(button, index, buttons.length)) return;
    subscription.add(button);
    if (button.getAttribute("data-revo-sub") !== "true") button.setAttribute("data-revo-sub", "true");
  });

  const visible = buttons.filter((button) => !subscription.has(button) && button.getBoundingClientRect().width > 0);
  if (!visible.length) return;

  setStyle(container, "--revo-nav-count", String(visible.length));
  if (!container.classList.contains("revo-nav")) container.classList.add("revo-nav");

  // A dedicated pill, positioned from measured geometry, replaces the original
  // inline-styled indicator (which assumed six columns and would drift off-centre).
  let pill = container.querySelector<HTMLElement>(":scope > .revo-nav-pill");
  if (!pill) {
    pill = document.createElement("span");
    pill.className = "revo-nav-pill";
    pill.setAttribute("aria-hidden", "true");
    container.prepend(pill);
  }

  const active =
    visible.find((button) => button.getAttribute("aria-current") === "page") ??
    visible.find((button) => button.querySelector(".text-black")) ??
    null;

  const box = container.getBoundingClientRect();
  if (!active) {
    setStyle(pill, "opacity", "0");
    setStyle(pill, "width", "0px");
  } else {
    const rect = active.getBoundingClientRect();
    const width = Math.max(40, rect.width - 4);
    const height = Math.max(38, rect.height - 2);
    setStyle(pill, "opacity", "1");
    setStyle(pill, "width", `${width}px`);
    setStyle(pill, "height", `${height}px`);
    setStyle(pill, "left", `${rect.left - box.left + (rect.width - width) / 2}px`);
    setStyle(pill, "top", `${rect.top - box.top + (rect.height - height) / 2}px`);
  }

  // Keep the hidden entry out of the accessibility tree without unmounting it.
  for (const button of subscription) {
    if (button.getAttribute("aria-hidden") !== "true") button.setAttribute("aria-hidden", "true");
  }
}

export function installStudentChrome(mount: HTMLElement): () => void {
  syncRouteFlag();

  let frame = 0;
  let disposed = false;
  let observedNav: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const sync = () => {
    if (disposed) return;
    syncRouteFlag();
    if (!isStudentRoute()) {
      if (observedNav) resizeObserver?.unobserve(observedNav);
      observedNav = null;
      return;
    }
    const currentNav = navContainer(mount);
    if (currentNav !== observedNav) {
      if (observedNav) resizeObserver?.unobserve(observedNav);
      observedNav = currentNav;
      if (observedNav) resizeObserver?.observe(observedNav);
    }
    ensureSubscriptionAction(mount);
    syncBottomNav(mount);
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(mount, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-current"],
  });

  let settle = 0;
  const settleSync = () => {
    window.clearTimeout(settle);
    settle = window.setTimeout(sync, 420);
  };
  const onRoute = () => {
    schedule();
    settleSync();
  };

  window.addEventListener("hashchange", onRoute);
  window.addEventListener("resize", onRoute);
  window.addEventListener("orientationchange", onRoute);

  if (typeof ResizeObserver !== "undefined") resizeObserver = new ResizeObserver(schedule);

  sync();

  return () => {
    disposed = true;
    if (frame) window.cancelAnimationFrame(frame);
    observer.disconnect();
    resizeObserver?.disconnect();
    window.clearTimeout(settle);
    window.removeEventListener("hashchange", onRoute);
    window.removeEventListener("resize", onRoute);
    window.removeEventListener("orientationchange", onRoute);
    document.documentElement.classList.remove("revo-student-route");
    document.documentElement.classList.remove("revo-coach-route");
    mount.querySelectorAll(`[${MARK}]`).forEach((node) => node.remove());
    mount.querySelectorAll(".revo-nav-pill").forEach((node) => node.remove());
    mount.querySelectorAll("[data-revo-sub]").forEach((node) => node.removeAttribute("data-revo-sub"));
    mount.querySelectorAll<HTMLElement>(".revo-nav").forEach((node) => {
      node.classList.remove("revo-nav");
      node.style.removeProperty("--revo-nav-count");
    });
  };
}
