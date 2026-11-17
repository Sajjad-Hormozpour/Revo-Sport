import { useMemo, useState } from "react";
import { ChevronLeft, PackagePlus, Search, X } from "lucide-react";
import type { FoodEntry } from "../data/types";
import { useStore } from "../lib/store";
import { uid } from "../lib/core";
import { Modal } from "../components/ui";
import { FOOD_CATEGORIES, UNIT_LABELS, customServing, customToFood, normalizeSearch, parseServing, type FoodCategory, type NutriFood, type UnitKey } from "./foods";
import { allFoods, equivalentAmount, macrosForGrams, nf, unitFor, type Macros } from "./engine";
import { Chip, Label, MacroInline, NumInput, fieldCls, gUnit, kcalUnit, useTx } from "./parts";

export type PickResult = { food: NutriFood; amount: number; unit: UnitKey; note: string };

function defaultPortion(food: NutriFood, equivalentTo?: Macros | null): { unit: UnitKey; amount: number } {
  // Prefer the most natural household serving: palm-size for protein, otherwise the largest common unit.
  const household = food.units.filter((unit) => unit.key !== "g" && unit.key !== "ml");
  const unit = (household.find((item) => item.key === "palm") ?? household[household.length - 1])?.key ?? "g";
  if (equivalentTo && equivalentTo.kcal > 0) return { unit, amount: equivalentAmount(equivalentTo, food, unit) };
  return { unit, amount: unit === "g" ? 100 : 1 };
}

export function unitOptionLabel(food: NutriFood, key: UnitKey, lang: "fa" | "en"): string {
  const unit = unitFor(food, key);
  const label = unit.label ? (lang === "fa" ? unit.label : unit.labelEn || unit.label) : UNIT_LABELS[key][lang];
  if (key === "g" || key === "ml") return label;
  return `${label} (${nf(unit.grams, 1)} ${gUnit(lang)})`;
}

