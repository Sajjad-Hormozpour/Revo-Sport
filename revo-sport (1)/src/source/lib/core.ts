export { WEEK, WEEK_S } from "./time";
export { weekdayName as todayName, weekdayIdx as todayIdx, greetingAt as greeting } from "./time";

/** Revo sport keeps clean Latin digits for a modern, professional look. */
export function fa(v: number | string): string {
  return String(v).replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (digit) => {
    const code = digit.codePointAt(0)!;
    return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
  });
}

export function formatClock(total: number): string {
  const m = Math.floor(Math.max(0, total) / 60);
  const s = Math.max(0, total) % 60;
  return `${fa(String(m).padStart(2, "0"))}:${fa(String(s).padStart(2, "0"))}`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function hashPath(): string {
  return (window.location.hash.replace(/^#/, "") || "/").split("?")[0];
}

export function go(path: string) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}
