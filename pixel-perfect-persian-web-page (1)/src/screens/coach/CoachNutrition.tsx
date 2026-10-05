import { useMemo, useState } from "react";
import { BookOpen, Copy, Plus, Save, Search, Send, Trash2, History, RotateCcw } from "lucide-react";
import { FOODS } from "../../data/library";
import type { FoodEntry, MealPlan, MealSlot } from "../../data/types";
import { useStore } from "../../lib/store";
import { uid, fa } from "../../lib/core";
import { nowIso, formatDateTime } from "../../lib/time";
import { foodFor, sumItems, sumPlan } from "../../lib/nutrition";
import { BrandBtn, Empty, Field, Pill, inputCls } from "../../components/ui";

const SLOTS = ["صبحانه", "میان‌وعده", "ناهار", "قبل تمرین", "بعد تمرین", "شام", "میان‌وعده شب"];
const emptySlots = (): MealSlot[] => SLOTS.map((slot) => ({ id: uid("slot"), slot, items: [] }));
const freshPlan = (studentId: string, coachId: string, status: MealPlan["status"] = "draft"): MealPlan => ({
  id: uid("meal"), studentId, coachId, name: status === "template" ? "قالب تغذیه جدید" : "برنامه غذایی جدید",
  meals: emptySlots(), createdAt: nowIso(), updatedAt: nowIso(), version: 1, status,
  targetKcal: 2400, targetP: 180, targetC: 260, targetF: 75, targetFiber: 30, waterGoal: 3000, history: [],
});

