import type { AppData, FoodEntry, MealItem, MealPlan, MealSlot, Student } from "../data/types";
import { uid } from "../lib/core";
import { addDays, dayKey, nowIso, weekdayIdx } from "../lib/time";
import { FOOD_BY_ID, UNIT_LABELS, customToFood, type FoodUnit, type NutriFood, type UnitKey } from "./foods";

/* =================================================================== */
/*  Types — the professional plan extends the existing MealPlan record  */
/*  so storage, server sync, backup and meal logging stay unchanged.    */
/* =================================================================== */

export interface Macros { kcal: number; p: number; c: number; f: number; fiber: number }
export interface Targets { kcal: number; p: number; c: number; f: number }

export interface NutriAlt {
  foodId: string;
  name: string;
  nameEn?: string;
  amount: number;
  unit: UnitKey;
  unitLabel?: string;
  unitLabelEn?: string;
  grams: number;
  macros: Macros;
}

export interface NutriItem extends MealItem {
  uid: string;
  name: string;
  nameEn?: string;
  amount: number;
  unit: UnitKey;
  unitLabel?: string;
  unitLabelEn?: string;
  grams: number;
  macros: Macros;
  alternatives?: NutriAlt[];
}

export interface NutriSlot extends MealSlot {
  id: string;
  slot: string;
  time?: string;
  note?: string;
  items: NutriItem[];
}

export type DayKind = "training" | "rest" | "custom";

export interface NutriDay {
  id: string;
  name: string;
  kind: DayKind;
  /** Saturday-based weekday indexes (0 = Saturday … 6 = Friday). */
  weekdays: number[];
  items: Record<string, NutriItem[]>;
  targets?: Targets | null;
}

export interface NutriSupplement { id: string; name: string; dose: string; timing: string; note: string }

export type ActivityKey = "sedentary" | "light" | "moderate" | "active" | "athlete";
export type GoalKey = "aggressiveCut" | "cut" | "mildCut" | "maintain" | "leanBulk" | "bulk" | "custom";
export type FormulaKey = "mifflin" | "harris" | "katch";

export interface NutriCalc {
  formula: FormulaKey;
  activity: ActivityKey;
  goal: GoalKey;
  adjustPct: number;
  proteinPerKg: number;
  fatPct: number;
  weight: number;
  height: number;
  age: number;
  gender: "male" | "female";
  bodyFat: number | null;
  preset: string;
}

export interface NutriProfile {
  allergies: string[];
  restrictions: string[];
  dislikes: string;
  medical: string;
  wake: string;
  sleep: string;
  training: string;
  budget: "economy" | "standard" | "premium";
  mealsPerDay: number;
}

export interface ProPlan extends MealPlan {
  pro: 1;
  meals: NutriSlot[];
  days: NutriDay[];
  supplements: NutriSupplement[];
  guidelines: string;
  coachNote: string;
  profile: NutriProfile;
  calc: NutriCalc;
  startDate: string;
  endDate: string;
  reviewDate: string;
  serviceOff?: boolean;
  publishedAt?: string;
}

/* =================================================================== */
/*  Reference tables                                                    */
/* =================================================================== */

export const ACTIVITY: { key: ActivityKey; factor: number; fa: string; en: string; hint: string; hintEn: string }[] = [
  { key: "sedentary", factor: 1.2, fa: "کم‌تحرک", en: "Sedentary", hint: "کار پشت میز و بدون ورزش منظم", hintEn: "Desk job, no regular exercise" },
  { key: "light", factor: 1.375, fa: "فعالیت سبک", en: "Lightly active", hint: "تمرین سبک ۱ تا ۳ روز در هفته", hintEn: "Light training 1–3 days a week" },
  { key: "moderate", factor: 1.55, fa: "فعالیت متوسط", en: "Moderately active", hint: "تمرین منظم ۳ تا ۵ روز در هفته", hintEn: "Regular training 3–5 days a week" },
  { key: "active", factor: 1.725, fa: "فعالیت زیاد", en: "Very active", hint: "تمرین سنگین ۶ تا ۷ روز در هفته", hintEn: "Hard training 6–7 days a week" },
  { key: "athlete", factor: 1.9, fa: "ورزشکار حرفه‌ای", en: "Athlete", hint: "دو جلسه تمرین در روز یا کار بدنی سنگین", hintEn: "Twice-daily training or heavy physical work" },
];

