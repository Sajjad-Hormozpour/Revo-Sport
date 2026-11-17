import type { AppData } from "../data/types";

/**
 * لایهٔ ارتباط با سرور دیتابیس مرکزی.
 * اگر سرور (server/index.mjs) در کنار اپ اجرا شود، اپ خودکار به حالت «سرور» می‌رود و
 * همهٔ کاربران از یک دیتابیس مشترک استفاده می‌کنند. در غیر این صورت مثل قبل محلی کار می‌کند.
 */

const TOKEN_KEY = "revofit-token";

const envUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;

export const API_BASE: string = envUrl
  ? `${envUrl.replace(/\/$/, "")}/`
  : new URL("api/", window.location.href.split("#")[0]).toString();

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

export interface ApiRes<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

export async function api<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
  opts: { token?: string | null; timeout?: number } = {}
): Promise<ApiRes<T>> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), opts.timeout ?? 25000);
  try {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const r = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: ctrl.signal,
    });
    let data = {} as T & { error?: string };
    try {
      data = (await r.json()) as T & { error?: string };
    } catch {
      /* non-json */
    }
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "ارتباط با سرور برقرار نشد" } as T & { error?: string } };
  } finally {
    window.clearTimeout(timer);
  }
}

export interface PublicStats {
  users: number;
  coaches: number;
  students: number;
}

export async function detectServer(): Promise<{ ok: boolean; stats?: PublicStats }> {
  try {
    const c = new AbortController();
    const t = window.setTimeout(() => c.abort(), 2500);
    const r = await fetch(`${API_BASE}health`, { cache: "no-store", signal: c.signal });
    window.clearTimeout(t);
    if (!r.ok) return { ok: false };
    const j = (await r.json()) as { ok?: boolean; app?: string } & Partial<PublicStats>;
    if (!j || j.app !== "revo-sport") return { ok: false };
    return { ok: true, stats: { users: j.users ?? 0, coaches: j.coaches ?? 0, students: j.students ?? 0 } };
  } catch {
    return { ok: false };
  }
}

const ARR_KEYS = [
  "users", "students", "programs", "logs", "meals", "progress", "photos", "goals",
  "messages", "notifs", "appts", "invoices", "coachExercises", "foods", "nutritionLogs", "checkins", "workoutTemplates",
] as const;
const MAP_KEYS = ["water", "sleep", "xp", "streak", "coachPlans"] as const;

/** فقط رکوردهای تغییرکرده نسبت به آخرین نسخهٔ سرور (تا نسخهٔ کهنه چیزی را بازنویسی نکند) */
export function computeDelta(base: AppData, cur: AppData): { delta: Record<string, unknown>; empty: boolean } {
  const delta: Record<string, unknown> = {};
  let empty = true;
  for (const k of ARR_KEYS) {
    const bArr = (base[k] ?? []) as unknown as { id: string }[];
    const cArr = (cur[k] ?? []) as unknown as { id: string }[];
    const b = new Map(bArr.map((x) => [x.id, JSON.stringify(x)]));
    const changed = cArr.filter((x) => b.get(x.id) !== JSON.stringify(x));
    if (changed.length) {
      delta[k] = changed;
      empty = false;
    }
  }
  for (const k of MAP_KEYS) {
    const bm = (base[k] ?? {}) as Record<string, unknown>;
    const cm = (cur[k] ?? {}) as Record<string, unknown>;
    const ch: Record<string, unknown> = {};
    for (const [id, v] of Object.entries(cm)) if (JSON.stringify(v) !== JSON.stringify(bm[id])) ch[id] = v;
    if (Object.keys(ch).length) {
      delta[k] = ch;
      empty = false;
    }
  }
  return { delta, empty };
}

export interface Deletes {
  students: string[];
  programs: string[];
  coachExercises: string[];
  meals: string[];
  foods: string[];
  nutritionLogs: string[];
  workoutTemplates: string[];
}

export const noDeletes = (): Deletes => ({ students: [], programs: [], coachExercises: [], meals: [], foods: [], nutritionLogs: [], workoutTemplates: [] });
