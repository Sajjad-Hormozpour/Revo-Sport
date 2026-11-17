import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Droplets, FileText, Lock, MessageCircle, Minus, Pill as PillIcon, Plus, Printer, Repeat, Salad, ShoppingCart } from "lucide-react";
import { useStore } from "../lib/store";
import { dayKey, formatJalaliDate, formatRelative } from "../lib/time";
import {
  currentRecord, dayTargets, dayTotals, filledSlots, formatPortion, itemName, localName, nf, normalizePlan, resolveDay, serviceState, shoppingList, sumMacros, zeroMacros,
} from "./engine";
import { Card, KcalRing, MACRO_COLORS, MacroBar, MacroInline, PlanSheet, PrintPortal, dayKindLabel, gUnit, macroLabel, useTx, weekdaysLabel } from "./parts";

export default function NutritionStudent({ stId, onToast, onChat }: { stId: string; onToast: (title: string, desc: string) => void; onChat: () => void }) {
  const { data, userById, toggleNutritionMeal, addWater } = useStore();
  const { tx, lang } = useTx();
  const state = serviceState(data, stId);
  const record = currentRecord(data, stId);
  const student = data.students.find((item) => item.id === stId);
  const coach = student?.coachId ? userById(student.coachId) : undefined;
  const plan = useMemo(() => (record && state === "active" ? normalizePlan(record, data) : null), [record, state, data]);
  const [dayId, setDayId] = useState<string | null>(null);
  const [openAlts, setOpenAlts] = useState<Record<string, boolean>>({});
  const [printing, setPrinting] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);

  if (state === "off" || !record) {
    return (
      <div className="screen-in pt-2">
        <Card className="py-10 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 text-[var(--color-mute)]"><Lock size={28} /></span>
          <b className="mt-4 block text-[16px] font-black">{tx("بخش تغذیه برای شما فعال نیست", "Nutrition isn't enabled for you")}</b>
          <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-7 text-[var(--color-mute)]">
            {tx("اگر به برنامه غذایی اختصاصی نیاز دارید، با مربی خود هماهنگ کنید تا این بخش برایتان فعال شود.", "If you need a personal meal plan, ask your coach to enable this section for you.")}
          </p>
          <button type="button" onClick={onChat} className="press mx-auto mt-5 flex h-11 items-center gap-1.5 rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black">
            <MessageCircle size={15} /> {tx("پیام به مربی", "Message your coach")}
          </button>
        </Card>
      </div>
    );
  }

  if (state === "pending" || !plan) {
    return (
      <div className="screen-in pt-2">
        <Card className="py-10 text-center">
          <span className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl bg-[#e9e400]/12 text-[#e9e400]"><Salad size={30} /></span>
          <b className="mt-4 block text-[16px] font-black">{tx("برنامه غذایی شما در حال آماده‌سازی است", "Your meal plan is being prepared")}</b>
          <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-7 text-[var(--color-mute)]">
            {tx(
              `${coach?.name ?? "مربی شما"} در حال طراحی برنامه غذایی اختصاصی شماست. پس از انتشار، برنامه همین‌جا نمایش داده می‌شود و اعلان آن را دریافت خواهید کرد.`,
              `${coach?.name ?? "Your coach"} is designing your personal meal plan. Once published, it will appear here and you'll get a notification.`,
            )}
          </p>
          <button type="button" onClick={onChat} className="press mx-auto mt-5 flex h-11 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-5 text-[12.5px] font-extrabold">
            <MessageCircle size={15} /> {tx("پیام به مربی", "Message your coach")}
          </button>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const todayKey = dayKey(now);
  const todayDay = resolveDay(plan, now);
  const day = plan.days.find((item) => item.id === dayId) ?? todayDay;
  const isToday = day.id === todayDay.id;
  const targets = dayTargets(plan, day);
  const planned = dayTotals(plan, day);
  const slots = filledSlots(plan, day);
  const logged = new Set(
    data.nutritionLogs.filter((log) => log.planId === plan.id && log.studentId === stId && log.date === todayKey).map((log) => log.slotId),
  );
  const todaySlots = filledSlots(plan, todayDay);
  const doneCount = todaySlots.filter((slot) => logged.has(slot.id)).length;
  const consumed = todaySlots.filter((slot) => logged.has(slot.id)).reduce((total, slot) => {
    const sum = sumMacros(todayDay.items[slot.id]);
    return { kcal: total.kcal + sum.kcal, p: total.p + sum.p, c: total.c + sum.c, f: total.f + sum.f, fiber: total.fiber + sum.fiber };
  }, zeroMacros());
  const shown = isToday ? consumed : planned;
  const water = data.water[stId];
  const waterMl = water?.date === todayKey ? water.ml : 0;
  const waterGoal = plan.waterGoal || water?.goal || 2500;
  const glasses = Math.min(16, Math.max(4, Math.round(waterGoal / 250)));
  const guidelines = plan.guidelines.split("\n").map((line) => line.trim()).filter(Boolean);
  const shopping = shoppingOpen ? shoppingList(plan) : [];

  const toggleMeal = (slotId: string, name: string) => {
    const wasDone = logged.has(slotId);
    toggleNutritionMeal(plan.id, slotId, todayKey);
    if (!wasDone) onToast(tx("نوش جان!", "Enjoy your meal!"), tx(`وعده «${name}» ثبت شد.`, `“${name}” has been logged.`));
  };

  return (
    <div className="screen-in space-y-3 pb-2 pt-1">
      <Card className="relative overflow-hidden">
        <span className="pointer-events-none absolute -top-16 h-40 w-40 rounded-full bg-[#e9e400]/10 blur-3xl" style={{ insetInlineEnd: -40 }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-black text-[#e9e400]">{tx("برنامه غذایی اختصاصی", "Personal meal plan")}</span>
            <h2 className="mt-0.5 text-[17px] font-black leading-7">{localName(plan.name, lang)}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--color-mute)]">
              {coach && <span className="flex items-center gap-1.5"><img src={coach.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />{tx(`طراحی‌شده توسط ${coach.name}`, `Designed by ${coach.name}`)}</span>}
              <span>{tx("به‌روزرسانی", "Updated")} {formatRelative(plan.updatedAt || plan.createdAt)}</span>
            </p>
          </div>
          <button type="button" onClick={() => setPrinting(true)} aria-label={tx("چاپ یا ذخیره PDF", "Print or save as PDF")} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)]">
            <Printer size={16} />
          </button>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-1.5 text-[10.5px] font-bold">
          <span className="tnum flex items-center gap-1 rounded-full bg-[var(--color-bg)] px-2.5 py-1"><CalendarDays size={12} /> {formatJalaliDate(plan.startDate)} — {formatJalaliDate(plan.endDate)}</span>
          <span className="tnum rounded-full bg-[var(--color-bg)] px-2.5 py-1">{tx("بازبینی", "Review")}: {formatJalaliDate(plan.reviewDate)}</span>
        </div>
        {plan.coachNote.trim() && (
          <p className="relative mt-3 whitespace-pre-line rounded-xl border-s-[3px] border-[#e9e400] bg-[var(--color-bg)] px-3 py-2.5 text-[12px] leading-7">{plan.coachNote}</p>
        )}
      </Card>

      {plan.days.length > 1 && (
        <div className="noscroll -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {plan.days.map((item) => {
            const active = item.id === day.id;
            const today = item.id === todayDay.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDayId(item.id)}
                className={`press flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-[12px] font-black transition ${
                  active ? "border-transparent bg-[#e9e400] text-black" : "border-[var(--color-line)] bg-[var(--color-card)]"
                }`}
              >
                {localName(item.name, lang)}
                {today && <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] ${active ? "bg-black/15" : "bg-[#e9e400]/15 text-[#e9e400]"}`}>{tx("امروز", "Today")}</span>}
              </button>
            );
          })}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-4">
          <KcalRing value={shown.kcal} target={targets.kcal} size={108} mode={isToday ? "intake" : "plan"} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="text-[11px] font-bold text-[var(--color-mute)]">
              {isToday ? tx("دریافتی امروز بر اساس وعده‌های ثبت‌شده", "Today's intake from logged meals") : tx(`مجموع برنامه «${localName(day.name, lang)}»`, `Total for “${localName(day.name, lang)}”`)}
            </p>
            <MacroBar label={macroLabel("p", lang)} value={shown.p} target={targets.p} color={MACRO_COLORS.p} unit={gUnit(lang)} mode={isToday ? "intake" : "plan"} />
            <MacroBar label={macroLabel("c", lang)} value={shown.c} target={targets.c} color={MACRO_COLORS.c} unit={gUnit(lang)} mode={isToday ? "intake" : "plan"} />
            <MacroBar label={macroLabel("f", lang)} value={shown.f} target={targets.f} color={MACRO_COLORS.f} unit={gUnit(lang)} mode={isToday ? "intake" : "plan"} />
          </div>
        </div>
        <p className="mt-3 text-[10.5px] text-[var(--color-mute)]">
          {dayKindLabel(day.kind, lang)} • {weekdaysLabel(day, lang)}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="!p-3.5">
          <span className="text-[11px] font-bold text-[var(--color-mute)]">{tx("وعده‌های امروز", "Today's meals")}</span>
          <b className="tnum mt-1 block text-[20px] font-black">{doneCount}<span className="text-[13px] text-[var(--color-mute)]"> / {todaySlots.length}</span></b>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
            <div className="h-full rounded-full bg-[#e9e400] transition-[width] duration-500" style={{ width: `${todaySlots.length ? (doneCount / todaySlots.length) * 100 : 0}%` }} />
          </div>
        </Card>
        <Card className="!p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--color-mute)]">{tx("آب امروز", "Water today")}</span>
            <Droplets size={15} className="text-sky-400" />
          </div>
          <b className="tnum mt-1 block text-[20px] font-black">{nf(waterMl / 1000, 2)}<span className="text-[12px] text-[var(--color-mute)]"> / {nf(waterGoal / 1000, 1)} {tx("لیتر", "L")}</span></b>
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={() => addWater(stId, -250)} disabled={!waterMl} aria-label={tx("کاهش 250 میلی‌لیتر", "Remove 250 ml")} className="press flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-line)] disabled:opacity-40"><Minus size={14} /></button>
            <button type="button" onClick={() => addWater(stId, 250)} className="press flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-sky-500/15 text-[11.5px] font-black text-sky-400"><Plus size={13} /> {tx("یک لیوان", "1 glass")}</button>
          </div>
        </Card>
      </div>
      <div className="flex flex-wrap justify-center gap-1" aria-hidden="true">
        {Array.from({ length: glasses }, (_, index) => (
          <span key={index} className={`h-2 w-5 rounded-full transition ${index < Math.round(waterMl / 250) ? "bg-sky-400" : "bg-[var(--color-line)]"}`} />
        ))}
      </div>

      {!isToday && (
        <p className="rounded-xl bg-[var(--color-card)] px-3 py-2.5 text-center text-[11.5px] text-[var(--color-mute)]">
          {tx("برای ثبت وعده‌ها، برنامه «امروز» را انتخاب کنید.", "Select today's plan to log your meals.")}
        </p>
      )}

      {!slots.length && (
        <Card className="py-8 text-center text-[12.5px] text-[var(--color-mute)]">{tx("برای این روز وعده‌ای تعیین نشده است.", "No meals are set for this day.")}</Card>
      )}

      {slots.map((slot) => {
        const items = day.items[slot.id] ?? [];
        const sum = sumMacros(items);
        const done = isToday && logged.has(slot.id);
        return (
          <Card key={slot.id} className={`!p-3.5 transition ${done ? "ring-1 ring-emerald-500/40" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <b className="text-[14px] font-black">{localName(slot.slot, lang)}</b>
                  {slot.time && <span className="tnum rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--color-mute)]" dir="ltr">{slot.time}</span>}
                </div>
                <MacroInline kcal={sum.kcal} p={sum.p} c={sum.c} f={sum.f} className="mt-0.5" />
              </div>
              {isToday && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={done ? tx("لغو ثبت وعده", "Unlog meal") : tx("ثبت وعده", "Log meal")}
                  onClick={() => toggleMeal(slot.id, localName(slot.slot, lang))}
                  className="nutri-check press"
                >
                  {done && <Check size={16} strokeWidth={3} />}
                </button>
              )}
            </div>
            <ul className="mt-3 space-y-1.5">
              {items.map((item) => {
                const alts = item.alternatives ?? [];
                const open = !!openAlts[item.uid];
                return (
                  <li key={item.uid} className="rounded-xl bg-[var(--color-bg)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <b className="block text-[12.5px]">{itemName(item, lang)}</b>
                        <span className="tnum block text-[11px] text-[var(--color-mute)]">{formatPortion(item, lang)}</span>
                      </span>
                      <span className="tnum shrink-0 text-[11px] font-bold text-[var(--color-mute)]">{nf(item.macros.kcal)} {tx("کالری", "kcal")}</span>
                    </div>
                    {item.note && <p className="mt-1 text-[11px] text-[#e9e400]">{item.note}</p>}
                    {alts.length > 0 && (
                      <>
                        <button type="button" onClick={() => setOpenAlts((current) => ({ ...current, [item.uid]: !current[item.uid] }))} className="press mt-1.5 flex items-center gap-1 text-[11px] font-black text-[#e9e400]">
                          <Repeat size={12} /> {tx(`${alts.length} جایگزین مجاز`, `${alts.length} allowed swap${alts.length > 1 ? "s" : ""}`)}
                          <ChevronDown size={12} className={`transition ${open ? "rotate-180" : ""}`} />
                        </button>
                        {open && (
                          <ul className="nutri-pop mt-1.5 space-y-1 border-t border-dashed border-[var(--color-line)] pt-1.5">
                            {alts.map((alt, index) => (
                              <li key={`${alt.foodId}-${index}`} className="flex items-center justify-between gap-2 text-[11.5px]">
                                <span className="min-w-0 truncate">{itemName(alt, lang)} — <span className="text-[var(--color-mute)]">{formatPortion(alt, lang)}</span></span>
                                <span className="tnum shrink-0 text-[10.5px] text-[var(--color-mute)]">{nf(alt.macros.kcal)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {slot.note && <p className="mt-2 text-[11.5px] leading-6 text-[var(--color-mute)]">{slot.note}</p>}
          </Card>
        );
      })}

      {!!plan.supplements.length && (
        <Card>
          <b className="flex items-center gap-2 text-[14px] font-black"><PillIcon size={16} className="text-[#e9e400]" /> {tx("مکمل‌ها", "Supplements")}</b>
          <ul className="mt-3 space-y-1.5">
            {plan.supplements.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] px-3 py-2">
                <span className="min-w-0">
                  <b className="block text-[12.5px]">{item.name}</b>
                  <span className="block text-[11px] text-[var(--color-mute)]">{[item.dose, item.note].filter(Boolean).join(" • ")}</span>
                </span>
                {item.timing && <span className="shrink-0 rounded-full bg-[#e9e400]/12 px-2.5 py-1 text-[10.5px] font-black text-[#e9e400]">{item.timing}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!!guidelines.length && (
        <Card>
          <b className="flex items-center gap-2 text-[14px] font-black"><FileText size={16} className="text-[#e9e400]" /> {tx("توصیه‌های مربی", "Coach guidelines")}</b>
          <ul className="mt-3 space-y-2">
            {guidelines.map((line, index) => (
              <li key={index} className="flex gap-2 text-[12px] leading-7">
                <Check size={14} className="mt-1.5 shrink-0 text-emerald-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="!p-0">
        <button type="button" onClick={() => setShoppingOpen((value) => !value)} className="press flex w-full items-center justify-between gap-2 p-4 text-start">
          <b className="flex items-center gap-2 text-[14px] font-black"><ShoppingCart size={16} className="text-[#e9e400]" /> {tx("فهرست خرید هفتگی", "Weekly shopping list")}</b>
          <ChevronDown size={16} className={`text-[var(--color-mute)] transition ${shoppingOpen ? "rotate-180" : ""}`} />
        </button>
        {shoppingOpen && (
          <ul className="nutri-pop space-y-1 px-4 pb-4">
            {shopping.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-2 border-b border-dashed border-[var(--color-line)] py-1.5 text-[12px]">
                <span>{lang === "fa" ? item.name : item.nameEn || item.name}</span>
                <b className="tnum">{item.grams ? (item.grams >= 1000 ? `${nf(item.grams / 1000, 2)} ${tx("کیلوگرم", "kg")}` : `${nf(item.grams)} ${gUnit(lang)}`) : item.portion}</b>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {printing && (
        <PrintPortal onDone={() => setPrinting(false)}>
          <PlanSheet plan={plan} studentName={student ? userById(student.userId)?.name : undefined} coachName={coach?.name} />
        </PrintPortal>
      )}
    </div>
  );
}