export const GOALS: { key: GoalKey; pct: number; fa: string; en: string }[] = [
  { key: "aggressiveCut", pct: -20, fa: "کاهش چربی سریع", en: "Aggressive fat loss" },
  { key: "cut", pct: -15, fa: "کاهش چربی", en: "Fat loss" },
  { key: "mildCut", pct: -10, fa: "کاهش وزن ملایم", en: "Mild fat loss" },
  { key: "maintain", pct: 0, fa: "حفظ وزن و بازترکیب بدن", en: "Maintenance / recomposition" },
  { key: "leanBulk", pct: 10, fa: "افزایش حجم کنترل‌شده", en: "Lean bulk" },
  { key: "bulk", pct: 15, fa: "افزایش حجم", en: "Bulk" },
  { key: "custom", pct: 0, fa: "سفارشی", en: "Custom" },
];

export const FORMULAS: { key: FormulaKey; fa: string; en: string; hint: string; hintEn: string }[] = [
  { key: "mifflin", fa: "میفلین سنت‌جئور", en: "Mifflin-St Jeor", hint: "دقیق‌ترین فرمول برای عموم افراد (پیشنهادی)", hintEn: "Most accurate for most people (recommended)" },
  { key: "harris", fa: "هریس بندیکت", en: "Harris-Benedict", hint: "فرمول کلاسیک و بازبینی‌شده", hintEn: "Classic revised equation" },
  { key: "katch", fa: "کچ مک‌آردل", en: "Katch-McArdle", hint: "بر پایه توده بدون چربی؛ نیازمند درصد چربی", hintEn: "Lean-mass based; needs body-fat %" },
];

export const MACRO_PRESETS: { key: string; fa: string; en: string; proteinPerKg: number; fatPct: number }[] = [
  { key: "balanced", fa: "متعادل", en: "Balanced", proteinPerKg: 1.8, fatPct: 30 },
  { key: "highProtein", fa: "پرپروتئین", en: "High protein", proteinPerKg: 2.2, fatPct: 25 },
  { key: "lowCarb", fa: "کم‌کربوهیدرات", en: "Low carb", proteinPerKg: 2, fatPct: 40 },
  { key: "performance", fa: "ورزشی و حجم", en: "Performance", proteinPerKg: 1.8, fatPct: 22 },
  { key: "keto", fa: "کتوژنیک", en: "Ketogenic", proteinPerKg: 1.6, fatPct: 70 },
];

export const MEAL_PRESETS: { fa: string; en: string; time: string }[] = [
  { fa: "صبحانه", en: "Breakfast", time: "08:00" },
  { fa: "میان‌وعده صبح", en: "Morning snack", time: "10:30" },
  { fa: "ناهار", en: "Lunch", time: "13:30" },
  { fa: "میان‌وعده عصر", en: "Afternoon snack", time: "17:00" },
  { fa: "قبل از تمرین", en: "Pre-workout", time: "18:00" },
  { fa: "بعد از تمرین", en: "Post-workout", time: "20:00" },
  { fa: "شام", en: "Dinner", time: "20:30" },
  { fa: "قبل از خواب", en: "Before bed", time: "23:00" },
];

export const ALLERGY_OPTIONS: { fa: string; en: string }[] = [
  { fa: "عدم تحمل لاکتوز", en: "Lactose intolerance" },
  { fa: "حساسیت به گلوتن", en: "Gluten sensitivity" },
  { fa: "حساسیت به تخم‌مرغ", en: "Egg allergy" },
  { fa: "حساسیت به بادام‌زمینی", en: "Peanut allergy" },
  { fa: "حساسیت به آجیل", en: "Tree-nut allergy" },
  { fa: "حساسیت به غذای دریایی", en: "Seafood allergy" },
  { fa: "حساسیت به سویا", en: "Soy allergy" },
];

export const RESTRICTION_OPTIONS: { fa: string; en: string }[] = [
  { fa: "گیاه‌خوار", en: "Vegetarian" },
  { fa: "وگان", en: "Vegan" },
  { fa: "دیابت", en: "Diabetes" },
  { fa: "فشار خون بالا", en: "High blood pressure" },
  { fa: "کم‌نمک", en: "Low sodium" },
  { fa: "چربی خون بالا", en: "High cholesterol" },
  { fa: "روزه‌داری متناوب", en: "Intermittent fasting" },
  { fa: "مشکلات گوارشی", en: "Digestive issues" },
];

