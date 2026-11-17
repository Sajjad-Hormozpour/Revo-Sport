import type { AppData, FoodEntry, MealItem, MealPlan } from "../data/types";
import { FOODS } from "../data/library";
import { dayKey, startOfWeek, addDays } from "./time";

export interface Macros { kcal: number; p: number; c: number; f: number; fiber: number }
export const zeroMacros = (): Macros => ({ kcal: 0, p: 0, c: 0, f: 0, fiber: 0 });

export function foodFor(item: MealItem, data: AppData): FoodEntry | undefined {
  if (item.food) return item.food;
  const custom = data.foods.find((f) => f.id === item.foodId);
  if (custom) return custom;
  const legacy = FOODS.find((f) => f.id === item.foodId);
  return legacy ? { ...legacy, fiber: 0, serving: legacy.unit, coachId: "" } : undefined;
}

export function sumItems(items: MealItem[], data: AppData): Macros {
  const total = zeroMacros();
  for (const item of items) {
    const food = foodFor(item, data);
    if (!food) continue;
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty < 0) continue;
    total.kcal += food.kcal * qty;
    total.p += food.p * qty;
    total.c += food.c * qty;
    total.f += food.f * qty;
    total.fiber += food.fiber * qty;
  }
  return total;
}

export function sumPlan(plan: MealPlan, data: AppData): Macros {
  const result = zeroMacros();
  for (const slot of plan.meals) {
    const sum = sumItems(slot.items, data);
    (Object.keys(result) as (keyof Macros)[]).forEach((key) => { result[key] += sum[key]; });
  }
  return result;
}

export function activeMealPlan(data: AppData, studentId: string): MealPlan | undefined {
  return data.meals.filter((m) => m.studentId === studentId && m.status !== "template" && m.status !== "archived" && m.status !== "draft")
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))[0];
}

export function completedMeals(data: AppData, plan: MealPlan, date = dayKey()) {
  const done = new Set(data.nutritionLogs.filter((log) => log.studentId === plan.studentId && log.planId === plan.id && log.date === date).map((log) => log.slotId));
  return { done, count: plan.meals.filter((slot, index) => done.has(slot.id || `${index}`)).length };
}

export function nutritionAdherence(data: AppData, studentId: string, now = new Date()): number | null {
  const plan = activeMealPlan(data, studentId);
  if (!plan || !plan.meals.length) return null;
  const since = new Date(plan.createdAt);
  const start = startOfWeek(now);
  let expected = 0;
  let actual = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    if (date > now || date < since) continue;
    expected += plan.meals.length;
    actual += completedMeals(data, plan, dayKey(date)).count;
  }
  return expected ? Math.round(100 * actual / expected) : null;
}