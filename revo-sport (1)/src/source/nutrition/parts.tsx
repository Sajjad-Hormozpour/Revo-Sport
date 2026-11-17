import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clock, MoreHorizontal } from "lucide-react";
import { localizeDigits } from "../../i18n";
import { useLang } from "../lib/i18n";
import { formatJalaliDate } from "../lib/time";
import { Modal } from "../components/ui";
import {
  WEEKDAY_FA, WEEKDAY_EN, dayTargets, dayTotals, deviationTone, formatPortion, itemName, localName, nf, planTargets, shoppingList, sumMacros,
  type DayKind, type NutriDay, type ProPlan,
} from "./engine";
import "./nutrition.css";

/* ---------------- language ---------------- */

export function useTx() {
  const { lang } = useLang();
  const tx = useCallback((fa: string, en: string) => (lang === "fa" ? fa : en), [lang]);
  return { lang, tx, dir: (lang === "fa" ? "rtl" : "ltr") as "rtl" | "ltr" };
}

export const MACRO_COLORS = { kcal: "#e9e400", p: "#38bdf8", c: "#f59e0b", f: "#fb7185", fiber: "#22c55e" } as const;

export function macroLabel(key: "kcal" | "p" | "c" | "f" | "fiber", lang: "fa" | "en"): string {
  const map = {
    kcal: ["کالری", "Calories"],
    p: ["پروتئین", "Protein"],
    c: ["کربوهیدرات", "Carbs"],
    f: ["چربی", "Fat"],
    fiber: ["فیبر", "Fiber"],
  } as const;
  return map[key][lang === "fa" ? 0 : 1];
}

export function kcalUnit(lang: "fa" | "en") {
  return lang === "fa" ? "کالری" : "kcal";
}

export function gUnit(lang: "fa" | "en") {
  return lang === "fa" ? "گرم" : "g";
}

export function dayKindLabel(kind: DayKind, lang: "fa" | "en") {
  if (kind === "training") return lang === "fa" ? "روز تمرین" : "Training day";
  if (kind === "rest") return lang === "fa" ? "روز استراحت" : "Rest day";
  return lang === "fa" ? "روز عمومی" : "General day";
}

export function weekdaysLabel(day: NutriDay, lang: "fa" | "en") {
  if (day.weekdays.length === 7) return lang === "fa" ? "همه روزهای هفته" : "Every day";
  if (!day.weekdays.length) return lang === "fa" ? "بدون روز تخصیص‌یافته" : "No weekdays assigned";
  const names = lang === "fa" ? WEEKDAY_FA : WEEKDAY_EN;
  return [...day.weekdays].sort((a, b) => a - b).map((index) => names[index]).join(lang === "fa" ? "، " : ", ");
}

/** Plan mode flags deviations both ways; intake mode only warns when the athlete goes over target. */
function toneFor(value: number, target: number, mode: "plan" | "intake") {
  if (mode === "plan") return deviationTone(value, target);
  if (!target) return "mute" as const;
  if (value > target * 1.1) return "danger" as const;
  if (value > target * 1.05) return "warn" as const;
  if (value >= target * 0.95) return "ok" as const;
  return "mute" as const;
}

const TONE_TEXT = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-red-400",
  mute: "text-[var(--color-ink)]",
} as const;

