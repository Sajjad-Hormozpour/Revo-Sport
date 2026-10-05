import { Check, Droplets, Utensils } from "lucide-react";
import { useStore } from "../../lib/store";
import { fa } from "../../lib/core";
import { dayKey } from "../../lib/time";
import { activeMealPlan, completedMeals, foodFor, sumItems, sumPlan } from "../../lib/nutrition";
import { BrandBtn, Empty, ProgressBar } from "../../components/ui";

const labels = [
  ["kcal", "کالری", "kcal"], ["p", "پروتئین", "g"], ["c", "کربوهیدرات", "g"],
  ["f", "چربی", "g"], ["fiber", "فیبر", "g"],
] as const;

export default function StudentNutrition({ studentId, onToast }: {
  studentId: string; onToast: (title: string, detail: string) => void;
}) {
  const { data, toggleNutritionMeal, addWater } = useStore();
  const plan = activeMealPlan(data, studentId);
  const today = dayKey();
  const water = data.water[studentId];
  const goal = plan?.waterGoal || 3000;
  const consumed = water?.date === today ? water.ml : 0;
  if (!plan) return <div className="screen-in py-8"><Empty text="مربی هنوز برنامه غذایی برایت ارسال نکرده است." /></div>;
  const { done, count } = completedMeals(data, plan, today);
  const targets = sumPlan(plan, data);
  const eaten = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
  plan.meals.forEach((slot, index) => {
    if (!done.has(slot.id || `${index}`)) return;
    const total = sumItems(slot.items, data);
    labels.forEach(([key]) => { eaten[key] += total[key]; });
  });
  const targetsByKey = { kcal: plan.targetKcal || targets.kcal, p: plan.targetP || targets.p,
    c: plan.targetC || targets.c, f: plan.targetF || targets.f, fiber: plan.targetFiber || targets.fiber };
  const adherence = plan.meals.length ? Math.round(100 * count / plan.meals.length) : 0;

  return <div className="screen-in space-y-3 pb-6">
    <div className="rounded-3xl border border-[var(--color-line)] bg-gradient-to-l from-[#e9e400]/15 to-[var(--color-card)] p-4">
      <p className="text-[11px] text-[#e9e400]">تغذیه امروز • نسخه {fa(plan.version || 1)}</p>
      <h2 className="text-[18px] font-black">{plan.name}</h2>
      <div className="mt-3 flex items-center justify-between text-[12px]"><span>پایبندی امروز</span><b className="tnum">{fa(count)} / {fa(plan.meals.length)} وعده • {fa(adherence)}٪</b></div>
      <ProgressBar pct={adherence} className="mt-1.5" />
    </div>
    <div className="grid grid-cols-2 gap-2">{labels.map(([key,title,unit]) => <div key={key} className="rounded-2xl bg-[var(--color-card)] p-3">
      <b className="text-[12px]">{title}</b><p className="tnum mt-1 text-[14px] font-black text-[#e9e400]">{fa(Math.round(eaten[key]))} / {fa(Math.round(targetsByKey[key]))} {unit}</p>
      <ProgressBar pct={targetsByKey[key] ? 100 * eaten[key] / targetsByKey[key] : 0} className="mt-2" />
    </div>)}</div>
    <div className="rounded-2xl bg-[var(--color-card)] p-3">
      <div className="flex justify-between text-[12px]"><b className="flex items-center gap-1"><Droplets size={15} className="text-sky-400" /> آب</b><span className="tnum">{fa(consumed)} / {fa(goal)} ml</span></div>
      <ProgressBar pct={100 * consumed / goal} className="mt-2" />
      <div className="mt-2 flex gap-2">{[250,500].map((ml) => <button key={ml} onClick={() => { addWater(studentId,ml); onToast("آب ثبت شد",`${fa(ml)} میلی‌لیتر`); }} className="press flex-1 rounded-full bg-[var(--color-bg)] py-2 text-[12px]">+ {fa(ml)} ml</button>)}</div>
    </div>
    <h3 className="flex items-center gap-1.5 text-[14px] font-black"><Utensils size={16} className="text-[#e9e400]" /> وعده‌های امروز</h3>
    {plan.meals.map((slot,index) => { const id = slot.id || `${index}`; const isDone = done.has(id); const total = sumItems(slot.items,data); return <section key={id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between"><b className="text-[13px]">{slot.slot}</b><span className="tnum text-[11px] text-[var(--color-mute)]">{fa(Math.round(total.kcal))} kcal</span></div>
      {slot.items.length === 0 ? <p className="mt-1 text-[11px] text-[var(--color-mute)]">غذایی برای این وعده ثبت نشده</p> : slot.items.map((item,i) => { const food=foodFor(item,data); return <p key={i} className="mt-1 text-[12px] text-[var(--color-mute)]">{food?.name || "غذا"} • {fa(item.qty)} × {food?.serving || "سروینگ"}{item.note ? ` • ${item.note}` : ""}</p>; })}
      <BrandBtn className={`mt-2 w-full ${isDone ? "!bg-emerald-500" : ""}`} onClick={() => { toggleNutritionMeal(plan.id,id,today); onToast(isDone ? "ثبت وعده برداشته شد" : "وعده ثبت شد",slot.slot); }}><Check size={15} />{isDone ? "انجام شد • بازگردانی" : "ثبت مصرف وعده"}</BrandBtn>
    </section>; })}
  </div>;
}