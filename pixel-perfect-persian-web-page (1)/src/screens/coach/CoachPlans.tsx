import { useMemo, useState } from "react";
import {
  Crown, Plus, Trash2, Save, RotateCcw, Eye, EyeOff, TrendingUp, Users, Receipt, Info, Check,
  ChevronUp, ChevronDown, Sparkles,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { PLANS, buildPlan, coachPlanList } from "../../data/plans";
import type { SubPlan } from "../../data/types";
import { fa, uid } from "../../lib/core";
import { liveSubStatus } from "../../lib/metrics";
import { BrandBtn, Empty, Field, GhostBtn, Pill, StatCard, Toggle, inputCls, money } from "../../components/ui";

type Row = SubPlan & { perksText: string; badge: "none" | "popular" | "best" };

function toRow(p: SubPlan): Row {
  return { ...p, perksText: p.perks.join("\n"), badge: p.popular ? "popular" : p.best ? "best" : "none" };
}

function fromRow(r: Row): SubPlan {
  return buildPlan({
    id: r.id,
    sessions: r.sessions,
    price: r.price,
    days: r.days,
    title: r.title,
    perks: r.perksText.split("\n"),
    popular: r.badge === "popular",
    best: r.badge === "best",
    active: r.active !== false,
  });
}

const sig = (rows: SubPlan[]) =>
  JSON.stringify(rows.map((p) => [p.id, p.title, p.sessions, p.price, p.days, p.perks, !!p.popular, !!p.best, p.active !== false]));

export default function CoachPlans({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, session, saveCoachPlans } = useStore();
  const coachId = session?.userId ?? "";
  const saved = useMemo(() => coachPlanList(data, coachId), [data, coachId]);
  const [rows, setRows] = useState<Row[]>(() => saved.map(toRow));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const custom = !!data.coachPlans?.[coachId]?.length;

  const current = rows.map(fromRow);
  const dirty = sig(current) !== sig(saved);

  const paid = data.invoices.filter((i) => i.status === "پرداخت‌شده" && i.planId);
  const revenue = paid.reduce((a, i) => a + i.amount, 0);
  const subscribers = data.students.filter((s) => s.planId && liveSubStatus(s) !== "منقضی" && liveSubStatus(s) !== "غیرفعال").length;
  const salesOf = (id: string) => paid.filter((i) => i.planId === id);

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const move = (idx: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = idx + dir;
      if (j < 0 || j >= rs.length) return rs;
      const a = [...rs];
      [a[idx], a[j]] = [a[j], a[idx]];
      return a;
    });

  const add = () => {
    const last = rows[rows.length - 1];
    const sessions = last ? last.sessions + 4 : 8;
    setRows((rs) => [
      ...rs,
      toRow(buildPlan({ id: uid("plan"), sessions, price: sessions * 200000, days: Math.round(sessions * 3.75), perks: ["برنامه تمرینی اختصاصی"], active: true })),
    ]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    rows.forEach((r) => {
      if (!(r.sessions >= 1)) e[r.id] = "تعداد جلسات باید حداقل ۱ باشد";
      else if (!(r.days >= 1)) e[r.id] = "مدت اعتبار باید حداقل ۱ روز باشد";
      else if (!(r.price >= 10000)) e[r.id] = "قیمت باید حداقل ۱۰٬۰۰۰ تومان باشد";
    });
    if (!rows.some((r) => r.active !== false)) e._all = "حداقل یک پلن باید فعال باشد تا شاگردان بتوانند خرید کنند";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    if (!validate()) return onToast("خطا در اطلاعات پلن‌ها", "موارد قرمز را اصلاح کن");
    saveCoachPlans(current);
    onToast("پلن‌ها ذخیره شد", "از همین لحظه شاگردان قیمت‌ها و مدت جدید را می‌بینند");
  };

  const resetDefaults = () => {
    if (!confirm("پلن‌ها به حالت پیش‌فرض (۸، ۱۲، ۱۶ و ۲۴ جلسه) برگردد؟")) return;
    setRows(PLANS.map(toRow));
    setErrors({});
  };

  const activePreview = current.filter((p) => p.active !== false).sort((a, b) => a.sessions - b.sessions);

  return (
    <div className="screen-in mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[19px] font-black"><Crown size={20} className="text-[#e9e400]" /> پلن‌های اشتراک من</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-mute)]">
            قیمت، تعداد جلسات و روزهای اعتبار هر پلن را خودت تعیین کن. {custom ? "" : "(فعلاً پلن‌های پیش‌فرض فعال است)"}
          </p>
        </div>
        <div className="flex gap-2">
          <GhostBtn onClick={resetDefaults}><RotateCcw size={14} /> پیش‌فرض</GhostBtn>
          <GhostBtn onClick={add}><Plus size={14} /> پلن جدید</GhostBtn>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatCard label="درآمد فروش اشتراک" value={money(revenue)} icon={<TrendingUp size={16} className="text-[#e9e400]" />} />
        <StatCard label="تعداد خرید" value={fa(paid.length)} icon={<Receipt size={16} className="text-[#e9e400]" />} />
        <StatCard label="شاگردان با اشتراک فعال" value={fa(subscribers)} icon={<Users size={16} className="text-[#e9e400]" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {rows.length === 0 && <Empty text="پلنی تعریف نشده. «پلن جدید» را بزن." />}
          {rows.map((r, idx) => {
            const perSession = r.sessions > 0 ? Math.round(r.price / r.sessions) : 0;
            const sales = salesOf(r.id);
            const off = r.active === false;
            return (
              <div key={r.id} className={`rounded-2xl border bg-[var(--color-card)] p-4 transition ${errors[r.id] ? "border-red-500/50" : "border-[var(--color-line)]"} ${off ? "opacity-60" : ""}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[#e9e400] text-black">
                    <b className="tnum text-[14px] leading-4">{fa(r.sessions || 0)}</b>
                    <span className="text-[8px] font-bold">جلسه</span>
                  </span>
                  <input
                    className={`${inputCls} h-10 min-w-0 flex-1 font-black`}
                    value={r.title}
                    onChange={(e) => update(r.id, { title: e.target.value })}
                    placeholder={`${fa(r.sessions)} جلسه`}
                  />
                  <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--color-mute)]">
                    {off ? <EyeOff size={14} /> : <Eye size={14} className="text-emerald-400" />}
                    {off ? "مخفی" : "فعال"}
                    <Toggle on={!off} onClick={() => update(r.id, { active: off })} />
                  </span>
                  <div className="flex items-center">
                    <button onClick={() => move(idx, -1)} className="press p-1 text-[var(--color-mute)]" aria-label="بالا"><ChevronUp size={16} /></button>
                    <button onClick={() => move(idx, 1)} className="press p-1 text-[var(--color-mute)]" aria-label="پایین"><ChevronDown size={16} /></button>
                    <button
                      onClick={() => {
                        if (sales.length && !confirm(`این پلن ${fa(sales.length)} فروش داشته. حذف شود؟ (خریدهای قبلی حفظ می‌شوند)`)) return;
                        setRows((rs) => rs.filter((x) => x.id !== r.id));
                      }}
                      className="press p-1.5 text-red-400"
                      aria-label="حذف پلن"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Field label="تعداد جلسات">
                    <input className={inputCls} type="number" min={1} value={r.sessions || ""} onChange={(e) => update(r.id, { sessions: Number(e.target.value) })} />
                  </Field>
                  <Field label="روزهای اعتبار">
                    <input className={inputCls} type="number" min={1} value={r.days || ""} onChange={(e) => update(r.id, { days: Number(e.target.value) })} />
                  </Field>
                  <Field label="قیمت (تومان)">
                    <input className={inputCls} type="number" min={0} step={10000} value={r.price || ""} onChange={(e) => update(r.id, { price: Number(e.target.value) })} dir="ltr" />
                  </Field>
                  <Field label="برچسب">
                    <select className={inputCls} value={r.badge} onChange={(e) => update(r.id, { badge: e.target.value as Row["badge"] })}>
                      <option value="none">بدون برچسب</option>
                      <option value="popular">محبوب‌ترین</option>
                      <option value="best">بهترین قیمت</option>
                    </select>
                  </Field>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Pill tone="brand">{money(r.price || 0)}</Pill>
                  <Pill>هر جلسه {money(perSession)}</Pill>
                  <Pill>{fa(r.days || 0)} روز</Pill>
                  <Pill tone={sales.length ? "ok" : "mute"}>{fa(sales.length)} فروش</Pill>
                  <div className="mr-auto flex gap-1">
                    {[-10, 10].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => update(r.id, { price: Math.max(10000, Math.round(((r.price || 0) * (1 + pct / 100)) / 10000) * 10000) })}
                        className="press rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[10.5px] font-bold"
                      >
                        {pct > 0 ? "+" : "−"}{fa(Math.abs(pct))}٪ قیمت
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <Field label="امکانات پلن (هر خط یک مورد)">
                    <textarea
                      className={`${inputCls} h-20 py-2 leading-6`}
                      value={r.perksText}
                      onChange={(e) => update(r.id, { perksText: e.target.value })}
                      placeholder={"برنامه تمرینی اختصاصی\nپشتیبانی پیام‌رسان"}
                    />
                  </Field>
                </div>
                {errors[r.id] && <p className="mt-2 text-[12px] font-bold text-red-400">{errors[r.id]}</p>}
              </div>
            );
          })}
          {errors._all && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-400">{errors._all}</p>}
        </div>

        <div className="space-y-3 lg:sticky lg:top-0 lg:h-fit">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
            <b className="flex items-center gap-1.5 text-[13.5px]"><Sparkles size={15} className="text-[#e9e400]" /> پیش‌نمایش برای شاگرد</b>
            <div className="mt-3 space-y-2">
              {activePreview.length === 0 && <p className="text-[12px] text-[var(--color-mute)]">پلن فعالی نیست.</p>}
              {activePreview.map((p) => (
                <div key={p.id} className="relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-2.5">
                  {(p.popular || p.best) && (
                    <span className={`absolute left-0 top-0 rounded-br-lg px-2 py-0.5 text-[9px] font-black ${p.popular ? "bg-[#e9e400] text-black" : "bg-emerald-500 text-white"}`}>
                      {p.popular ? "محبوب‌ترین" : "بهترین قیمت"}
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <b className="block text-[12.5px]">{p.title}</b>
                      <span className="tnum text-[10.5px] text-[var(--color-mute)]">{fa(p.days)} روز • هر جلسه {money(p.perSession)}</span>
                    </span>
                    <b className="tnum shrink-0 text-[12.5px] text-[#e9e400]">{money(p.price)}</b>
                  </div>
                  {p.perks.slice(0, 3).map((x) => (
                    <p key={x} className="mt-1 flex items-center gap-1 text-[10.5px] text-[var(--color-mute)]"><Check size={11} className="text-emerald-400" /> {x}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 text-[11.5px] leading-6 text-[var(--color-mute)]">
            <Info size={15} className="mt-1 shrink-0 text-[#e9e400]" />
            تغییرات فقط روی خریدهای جدید اعمال می‌شود؛ اشتراک و روزهای شاگردانی که قبلاً خرید کرده‌اند تغییری نمی‌کند.
          </div>

          <BrandBtn className="w-full" onClick={save}>
            <Save size={16} /> {dirty ? "ذخیره تغییرات" : "ذخیره‌شده"}
          </BrandBtn>
          {dirty && <p className="text-center text-[11px] font-bold text-amber-400">تغییرات ذخیره نشده داری</p>}
        </div>
      </div>
    </div>
  );
}