/* ---------------- primitives ---------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4 ${className}`}>{children}</section>;
}

export function SectionHead({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-[14px] font-black">
          {icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e9e400]/12 text-[#e9e400]">{icon}</span>}
          {title}
        </h3>
        {hint && <p className="mt-1 text-[11.5px] leading-6 text-[var(--color-mute)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Chip({ on, onClick, children, disabled }: { on?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`press inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${
        on
          ? "border-[#e9e400]/50 bg-[#e9e400]/15 text-[#e9e400]"
          : "border-[var(--color-line)] text-[var(--color-mute)] hover:border-[#e9e400]/30 hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

export function Seg<T extends string>({ items, value, onChange }: { items: { key: T; label: string; icon?: ReactNode; hidden?: boolean }[]; value: T; onChange: (key: T) => void }) {
  return (
    <div className="noscroll flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-1">
      {items.filter((item) => !item.hidden).map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className={`press flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[12px] font-black transition ${
              active ? "bg-[#e9e400] text-black shadow-[0_8px_20px_-10px_rgba(233,228,0,0.8)]" : "text-[var(--color-mute)] hover:bg-white/5 hover:text-[var(--color-ink)]"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export const fieldCls =
  "h-10 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3 text-[13px] font-semibold text-[var(--color-ink)] outline-none transition focus:border-[#e9e400]/50";

export const areaCls =
  "w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3 text-[13px] leading-7 text-[var(--color-ink)] outline-none transition focus:border-[#e9e400]/50";

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[11.5px] font-bold text-[var(--color-mute)]">{children}</span>;
}

/** Numeric input that accepts Persian/Arabic digits and keeps Latin digits on screen. */
export function NumInput({
  value, onChange, step = 1, min = 0, max = 100000, ariaLabel, suffix, className = "", compact,
}: {
  value: number; onChange: (value: number) => void; step?: number; min?: number; max?: number;
  ariaLabel: string; suffix?: string; className?: string; compact?: boolean;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  useEffect(() => {
    if (Number(text) !== value) setText(Number.isFinite(value) ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <span
      className={`flex items-center overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] transition focus-within:border-[#e9e400]/50 ${
        compact ? "h-9" : "h-10"
      } ${className}`}
    >
      <input
        inputMode="decimal"
        dir="ltr"
        aria-label={ariaLabel}
        value={text}
        onChange={(event) => {
          const raw = localizeDigits(event.target.value).replace(/[٫,]/g, ".").replace(/[^\d.]/g, "");
          setText(raw);
          const n = Number(raw);
          if (raw !== "" && raw !== "." && Number.isFinite(n)) onChange(clamp(n));
        }}
        onBlur={() => {
          const n = Number(text);
          if (text === "" || !Number.isFinite(n)) setText(String(value));
          else if (clamp(n) !== n) setText(String(clamp(n)));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const next = clamp(Math.round(((Number(text) || 0) + (event.key === "ArrowUp" ? step : -step)) * 100) / 100);
            setText(String(next));
            onChange(next);
          }
        }}
        className={`tnum h-full w-full min-w-0 flex-1 bg-transparent px-2 text-center font-bold text-[var(--color-ink)] outline-none ${compact ? "text-[12.5px]" : "text-[13px]"}`}
      />
      {suffix && <span className="shrink-0 whitespace-nowrap pe-2.5 ps-1 text-[10.5px] font-bold text-[var(--color-mute)]">{suffix}</span>}
    </span>
  );
}

/** 24-hour time field (HH:MM) that accepts Persian digits — avoids AM/PM in the Persian UI. */
export function TimeField({ value, onChange, ariaLabel, className = "" }: { value: string; onChange: (value: string) => void; ariaLabel: string; className?: string }) {
  const [text, setText] = useState(value || "");
  useEffect(() => {
    setText(value || "");
  }, [value]);
  const commit = (raw: string) => {
    const digits = localizeDigits(raw).replace(/\D/g, "").slice(0, 4);
    if (!digits) {
      setText("");
      onChange("");
      return;
    }
    const hours = Math.min(23, Number(digits.length <= 2 ? digits : digits.slice(0, digits.length - 2)));
    const minutes = digits.length <= 2 ? 0 : Math.min(59, Number(digits.slice(-2)));
    const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    setText(formatted);
    if (formatted !== value) onChange(formatted);
  };
  return (
    <span className={`flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 transition focus-within:border-[#e9e400]/50 ${className}`}>
      <Clock size={13} className="shrink-0 text-[var(--color-mute)]" />
      <input
        value={text}
        dir="ltr"
        inputMode="numeric"
        maxLength={5}
        placeholder="08:00"
        aria-label={ariaLabel}
        onChange={(event) => {
          const raw = localizeDigits(event.target.value).replace(/[^\d:]/g, "");
          setText(raw);
          const match = raw.match(/^(\d{2}):(\d{2})$/);
          if (match && Number(match[1]) < 24 && Number(match[2]) < 60) onChange(raw);
        }}
        onBlur={() => commit(text)}
        className="tnum h-full w-full min-w-[46px] bg-transparent text-center text-[12.5px] font-bold text-[var(--color-ink)] outline-none placeholder:text-[var(--color-mute)]"
      />
    </span>
  );
}

/* ---------------- macro visuals ---------------- */

export function MacroBar({ label, value, target, color, unit, mode = "plan" }: { label: string; value: number; target: number; color: string; unit: string; mode?: "plan" | "intake" }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const tone = toneFor(value, target, mode);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="flex items-center gap-1.5 font-bold">
          <i className="h-2 w-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="tnum text-[var(--color-mute)]">
          <b className={`text-[12.5px] ${TONE_TEXT[tone]}`}>{nf(value)}</b> / {nf(target)} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function KcalRing({ value, target, size = 116, mode = "plan" }: { value: number; target: number; size?: number; mode?: "plan" | "intake" }) {
  const { tx, lang } = useTx();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = target ? Math.min(1, value / target) : 0;
  const tone = toneFor(value, target, mode);
  const color = tone === "danger" ? "#ef4444" : tone === "warn" ? "#f59e0b" : tone === "ok" && mode === "intake" ? "#22c55e" : "#e9e400";
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-[var(--color-line)]" />
        {pct > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${circumference * pct} ${circumference}`} style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        )}
      </svg>
      <div className="absolute px-2 text-center">
        <b className="tnum block text-[19px] font-black leading-6">{nf(value)}</b>
        <span className="tnum block text-[10px] font-bold text-[var(--color-mute)]">
          {tx("از", "of")} {nf(target)} {kcalUnit(lang)}
        </span>
      </div>
    </div>
  );
}

/** Calorie share of protein, carbs and fat as a stacked bar. */
export function MacroSplit({ p, c, f }: { p: number; c: number; f: number }) {
  const { lang } = useTx();
  const kp = p * 4;
  const kc = c * 4;
  const kf = f * 9;
  const total = kp + kc + kf || 1;
  const parts = [
    { key: "p" as const, kcal: kp, color: MACRO_COLORS.p },
    { key: "c" as const, kcal: kc, color: MACRO_COLORS.c },
    { key: "f" as const, kcal: kf, color: MACRO_COLORS.f },
  ];
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--color-line)]">
        {parts.map((part) => (
          <span key={part.key} className="h-full transition-[width] duration-500" style={{ width: `${(part.kcal / total) * 100}%`, background: part.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-mute)]">
        {parts.map((part) => (
          <span key={part.key} className="tnum flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: part.color }} />
            {macroLabel(part.key, lang)} {nf((part.kcal / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function MacroInline({ kcal, p, c, f, className = "" }: { kcal: number; p: number; c: number; f: number; className?: string }) {
  const { lang } = useTx();
  return (
    <span className={`tnum inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] font-bold text-[var(--color-mute)] ${className}`}>
      <span className="text-[var(--color-ink)]">{nf(kcal)} {kcalUnit(lang)}</span>
      <span style={{ color: MACRO_COLORS.p }}>{lang === "fa" ? "پ" : "P"} {nf(p, 1)}</span>
      <span style={{ color: MACRO_COLORS.c }}>{lang === "fa" ? "ک" : "C"} {nf(c, 1)}</span>
      <span style={{ color: MACRO_COLORS.f }}>{lang === "fa" ? "چ" : "F"} {nf(f, 1)}</span>
    </span>
  );
}

/* ---------------- confirm dialog ---------------- */

type ConfirmOptions = { title: string; body: string; confirm: string; cancel?: string; danger?: boolean };

export function useConfirm() {
  const { tx } = useTx();
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...options, resolve })), []);
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  const confirmNode = state ? (
    <Modal open onClose={() => close(false)} title={state.title}>
      <p className="text-[13px] leading-7 text-[var(--color-mute)]">{state.body}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => close(false)} className="press h-11 rounded-full border border-[var(--color-line)] px-5 text-[12.5px] font-extrabold">
          {state.cancel || tx("انصراف", "Cancel")}
        </button>
        <button
          type="button"
          onClick={() => close(true)}
          className={`press h-11 rounded-full px-5 text-[12.5px] font-black ${state.danger ? "bg-red-500 text-white" : "bg-[#e9e400] text-black"}`}
        >
          {state.confirm}
        </button>
      </div>
    </Modal>
  ) : null;
  return { ask, confirmNode };
}

/* ---------------- overflow menu ---------------- */

export type MenuItem = { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean };

export function MoreMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={label}
        className="press flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3.5 text-[12px] font-extrabold hover:border-[#e9e400]/40"
      >
        <MoreHorizontal size={16} />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div
          className="screen-in glass-strong absolute top-[calc(100%+8px)] z-[60] w-60 overflow-hidden rounded-2xl p-1.5"
          style={{ insetInlineEnd: 0 }}
          role="menu"
        >
          {items.filter((item) => !item.hidden).map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`press flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-[12.5px] font-bold transition hover:bg-white/5 ${
                item.danger ? "text-red-400" : ""
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- printable plan document ---------------- */

export function PlanSheet({ plan, studentName, coachName, showShopping = true }: { plan: ProPlan; studentName?: string; coachName?: string; showShopping?: boolean }) {
  const { tx, lang, dir } = useTx();
  const targets = planTargets(plan);
  const shopping = showShopping ? shoppingList(plan) : [];
  const guidelines = plan.guidelines.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <article className="nutri-sheet" dir={dir}>
      <header className="ns-head">
        <div className="min-w-0">
          <span className="ns-brand" dir="ltr">Revo sport</span>
          <h2>{localName(plan.name, lang)}</h2>
          <p>
            {[studentName && `${tx("شاگرد", "Athlete")}: ${studentName}`, coachName && `${tx("مربی", "Coach")}: ${coachName}`, `${tx("نسخه", "Version")} ${plan.version || 1}`]
              .filter(Boolean)
              .join("  •  ")}
          </p>
        </div>
        <dl className="ns-dates">
          <div><dt>{tx("شروع", "Start")}</dt><dd>{formatJalaliDate(plan.startDate)}</dd></div>
          <div><dt>{tx("پایان", "End")}</dt><dd>{formatJalaliDate(plan.endDate)}</dd></div>
          <div><dt>{tx("بازبینی", "Review")}</dt><dd>{formatJalaliDate(plan.reviewDate)}</dd></div>
        </dl>
      </header>

      <div className="ns-targets">
        {[
          { label: tx("کالری روزانه", "Daily calories"), value: `${nf(targets.kcal)} ${kcalUnit(lang)}` },
          { label: macroLabel("p", lang), value: `${nf(targets.p)} ${gUnit(lang)}` },
          { label: macroLabel("c", lang), value: `${nf(targets.c)} ${gUnit(lang)}` },
          { label: macroLabel("f", lang), value: `${nf(targets.f)} ${gUnit(lang)}` },
          { label: macroLabel("fiber", lang), value: `${nf(plan.targetFiber || 0)} ${gUnit(lang)}` },
          { label: tx("آب", "Water"), value: `${nf((plan.waterGoal || 0) / 1000, 1)} ${tx("لیتر", "L")}` },
        ].map((item) => (
          <div key={item.label}><span>{item.label}</span><b>{item.value}</b></div>
        ))}
      </div>

      {plan.coachNote.trim() && <p className="ns-note">{plan.coachNote}</p>}

      {plan.days.map((day) => {
        const totals = dayTotals(plan, day);
        const dt = dayTargets(plan, day);
        const meals = plan.meals.filter((slot) => (day.items[slot.id] ?? []).length > 0);
        return (
          <section className="ns-day" key={day.id}>
            <div className="ns-day-head">
              <div>
                <h3>{localName(day.name, lang)}</h3>
                <span>{dayKindLabel(day.kind, lang)} • {weekdaysLabel(day, lang)}</span>
              </div>
              <span className="ns-day-total">
                {nf(totals.kcal)} / {nf(dt.kcal)} {kcalUnit(lang)}  •  {macroLabel("p", lang)} {nf(totals.p)}  •  {macroLabel("c", lang)} {nf(totals.c)}  •  {macroLabel("f", lang)} {nf(totals.f)}
              </span>
            </div>
            {!meals.length && <p className="ns-empty">{tx("برای این روز هنوز غذایی ثبت نشده است.", "No foods have been added for this day yet.")}</p>}
            {meals.map((slot) => {
              const items = day.items[slot.id] ?? [];
              const sum = sumMacros(items);
              return (
                <div className="ns-meal" key={slot.id}>
                  <div className="ns-meal-head">
                    <b>{localName(slot.slot, lang)}</b>
                    {slot.time && <time dir="ltr">{slot.time}</time>}
                    <span>{nf(sum.kcal)} {kcalUnit(lang)}</span>
                  </div>
                  <ul>
                    {items.map((item) => (
                      <li key={item.uid}>
                        <div className="ns-row">
                          <span className="ns-food">{itemName(item, lang)}</span>
                          <span className="ns-portion">{formatPortion(item, lang)}</span>
                          <span className="ns-kcal">{nf(item.macros.kcal)}</span>
                        </div>
                        {item.note && <small className="ns-sub">{item.note}</small>}
                        {!!item.alternatives?.length && (
                          <small className="ns-sub ns-alt">
                            {tx("جایگزین", "Swap")}: {item.alternatives.map((alt) => `${itemName(alt, lang)} (${formatPortion(alt, lang)})`).join(tx(" یا ", " or "))}
                          </small>
                        )}
                      </li>
                    ))}
                  </ul>
                  {slot.note && <p className="ns-meal-note">{slot.note}</p>}
                </div>
              );
            })}
          </section>
        );
      })}

      {!!plan.supplements.length && (
        <section className="ns-block">
          <h3>{tx("مکمل‌ها", "Supplements")}</h3>
          <table>
            <thead><tr><th>{tx("مکمل", "Supplement")}</th><th>{tx("مقدار", "Dose")}</th><th>{tx("زمان مصرف", "Timing")}</th><th>{tx("توضیحات", "Notes")}</th></tr></thead>
            <tbody>
              {plan.supplements.map((item) => (
                <tr key={item.id}><td>{item.name}</td><td>{item.dose}</td><td>{item.timing}</td><td>{item.note || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!!guidelines.length && (
        <section className="ns-block">
          <h3>{tx("توصیه‌های تغذیه‌ای", "Nutrition guidelines")}</h3>
          <ul className="ns-bullets">{guidelines.map((line, index) => <li key={index}>{line}</li>)}</ul>
        </section>
      )}

      {!!shopping.length && (
        <section className="ns-block">
          <h3>{tx("فهرست خرید هفتگی", "Weekly shopping list")}</h3>
          <ul className="ns-shopping">
            {shopping.map((item) => (
              <li key={item.name}>
                <span>{lang === "fa" ? item.name : item.nameEn || item.name}</span>
                <b>{item.grams ? (item.grams >= 1000 ? `${nf(item.grams / 1000, 2)} ${tx("کیلوگرم", "kg")}` : `${nf(item.grams)} ${gUnit(lang)}`) : item.portion}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="ns-foot">
        {tx("تهیه‌شده با", "Prepared with")} <span dir="ltr">Revo sport</span> • {formatJalaliDate(plan.updatedAt || plan.createdAt)}
      </footer>
    </article>
  );
}

/** Renders a document into a print-only layer and opens the browser print dialog (Save as PDF). */
export function PrintPortal({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  const { dir, lang } = useTx();
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("nutri-printing");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      html.classList.remove("nutri-printing");
      onDone();
    };
    window.addEventListener("afterprint", finish);
    const timer = window.setTimeout(() => {
      window.print();
      window.setTimeout(finish, 600);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
      html.classList.remove("nutri-printing");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <div className="nutri-print-host" dir={dir} lang={lang}>
      {children}
    </div>,
    document.body,
  );
}