export const SUPPLEMENT_SUGGESTIONS: { fa: string; en: string; dose: string; timing: string }[] = [
  { fa: "کراتین مونوهیدرات", en: "Creatine monohydrate", dose: "5 گرم", timing: "بعد از تمرین" },
  { fa: "پودر وی پروتئین", en: "Whey protein", dose: "1 اسکوپ (30 گرم)", timing: "بعد از تمرین" },
  { fa: "کازئین", en: "Casein", dose: "1 اسکوپ", timing: "قبل از خواب" },
  { fa: "مولتی‌ویتامین", en: "Multivitamin", dose: "1 عدد", timing: "همراه صبحانه" },
  { fa: "امگا 3", en: "Omega-3", dose: "1000 میلی‌گرم", timing: "همراه ناهار" },
  { fa: "ویتامین D3", en: "Vitamin D3", dose: "1000 تا 2000 واحد", timing: "همراه ناهار" },
  { fa: "منیزیم", en: "Magnesium", dose: "250 میلی‌گرم", timing: "قبل از خواب" },
  { fa: "زینک (روی)", en: "Zinc", dose: "15 میلی‌گرم", timing: "همراه شام" },
  { fa: "کافئین", en: "Caffeine", dose: "100 تا 200 میلی‌گرم", timing: "قبل از تمرین" },
  { fa: "بتا آلانین", en: "Beta-alanine", dose: "3 گرم", timing: "قبل از تمرین" },
  { fa: "آهن", en: "Iron", dose: "طبق دستور پزشک", timing: "صبح ناشتا" },
];

export const SUPPLEMENT_TIMINGS: { fa: string; en: string }[] = [
  { fa: "صبح ناشتا", en: "Morning, empty stomach" },
  { fa: "همراه صبحانه", en: "With breakfast" },
  { fa: "قبل از تمرین", en: "Pre-workout" },
  { fa: "حین تمرین", en: "Intra-workout" },
  { fa: "بعد از تمرین", en: "Post-workout" },
  { fa: "همراه ناهار", en: "With lunch" },
  { fa: "همراه شام", en: "With dinner" },
  { fa: "قبل از خواب", en: "Before bed" },
];

export const GUIDELINE_SUGGESTIONS: { fa: string; en: string }[] = [
  { fa: "روزانه دست‌کم 8 تا 10 لیوان آب بنوشید و مصرف آب را در روزهای تمرین بیشتر کنید.", en: "Drink at least 8–10 glasses of water daily, and more on training days." },
  { fa: "روغن مصرفی را با قاشق اندازه‌گیری کنید و از سرخ‌کردن غذا خودداری کنید.", en: "Measure cooking oil with a spoon and avoid deep-frying." },
  { fa: "غذاها را به‌صورت آب‌پز، بخارپز، تنوری یا گریل آماده کنید.", en: "Prepare food boiled, steamed, baked or grilled." },
  { fa: "سبزیجات و سالاد بدون سس را می‌توانید بدون محدودیت مصرف کنید.", en: "Vegetables and undressed salad can be eaten freely." },
  { fa: "از مصرف نوشابه، آب‌میوه صنعتی، فست‌فود و شیرینی خودداری کنید.", en: "Avoid soft drinks, packaged juice, fast food and sweets." },
  { fa: "نمک و غذاهای شور را محدود کنید و از نمک یددار کم‌سدیم استفاده کنید.", en: "Limit salt and salty foods; use low-sodium iodised salt." },
  { fa: "وزن غذاها را پس از پخت اندازه‌گیری کنید، مگر اینکه خلاف آن ذکر شده باشد.", en: "Weigh foods after cooking unless stated otherwise." },
  { fa: "هفته‌ای یک وعده آزاد با هماهنگی مربی مجاز است.", en: "One free meal per week is allowed in agreement with your coach." },
  { fa: "وزن خود را هر هفته، صبح ناشتا و پس از دستشویی ثبت کنید.", en: "Log your weight weekly, in the morning on an empty stomach." },
  { fa: "خواب شبانه 7 تا 9 ساعت را جدی بگیرید؛ کم‌خوابی اشتها را افزایش می‌دهد.", en: "Prioritise 7–9 hours of sleep; poor sleep increases appetite." },
];

/* =================================================================== */
/*  Formatting helpers                                                  */
/* =================================================================== */

export const zeroMacros = (): Macros => ({ kcal: 0, p: 0, c: 0, f: 0, fiber: 0 });