export default function CoachNutrition({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, session, userById, saveMeal, deleteMeal, saveFood, deleteFood } = useStore();
  const owner = session?.userId || "";
  const [tab, setTab] = useState<"plans" | "templates" | "foods">("plans");
  const [studentId, setStudentId] = useState(data.students[0]?.id || "");
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<MealPlan | null>(null);
  const [foodQuery, setFoodQuery] = useState("");
  const [newFood, setNewFood] = useState<FoodEntry>({ id: uid("food"), coachId: owner, name: "", serving: "۱۰۰ گرم", kcal: 0, p: 0, c: 0, f: 0, fiber: 0 });
  const plans = data.meals.filter((m) => m.studentId === studentId && m.status !== "template");
  const templates = data.meals.filter((m) => m.status === "template" && m.coachId === owner);
  const current = draft || data.meals.find((m) => m.id === selected);
  const foods = useMemo(() => [
    ...FOODS.map((food) => ({ ...food, coachId: "", serving: food.unit, fiber: 0 } as FoodEntry)),
    ...data.foods,
  ], [data.foods]);
  const filteredFoods = foods.filter((f) => f.name.includes(foodQuery.trim())).slice(0, 40);

  const change = (patch: Partial<MealPlan>) => {
    if (!current) return;
    setDraft({ ...current, ...patch });
  };
  const changeSlot = (index: number, slot: MealSlot) => {
    if (!current) return;
    change({ meals: current.meals.map((s, i) => i === index ? slot : s) });
  };
  const save = (status: MealPlan["status"] = current?.status || "active") => {
    if (!current) return;
    if (!current.name.trim()) return onToast("عنوان برنامه لازم است", "");
    if (status === "active" && !current.studentId) return onToast("شاگرد را انتخاب کن", "");
    if (status === "active" && !current.meals.some((s) => s.items.length)) return onToast("حداقل یک غذا اضافه کن", "");
    const old = data.meals.find((m) => m.id === current.id);
    const version = old ? (old.version || 1) + 1 : 1;
    const history = old ? [...(old.history || []), { version: old.version || 1, at: old.updatedAt || old.createdAt, name: old.name, meals: structuredClone(old.meals) }].slice(-20) : [];
    const next = { ...current, coachId: owner, status, name: current.name.trim(), version, history, updatedAt: nowIso() };
    saveMeal(next);
    setSelected(next.id);
    setDraft(null);
    onToast(status === "template" ? "قالب ذخیره شد" : status === "active" ? "برنامه برای شاگرد فعال شد" : "پیش‌نویس ذخیره شد", `نسخه ${fa(version)}`);
  };
  const duplicate = (m: MealPlan, destination = m.studentId) => {
    const copy: MealPlan = { ...structuredClone(m), id: uid("meal"), studentId: destination, coachId: owner,
      name: `${m.name} - کپی`, createdAt: nowIso(), updatedAt: nowIso(), version: 1, history: [],
      status: destination ? "draft" : "template", sourceId: m.id,
      meals: m.meals.map((s) => ({ ...s, id: uid("slot") })),
    };
    saveMeal(copy); setSelected(copy.id); setDraft(null);
    onToast("کپی ساخته شد", "پیش‌نویس را بررسی و ارسال کن");
  };

  return (
    <div className="screen-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-[19px] font-black">تغذیه شاگردان</h2><p className="text-[12px] text-[var(--color-mute)]">برنامه، قالب و مواد غذایی در دیتابیس مشترک ذخیره می‌شوند.</p></div>
        <div className="flex gap-1.5">
          {(["plans", "templates", "foods"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setDraft(null); setSelected(""); }} className={`rounded-full px-3 py-2 text-[11.5px] font-bold ${tab === t ? "bg-[#e9e400] text-black" : "bg-[var(--color-card)]"}`}>
              {t === "plans" ? "برنامه‌ها" : t === "templates" ? "قالب‌ها" : "مواد غذایی"}
            </button>
          ))}
        </div>
      </div>

      {tab === "foods" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="rounded-2xl bg-[var(--color-card)] p-4">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2"><Search size={15} /><input value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} placeholder="جستجوی ماده غذایی" className="min-w-0 flex-1 bg-transparent outline-none" /></div>
            <div className="mt-3 space-y-1.5">
              {filteredFoods.map((food) => <div key={food.id} className="flex items-center gap-2 rounded-xl bg-[var(--color-bg)] p-2.5 text-[12px]">
                <span className="min-w-0 flex-1"><b className="block">{food.name}</b><span className="text-[var(--color-mute)]">{food.serving} • {fa(food.kcal)} کالری • P {fa(food.p)} / C {fa(food.c)} / F {fa(food.f)} / فیبر {fa(food.fiber)}</span></span>
                {food.coachId === owner && <button onClick={() => { if (confirm("ماده غذایی حذف شود؟")) deleteFood(food.id); }} aria-label="حذف ماده غذایی" className="text-red-400"><Trash2 size={14} /></button>}
              </div>)}
            </div>
          </div>
          <div className="h-fit space-y-2 rounded-2xl bg-[var(--color-card)] p-4"><b>ماده غذایی اختصاصی</b>
            <Field label="نام"><input className={inputCls} value={newFood.name} onChange={(e) => setNewFood({ ...newFood, name: e.target.value })} /></Field>
            <Field label="مقدار هر سروینگ"><input className={inputCls} value={newFood.serving} onChange={(e) => setNewFood({ ...newFood, serving: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">{([['kcal','کالری'],['p','پروتئین'],['c','کربوهیدرات'],['f','چربی'],['fiber','فیبر']] as const).map(([key,label]) => <Field key={key} label={label}><input type="number" min="0" className={inputCls} value={newFood[key]} onChange={(e) => setNewFood({ ...newFood, [key]: Number(e.target.value) })} /></Field>)}</div>
            <BrandBtn className="w-full" onClick={() => { if (!newFood.name.trim() || !newFood.serving.trim()) return onToast("نام و سروینگ لازم است", ""); saveFood({ ...newFood, name: newFood.name.trim() }); setNewFood({ id: uid("food"), coachId: owner, name: "", serving: "۱۰۰ گرم", kcal: 0, p: 0, c: 0, f: 0, fiber: 0 }); onToast("غذا ذخیره شد", ""); }}><Plus size={15} /> ثبت ماده غذایی</BrandBtn>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {tab === "plans" && <Field label="شاگرد"><select className={inputCls} value={studentId} onChange={(e) => { setStudentId(e.target.value); setSelected(""); setDraft(null); }}><option value="">شاگرد انتخاب کن</option>{data.students.map((s) => <option key={s.id} value={s.id}>{userById(s.userId)?.name}</option>)}</select></Field>}
            <BrandBtn className="w-full" onClick={() => { if (tab === "plans" && !studentId) return onToast("اول شاگرد را انتخاب کن", ""); setSelected(""); setDraft(freshPlan(tab === "templates" ? "" : studentId, owner, tab === "templates" ? "template" : "draft")); }}><Plus size={15} /> {tab === "templates" ? "قالب جدید" : "برنامه جدید"}</BrandBtn>
            {(tab === "templates" ? templates : plans).map((m) => <div key={m.id} className={`flex items-center gap-1 rounded-xl border p-2 ${m.id === current?.id ? "border-[#e9e400]" : "border-[var(--color-line)]"}`}>
              <button className="min-w-0 flex-1 text-right" onClick={() => { setDraft(null); setSelected(m.id); }}><b className="block truncate text-[12px]">{m.name}</b><span className="text-[10px] text-[var(--color-mute)]">نسخه {fa(m.version || 1)} • {m.status === "active" ? "فعال" : m.status === "template" ? "قالب" : m.status === "archived" ? "بایگانی" : "پیش‌نویس"}</span></button>
              <button onClick={() => duplicate(m, tab === "templates" ? "" : studentId)} title="کپی"><Copy size={14}/></button>
              <button onClick={() => { if (confirm("برنامه غذایی حذف شود؟")) { deleteMeal(m.id); setSelected(""); setDraft(null); } }} title="حذف" className="text-red-400"><Trash2 size={14}/></button>
            </div>)}
            {(tab === "templates" ? templates : plans).length === 0 && <Empty text="هنوز موردی ثبت نشده" />}
          </div>

          {current ? <div className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2"><input className={`${inputCls} min-w-0 flex-1`} aria-label="عنوان برنامه" value={current.name} onChange={(e) => change({ name: e.target.value })} /><Pill tone={current.status === "active" ? "ok" : "info"}>{current.status === "template" ? "قالب" : current.status === "active" ? "ارسال‌شده" : "در حال ویرایش"}</Pill></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{([['targetKcal','کالری هدف'],['targetP','پروتئین هدف (g)'],['targetC','کربوهیدرات هدف (g)'],['targetF','چربی هدف (g)'],['targetFiber','فیبر هدف (g)'],['waterGoal','هدف آب (ml)']] as const).map(([key,label]) => <Field key={key} label={label}><input type="number" min="0" className={inputCls} value={current[key] ?? 0} onChange={(e) => change({ [key]: Number(e.target.value) })} /></Field>)}</div>
            <div className="space-y-3">{current.meals.map((slot,index) => { const sum = sumItems(slot.items,data); return <section key={slot.id || index} className="rounded-xl bg-[var(--color-bg)] p-3">
              <div className="mb-2 flex items-center justify-between"><b className="text-[13px]">{slot.slot}</b><span className="tnum text-[11px] text-[var(--color-mute)]">{fa(Math.round(sum.kcal))} kcal • {fa(Math.round(sum.p))}g پروتئین</span></div>
              {slot.items.map((item,i) => { const food = foodFor(item,data); return <div key={i} className="mb-1 flex items-center gap-2 text-[11.5px]"><span className="min-w-0 flex-1 truncate">{food?.name || "غذای نامشخص"}</span><input type="number" min="0.1" step="0.1" aria-label={`تعداد سروینگ ${food?.name}`} className="w-16 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] p-1 text-center" value={item.qty} onChange={(e) => changeSlot(index,{ ...slot,items:slot.items.map((x,j) => j === i ? {...x,qty:Number(e.target.value)}:x) })}/><span>سروینگ</span><button title="حذف غذا" onClick={() => changeSlot(index,{...slot,items:slot.items.filter((_,j) => j !== i)})} className="text-red-400"><Trash2 size={13}/></button></div>; })}
              <select aria-label={`افزودن غذا به ${slot.slot}`} className={`${inputCls} mt-2`} value="" onChange={(e) => { const food = foods.find((f) => f.id === e.target.value); if(food) changeSlot(index,{...slot,items:[...slot.items,{foodId:food.id,qty:1,note:"",food:{...food}}]}); }}><option value="">+ افزودن ماده غذایی</option>{foods.map((food) => <option key={food.id} value={food.id}>{food.name} • {food.serving}</option>)}</select>
            </section>; })}</div>
            <div className="rounded-xl border border-[#e9e400]/25 p-3"><b className="text-[12px]">مجموع روزانه محاسبه‌شده</b><div className="mt-2 grid grid-cols-5 gap-1 text-center">{Object.entries(sumPlan(current,data)).map(([key,val]) => <div key={key}><b className="tnum block text-[12px] text-[#e9e400]">{fa(Math.round(val))}</b><span className="text-[9px] text-[var(--color-mute)]">{{kcal:'کالری',p:'پروتئین',c:'کربوهیدرات',f:'چربی',fiber:'فیبر'}[key as keyof ReturnType<typeof sumPlan>]}</span></div>)}</div></div>
            {!!current.history?.length && <details className="rounded-xl border border-[var(--color-line)] p-3"><summary className="cursor-pointer text-[12px] font-bold"><History size={13} className="ml-1 inline"/>تاریخچه نسخه‌ها ({fa(current.history.length)})</summary><div className="mt-2 space-y-2">{current.history.map((h) => <div key={h.version} className="flex items-center justify-between gap-2 text-[11px]"><span>نسخه {fa(h.version)} • {formatDateTime(h.at)}</span><button onClick={() => change({ name:h.name, meals:structuredClone(h.meals) })} className="text-[#e9e400]"><RotateCcw size={12} className="ml-1 inline"/>بازیابی در ویرایشگر</button></div>)}</div></details>}
            <div className="flex flex-wrap gap-2"><BrandBtn onClick={() => save(tab === "templates" ? "template" : "active")}><Send size={14}/>{tab === "templates" ? "ذخیره قالب" : "ذخیره و ارسال به شاگرد"}</BrandBtn>{tab === "plans" && <button className="rounded-full border border-[var(--color-line)] px-4 text-[12px]" onClick={() => save("draft")}><Save size={13} className="ml-1 inline"/>ذخیره پیش‌نویس</button>}{tab === "plans" && !!templates.length && <button className="rounded-full border border-[var(--color-line)] px-4 text-[12px]" onClick={() => { const template = templates[0]; setDraft({...structuredClone(template),id:uid('meal'),studentId,coachId:owner,status:'draft',name:`${template.name} برای ${userById(data.students.find(s => s.id===studentId)?.userId || '')?.name || 'شاگرد'}`,history:[],version:1,createdAt:nowIso()}); setSelected(''); }}><BookOpen size={13} className="ml-1 inline"/>شروع از قالب</button>}</div>
          </div> : <Empty text="یک برنامه انتخاب کن یا برنامه جدید بساز" />}
        </div>
      )}
    </div>
  );
}