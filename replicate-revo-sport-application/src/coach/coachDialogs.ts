import "./coachDialogs.css";

const OVERLAY_SELECTOR = ".overlay-in";
const DIALOG = "data-revo-coach-dialog";
const PANEL = "data-revo-coach-panel";
const HEADER = "data-revo-coach-dialog-header";
const ANCESTOR = "data-revo-coach-dialog-ancestor";
const SETTLED = "data-revo-coach-screen-settled";
const OPEN = "data-revo-coach-dialog-open";

type DialogParts = { overlay: HTMLElement; panel: HTMLElement; header: HTMLElement | null };

function isCoachRoute(): boolean {
  return /^#\/coach(?:\/|\?|$)/.test(window.location.hash);
}

function findDialogs(mount: HTMLElement): DialogParts[] {
  if (!isCoachRoute()) return [];
  return Array.from(mount.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR)).flatMap((overlay) => {
    const panel = overlay.firstElementChild;
    if (!(panel instanceof HTMLElement) || !panel.classList.contains("drawer-in") || !panel.classList.contains("glass-strong")) {
      return [];
    }
    const first = panel.firstElementChild;
    const header = first instanceof HTMLElement && first.querySelector("h3") ? first : null;
    return [{ overlay, panel, header }];
  });
}

function includesOverlay(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches(OVERLAY_SELECTOR) || Boolean(node.querySelector(OVERLAY_SELECTOR));
}

export function installCoachDialogs(mount: HTMLElement): () => void {
  let dialogs: DialogParts[] = [];
  let ancestors = new Set<HTMLElement>();
  let updateFrame = 0;
  let viewportFrame = 0;
  let focusTimer = 0;
  let previousFocus: HTMLElement | null = null;
  let destroyed = false;
  const html = document.documentElement;

  const updateViewport = () => {
    viewportFrame = 0;
    if (!dialogs.length) return;
    const viewport = window.visualViewport;
    const values: Record<string, string> = {
      "--revo-dialog-top": `${viewport?.offsetTop ?? 0}px`,
      "--revo-dialog-left": `${viewport?.offsetLeft ?? 0}px`,
      "--revo-dialog-width": `${viewport?.width ?? window.innerWidth}px`,
      "--revo-dialog-height": `${viewport?.height ?? window.innerHeight}px`,
    };
    for (const [name, value] of Object.entries(values)) {
      if (html.style.getPropertyValue(name) !== value) html.style.setProperty(name, value);
    }
  };

  const scheduleViewport = () => {
    if (!viewportFrame) viewportFrame = window.requestAnimationFrame(updateViewport);
  };

  const sync = () => {
    updateFrame = 0;
    if (destroyed) return;
    const nextDialogs = findDialogs(mount);
    const same = dialogs.length === nextDialogs.length && dialogs.every((item, index) => item.overlay === nextDialogs[index].overlay);
    if (same) return;

    const hadDialog = dialogs.length > 0;
    const nextAncestors = new Set<HTMLElement>();
    for (const { overlay, panel, header } of nextDialogs) {
      overlay.setAttribute(DIALOG, "");
      panel.setAttribute(PANEL, "");
      header?.setAttribute(HEADER, "");
      let parent = overlay.parentElement;
      while (parent && parent !== mount) {
        nextAncestors.add(parent);
        if (parent.classList.contains("screen-in")) parent.setAttribute(SETTLED, "");
        parent = parent.parentElement;
      }
    }
    for (const ancestor of ancestors) {
      if (!nextAncestors.has(ancestor)) ancestor.removeAttribute(ANCESTOR);
    }
    for (const ancestor of nextAncestors) {
      if (!ancestors.has(ancestor)) ancestor.setAttribute(ANCESTOR, "");
    }
    for (const { overlay, panel, header } of dialogs) {
      if (nextDialogs.some((item) => item.overlay === overlay)) continue;
      overlay.removeAttribute(DIALOG);
      panel.removeAttribute(PANEL);
      header?.removeAttribute(HEADER);
    }

    dialogs = nextDialogs;
    ancestors = nextAncestors;
    if (dialogs.length) {
      html.setAttribute(OPEN, "");
      if (!hadDialog) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      updateViewport();
    } else {
      html.removeAttribute(OPEN);
      for (const name of ["--revo-dialog-top", "--revo-dialog-left", "--revo-dialog-width", "--revo-dialog-height"]) {
        html.style.removeProperty(name);
      }
      if (hadDialog && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      previousFocus = null;
    }
  };

  const scheduleSync = () => {
    if (!updateFrame) updateFrame = window.requestAnimationFrame(sync);
  };

  const observer = new MutationObserver((records) => {
    if (records.some((record) => Array.from(record.addedNodes).some(includesOverlay) || Array.from(record.removedNodes).some(includesOverlay))) {
      scheduleSync();
    }
  });
  observer.observe(mount, { childList: true, subtree: true });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !dialogs.length || event.defaultPrevented) return;
    const dialog = dialogs[dialogs.length - 1];
    const close = dialog.header?.querySelector<HTMLButtonElement>('button[aria-label="بستن"]');
    if (close) {
      event.preventDefault();
      close.click();
    }
  };

  const onFocus = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("input:not([type='file']), textarea, select")) return;
    const panel = target.closest<HTMLElement>(`[${PANEL}]`);
    if (!panel) return;
    window.clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => {
      if (!target.isConnected || document.activeElement !== target) return;
      const field = target.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      const headerHeight = panel.querySelector<HTMLElement>(`[${HEADER}]`)?.getBoundingClientRect().height ?? 0;
      const overflow = field.bottom - (bounds.bottom - 16);
      const hiddenAtTop = bounds.top + headerHeight + 12 - field.top;
      if (overflow > 0) panel.scrollTop += overflow;
      else if (hiddenAtTop > 0) panel.scrollTop -= hiddenAtTop;
    }, 180);
  };

  window.addEventListener("hashchange", scheduleSync);
  window.addEventListener("resize", scheduleViewport);
  window.visualViewport?.addEventListener("resize", scheduleViewport);
  window.visualViewport?.addEventListener("scroll", scheduleViewport);
  document.addEventListener("keydown", onKeyDown);
  mount.addEventListener("focusin", onFocus);
  sync();

  return () => {
    destroyed = true;
    observer.disconnect();
    if (updateFrame) window.cancelAnimationFrame(updateFrame);
    if (viewportFrame) window.cancelAnimationFrame(viewportFrame);
    window.clearTimeout(focusTimer);
    window.removeEventListener("hashchange", scheduleSync);
    window.removeEventListener("resize", scheduleViewport);
    window.visualViewport?.removeEventListener("resize", scheduleViewport);
    window.visualViewport?.removeEventListener("scroll", scheduleViewport);
    document.removeEventListener("keydown", onKeyDown);
    mount.removeEventListener("focusin", onFocus);
    for (const ancestor of ancestors) ancestor.removeAttribute(ANCESTOR);
    mount.querySelectorAll(`[${SETTLED}]`).forEach((element) => element.removeAttribute(SETTLED));
    for (const { overlay, panel, header } of dialogs) {
      overlay.removeAttribute(DIALOG);
      panel.removeAttribute(PANEL);
      header?.removeAttribute(HEADER);
    }
    html.removeAttribute(OPEN);
    for (const name of ["--revo-dialog-top", "--revo-dialog-left", "--revo-dialog-width", "--revo-dialog-height"]) {
      html.style.removeProperty(name);
    }
  };
}