/** Latin digits with thousands separators. */
export function nf(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function unitLabel(unit: UnitKey, lang: "fa" | "en", custom?: { unitLabel?: string; unitLabelEn?: string }): string {
  if (unit === "portion" && custom?.unitLabel) return lang === "fa" ? custom.unitLabel : (custom.unitLabelEn || custom.unitLabel);
  return UNIT_LABELS[unit]?.[lang] ?? unit;
}

/** "150 گرم" or "2 عدد (100 گرم)" */
export function formatPortion(item: Pick<NutriItem, "amount" | "unit" | "grams" | "unitLabel" | "unitLabelEn">, lang: "fa" | "en"): string {
  const label = unitLabel(item.unit, lang, item);
  if (item.unit === "g" || item.unit === "ml") return `${nf(item.amount, 1)} ${label}`;
  const grams = lang === "fa" ? `${nf(item.grams)} گرم` : `${nf(item.grams)} g`;
  return `${nf(item.amount, 2)} ${label} (${grams})`;
}

export function itemName(item: { name: string; nameEn?: string }, lang: "fa" | "en"): string {
  return lang === "fa" ? item.name : (item.nameEn || item.name);
}

/* =================================================================== */
/*  Foods & item macros                                                 */
/* =================================================================== */

export function allFoods(data: AppData, coachId: string): NutriFood[] {
  const custom = data.foods.filter((food) => !coachId || food.coachId === coachId).map(customToFood);
  return [...custom, ...FOOD_BY_ID.values()];
}

export function findFood(id: string, data: AppData): NutriFood | undefined {
  const builtIn = FOOD_BY_ID.get(id);
  if (builtIn) return builtIn;
  const custom = data.foods.find((food: FoodEntry) => food.id === id);
  return custom ? customToFood(custom) : undefined;
}

export function macrosForGrams(food: NutriFood, grams: number): Macros {
  const factor = Math.max(0, grams) / 100;
  return {
    kcal: food.per100.kcal * factor,
    p: food.per100.p * factor,
    c: food.per100.c * factor,
    f: food.per100.f * factor,
    fiber: food.per100.fiber * factor,
  };
}

export function unitFor(food: NutriFood, key: UnitKey): FoodUnit {
  return food.units.find((unit) => unit.key === key) ?? food.units[0];
}

function legacySnapshot(food: NutriFood, amount: number, unit: FoodUnit, macros: Macros) {
  const label = unit.label || UNIT_LABELS[unit.key].fa;
  return {
    id: food.id,
    coachId: "",
    name: food.fa,
    serving: `${nf(amount, 2)} ${label}`,
    kcal: round1(macros.kcal),
    p: round1(macros.p),
    c: round1(macros.c),
    f: round1(macros.f),
    fiber: round1(macros.fiber),
  };
}

export function makeItem(food: NutriFood, amount: number, unitKey: UnitKey, note = "", keepUid?: string, alternatives?: NutriAlt[]): NutriItem {
  const unit = unitFor(food, unitKey);
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const grams = round1(safe * unit.grams);
  const macros = macrosForGrams(food, grams);
  return {
    uid: keepUid || uid("ni"),
    foodId: food.id,
    qty: 1,
    note,
    food: legacySnapshot(food, safe, unit, macros),
    name: food.fa,
    nameEn: food.en,
    amount: safe,
    unit: unit.key,
    unitLabel: unit.label,
    unitLabelEn: unit.labelEn,
    grams,
    macros,
    alternatives: alternatives ?? [],
  };
}

export function makeAlt(food: NutriFood, amount: number, unitKey: UnitKey): NutriAlt {
  const unit = unitFor(food, unitKey);
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const grams = round1(safe * unit.grams);
  return {
    foodId: food.id,
    name: food.fa,
    nameEn: food.en,
    amount: safe,
    unit: unit.key,
    unitLabel: unit.label,
    unitLabelEn: unit.labelEn,
    grams,
    macros: macrosForGrams(food, grams),
  };
}

/** Suggests an equivalent portion of another food with the same calories. */
export function equivalentAmount(target: Macros, food: NutriFood, unitKey: UnitKey): number {
  const unit = unitFor(food, unitKey);
  if (!food.per100.kcal || !unit.grams) return 1;
  const grams = (target.kcal / food.per100.kcal) * 100;
  const amount = grams / unit.grams;
  const step = unit.key === "g" || unit.key === "ml" ? 5 : 0.5;
  return Math.max(step, Math.round(amount / step) * step);
}

export function sumMacros(items: { macros: Macros }[] | undefined): Macros {
  const total = zeroMacros();
  for (const item of items ?? []) {
    total.kcal += item.macros?.kcal || 0;
    total.p += item.macros?.p || 0;
    total.c += item.macros?.c || 0;
    total.f += item.macros?.f || 0;
    total.fiber += item.macros?.fiber || 0;
  }
  return total;
}

export function dayItems(_plan: ProPlan, day: NutriDay, slotId: string): NutriItem[] {
  return day.items[slotId] ?? [];
}

export function dayTotals(plan: ProPlan, day: NutriDay): Macros {
  const total = zeroMacros();
  for (const slot of plan.meals) {
    const sum = sumMacros(dayItems(plan, day, slot.id));
    total.kcal += sum.kcal;
    total.p += sum.p;
    total.c += sum.c;
    total.f += sum.f;
    total.fiber += sum.fiber;
  }
  return total;
}

export function planTargets(plan: ProPlan): Targets {
  return { kcal: plan.targetKcal || 0, p: plan.targetP || 0, c: plan.targetC || 0, f: plan.targetF || 0 };
}

export function dayTargets(plan: ProPlan, day: NutriDay): Targets {
  return day.targets ?? planTargets(plan);
}

/** Percentage deviation of a value from its target. */
export function deviation(value: number, target: number): number {
  if (!target) return 0;
  return ((value - target) / target) * 100;
}

export function deviationTone(value: number, target: number): "ok" | "warn" | "danger" | "mute" {
  if (!target) return "mute";
  const d = Math.abs(deviation(value, target));
  if (d <= 5) return "ok";
  if (d <= 12) return "warn";
  return "danger";
}

/* =================================================================== */
/*  Energy & macro calculator                                           */
/* =================================================================== */

export function activityFactor(key: ActivityKey): number {
  return ACTIVITY.find((item) => item.key === key)?.factor ?? 1.55;
}

export function goalPct(calc: NutriCalc): number {
  if (calc.goal === "custom") return calc.adjustPct;
  return GOALS.find((item) => item.key === calc.goal)?.pct ?? 0;
}

export function computeEnergy(calc: NutriCalc) {
  const w = Math.max(30, calc.weight || 70);
  const h = Math.max(120, calc.height || 170);
  const a = Math.max(12, calc.age || 25);
  const male = calc.gender === "male";
  const bf = calc.bodyFat && calc.bodyFat > 2 && calc.bodyFat < 60 ? calc.bodyFat : null;
  const lbm = bf ? w * (1 - bf / 100) : null;
  let bmr: number;
  if (calc.formula === "katch" && lbm) bmr = 370 + 21.6 * lbm;
  else if (calc.formula === "harris") bmr = male ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * a : 447.593 + 9.247 * w + 3.098 * h - 4.33 * a;
  else bmr = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161);
  const tdee = bmr * activityFactor(calc.activity);
  const target = Math.round((tdee * (1 + goalPct(calc) / 100)) / 10) * 10;
  const protein = Math.round(calc.proteinPerKg * w);
  const fat = Math.round((target * (calc.fatPct / 100)) / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  const bmi = w / Math.pow(h / 100, 2);
  const water = Math.round((w * 35 + (calc.activity === "sedentary" ? 0 : 500)) / 50) * 50;
  const fiber = Math.round((target / 1000) * 14);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target, protein, fat, carbs, bmi, lbm, water, fiber, usedKatch: calc.formula === "katch" && !!lbm };
}

