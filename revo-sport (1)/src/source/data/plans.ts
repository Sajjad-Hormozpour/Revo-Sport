import type { AppData, SubPlan } from "./types";

export type PlanDef = SubPlan;

export function buildPlan(p: Omit<SubPlan, "perSession" | "title"> & { title?: string }): SubPlan {
  const sessions = Math.max(1, Math.round(p.sessions || 1));
  const price = Math.max(0, Math.round(p.price || 0));
  return {
    ...p,
    sessions,
    price,
    days: Math.max(1, Math.round(p.days || 1)),
    title: p.title?.trim() || `${sessions} جلسه`,
    perSession: Math.round(price / sessions),
    perks: (p.perks ?? []).map((x) => x.trim()).filter(Boolean),
    active: p.active !== false,
  };
}

function mk(sessions: number, price: number, days: number, perks: string[], flag?: "popular" | "best"): SubPlan {
  return buildPlan({ id: `p${sessions}`, sessions, price, days, perks, popular: flag === "popular", best: flag === "best" });
}

/** پلن‌های پیش‌فرض (تا وقتی مربی پلن‌های خودش را تعریف نکرده) */
export const PLANS: SubPlan[] = [
  mk(8, 1600000, 30, ["برنامه تمرینی اختصاصی", "پشتیبانی پیام‌رسان", "ثبت و بررسی تمرین"]),
  mk(12, 2160000, 45, ["همه امکانات پلن ۸ جلسه", "بازبینی برنامه در میانه دوره", "گزارش پیشرفت"], "popular"),
  mk(16, 2720000, 60, ["همه امکانات پلن ۱۲ جلسه", "اصلاح فرم با ویدیو", "تنظیم هفتگی برنامه"]),
  mk(24, 3840000, 90, ["همه امکانات پلن ۱۶ جلسه", "اولویت پاسخ‌گویی مربی", "جلسه مشاوره اختصاصی"], "best"),
];

/** همه پلن‌های مربی (فعال و غیرفعال) */
export function coachPlanList(data: AppData, coachId?: string): SubPlan[] {
  const own = coachId ? data.coachPlans?.[coachId] : undefined;
  return (own && own.length ? own : PLANS).map((p) => buildPlan(p));
}

/** پلن‌هایی که شاگرد می‌تواند بخرد */
export function resolvePlans(data: AppData, coachId?: string): SubPlan[] {
  return coachPlanList(data, coachId)
    .filter((p) => p.active !== false)
    .sort((a, b) => a.sessions - b.sessions);
}

export function getPlan(id?: string): SubPlan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** کد تخفیف‌های نمونه */
export const COUPONS: Record<string, number> = {
  REVO10: 0.1,
  WELCOME15: 0.15,
  COACH20: 0.2,
};