export function FoodPicker({
  onClose, onPick, title, coachId, initial, equivalentTo, allowNote = true, confirmLabel,
}: {
  onClose: () => void;
  onPick: (result: PickResult) => void;
  title: string;
  coachId: string;
  initial?: { foodId: string; amount: number; unit: UnitKey; note?: string } | null;
  equivalentTo?: Macros | null;
  allowNote?: boolean;
  confirmLabel?: string;
}) {
  const { data } = useStore();
  const { tx, lang } = useTx();
  const foods = useMemo(() => allFoods(data, coachId), [data, coachId]);
  const initialFood = initial ? foods.find((food) => food.id === initial.foodId) ?? null : null;
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<FoodCategory | "all">("all");
  const [selected, setSelected] = useState<NutriFood | null>(initialFood);
  const [amount, setAmount] = useState(initial?.amount ?? 100);
  const [unit, setUnit] = useState<UnitKey>(initial?.unit ?? "g");
  const [note, setNote] = useState(initial?.note ?? "");
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const q = normalizeSearch(query);
    return foods.filter((food) => {
      if (cat !== "all" && food.cat !== cat) return false;
      if (!q) return true;
      return normalizeSearch(food.fa).includes(q) || food.en.toLowerCase().includes(q);
    });
  }, [foods, query, cat]);

  const choose = (food: NutriFood) => {
    const portion = defaultPortion(food, equivalentTo);
    setSelected(food);
    setUnit(portion.unit);
    setAmount(portion.amount);
  };

  const changeUnit = (next: UnitKey) => {
    if (!selected) return;
    const grams = amount * unitFor(selected, unit).grams;
    const target = unitFor(selected, next).grams || 1;
    const step = next === "g" || next === "ml" ? 5 : 0.5;
    setUnit(next);
    setAmount(Math.max(step, Math.round(grams / target / step) * step));
  };

  const grams = selected ? amount * unitFor(selected, unit).grams : 0;
  const macros = selected ? macrosForGrams(selected, grams) : null;
  const categories = FOOD_CATEGORIES.filter((item) => item.key !== "custom" || foods.some((food) => food.custom));

  return (
    <Modal open onClose={onClose} title={title} wide>
      {creating ? (
        <CustomFoodForm
          coachId={coachId}
          onCancel={() => setCreating(false)}
          onSaved={(entry) => {
            setCreating(false);
            setCat("custom");
            choose(customToFood(entry));
          }}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3">
              <Search size={16} className="shrink-0 text-[var(--color-mute)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tx("جستجوی غذا؛ مثلاً مرغ، برنج یا ماست", "Search foods, e.g. chicken, rice or yogurt")}
                className="h-11 min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-[var(--color-mute)]"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label={tx("پاک کردن جستجو", "Clear search")}>
                  <X size={14} className="text-[var(--color-mute)]" />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="press flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-[#e9e400]/50 px-3 text-[12px] font-black text-[#e9e400]"
            >
              <PackagePlus size={16} />
              <span className="hidden sm:inline">{tx("غذای جدید", "New food")}</span>
            </button>
          </div>

          <div className="noscroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <Chip on={cat === "all"} onClick={() => setCat("all")}>{tx("همه", "All")}</Chip>
            {categories.map((item) => (
              <Chip key={item.key} on={cat === item.key} onClick={() => setCat(item.key)}>{lang === "fa" ? item.fa : item.en}</Chip>
            ))}
          </div>

          <div className="noscroll max-h-[34dvh] space-y-1 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-1.5 sm:max-h-[300px]">
            {!list.length && (
              <p className="p-6 text-center text-[12.5px] leading-7 text-[var(--color-mute)]">
                {tx("غذایی با این نام پیدا نشد. می‌توانید آن را به‌عنوان غذای جدید تعریف کنید.", "No food matches this search. You can add it as a new food.")}
              </p>
            )}
            {list.map((food) => {
              const active = selected?.id === food.id;
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => choose(food)}
                  className={`press flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition ${
                    active ? "bg-[#e9e400]/15 ring-1 ring-[#e9e400]/40" : "hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <b className="block truncate text-[13px]">{lang === "fa" ? food.fa : food.en}</b>
                    <span className="tnum block text-[10.5px] text-[var(--color-mute)]">
                      {tx("در 100 گرم", "Per 100 g")}: {nf(food.per100.kcal)} {kcalUnit(lang)} • {tx("پروتئین", "Protein")} {nf(food.per100.p, 1)} • {tx("کربوهیدرات", "Carbs")} {nf(food.per100.c, 1)} • {tx("چربی", "Fat")} {nf(food.per100.f, 1)}
                    </span>
                  </span>
                  {food.custom && <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-black text-sky-400">{tx("سفارشی", "Custom")}</span>}
                </button>
              );
            })}
          </div>

          {selected && macros && (
            <div className="nutri-pop rounded-2xl border border-[#e9e400]/30 bg-[#e9e400]/[0.06] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-[14px]">{lang === "fa" ? selected.fa : selected.en}</b>
                <MacroInline kcal={macros.kcal} p={macros.p} c={macros.c} f={macros.f} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[130px_minmax(0,1fr)]">
                <div>
                  <Label>{tx("مقدار", "Amount")}</Label>
                  <NumInput value={amount} onChange={setAmount} step={unit === "g" || unit === "ml" ? 5 : 0.5} min={0} max={5000} ariaLabel={tx("مقدار", "Amount")} />
                </div>
                <div>
                  <Label>{tx("واحد اندازه‌گیری", "Unit")}</Label>
                  <select value={unit} onChange={(event) => changeUnit(event.target.value as UnitKey)} className={fieldCls}>
                    {selected.units.map((item) => (
                      <option key={item.key} value={item.key}>{unitOptionLabel(selected, item.key, lang)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {unit !== "g" && unit !== "ml" && (
                <p className="tnum mt-2 text-[11px] text-[var(--color-mute)]">
                  {tx("معادل", "Equals")} {nf(grams, 1)} {gUnit(lang)}
                </p>
              )}
              {equivalentTo && equivalentTo.kcal > 0 && (
                <p className="mt-1 text-[11px] text-[#e9e400]">
                  {tx("مقدار پیشنهادی بر اساس کالری برابر با غذای اصلی محاسبه شده است.", "The suggested amount matches the calories of the original food.")}
                </p>
              )}
              {allowNote && (
                <div className="mt-3">
                  <Label>{tx("توضیح برای شاگرد (اختیاری)", "Note for the athlete (optional)")}</Label>
                  <input value={note} onChange={(event) => setNote(event.target.value)} className={fieldCls} placeholder={tx("مثلاً بدون روغن، گریل‌شده", "e.g. no oil, grilled")} />
                </div>
              )}
              <button
                type="button"
                disabled={amount <= 0}
                onClick={() => onPick({ food: selected, amount, unit, note: note.trim() })}
                className="press mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#f2ff00] to-[#d9d200] text-[13px] font-black text-black disabled:opacity-50"
              >
                {confirmLabel || tx("افزودن به وعده", "Add to meal")}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const UNIT_CHOICES = ["گرم", "عدد", "برش", "لیوان", "قاشق غذاخوری", "پرس", "کاسه", "اسکوپ"];

export function CustomFoodForm({ coachId, initial, onSaved, onCancel }: { coachId: string; initial?: FoodEntry; onSaved: (entry: FoodEntry) => void; onCancel: () => void }) {
  const { saveFood } = useStore();
  const { tx } = useTx();
  const parsed = initial ? parseServing(initial.serving) : { grams: 100, label: "گرم" };
  const [name, setName] = useState(initial?.name ?? "");
  const [label, setLabel] = useState(parsed.label);
  const [custom, setCustom] = useState(!UNIT_CHOICES.includes(parsed.label));
  const [grams, setGrams] = useState(parsed.grams);
  const [kcal, setKcal] = useState(initial?.kcal ?? 0);
  const [p, setP] = useState(initial?.p ?? 0);
  const [c, setC] = useState(initial?.c ?? 0);
  const [f, setF] = useState(initial?.f ?? 0);
  const [fiber, setFiber] = useState(initial?.fiber ?? 0);
  const [error, setError] = useState("");
  const perGram = label.trim() === "گرم";
  const servingGrams = perGram ? 100 : grams;
  const estimated = Math.round(p * 4 + c * 4 + f * 9);

  const submit = () => {
    if (!name.trim()) return setError(tx("نام غذا را وارد کنید.", "Enter the food name."));
    if (!perGram && (!grams || grams <= 0)) return setError(tx("وزن هر واحد را به گرم وارد کنید.", "Enter the weight of one unit in grams."));
    const entry: FoodEntry = {
      id: initial?.id ?? uid("food"),
      coachId,
      name: name.trim(),
      serving: customServing(label, servingGrams),
      kcal: kcal || estimated,
      p, c, f, fiber,
    };
    saveFood(entry);
    onSaved(entry);
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={onCancel} className="press flex items-center gap-1 text-[12px] font-bold text-[var(--color-mute)]">
        <ChevronLeft size={15} className="ltr:rotate-180" /> {tx("بازگشت به فهرست غذاها", "Back to foods")}
      </button>
      <div>
        <Label>{tx("نام غذا", "Food name")}</Label>
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldCls} placeholder={tx("مثلاً نان پروتئینی", "e.g. Protein bread")} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>{tx("واحد مرجع", "Reference unit")}</Label>
          <select
            value={custom ? "__custom" : label}
            onChange={(event) => {
              if (event.target.value === "__custom") {
                setCustom(true);
                setLabel("");
              } else {
                setCustom(false);
                setLabel(event.target.value);
              }
            }}
            className={fieldCls}
          >
            {UNIT_CHOICES.map((item) => <option key={item} value={item}>{item === "گرم" ? tx("100 گرم", "100 g") : item}</option>)}
            <option value="__custom">{tx("واحد دلخواه…", "Custom unit…")}</option>
          </select>
          {custom && <input value={label} onChange={(event) => setLabel(event.target.value)} className={`${fieldCls} mt-2`} placeholder={tx("نام واحد؛ مثلاً بسته", "Unit name, e.g. pack")} />}
        </div>
        {!perGram && (
          <div>
            <Label>{tx("وزن هر واحد (گرم)", "Weight per unit (g)")}</Label>
            <NumInput value={grams} onChange={setGrams} min={0} max={3000} ariaLabel={tx("وزن هر واحد", "Weight per unit")} />
          </div>
        )}
      </div>
      <p className="text-[11.5px] leading-6 text-[var(--color-mute)]">
        {perGram
          ? tx("ارزش غذایی را برای 100 گرم وارد کنید.", "Enter the nutrition values for 100 g.")
          : tx("ارزش غذایی را برای یک واحد وارد کنید.", "Enter the nutrition values for one unit.")}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div><Label>{tx("کالری", "Calories")}</Label><NumInput value={kcal} onChange={setKcal} max={5000} ariaLabel={tx("کالری", "Calories")} /></div>
        <div><Label>{tx("پروتئین (گرم)", "Protein (g)")}</Label><NumInput value={p} onChange={setP} step={0.5} max={500} ariaLabel={tx("پروتئین", "Protein")} /></div>
        <div><Label>{tx("کربوهیدرات (گرم)", "Carbs (g)")}</Label><NumInput value={c} onChange={setC} step={0.5} max={500} ariaLabel={tx("کربوهیدرات", "Carbs")} /></div>
        <div><Label>{tx("چربی (گرم)", "Fat (g)")}</Label><NumInput value={f} onChange={setF} step={0.5} max={500} ariaLabel={tx("چربی", "Fat")} /></div>
        <div><Label>{tx("فیبر (گرم)", "Fiber (g)")}</Label><NumInput value={fiber} onChange={setFiber} step={0.5} max={200} ariaLabel={tx("فیبر", "Fiber")} /></div>
      </div>
      {estimated > 0 && Math.abs(estimated - kcal) > 15 && (
        <button type="button" onClick={() => setKcal(estimated)} className="text-[11.5px] font-bold text-[#e9e400]">
          {tx(`کالری محاسبه‌شده از درشت‌مغذی‌ها: ${estimated} — اعمال شود`, `Calories from macros: ${estimated} — apply`)}
        </button>
      )}
      {error && <p className="text-[12px] font-bold text-red-400">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="press h-11 rounded-full border border-[var(--color-line)] px-5 text-[12.5px] font-extrabold">{tx("انصراف", "Cancel")}</button>
        <button type="button" onClick={submit} className="press h-11 rounded-full bg-[#e9e400] px-6 text-[12.5px] font-black text-black">
          {initial ? tx("ذخیره تغییرات", "Save changes") : tx("ذخیره غذا", "Save food")}
        </button>
      </div>
    </div>
  );
}