export function bmiLabel(bmi: number, lang: "fa" | "en"): { text: string; tone: "ok" | "warn" | "danger" | "info" } {
  if (bmi < 18.5) return { text: lang === "fa" ? "کمبود وزن" : "Underweight", tone: "info" };
  if (bmi < 25) return { text: lang === "fa" ? "وزن طبیعی" : "Normal", tone: "ok" };
  if (bmi < 30) return { text: lang === "fa" ? "اضافه وزن" : "Overweight", tone: "warn" };
  return { text: lang === "fa" ? "چاقی" : "Obese", tone: "danger" };
}

function goalFromStudent(goal: string): GoalKey {
  if (goal === "کاهش وزن" || goal === "چربی‌سوزی") return "cut";
  if (goal === "عضله‌سازی") return "leanBulk";
  if (goal === "تغییر ترکیب بدنی") return "mildCut";
  return "maintain";
}

function activityFromStudent(student?: Student): ActivityKey {
  const days = student?.assessment?.daysPerWeek ?? 3;
  if (days <= 1) return "sedentary";
  if (days <= 3) return "light";
  if (days <= 5) return "moderate";
  return "active";
}

export function latestBody(data: AppData, studentId: string): { weight?: number; bodyFat?: number } {
  const entries = data.progress
    .filter((entry) => entry.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const weight = entries.find((entry) => entry.weight > 0)?.weight;
  const bodyFat = entries.find((entry) => (entry.bodyFat ?? 0) > 0)?.bodyFat;
  return { weight, bodyFat };
}

export function defaultCalc(student: Student | undefined, data: AppData): NutriCalc {
  const body = student ? latestBody(data, student.id) : {};
  const goal = goalFromStudent(student?.goal ?? "");
  const preset = goal === "cut" || goal === "mildCut" ? "highProtein" : goal === "leanBulk" ? "performance" : "balanced";
  const p = MACRO_PRESETS.find((item) => item.key === preset)!;
  return {
    formula: "mifflin",
    activity: activityFromStudent(student),
    goal,
    adjustPct: 0,
    proteinPerKg: p.proteinPerKg,
    fatPct: p.fatPct,
    weight: body.weight || student?.weight || 75,
    height: student?.height || 175,
    age: student?.age || 25,
    gender: student?.gender === "زن" ? "female" : "male",
    bodyFat: body.bodyFat ?? null,
    preset,
  };
}

export function defaultProfile(): NutriProfile {
  return {
    allergies: [],
    restrictions: [],
    dislikes: "",
    medical: "",
    wake: "07:00",
    sleep: "23:30",
    training: "18:00",
    budget: "standard",
    mealsPerDay: 5,
  };
}

/* =================================================================== */
/*  Plan construction & normalisation                                   */
/* =================================================================== */

export function defaultSlots(count: number): NutriSlot[] {
  const pick: Record<number, number[]> = {
    3: [0, 2, 6],
    4: [0, 2, 3, 6],
    5: [0, 1, 2, 3, 6],
    6: [0, 1, 2, 3, 6, 7],
    7: [0, 1, 2, 4, 5, 6, 7],
  };
  const indexes = pick[Math.min(7, Math.max(3, count))];
  return indexes.map((index) => ({ id: uid("slot"), slot: MEAL_PRESETS[index].fa, time: MEAL_PRESETS[index].time, note: "", items: [] }));
}

export function blankDay(name: string, kind: DayKind, weekdays: number[]): NutriDay {
  return { id: uid("day"), name, kind, weekdays, items: {}, targets: null };
}

export function isoDate(date: Date): string {
  return dayKey(date);
}

export function newPlan(options: { student?: Student; data: AppData; coachId: string; name?: string; status?: ProPlan["status"] }): ProPlan {
  const { student, data, coachId } = options;
  const calc = defaultCalc(student, data);
  const energy = computeEnergy(calc);
  const profile = defaultProfile();
  const at = nowIso();
  const start = new Date();
  return {
    id: uid("meal"),
    pro: 1,
    studentId: student?.id ?? "",
    coachId,
    name: options.name || "برنامه غذایی اختصاصی",
    status: options.status ?? "draft",
    createdAt: at,
    updatedAt: at,
    version: 1,
    history: [],
    meals: defaultSlots(profile.mealsPerDay),
    days: [blankDay("برنامه روزانه", "custom", [0, 1, 2, 3, 4, 5, 6])],
    supplements: [],
    guidelines: "",
    coachNote: "",
    profile,
    calc,
    targetKcal: energy.target,
    targetP: energy.protein,
    targetC: energy.carbs,
    targetF: energy.fat,
    targetFiber: energy.fiber,
    waterGoal: energy.water,
    startDate: isoDate(start),
    endDate: isoDate(addDays(start, 28)),
    reviewDate: isoDate(addDays(start, 14)),
    serviceOff: false,
  };
}

/** Converts a legacy item (serving-based) into a professional item. */
function upgradeItem(item: MealItem, data: AppData): NutriItem {
  const known = item as Partial<NutriItem>;
  if (known.uid && known.macros && known.unit) return { alternatives: [], ...(known as NutriItem) };
  const food = item.food ?? data.foods.find((entry) => entry.id === item.foodId);
  const qty = Number(item.qty) || 1;
  const macros: Macros = food
    ? { kcal: food.kcal * qty, p: food.p * qty, c: food.c * qty, f: food.f * qty, fiber: (food.fiber || 0) * qty }
    : zeroMacros();
  return {
    ...item,
    uid: uid("ni"),
    name: food?.name ?? "—",
    amount: qty,
    unit: "portion",
    unitLabel: food?.serving || "واحد",
    unitLabelEn: food?.serving || "portion",
    grams: 0,
    macros,
    alternatives: [],
  };
}

export function normalizePlan(record: MealPlan, data: AppData): ProPlan {
  const base = record as Partial<ProPlan> & MealPlan;
  const student = data.students.find((item) => item.id === record.studentId);
  const meals: NutriSlot[] = (record.meals ?? []).map((slot, index) => ({
    ...slot,
    id: slot.id || `${index}`,
    slot: slot.slot || MEAL_PRESETS[Math.min(index, MEAL_PRESETS.length - 1)].fa,
    time: (slot as Partial<NutriSlot>).time ?? "",
    note: (slot as Partial<NutriSlot>).note ?? "",
    items: (slot.items ?? []).map((item) => upgradeItem(item, data)),
  }));
  let days = Array.isArray(base.days) && base.days.length ? base.days : null;
  if (!days) {
    const items: Record<string, NutriItem[]> = {};
    for (const slot of meals) items[slot.id] = slot.items;
    days = [{ id: uid("day"), name: "برنامه روزانه", kind: "custom", weekdays: [0, 1, 2, 3, 4, 5, 6], items, targets: null }];
  }
  days = days.map((day) => ({
    ...day,
    weekdays: Array.isArray(day.weekdays) ? day.weekdays : [],
    items: Object.fromEntries(Object.entries(day.items ?? {}).map(([slotId, list]) => [slotId, (list ?? []).map((item) => upgradeItem(item, data))])),
    targets: day.targets ?? null,
  }));
  const calc = { ...defaultCalc(student, data), ...(base.calc ?? {}) };
  const start = new Date(record.createdAt || Date.now());
  return {
    ...record,
    pro: 1,
    meals,
    days,
    supplements: Array.isArray(base.supplements) ? base.supplements : [],
    guidelines: base.guidelines ?? "",
    coachNote: base.coachNote ?? "",
    profile: { ...defaultProfile(), ...(base.profile ?? {}) },
    calc,
    startDate: base.startDate || isoDate(start),
    endDate: base.endDate || isoDate(addDays(start, 28)),
    reviewDate: base.reviewDate || isoDate(addDays(start, 14)),
    serviceOff: base.serviceOff,
    publishedAt: base.publishedAt,
  };
}

/** Mirrors the first day into `meals[].items` so legacy readers and server validation keep working. */
export function syncLegacy(plan: ProPlan): ProPlan {
  const primary = plan.days[0];
  return {
    ...plan,
    meals: plan.meals.slice(0, 12).map((slot) => ({ ...slot, items: (primary?.items[slot.id] ?? []).slice(0, 30) })),
  };
}

export function snapshotOf(plan: ProPlan) {
  return {
    version: plan.version || 1,
    at: plan.updatedAt || plan.createdAt,
    name: plan.name,
    meals: structuredClone(plan.meals),
    days: structuredClone(plan.days),
    supplements: structuredClone(plan.supplements),
    guidelines: plan.guidelines,
    coachNote: plan.coachNote,
    targets: { kcal: plan.targetKcal, p: plan.targetP, c: plan.targetC, f: plan.targetF, fiber: plan.targetFiber, water: plan.waterGoal },
  };
}

export type PlanSnapshot = ReturnType<typeof snapshotOf>;

/* =================================================================== */
/*  Records, service state & templates                                  */
/* =================================================================== */

export function studentRecords(data: AppData, studentId: string): MealPlan[] {
  return data.meals
    .filter((meal) => meal.studentId === studentId && meal.status !== "template")
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

export function currentRecord(data: AppData, studentId: string): MealPlan | undefined {
  return studentRecords(data, studentId).find((meal) => meal.status !== "archived");
}

export function archivedRecords(data: AppData, studentId: string): MealPlan[] {
  return studentRecords(data, studentId).filter((meal) => meal.status === "archived");
}

export type ServiceState = "off" | "pending" | "active";

export function serviceState(data: AppData, studentId: string): ServiceState {
  const record = currentRecord(data, studentId) as (MealPlan & { serviceOff?: boolean }) | undefined;
  if (!record || record.serviceOff) return "off";
  return record.status === "active" ? "active" : "pending";
}

export function templatesOf(data: AppData, coachId: string): MealPlan[] {
  return data.meals
    .filter((meal) => meal.status === "template" && (!coachId || meal.coachId === coachId))
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

/** Copies plan content (structure, foods, targets, guidance) into a fresh record. */
export function clonePlanContent(source: ProPlan, overrides: Partial<ProPlan>): ProPlan {
  const slotMap = new Map<string, string>();
  const meals = source.meals.map((slot) => {
    const id = uid("slot");
    slotMap.set(slot.id, id);
    return { ...structuredClone(slot), id };
  });
  const days = source.days.map((day) => ({
    ...structuredClone(day),
    id: uid("day"),
    items: Object.fromEntries(
      Object.entries(day.items).map(([slotId, list]) => [slotMap.get(slotId) ?? slotId, list.map((item) => ({ ...structuredClone(item), uid: uid("ni") }))]),
    ),
  }));
  const at = nowIso();
  return {
    ...structuredClone(source),
    id: uid("meal"),
    meals,
    days,
    version: 1,
    history: [],
    createdAt: at,
    updatedAt: at,
    publishedAt: undefined,
    ...overrides,
  };
}

/* =================================================================== */
/*  Day resolution, adherence & shopping list                           */
/* =================================================================== */

export function resolveDay(plan: ProPlan, date: Date = new Date()): NutriDay {
  const index = weekdayIdx(date);
  return plan.days.find((day) => day.weekdays.includes(index)) ?? plan.days[0];
}

export function filledSlots(plan: ProPlan, day: NutriDay): NutriSlot[] {
  return plan.meals.filter((slot) => dayItems(plan, day, slot.id).length > 0);
}

export function adherenceRows(data: AppData, plan: ProPlan, span = 14) {
  const rows: { date: string; label: Date; planned: number; done: number; dayName: string }[] = [];
  const since = (plan.publishedAt || plan.createdAt || "").slice(0, 10);
  const today = new Date();
  for (let offset = span - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const key = dayKey(date);
    if (since && key < since) continue;
    const day = resolveDay(plan, date);
    const slots = filledSlots(plan, day).map((slot) => slot.id);
    const logged = new Set(
      data.nutritionLogs.filter((log) => log.planId === plan.id && log.studentId === plan.studentId && log.date === key).map((log) => log.slotId),
    );
    rows.push({ date: key, label: date, planned: slots.length, done: slots.filter((id) => logged.has(id)).length, dayName: day.name });
  }
  const planned = rows.reduce((sum, row) => sum + row.planned, 0);
  const done = rows.reduce((sum, row) => sum + row.done, 0);
  const week = rows.slice(-7);
  const weekPlanned = week.reduce((sum, row) => sum + row.planned, 0);
  const weekDone = week.reduce((sum, row) => sum + row.done, 0);
  return {
    rows,
    pct: planned ? Math.round((100 * done) / planned) : null,
    weekPct: weekPlanned ? Math.round((100 * weekDone) / weekPlanned) : null,
  };
}

export function shoppingList(plan: ProPlan) {
  const totals = new Map<string, { name: string; nameEn?: string; grams: number; portion?: string }>();
  for (let weekday = 0; weekday < 7; weekday++) {
    const day = plan.days.find((item) => item.weekdays.includes(weekday)) ?? plan.days[0];
    if (!day) continue;
    for (const slot of plan.meals) {
      for (const item of dayItems(plan, day, slot.id)) {
        const key = item.foodId || item.name;
        const current = totals.get(key) ?? { name: item.name, nameEn: item.nameEn, grams: 0 };
        current.grams += item.grams || 0;
        if (!item.grams) current.portion = item.unitLabel;
        totals.set(key, current);
      }
    }
  }
  return [...totals.values()].sort((a, b) => b.grams - a.grams);
}

export const WEEKDAY_SHORT_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
export const WEEKDAY_SHORT_EN = ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"];
export const WEEKDAY_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const WEEKDAY_EN = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/* =================================================================== */
/*  Built-in default names follow the interface language;              */
/*  anything the coach typed is always shown exactly as written.       */
/* =================================================================== */

const NAME_PAIRS: [string, string][] = [
  ...MEAL_PRESETS.map((preset) => [preset.fa, preset.en] as [string, string]),
  ["برنامه غذایی اختصاصی", "Personal nutrition plan"],
  ["برنامه روزانه", "Daily plan"],
  ["روز تمرین", "Training day"],
  ["روز استراحت", "Rest day"],
  ["روز عمومی", "General day"],
  ["وعده جدید", "New meal"],
  ["قالب جدید برنامه غذایی", "New nutrition template"],
];
const FA_TO_EN = new Map(NAME_PAIRS);
const EN_TO_FA = new Map(NAME_PAIRS.map(([fa, en]) => [en, fa] as [string, string]));

export function localName(name: string, lang: "fa" | "en"): string {
  const key = name.trim();
  return (lang === "en" ? FA_TO_EN.get(key) : EN_TO_FA.get(key)) ?? name;
}
