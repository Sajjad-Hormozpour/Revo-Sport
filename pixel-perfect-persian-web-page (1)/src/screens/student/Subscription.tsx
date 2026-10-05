import { useState, type ReactNode } from "react";
import {
  AlertTriangle, CalendarClock, Check, CheckCircle, ChevronDown, Crown, CreditCard, Receipt,
  Ticket, Dumbbell, MessageCircle, Lock, Timer,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { resolvePlans, type PlanDef } from "../../data/plans";
import Checkout from "../../components/checkout";
import { BrandBtn, Modal, Pill, ProgressBar, money } from "../../components/ui";
import { fa } from "../../lib/core";
import { daysBetween, formatDateTime, formatJalaliDate, parseDate, useNow } from "../../lib/time";
import { liveSubStatus, subEndDate } from "../../lib/metrics";

export default function SubscriptionView({ stId, onGo }: { stId: string; onGo: (v: "profile" | "chat") => void }) {
  const { data, purchasePlan, userById, serverMode } = useStore();
  const now = useNow(60000);
  const [pick, setPick] = useState<PlanDef | null>(null);
  const [pay, setPay] = useState(false);
  const [renew, setRenew] = useState(false);

  const st = data.students.find((s) => s.id === stId);
  if (!st) return null;
  const coach = st.coachId ? userById(st.coachId) : undefined;
  const me = userById(st.userId);
  const plans = resolvePlans(data, st.coachId);
  const purchased = !!st.planId && (st.sessionsTotal ?? 0) > 0;

  const checkout = (
    <Modal open={pay && !!pick} onClose={() => setPay(false)} title="پرداخت اشتراک">
      {pick && (
        <Checkout
          key={pick.id}
          plan={pick}
          studentName={me?.name ?? "شاگرد"}
          merchantName={coach?.name ?? "مربی"}
          onClose={() => { setPay(false); setPick(null); setRenew(false); }}
          onPaid={(p) =>
            purchasePlan({
              studentId: stId,
              planId: pick.id,
              planTitle: pick.title,
              sessions: pick.sessions,
              days: pick.days,
              perks: pick.perks,
              amount: p.amount,
              coupon: p.coupon,
              method: p.method,
              cardLast4: p.cardLast4,
              rrn: p.rrn,
              terminal: p.terminal,
              cardBank: p.cardBank,
            })
          }
        />
      )}
    </Modal>
  );

  /** پنجره پرداخت همیشه در یک جایگاه ثابت می‌ماند تا بعد از ثبت خرید، رسید بانکی از بین نرود */
  const wrap = (node: ReactNode) => (
    <>
      {node}
      {checkout}
    </>
  );

  /* ---------- no coach yet ---------- */
  if (!coach) {
    return (
      <div className="screen-in py-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#e9e400]/15"><Crown size={28} className="text-[#e9e400]" /></span>
        <b className="mt-3 block text-[16px]">خرید اشتراک</b>
        <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-6 text-[var(--color-mute)]">برای دیدن پلن‌ها و خرید اشتراک، ابتدا با کد مربی به مربی‌ات وصل شو.</p>
        <BrandBtn className="mx-auto mt-4" onClick={() => onGo("profile")}><Ticket size={15} /> وارد کردن کد مربی</BrandBtn>
      </div>
    );
  }

  /* ---------- before purchase: only buying ---------- */
  if (!purchased) {
    return wrap(
      <div className="screen-in space-y-3 pb-24">
        <div className="on-dark relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-gradient-to-br from-[#1d1f0a] via-[#121309] to-black p-5 text-white">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#e9e400]/25 blur-[60px]" />
          <div className="relative flex items-center gap-3">
            <img src={coach.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-[#e9e400]/50" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#e9e400]"><Crown size={13} /> خرید اشتراک</p>
              <b className="block truncate text-[18px] font-black">کوچینگ {coach.name}</b>
            </div>
          </div>
          <p className="relative mt-3 text-[12.5px] leading-6 text-white/65">پلن مناسب خودت را انتخاب کن و پرداخت را انجام بده.</p>
        </div>

        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-8 text-center text-[12.5px] text-[var(--color-mute)]">
            مربی فعلاً پلن فعالی برای فروش ندارد.
          </p>
        ) : (
          <PlanCards plans={plans} pick={pick} onPick={setPick} />
        )}

        <div className="sticky bottom-2 z-10 pt-1">
          <button
            onClick={() => pick && (serverMode ? alert("درگاه پرداخت آنلاین هنوز به سرور متصل نیست؛ خرید آزمایشی فقط در حالت محلی ممکن است.") : setPay(true))}
            disabled={!pick}
            className="press flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#e9e400] py-3.5 text-[14.5px] font-black text-black shadow-[0_14px_36px_-12px_rgba(233,228,0,0.7)] disabled:opacity-45"
          >
            <CreditCard size={17} /> {pick ? `ادامه و پرداخت ${money(pick.price)}` : "یک پلن انتخاب کن"}
          </button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10.5px] text-[var(--color-mute)]">
            <Lock size={11} /> پرداخت امن از طریق درگاه بانکی شبکه شاپرک
          </p>
        </div>
      </div>,
    );
  }

  /* ---------- after purchase ---------- */
  const status = liveSubStatus(st, now);
  const end = subEndDate(st);
  const start = parseDate(st.planStartedAt || st.startDate) ?? now;
  const tone = status === "فعال" ? "#22c55e" : status === "در حال اتمام" ? "#f59e0b" : "#ef4444";
  const sessionsTotal = st.sessionsTotal ?? 0;
  const planStart = st.planStartedAt ? new Date(st.planStartedAt).getTime() : 0;
  const sessionsUsed = data.logs.filter((l) => l.studentId === stId && new Date(l.at || l.date).getTime() >= planStart).length;
  const sessionsLeft = Math.max(0, sessionsTotal - sessionsUsed);
  const sessionPct = sessionsTotal ? Math.min(100, Math.round((sessionsUsed / sessionsTotal) * 100)) : 0;
  const lastLogAt = data.logs
    .filter((l) => l.studentId === stId)
    .map((l) => l.at || l.date)
    .sort()
    .pop();
  const lastLog = lastLogAt ? parseDate(lastLogAt) : null;
  const daysSinceLast = lastLog ? daysBetween(lastLog, now) : null;
  const memberCode = `RS-${(st.id || "").replace(/\W/g, "").slice(-4).toUpperCase()}-${String(sessionsTotal).padStart(3, "0")}`;
  const invoices = [...data.invoices.filter((i) => i.studentId === stId)].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const paidTotal = invoices.filter((i) => i.status === "پرداخت‌شده").reduce((a, i) => a + i.amount, 0);
  const perks = st.planPerks ?? plans.find((p) => p.id === st.planId)?.perks ?? [];

  return wrap(
    <div className="screen-in space-y-3 pb-4">
      {/* کارت دیجیتال اشتراک */}
      <div className="on-dark relative overflow-hidden rounded-3xl border border-[#e9e400]/25 bg-gradient-to-br from-[#232607] via-[#121309] to-black p-5 text-white shadow-[0_26px_70px_-28px_rgba(233,228,0,0.45)]">
        <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-[#e9e400]/25 blur-[70px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{ backgroundImage: "repeating-linear-gradient(118deg, #fff 0 1px, transparent 1px 13px)" }}
        />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#e9e400]"><Crown size={13} /> کارت اشتراک من</p>
            <b className="mt-1 block truncate text-[19px] font-black">{st.planTitle}</b>
            <span className="mt-0.5 block truncate text-[11.5px] text-white/55">{me?.name} • کوچینگ {coach.name}</span>
          </div>
          <span className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black" style={{ background: `${tone}26`, color: tone }}>{status}</span>
        </div>

        <div className="relative mt-5 grid grid-cols-[112px_1fr] items-center gap-4">
          <div className="relative h-[112px] w-[112px]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="51" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="11" />
              <circle
                cx="60" cy="60" r="51" fill="none" stroke="#e9e400" strokeWidth="11" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 51}
                strokeDashoffset={2 * Math.PI * 51 * (1 - sessionPct / 100)}
                className="ring-anim"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <b className="tnum text-[26px] font-black leading-none">{fa(sessionsLeft)}</b>
              <span className="mt-0.5 text-[10px] text-white/60">جلسه باقی</span>
            </div>
          </div>
          <div className="space-y-2 text-[11.5px]">
            <InfoRow k="تاریخ پایان اعتبار" v={formatJalaliDate(end)} />
            <InfoRow k="آخرین جلسه" v={lastLog ? `${formatJalaliDate(lastLog)}${daysSinceLast !== null ? ` (${fa(daysSinceLast)} روز پیش)` : ""}` : "هنوز ثبت نشده"} />
            <InfoRow k="کد اشتراک" v={memberCode} ltr />
          </div>
        </div>

        <div className="relative mt-5 rounded-2xl bg-white/[0.07] p-3">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-white/60">پیشرفت جلسات</span>
            <span className="tnum font-bold">{fa(sessionsUsed)} از {fa(sessionsTotal)} جلسه</span>
          </div>
          <ProgressBar pct={sessionPct} className="mt-2 h-2" />
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-white/50">
            <span>شروع دوره: {formatJalaliDate(start)}</span>
            <span className="tnum">{fa(sessionPct)}٪ استفاده‌شده</span>
          </div>
        </div>
      </div>

      {(status === "در حال اتمام" || status === "منقضی" || sessionsLeft <= 2) && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <b className="block text-[13px]">
              {status === "منقضی" ? "اشتراکت تمام شده" : sessionsLeft <= 2 ? `فقط ${fa(sessionsLeft)} جلسه باقی مانده` : "اشتراکت رو به اتمام است"}
            </b>
            <p className="text-[11.5px] leading-6 text-[var(--color-mute)]">برای ادامه تمرین، اشتراکت را تمدید کن.</p>
          </div>
          <button onClick={() => setRenew(true)} className="press shrink-0 rounded-full bg-[#e9e400] px-3 py-1.5 text-[11px] font-black text-black">تمدید</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Mini icon={<CalendarClock size={15} />} v={fa(sessionsTotal)} l="کل جلسات" />
        <Mini icon={<CheckCircle size={15} />} v={fa(sessionsUsed)} l="انجام‌شده" />
        <Mini icon={<Timer size={15} />} v={daysSinceLast === null ? "—" : fa(daysSinceLast)} l="روز از آخرین تمرین" />
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3.5">
        <b className="flex items-center gap-1.5 text-[13.5px]"><Crown size={15} className="text-[#e9e400]" /> ویژگی‌های اشتراک من</b>
        <ul className="mt-3 space-y-2">
          {[
            { icon: <Dumbbell size={14} />, t: `${fa(sessionsTotal)} جلسه تمرین با برنامه اختصاصی` },
            { icon: <Timer size={14} />, t: `${fa(st.planDays ?? 0)} روز اعتبار` },
            { icon: <MessageCircle size={14} />, t: `ارتباط مستقیم با ${coach.name}` },
          ].map((x) => (
            <li key={x.t} className="flex items-center gap-2 text-[12.5px]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e9e400]/15 text-[#e9e400]">{x.icon}</span>
              {x.t}
            </li>
          ))}
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-[12.5px]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400"><Check size={14} strokeWidth={3} /></span>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3.5">
        <div className="flex items-center justify-between">
          <b className="flex items-center gap-1.5 text-[13.5px]"><Receipt size={15} className="text-[#e9e400]" /> پرداخت‌ها</b>
          {paidTotal > 0 && <span className="text-[11px] text-[var(--color-mute)]">جمع: <b className="text-[var(--color-ink)]">{money(paidTotal)}</b></span>}
        </div>
        <div className="mt-2.5 space-y-2">
          {invoices.map((i) => (
            <div key={i.id} className="rounded-xl bg-[var(--color-bg)] p-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${i.status === "پرداخت‌شده" ? "bg-emerald-500/15 text-emerald-400" : i.status === "در انتظار" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                  {i.status === "پرداخت‌شده" ? <CheckCircle size={16} /> : <Receipt size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[12.5px]">{i.plan}</b>
                  <span className="block text-[10.5px] text-[var(--color-mute)]">{formatDateTime(i.date)}</span>
                </div>
                <div className="shrink-0 text-left">
                  <b className="tnum block text-[12px]">{money(i.amount)}</b>
                  <Pill tone={i.status === "پرداخت‌شده" ? "ok" : i.status === "در انتظار" ? "warn" : "danger"}>{i.status}</Pill>
                </div>
              </div>
              {(i.refId || i.method) && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--color-line)] pt-2 text-[10.5px] text-[var(--color-mute)]">
                  {i.method && <span>درگاه: {i.method}</span>}
                  {i.cardLast4 && <span dir="ltr">•••• {fa(i.cardLast4)}</span>}
                  {i.refId && <span>پیگیری: <b dir="ltr" className="text-[var(--color-ink)]">{i.refId}</b></span>}
                  {i.coupon && <span>کد تخفیف: {i.coupon}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
        <button onClick={() => setRenew((v) => !v)} className="press flex w-full items-center justify-between p-3.5 text-right">
          <b className="flex items-center gap-1.5 text-[13.5px]"><CreditCard size={15} className="text-[#e9e400]" /> تمدید یا ارتقای اشتراک</b>
          <ChevronDown size={16} className={`transition ${renew ? "rotate-180" : ""}`} />
        </button>
        {renew && (
          <div className="border-t border-[var(--color-line)] p-3.5">
            <p className="mb-2.5 text-[11.5px] text-[var(--color-mute)]">روزهای پلن جدید به انتهای اعتبار فعلی اضافه می‌شود.</p>
            <PlanCards plans={plans} pick={pick} onPick={setPick} currentId={st.planId} />
            <button
              onClick={() => pick && (serverMode ? alert("درگاه پرداخت آنلاین هنوز به سرور متصل نیست؛ خرید آزمایشی فقط در حالت محلی ممکن است.") : setPay(true))}
              disabled={!pick}
              className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black disabled:opacity-45"
            >
              <CreditCard size={17} /> {pick ? `پرداخت ${money(pick.price)}` : "یک پلن انتخاب کن"}
            </button>
          </div>
        )}
      </div>
    </div>,
  );
}

function PlanCards({
  plans, pick, onPick, currentId,
}: {
  plans: PlanDef[];
  pick: PlanDef | null;
  onPick: (p: PlanDef) => void;
  currentId?: string;
}) {
  return (
    <div className="space-y-2.5">
      {plans.map((p) => {
        const sel = pick?.id === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className={`press relative w-full overflow-hidden rounded-2xl border p-3.5 text-right transition ${sel ? "border-[#e9e400] bg-[#e9e400]/10 ring-1 ring-[#e9e400]/40" : "border-[var(--color-line)] bg-[var(--color-card)]"}`}
          >
            {(p.popular || p.best) && (
              <span className={`absolute left-0 top-0 rounded-br-xl px-2.5 py-1 text-[9.5px] font-black ${p.popular ? "bg-[#e9e400] text-black" : "bg-emerald-500 text-white"}`}>
                {p.popular ? "محبوب‌ترین" : "بهترین قیمت"}
              </span>
            )}
            <div className="flex items-center gap-3">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${sel ? "border-[#e9e400] bg-[#e9e400]" : "border-[var(--color-line)]"}`}>
                {sel && <Check size={12} strokeWidth={3.5} className="text-black" />}
              </span>
              <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${sel ? "bg-[#e9e400] text-black" : "bg-[var(--color-card2)]"}`}>
                <b className="tnum text-[15px] leading-4">{fa(p.sessions)}</b>
                <span className="text-[8.5px] font-bold opacity-70">جلسه</span>
              </span>
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-1.5 text-[14px]">
                  {p.title}
                  {currentId === p.id && <Pill tone="info">پلن فعلی</Pill>}
                </b>
                <span className="tnum block text-[10.5px] text-[var(--color-mute)]">{fa(p.days)} روز اعتبار • هر جلسه {money(p.perSession)}</span>
              </span>
              <b className="tnum shrink-0 text-[14px] font-black text-[#e9e400]">{money(p.price)}</b>
            </div>
            {p.perks.length > 0 && (
              <ul className="mt-2.5 grid gap-1 border-t border-[var(--color-line)] pt-2.5 sm:grid-cols-2">
                {p.perks.map((x) => (
                  <li key={x} className="flex items-center gap-1.5 text-[11.5px] text-[var(--color-mute)]">
                    <Check size={12} className="shrink-0 text-emerald-400" /> {x}
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}

function InfoRow({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 last:border-0 last:pb-0">
      <span className="shrink-0 text-white/55">{k}</span>
      <b className="tnum truncate text-white" dir={ltr ? "ltr" : undefined}>{v}</b>
    </div>
  );
}

function Mini({ icon, v, l }: { icon: ReactNode; v: string; l: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-card)] p-2.5 text-center">
      <div className="flex justify-center text-[#e9e400]">{icon}</div>
      <b className="tnum mt-1 block text-[15px]">{v}</b>
      <span className="text-[9.5px] text-[var(--color-mute)]">{l}</span>
    </div>
  );
}
