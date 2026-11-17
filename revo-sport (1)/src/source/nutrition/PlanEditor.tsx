import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, Archive, ArrowDown, ArrowUp, BookOpen, Calculator, CalendarDays, ChevronLeft, ClipboardList, Coffee, Copy, Dumbbell, Eye,
  FileText, History, LayoutTemplate, ListChecks, Moon, Pencil, Pill as PillIcon, Plus, Printer, Repeat, RotateCcw, Save, Send, Sparkles,
  StickyNote, Trash2, Utensils,
} from "lucide-react";
import type { MealPlan, Student } from "../data/types";
import { useStore } from "../lib/store";
import { uid } from "../lib/core";
import { addDays, formatJalaliDate, formatRelative, nowIso } from "../lib/time";
import { Modal, Pill, Toggle } from "../components/ui";
import type { UnitKey } from "./foods";
import {
  ACTIVITY, ALLERGY_OPTIONS, FORMULAS, GOALS, GUIDELINE_SUGGESTIONS, MACRO_PRESETS, MEAL_PRESETS, RESTRICTION_OPTIONS, SUPPLEMENT_SUGGESTIONS,
  SUPPLEMENT_TIMINGS, WEEKDAY_FA, WEEKDAY_EN, WEEKDAY_SHORT_FA, WEEKDAY_SHORT_EN, adherenceRows, bmiLabel, blankDay, clonePlanContent, computeEnergy,
  dayTargets, dayTotals, defaultProfile, defaultSlots, deviation, findFood, formatPortion, isoDate, itemName, makeAlt, makeItem, nf, normalizePlan,
  planTargets, round1, snapshotOf, sumMacros, syncLegacy, unitFor,
  type DayKind, type NutriCalc, type NutriDay, type NutriItem, type NutriProfile, type NutriSlot, type PlanSnapshot, type ProPlan, type Targets,
} from "./engine";
import { FoodPicker, unitOptionLabel, type PickResult } from "./FoodPicker";
import {
  Card, Chip, KcalRing, Label, MACRO_COLORS, MacroBar, MacroInline, MacroSplit, MoreMenu, NumInput, PlanSheet, PrintPortal, SectionHead, Seg,
  TimeField, areaCls, dayKindLabel, fieldCls, gUnit, kcalUnit, macroLabel, useConfirm, useTx,
} from "./parts";

type Section = "targets" | "meals" | "supplements" | "guide" | "preview" | "adherence";
type Ask = ReturnType<typeof useConfirm>["ask"];
type Update = (recipe: (plan: ProPlan) => ProPlan) => void;

export interface EditorProps {
  mode: "student" | "template";
  record: MealPlan;
  student?: Student;
  studentName?: string;
  studentAvatar?: string;
  coachId: string;
  coachName: string;
  serviceOn?: boolean;
  onToggleService?: () => void;
  onBack: () => void;
  onToast: (title: string, desc: string) => void;
  onNewPlan?: () => void;
  onOpenArchive?: () => void;
}

function IconBtn({ label, onClick, children, danger, active, badge }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; active?: boolean; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`press relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
        active ? "border-[#e9e400]/50 text-[#e9e400]" : "border-[var(--color-line)] text-[var(--color-mute)]"
      } ${danger ? "hover:border-red-400/50 hover:text-red-400" : "hover:border-[#e9e400]/40 hover:text-[#e9e400]"}`}
    >
      {children}
      {!!badge && (
        <span className="tnum absolute -top-1.5 min-w-4 rounded-full bg-[#e9e400] px-1 text-center text-[9px] font-black leading-4 text-black" style={{ insetInlineEnd: -6 }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function slotIcon(name: string) {
  if (/صبحانه|breakfast/i.test(name)) return <Coffee size={16} />;
  if (/تمرین|workout/i.test(name)) return <Dumbbell size={16} />;
  if (/خواب|شام|dinner|bed/i.test(name)) return <Moon size={16} />;
  return <Utensils size={16} />;
}

/* =================================================================== */
/*  Editor shell                                                        */
/* =================================================================== */

export default function PlanEditor(props: EditorProps) {
  const { mode, record, student, studentName, studentAvatar, coachId, coachName, serviceOn, onToggleService, onBack, onToast, onNewPlan, onOpenArchive } = props;
  const { data, saveMeal, deleteMeal, pushNotif } = useStore();
  const { tx } = useTx();
  const { ask, confirmNode } = useConfirm();
  const [draft, setDraft] = useState<ProPlan>(() => normalizePlan(record, data));
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState<Section>(record.status === "active" || mode === "template" ? "meals" : "targets");
  const [printing, setPrinting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setDraft(normalizePlan(record, data));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  useEffect(() => {
    if (!dirty) setDraft(normalizePlan(record, data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.updatedAt, record.status]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const update: Update = (recipe) => {
    setDraft((plan) => recipe(plan));
    setDirty(true);
  };

  const persist = (status: NonNullable<MealPlan["status"]>, notify?: "publish" | "update") => {
    const latest = data.meals.find((meal) => meal.id === draft.id) as (MealPlan & { serviceOff?: boolean }) | undefined;
    const bump = !!latest && latest.status === "active" && (dirty || status !== latest.status);
    const history = bump && latest
      ? [...(latest.history ?? []), snapshotOf(normalizePlan(latest, data))].slice(-8)
      : latest?.history ?? draft.history ?? [];
    const at = nowIso();
    const fallback = mode === "template" ? tx("قالب برنامه غذایی", "Nutrition template") : tx("برنامه غذایی اختصاصی", "Personal nutrition plan");
    const next = syncLegacy({
      ...draft,
      name: draft.name.trim() || fallback,
      status,
      coachId: draft.coachId || coachId,
      version: bump && latest ? (latest.version || 1) + 1 : latest?.version || draft.version || 1,
      history: history as MealPlan["history"],
      serviceOff: latest ? latest.serviceOff : draft.serviceOff,
      updatedAt: at,
      publishedAt: status === "active" ? (notify === "publish" || !draft.publishedAt ? at : draft.publishedAt) : draft.publishedAt,
    });
    saveMeal(next);
    setDraft(next);
    setDirty(false);
    if (notify && student) {
      pushNotif({
        to: "student",
        studentId: student.id,
        title: notify === "publish" ? "برنامه غذایی جدید" : "به‌روزرسانی برنامه غذایی",
        body: notify === "publish"
          ? `${coachName} برنامه غذایی «${next.name}» را برای شما ارسال کرد.`
          : `${coachName} برنامه غذایی «${next.name}» را به‌روزرسانی کرد.`,
        time: at,
        read: false,
        type: notify === "publish" ? "success" : "info",
      });
    }
    return next;
  };

  const validate = async (): Promise<boolean> => {
    const count = draft.days.reduce((sum, day) => sum + Object.values(day.items).reduce((inner, list) => inner + list.length, 0), 0);
    if (!count) {
      onToast(tx("برنامه هنوز خالی است", "The plan is still empty"), tx("پیش از انتشار، دست‌کم یک غذا به وعده‌ها اضافه کنید.", "Add at least one food before publishing."));
      setSection("meals");
      return false;
    }
    if (!draft.targetKcal) {
      onToast(tx("هدف کالری تعیین نشده است", "No calorie target"), tx("ابتدا در بخش «ارزیابی و اهداف» کالری روزانه را مشخص کنید.", "Set the daily calories in Assessment & targets first."));
      setSection("targets");
      return false;
    }
    const off = draft.days
      .map((day) => ({ day, dev: deviation(dayTotals(draft, day).kcal, dayTargets(draft, day).kcal) }))
      .filter((entry) => Math.abs(entry.dev) > 12);
    if (!off.length) return true;
    const lines = off.map((entry) =>
      tx(
        `مجموع کالری «${entry.day.name}» ${nf(Math.abs(entry.dev))}% ${entry.dev > 0 ? "بیشتر" : "کمتر"} از هدف است.`,
        `“${entry.day.name}” is ${nf(Math.abs(entry.dev))}% ${entry.dev > 0 ? "above" : "below"} its calorie target.`,
      ),
    );
    return ask({
      title: tx("اختلاف با هدف کالری", "Calorie target mismatch"),
      body: `${lines.join(" ")} ${tx("آیا برنامه با همین مقادیر منتشر شود؟", "Publish the plan anyway?")}`,
      confirm: tx("بله، منتشر شود", "Yes, publish"),
    });
  };

  const publish = async () => {
    if (!(await validate())) return;
    const next = persist("active", "publish");
    onToast(tx("برنامه منتشر شد", "Plan published"), tx(`«${next.name}» برای ${studentName ?? "شاگرد"} ارسال شد.`, `“${next.name}” was sent to ${studentName ?? "the athlete"}.`));
  };

  const saveActive = async () => {
    if (!(await validate())) return;
    const changed = dirty;
    persist("active", changed ? "update" : undefined);
    onToast(tx("تغییرات ذخیره شد", "Changes saved"), changed ? tx("برنامه شاگرد به‌روزرسانی شد و اعلان برای او ارسال شد.", "The athlete's plan was updated and notified.") : tx("تغییری برای ذخیره وجود نداشت.", "There were no changes to save."));
  };

  const saveDraft = () => {
    persist(mode === "template" ? "template" : "draft");
    onToast(
      mode === "template" ? tx("قالب ذخیره شد", "Template saved") : tx("پیش‌نویس ذخیره شد", "Draft saved"),
      mode === "template" ? tx("قالب برای استفاده در برنامه‌های بعدی آماده است.", "The template is ready to reuse.") : tx("برنامه هنوز برای شاگرد منتشر نشده است.", "The plan has not been published yet."),
    );
  };

  const saveAsTemplate = () => {
    const template = clonePlanContent(draft, {
      studentId: "",
      status: "template",
      coachId,
      name: `${draft.name} — ${tx("قالب", "template")}`,
      serviceOff: undefined,
      profile: defaultProfile(),
    });
    saveMeal(syncLegacy(template));
    onToast(tx("قالب ساخته شد", "Template created"), tx("این برنامه در بخش «قالب‌ها» ذخیره شد.", "The plan was saved under Templates."));
  };

  const duplicateTemplate = () => {
    const copy = clonePlanContent(draft, { name: `${draft.name} — ${tx("کپی", "copy")}`, status: "template", studentId: "", coachId });
    saveMeal(syncLegacy(copy));
    onToast(tx("قالب تکثیر شد", "Template duplicated"), copy.name);
  };

  const unpublish = async () => {
    const ok = await ask({
      title: tx("بازگرداندن به پیش‌نویس", "Move back to draft"),
      body: tx("با این کار برنامه از دید شاگرد خارج می‌شود و تا انتشار دوباره، پیام «در حال آماده‌سازی» به او نمایش داده می‌شود.", "The athlete will no longer see this plan until you publish it again."),
      confirm: tx("بازگرداندن به پیش‌نویس", "Move to draft"),
    });
    if (!ok) return;
    persist("draft");
    onToast(tx("برنامه به پیش‌نویس منتقل شد", "Moved to draft"), tx("برای نمایش دوباره، برنامه را منتشر کنید.", "Publish again to make it visible."));
  };

  const remove = async () => {
    const ok = await ask({
      title: mode === "template" ? tx("حذف قالب", "Delete template") : tx("حذف برنامه غذایی", "Delete nutrition plan"),
      body: mode === "template"
        ? tx("این قالب برای همیشه حذف می‌شود. برنامه‌هایی که قبلاً از آن ساخته شده‌اند تغییری نمی‌کنند.", "This template will be deleted permanently. Plans created from it are not affected.")
        : tx("برنامه و گزارش پایبندی آن برای همیشه حذف می‌شود و بخش تغذیه برای شاگرد غیرفعال خواهد شد.", "The plan and its adherence history will be deleted, and nutrition will be turned off for this athlete."),
      confirm: tx("حذف شود", "Delete"),
      danger: true,
    });
    if (!ok) return;
    deleteMeal(draft.id);
    setDirty(false);
    onToast(tx("حذف شد", "Deleted"), draft.name);
    onBack();
  };

  const restore = (snapshot: Partial<PlanSnapshot>) => {
    update((plan) => ({
      ...plan,
      name: snapshot.name ?? plan.name,
      meals: (snapshot.meals as NutriSlot[] | undefined) ?? plan.meals,
      days: snapshot.days ?? plan.days,
      supplements: snapshot.supplements ?? plan.supplements,
      guidelines: snapshot.guidelines ?? plan.guidelines,
      coachNote: snapshot.coachNote ?? plan.coachNote,
      targetKcal: snapshot.targets?.kcal ?? plan.targetKcal,
      targetP: snapshot.targets?.p ?? plan.targetP,
      targetC: snapshot.targets?.c ?? plan.targetC,
      targetF: snapshot.targets?.f ?? plan.targetF,
      targetFiber: snapshot.targets?.fiber ?? plan.targetFiber,
      waterGoal: snapshot.targets?.water ?? plan.waterGoal,
    }));
    setHistoryOpen(false);
    onToast(tx("نسخه در ویرایشگر بازیابی شد", "Version restored"), tx("برای اعمال، تغییرات را ذخیره کنید.", "Save to apply the restored version."));
  };

  const status = draft.status ?? "draft";
  const statusPill =
    mode === "template" ? <Pill tone="info">{tx("قالب", "Template")}</Pill>
      : status === "active" ? <Pill tone="ok">{tx("منتشرشده", "Published")}</Pill>
        : <Pill tone="warn">{tx("پیش‌نویس", "Draft")}</Pill>;

  const sections = [
    { key: "targets" as const, label: tx("ارزیابی و اهداف", "Assessment & targets"), icon: <Calculator size={15} /> },
    { key: "meals" as const, label: tx("وعده‌ها و غذاها", "Meals & foods"), icon: <Utensils size={15} /> },
    { key: "supplements" as const, label: tx("مکمل‌ها", "Supplements"), icon: <PillIcon size={15} /> },
    { key: "guide" as const, label: tx("توصیه‌ها و زمان‌بندی", "Guidance & schedule"), icon: <FileText size={15} /> },
    { key: "preview" as const, label: tx("پیش‌نمایش و چاپ", "Preview & print"), icon: <Eye size={15} /> },
    { key: "adherence" as const, label: tx("پایبندی شاگرد", "Adherence"), icon: <ListChecks size={15} />, hidden: mode === "template" },
  ];

  return (
    <div className="min-w-0 space-y-3">
      <Card className="relative">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={tx("بازگشت", "Back")}
            className={`press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] ${mode === "student" ? "lg:hidden" : ""}`}
          >
            <ChevronLeft size={18} className="rtl:rotate-180" />
          </button>
          {mode === "student" ? (
            <img src={studentAvatar} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-[#e9e400]/30" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400"><LayoutTemplate size={20} /></span>
          )}
          <div className="min-w-0 flex-1">
            <input
              value={draft.name}
              onChange={(event) => update((plan) => ({ ...plan, name: event.target.value }))}
              aria-label={tx("نام برنامه", "Plan name")}
              className="w-full rounded-lg bg-transparent text-[17px] font-black outline-none transition focus:bg-[var(--color-bg)] focus:px-2"
            />
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-mute)]">
              {mode === "student" && studentName && <b className="text-[var(--color-ink)]">{studentName}</b>}
              {statusPill}
              <span className="tnum">{tx("نسخه", "Version")} {draft.version || 1}</span>
              <span>•</span>
              {dirty ? (
                <span className="font-bold text-amber-400">{tx("تغییرات ذخیره نشده", "Unsaved changes")}</span>
              ) : (
                <span>{tx("آخرین ذخیره", "Last saved")} {formatRelative(draft.updatedAt || draft.createdAt)}</span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {mode === "template" ? (
              <button type="button" onClick={saveDraft} className="press flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black sm:flex-none">
                <Save size={15} /> {tx("ذخیره قالب", "Save template")}
              </button>
            ) : status === "active" ? (
              <button type="button" onClick={saveActive} className="press flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black sm:flex-none">
                <Send size={15} /> {tx("ذخیره و به‌روزرسانی برنامه", "Save & update plan")}
              </button>
            ) : (
              <>
                <button type="button" onClick={saveDraft} className="press flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-line)] px-4 text-[12.5px] font-extrabold">
                  <Save size={15} /> {tx("ذخیره پیش‌نویس", "Save draft")}
                </button>
                <button type="button" onClick={publish} className="press flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black sm:flex-none">
                  <Send size={15} /> {tx("انتشار برای شاگرد", "Publish to athlete")}
                </button>
              </>
            )}
            <MoreMenu
              label={tx("بیشتر", "More")}
              items={[
                { label: tx("چاپ یا ذخیره PDF", "Print or save as PDF"), icon: <Printer size={15} />, onClick: () => setPrinting(true) },
                { label: tx("ذخیره به‌عنوان قالب", "Save as template"), icon: <LayoutTemplate size={15} />, onClick: saveAsTemplate, hidden: mode === "template" },
                { label: tx("تکثیر قالب", "Duplicate template"), icon: <Copy size={15} />, onClick: duplicateTemplate, hidden: mode !== "template" },
                { label: tx("نسخه‌های قبلی", "Version history"), icon: <History size={15} />, onClick: () => setHistoryOpen(true), hidden: !draft.history?.length },
                { label: tx("برنامه‌های بایگانی‌شده", "Archived plans"), icon: <Archive size={15} />, onClick: () => onOpenArchive?.(), hidden: mode === "template" || !onOpenArchive },
                { label: tx("شروع برنامه جدید", "Start a new plan"), icon: <Sparkles size={15} />, onClick: () => onNewPlan?.(), hidden: mode === "template" || !onNewPlan },
                { label: tx("بازگرداندن به پیش‌نویس", "Move back to draft"), icon: <RotateCcw size={15} />, onClick: unpublish, hidden: mode === "template" || status !== "active" },
                { label: mode === "template" ? tx("حذف قالب", "Delete template") : tx("حذف برنامه", "Delete plan"), icon: <Trash2 size={15} />, onClick: remove, danger: true },
              ]}
            />
          </div>
        </div>
        {mode === "student" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--color-bg)] px-3 py-2.5">
            <div className="min-w-0">
              <b className="text-[12.5px]">{tx("نمایش بخش تغذیه در اپلیکیشن شاگرد", "Show nutrition in the athlete's app")}</b>
              <p className="text-[11px] leading-6 text-[var(--color-mute)]">
                {serviceOn
                  ? status === "active"
                    ? tx("شاگرد گزینه «تغذیه» را در منوی خود می‌بیند و برنامه منتشرشده را دریافت کرده است.", "The athlete sees “Nutrition” in their menu and has the published plan.")
                    : tx("گزینه «تغذیه» برای شاگرد فعال است؛ تا زمان انتشار، پیام «در حال آماده‌سازی» به او نمایش داده می‌شود.", "Nutrition is enabled; until you publish, the athlete sees a “being prepared” message.")
                  : tx("بخش تغذیه برای این شاگرد پنهان است. در صورت نیاز شاگرد، آن را فعال کنید.", "Nutrition is hidden for this athlete. Turn it on when they need it.")}
              </p>
            </div>
            <Toggle on={!!serviceOn} onClick={() => onToggleService?.()} />
          </div>
        )}
      </Card>

      <Seg items={sections} value={section} onChange={setSection} />

      <div className="screen-in" key={section}>
        {section === "targets" && <TargetsSection plan={draft} update={update} mode={mode} />}
        {section === "meals" && <MealsSection plan={draft} update={update} coachId={coachId} ask={ask} onToast={onToast} />}
        {section === "supplements" && <SupplementsSection plan={draft} update={update} />}
        {section === "guide" && <GuideSection plan={draft} update={update} />}
        {section === "preview" && (
          <div className="space-y-3">
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] leading-6 text-[var(--color-mute)]">
                {tx("نسخه سندی برنامه برای چاپ، ذخیره PDF یا ارسال در پیام‌رسان. اطلاعات پرونده تغذیه‌ای شاگرد در این سند نمایش داده نمی‌شود.", "A document version for printing, PDF export or sharing. The athlete's private nutrition file is not included.")}
              </p>
              <button type="button" onClick={() => setPrinting(true)} className="press flex h-10 items-center gap-1.5 rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black">
                <Printer size={15} /> {tx("چاپ یا ذخیره PDF", "Print or save as PDF")}
              </button>
            </Card>
            <Card><PlanSheet plan={draft} studentName={studentName} coachName={coachName} /></Card>
          </div>
        )}
        {section === "adherence" && mode === "student" && <AdherenceSection plan={draft} />}
      </div>

      {historyOpen && (
        <Modal open onClose={() => setHistoryOpen(false)} title={tx("نسخه‌های قبلی برنامه", "Version history")}>
          <div className="space-y-2">
            {[...(draft.history ?? [])].reverse().map((entry) => {
              const snapshot = entry as Partial<PlanSnapshot>;
              return (
                <div key={`${entry.version}-${entry.at}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] p-3">
                  <span className="min-w-0">
                    <b className="tnum block text-[12.5px]">{tx("نسخه", "Version")} {entry.version} — {entry.name}</b>
                    <span className="text-[11px] text-[var(--color-mute)]">{formatJalaliDate(entry.at)} • {formatRelative(entry.at)}</span>
                  </span>
                  <button type="button" onClick={() => restore(snapshot)} className="press flex items-center gap-1 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[11.5px] font-black text-[#e9e400]">
                    <RotateCcw size={13} /> {tx("بازیابی در ویرایشگر", "Restore in editor")}
                  </button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {printing && (
        <PrintPortal onDone={() => setPrinting(false)}>
          <PlanSheet plan={draft} studentName={studentName} coachName={coachName} />
        </PrintPortal>
      )}
      {confirmNode}
    </div>
  );
}

/* =================================================================== */
/*  Assessment & targets                                                */
/* =================================================================== */

function TargetsSection({ plan, update, mode }: { plan: ProPlan; update: Update; mode: "student" | "template" }) {
  const { tx, lang } = useTx();
  const calc = plan.calc;
  const energy = computeEnergy(calc);
  const bmi = bmiLabel(energy.bmi, lang);
  const setCalc = (patch: Partial<NutriCalc>) => update((p) => ({ ...p, calc: { ...p.calc, ...patch } }));
  const setProfile = (patch: Partial<NutriProfile>) => update((p) => ({ ...p, profile: { ...p.profile, ...patch } }));
  const applyTargets = () =>
    update((p) => ({ ...p, targetKcal: energy.target, targetP: energy.protein, targetC: energy.carbs, targetF: energy.fat, targetFiber: energy.fiber, waterGoal: energy.water }));
  const macroKcal = Math.round((plan.targetP || 0) * 4 + (plan.targetC || 0) * 4 + (plan.targetF || 0) * 9);
  const goalInfo = GOALS.find((goal) => goal.key === calc.goal);
  const pctLabel = calc.goal === "custom" ? calc.adjustPct : goalInfo?.pct ?? 0;
  const hasItems = plan.days.some((day) => Object.values(day.items).some((list) => list.length));
  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <Card>
        <SectionHead
          icon={<Activity size={15} />}
          title={tx("مشخصات بدنی", "Body metrics")}
          hint={mode === "student"
            ? tx("از پرونده شاگرد و آخرین اندازه‌گیری ثبت‌شده خوانده شده است؛ در صورت نیاز اصلاح کنید.", "Loaded from the athlete's profile and latest measurement; adjust if needed.")
            : tx("مشخصات یک فرد نمونه برای محاسبه اهداف این قالب.", "A reference profile used to calculate this template's targets.")}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div><Label>{tx("وزن", "Weight")}</Label><NumInput value={calc.weight} onChange={(weight) => setCalc({ weight })} step={0.5} min={30} max={250} suffix={tx("کیلوگرم", "kg")} ariaLabel={tx("وزن", "Weight")} /></div>
          <div><Label>{tx("قد", "Height")}</Label><NumInput value={calc.height} onChange={(height) => setCalc({ height })} min={120} max={230} suffix={tx("سانتی‌متر", "cm")} ariaLabel={tx("قد", "Height")} /></div>
          <div><Label>{tx("سن", "Age")}</Label><NumInput value={calc.age} onChange={(age) => setCalc({ age })} min={12} max={90} suffix={tx("سال", "yrs")} ariaLabel={tx("سن", "Age")} /></div>
          <div><Label>{tx("درصد چربی (اختیاری)", "Body fat % (optional)")}</Label><NumInput value={calc.bodyFat ?? 0} onChange={(bodyFat) => setCalc({ bodyFat: bodyFat || null })} step={0.5} min={0} max={60} suffix="%" ariaLabel={tx("درصد چربی", "Body fat")} /></div>
          <div className="col-span-2">
            <Label>{tx("جنسیت", "Sex")}</Label>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-1">
              {(["male", "female"] as const).map((gender) => (
                <button key={gender} type="button" onClick={() => setCalc({ gender })} className={`press h-8 rounded-lg text-[12px] font-black ${calc.gender === gender ? "bg-[#e9e400] text-black" : "text-[var(--color-mute)]"}`}>
                  {gender === "male" ? tx("آقا", "Male") : tx("خانم", "Female")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHead icon={<Dumbbell size={15} />} title={tx("سطح فعالیت و هدف", "Activity & goal")} />
        <div className="space-y-1.5">
          {ACTIVITY.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCalc({ activity: item.key })}
              aria-pressed={calc.activity === item.key}
              className={`press flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start transition ${
                calc.activity === item.key ? "border-[#e9e400]/50 bg-[#e9e400]/10" : "border-[var(--color-line)] hover:border-[#e9e400]/30"
              }`}
            >
              <span className="min-w-0">
                <b className="block text-[12.5px]">{lang === "fa" ? item.fa : item.en}</b>
                <span className="block text-[10.5px] text-[var(--color-mute)]">{lang === "fa" ? item.hint : item.hintEn}</span>
              </span>
              <span className="tnum shrink-0 text-[11px] font-black text-[var(--color-mute)]" dir="ltr">×{item.factor}</span>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label>{tx("هدف تغذیه‌ای", "Nutrition goal")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map((goal) => (
              <Chip key={goal.key} on={calc.goal === goal.key} onClick={() => setCalc({ goal: goal.key })}>
                {lang === "fa" ? goal.fa : goal.en}
                {goal.key !== "custom" && <span className="tnum opacity-70" dir="ltr">{goal.pct > 0 ? `+${goal.pct}` : goal.pct}%</span>}
              </Chip>
            ))}
          </div>
          {calc.goal === "custom" && (
            <div className="mt-2 max-w-[200px]">
              <NumInput value={calc.adjustPct} onChange={(adjustPct) => setCalc({ adjustPct })} min={-35} max={35} suffix="%" ariaLabel={tx("درصد تغییر کالری", "Calorie adjustment")} />
            </div>
          )}
        </div>
        <div className="mt-3">
          <Label>{tx("فرمول محاسبه متابولیسم پایه", "BMR formula")}</Label>
          <select value={calc.formula} onChange={(event) => setCalc({ formula: event.target.value as NutriCalc["formula"] })} className={fieldCls}>
            {FORMULAS.map((formula) => <option key={formula.key} value={formula.key}>{lang === "fa" ? formula.fa : formula.en}</option>)}
          </select>
          <p className="mt-1 text-[10.5px] text-[var(--color-mute)]">
            {lang === "fa" ? FORMULAS.find((f) => f.key === calc.formula)?.hint : FORMULAS.find((f) => f.key === calc.formula)?.hintEn}
            {calc.formula === "katch" && !energy.usedKatch && (
              <b className="text-amber-400"> — {tx("درصد چربی وارد نشده؛ فعلاً از فرمول میفلین استفاده می‌شود.", "No body-fat %; Mifflin is used instead.")}</b>
            )}
          </p>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <SectionHead
          icon={<Calculator size={15} />}
          title={tx("نتیجه محاسبه انرژی و درشت‌مغذی‌ها", "Energy & macro calculation")}
          hint={tx("پس از تنظیم مشخصات و هدف، نتیجه را به‌عنوان اهداف برنامه اعمال کنید.", "Once metrics and goal are set, apply the result as the plan targets.")}
          action={
            <button type="button" onClick={applyTargets} className="press flex h-10 items-center gap-1.5 rounded-full bg-[#e9e400] px-4 text-[12px] font-black text-black">
              <Sparkles size={14} /> {tx("اعمال به اهداف برنامه", "Apply to plan targets")}
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: tx("متابولیسم پایه (BMR)", "BMR"), value: `${nf(energy.bmr)}`, unit: kcalUnit(lang) },
            { label: tx("کالری نگهداری (TDEE)", "Maintenance (TDEE)"), value: `${nf(energy.tdee)}`, unit: kcalUnit(lang) },
            { label: tx("کالری هدف", "Target calories"), value: `${nf(energy.target)}`, unit: `${kcalUnit(lang)} (${pctLabel > 0 ? "+" : ""}${pctLabel}%)`, accent: true },
            { label: tx("شاخص توده بدنی", "BMI"), value: nf(energy.bmi, 1), unit: bmi.text },
            { label: tx("توده بدون چربی", "Lean mass"), value: energy.lbm ? nf(energy.lbm, 1) : "—", unit: energy.lbm ? tx("کیلوگرم", "kg") : tx("نیازمند درصد چربی", "needs body fat %") },
            { label: tx("آب پیشنهادی", "Suggested water"), value: nf(energy.water / 1000, 1), unit: tx("لیتر در روز", "L per day") },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl p-3 ${stat.accent ? "bg-[#e9e400]/12 ring-1 ring-[#e9e400]/30" : "bg-[var(--color-bg)]"}`}>
              <span className="block text-[10.5px] font-bold text-[var(--color-mute)]">{stat.label}</span>
              <b className={`tnum mt-1 block text-[18px] font-black ${stat.accent ? "text-[#e9e400]" : ""}`}>{stat.value}</b>
              <span className="tnum block text-[10.5px] text-[var(--color-mute)]">{stat.unit}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Label>{tx("الگوی تقسیم درشت‌مغذی‌ها", "Macro preset")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {MACRO_PRESETS.map((preset) => (
                <Chip key={preset.key} on={calc.preset === preset.key} onClick={() => setCalc({ preset: preset.key, proteinPerKg: preset.proteinPerKg, fatPct: preset.fatPct })}>
                  {lang === "fa" ? preset.fa : preset.en}
                </Chip>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="flex items-center justify-between text-[12px] font-bold">
                  <span>{tx("پروتئین به ازای هر کیلوگرم وزن", "Protein per kg body weight")}</span>
                  <b className="tnum" style={{ color: MACRO_COLORS.p }}>{nf(calc.proteinPerKg, 1)} {tx("گرم", "g")} • {nf(energy.protein)} {gUnit(lang)}</b>
                </span>
                <input type="range" min={1.2} max={3.2} step={0.1} value={calc.proteinPerKg} onChange={(event) => setCalc({ proteinPerKg: Number(event.target.value), preset: "custom" })} className="mt-2 w-full accent-[#38bdf8]" />
              </label>
              <label className="block">
                <span className="flex items-center justify-between text-[12px] font-bold">
                  <span>{tx("سهم چربی از کالری", "Fat share of calories")}</span>
                  <b className="tnum" style={{ color: MACRO_COLORS.f }}>{nf(calc.fatPct)}% • {nf(energy.fat)} {gUnit(lang)}</b>
                </span>
                <input type="range" min={15} max={70} step={1} value={calc.fatPct} onChange={(event) => setCalc({ fatPct: Number(event.target.value), preset: "custom" })} className="mt-2 w-full accent-[#fb7185]" />
              </label>
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg)] px-3 py-2.5 text-[12px] font-bold">
                <span>{tx("کربوهیدرات (باقی‌مانده کالری)", "Carbs (remaining calories)")}</span>
                <b className="tnum" style={{ color: MACRO_COLORS.c }}>{nf(energy.carbs)} {gUnit(lang)} • {nf(energy.carbs / Math.max(1, calc.weight), 1)} {tx("گرم/کیلوگرم", "g/kg")}</b>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--color-bg)] p-4">
            <span className="mb-3 block text-[12px] font-black">{tx("سهم هر درشت‌مغذی از کالری هدف", "Calorie share by macro")}</span>
            <MacroSplit p={energy.protein} c={energy.carbs} f={energy.fat} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { key: "p" as const, value: energy.protein },
                { key: "c" as const, value: energy.carbs },
                { key: "f" as const, value: energy.fat },
              ].map((macro) => (
                <div key={macro.key} className="rounded-xl border border-[var(--color-line)] p-2.5">
                  <span className="block text-[10.5px] font-bold text-[var(--color-mute)]">{macroLabel(macro.key, lang)}</span>
                  <b className="tnum block text-[16px] font-black" style={{ color: MACRO_COLORS[macro.key] }}>{nf(macro.value)}</b>
                  <span className="text-[10px] text-[var(--color-mute)]">{gUnit(lang)}</span>
                </div>
              ))}
            </div>
            {energy.carbs < 60 && calc.preset !== "keto" && (
              <p className="mt-3 text-[11px] leading-6 text-amber-400">{tx("کربوهیدرات کمتر از 60 گرم است؛ برای تمرینات قدرتی و حجمی ممکن است کافی نباشد.", "Carbs are below 60 g; this may be too low for strength or hypertrophy training.")}</p>
            )}
            {calc.proteinPerKg > 2.8 && (
              <p className="mt-2 text-[11px] leading-6 text-amber-400">{tx("پروتئین بیش از 2.8 گرم به ازای هر کیلوگرم معمولاً مزیت اضافه‌ای ندارد.", "Protein above 2.8 g/kg rarely adds extra benefit.")}</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <SectionHead
          icon={<Sparkles size={15} />}
          title={tx("اهداف نهایی برنامه", "Final plan targets")}
          hint={tx("این مقادیر مبنای کنترل وعده‌ها هستند و در برنامه شاگرد نمایش داده می‌شوند. در صورت نیاز می‌توانید به‌صورت دستی تغییرشان دهید.", "These targets drive meal checks and are shown to the athlete. You can fine-tune them manually.")}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div><Label>{tx("کالری روزانه", "Daily calories")}</Label><NumInput value={plan.targetKcal || 0} onChange={(v) => update((p) => ({ ...p, targetKcal: v }))} step={10} max={8000} ariaLabel={tx("کالری روزانه", "Daily calories")} /></div>
          <div><Label>{tx("پروتئین (گرم)", "Protein (g)")}</Label><NumInput value={plan.targetP || 0} onChange={(v) => update((p) => ({ ...p, targetP: v }))} max={600} ariaLabel={tx("پروتئین", "Protein")} /></div>
          <div><Label>{tx("کربوهیدرات (گرم)", "Carbs (g)")}</Label><NumInput value={plan.targetC || 0} onChange={(v) => update((p) => ({ ...p, targetC: v }))} max={1000} ariaLabel={tx("کربوهیدرات", "Carbs")} /></div>
          <div><Label>{tx("چربی (گرم)", "Fat (g)")}</Label><NumInput value={plan.targetF || 0} onChange={(v) => update((p) => ({ ...p, targetF: v }))} max={400} ariaLabel={tx("چربی", "Fat")} /></div>
          <div><Label>{tx("فیبر (گرم)", "Fiber (g)")}</Label><NumInput value={plan.targetFiber || 0} onChange={(v) => update((p) => ({ ...p, targetFiber: v }))} max={120} ariaLabel={tx("فیبر", "Fiber")} /></div>
          <div><Label>{tx("آب (میلی‌لیتر)", "Water (ml)")}</Label><NumInput value={plan.waterGoal || 0} onChange={(v) => update((p) => ({ ...p, waterGoal: v }))} step={250} max={8000} ariaLabel={tx("آب", "Water")} /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] px-3 py-2.5 text-[11.5px]">
          <span className="tnum text-[var(--color-mute)]">
            {tx("کالری حاصل از درشت‌مغذی‌ها", "Calories from macros")}: <b className="text-[var(--color-ink)]">{nf(macroKcal)}</b> {kcalUnit(lang)}
          </span>
          {Math.abs(macroKcal - (plan.targetKcal || 0)) > 60 && (
            <button type="button" onClick={() => update((p) => ({ ...p, targetKcal: macroKcal }))} className="font-black text-[#e9e400]">
              {tx("هم‌سان‌سازی کالری با درشت‌مغذی‌ها", "Match calories to macros")}
            </button>
          )}
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <SectionHead
          icon={<ClipboardList size={15} />}
          title={tx("پرونده تغذیه‌ای", "Nutrition file")}
          hint={tx("این اطلاعات فقط برای مربی است و در برنامه شاگرد یا نسخه چاپی نمایش داده نمی‌شود.", "Private coach notes; not shown to the athlete or in print.")}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <Label>{tx("حساسیت‌ها و عدم تحمل‌ها", "Allergies & intolerances")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGY_OPTIONS.map((item) => (
                <Chip key={item.fa} on={plan.profile.allergies.includes(item.fa)} onClick={() => setProfile({ allergies: toggleIn(plan.profile.allergies, item.fa) })}>
                  {lang === "fa" ? item.fa : item.en}
                </Chip>
              ))}
            </div>
            <Label><span className="mt-3 block">{tx("شرایط و محدودیت‌های رژیمی", "Dietary conditions")}</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {RESTRICTION_OPTIONS.map((item) => (
                <Chip key={item.fa} on={plan.profile.restrictions.includes(item.fa)} onClick={() => setProfile({ restrictions: toggleIn(plan.profile.restrictions, item.fa) })}>
                  {lang === "fa" ? item.fa : item.en}
                </Chip>
              ))}
            </div>
            <div className="mt-3">
              <Label>{tx("غذاهای نامطلوب یا ممنوع", "Disliked or excluded foods")}</Label>
              <input value={plan.profile.dislikes} onChange={(event) => setProfile({ dislikes: event.target.value })} className={fieldCls} placeholder={tx("مثلاً ماهی، بادمجان", "e.g. fish, eggplant")} />
            </div>
          </div>
          <div>
            <Label>{tx("سوابق پزشکی، داروها و آزمایش‌ها", "Medical history, medication & tests")}</Label>
            <textarea value={plan.profile.medical} onChange={(event) => setProfile({ medical: event.target.value })} rows={3} className={areaCls} placeholder={tx("مثلاً کم‌کاری تیروئید، مصرف متفورمین", "e.g. hypothyroidism, metformin")} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["wake", tx("بیداری", "Wake up")],
                ["training", tx("تمرین", "Training")],
                ["sleep", tx("خواب", "Sleep")],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <Label>{label}</Label>
                  <TimeField value={plan.profile[key]} onChange={(time) => setProfile({ [key]: time } as Partial<NutriProfile>)} ariaLabel={label} className="h-10 w-full" />
                </label>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <Label>{tx("سطح هزینه مواد غذایی", "Food budget")}</Label>
                <select value={plan.profile.budget} onChange={(event) => setProfile({ budget: event.target.value as NutriProfile["budget"] })} className={fieldCls}>
                  <option value="economy">{tx("اقتصادی", "Economy")}</option>
                  <option value="standard">{tx("متوسط", "Standard")}</option>
                  <option value="premium">{tx("بدون محدودیت", "Premium")}</option>
                </select>
              </div>
              <div>
                <Label>{tx("تعداد وعده‌های روزانه", "Meals per day")}</Label>
                <select
                  value={plan.profile.mealsPerDay}
                  onChange={(event) => {
                    const count = Number(event.target.value);
                    update((p) => ({ ...p, profile: { ...p.profile, mealsPerDay: count }, ...(hasItems ? {} : { meals: defaultSlots(count) }) }));
                  }}
                  className={fieldCls}
                >
                  {[3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{tx(`${count} وعده`, `${count} meals`)}</option>)}
                </select>
                {hasItems && <p className="mt-1 text-[10.5px] text-[var(--color-mute)]">{tx("چون غذا ثبت شده، ساختار وعده‌ها تغییر نمی‌کند.", "Meals already have foods, so the structure is kept.")}</p>}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =================================================================== */
/*  Meals builder                                                       */
/* =================================================================== */

type PickerState = { mode: "add" | "edit" | "alt"; slotId: string; itemUid?: string };

function scaleItem(item: NutriItem, ratio: number): NutriItem {
  const macros = {
    kcal: item.macros.kcal * ratio,
    p: item.macros.p * ratio,
    c: item.macros.c * ratio,
    f: item.macros.f * ratio,
    fiber: item.macros.fiber * ratio,
  };
  return { ...item, amount: round1(item.amount * ratio * 100) / 100, grams: round1(item.grams * ratio), macros };
}

function MealsSection({ plan, update, coachId, ask, onToast }: { plan: ProPlan; update: Update; coachId: string; ask: Ask; onToast: (t: string, d: string) => void }) {
  const { data } = useStore();
  const { tx, lang } = useTx();
  const [dayId, setDayId] = useState(plan.days[0]?.id ?? "");
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [openAlts, setOpenAlts] = useState<Record<string, boolean>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const day = plan.days.find((item) => item.id === dayId) ?? plan.days[0];

  useEffect(() => {
    if (!plan.days.some((item) => item.id === dayId)) setDayId(plan.days[0]?.id ?? "");
  }, [plan.days, dayId]);

  if (!day) return null;
  const totals = dayTotals(plan, day);
  const targets = dayTargets(plan, day);
  const shortNames = lang === "fa" ? WEEKDAY_SHORT_FA : WEEKDAY_SHORT_EN;
  const fullNames = lang === "fa" ? WEEKDAY_FA : WEEKDAY_EN;
  const assigned = new Set(plan.days.flatMap((item) => item.weekdays));
  const unassigned = [0, 1, 2, 3, 4, 5, 6].filter((index) => !assigned.has(index));

  const setDay = (recipe: (current: NutriDay) => NutriDay) => update((p) => ({ ...p, days: p.days.map((item) => (item.id === day.id ? recipe(item) : item)) }));
  const setItems = (slotId: string, recipe: (items: NutriItem[]) => NutriItem[]) =>
    setDay((current) => ({ ...current, items: { ...current.items, [slotId]: recipe(current.items[slotId] ?? []) } }));
  const setSlot = (slotId: string, patch: Partial<NutriSlot>) => update((p) => ({ ...p, meals: p.meals.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)) }));

  const moveSlot = (slotId: string, direction: -1 | 1) =>
    update((p) => {
      const index = p.meals.findIndex((slot) => slot.id === slotId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= p.meals.length) return p;
      const meals = [...p.meals];
      [meals[index], meals[target]] = [meals[target], meals[index]];
      return { ...p, meals };
    });

  const addSlot = (preset?: { fa: string; en: string; time: string }) => {
    if (plan.meals.length >= 10) {
      onToast(tx("حداکثر 10 وعده", "Up to 10 meals"), tx("برای خوانایی برنامه، بیش از 10 وعده در روز مجاز نیست.", "For clarity, a day can have at most 10 meals."));
      return;
    }
    const slot: NutriSlot = { id: uid("slot"), slot: preset ? (lang === "fa" ? preset.fa : preset.en) : tx("وعده جدید", "New meal"), time: preset?.time ?? "", note: "", items: [] };
    update((p) => {
      const meals = [...p.meals];
      const at = slot.time ? meals.findIndex((item) => (item.time || "99") > slot.time!) : -1;
      if (at < 0) meals.push(slot);
      else meals.splice(at, 0, slot);
      return { ...p, meals };
    });
    setPresetsOpen(false);
  };

  const removeSlot = async (slot: NutriSlot) => {
    const used = plan.days.some((item) => (item.items[slot.id] ?? []).length > 0);
    if (used) {
      const ok = await ask({
        title: tx("حذف وعده", "Delete meal"),
        body: tx(`وعده «${slot.slot}» و غذاهای آن از همه روزهای برنامه حذف می‌شود.`, `“${slot.slot}” and its foods will be removed from every day.`),
        confirm: tx("حذف وعده", "Delete meal"),
        danger: true,
      });
      if (!ok) return;
    }
    update((p) => ({
      ...p,
      meals: p.meals.filter((item) => item.id !== slot.id),
      days: p.days.map((item) => {
        const items = { ...item.items };
        delete items[slot.id];
        return { ...item, items };
      }),
    }));
  };

  const copySlotTo = (slotId: string, targetDayId: string) => {
    const source = day.items[slotId] ?? [];
    update((p) => ({
      ...p,
      days: p.days.map((item) =>
        item.id === targetDayId ? { ...item, items: { ...item.items, [slotId]: source.map((entry) => ({ ...structuredClone(entry), uid: uid("ni") })) } } : item,
      ),
    }));
    const target = plan.days.find((item) => item.id === targetDayId);
    onToast(tx("وعده کپی شد", "Meal copied"), tx(`به «${target?.name ?? ""}» منتقل شد.`, `Copied to “${target?.name ?? ""}”.`));
  };

  const toggleWeekday = (weekday: number) => {
    const adding = !day.weekdays.includes(weekday);
    update((p) => ({
      ...p,
      days: p.days.map((item) => {
        if (item.id === day.id) {
          return { ...item, weekdays: adding ? [...item.weekdays, weekday].sort((a, b) => a - b) : item.weekdays.filter((value) => value !== weekday) };
        }
        return adding ? { ...item, weekdays: item.weekdays.filter((value) => value !== weekday) } : item;
      }),
    }));
  };

  const duplicateDay = () => {
    const copy: NutriDay = {
      ...structuredClone(day),
      id: uid("day"),
      name: `${day.name} — ${tx("کپی", "copy")}`,
      weekdays: [],
      items: Object.fromEntries(Object.entries(day.items).map(([slotId, list]) => [slotId, list.map((entry) => ({ ...structuredClone(entry), uid: uid("ni") }))])),
    };
    update((p) => ({ ...p, days: [...p.days, copy] }));
    setDayId(copy.id);
  };

  const removeDay = async () => {
    if (plan.days.length <= 1) return;
    const ok = await ask({
      title: tx("حذف روز", "Delete day"),
      body: tx(`«${day.name}» و همه غذاهای آن حذف می‌شود. روزهای هفته این روز به روز اول برنامه منتقل خواهند شد.`, `“${day.name}” and its foods will be deleted; its weekdays will follow the first day.`),
      confirm: tx("حذف روز", "Delete day"),
      danger: true,
    });
    if (!ok) return;
    update((p) => ({ ...p, days: p.days.filter((item) => item.id !== day.id) }));
  };

  const reduceCarbs = () =>
    setDay((current) => {
      const base = current.targets ?? planTargets(plan);
      const carbs = Math.round(base.c * 0.75);
      return { ...current, targets: { ...base, c: carbs, kcal: Math.round(base.kcal - (base.c - carbs) * 4) } };
    });

  const setTarget = (key: keyof Targets, value: number) => setDay((current) => ({ ...current, targets: { ...(current.targets ?? planTargets(plan)), [key]: value } }));

  const changeAmount = (slotId: string, item: NutriItem, amount: number) => {
    const food = findFood(item.foodId, data);
    setItems(slotId, (items) =>
      items.map((entry) =>
        entry.uid !== item.uid ? entry : food ? makeItem(food, amount, entry.unit, entry.note, entry.uid, entry.alternatives) : entry.amount ? scaleItem(entry, amount / entry.amount) : entry,
      ),
    );
  };

  const changeUnit = (slotId: string, item: NutriItem, unit: UnitKey) => {
    const food = findFood(item.foodId, data);
    if (!food) return;
    const target = unitFor(food, unit).grams || 1;
    const step = unit === "g" || unit === "ml" ? 5 : 0.5;
    const amount = Math.max(step, Math.round(item.grams / target / step) * step);
    setItems(slotId, (items) => items.map((entry) => (entry.uid === item.uid ? makeItem(food, amount, unit, entry.note, entry.uid, entry.alternatives) : entry)));
  };

  const onPick = (result: PickResult) => {
    if (!picker) return;
    const { mode, slotId, itemUid } = picker;
    if (mode === "add") setItems(slotId, (items) => [...items, makeItem(result.food, result.amount, result.unit, result.note)]);
    if (mode === "edit") setItems(slotId, (items) => items.map((entry) => (entry.uid === itemUid ? makeItem(result.food, result.amount, result.unit, result.note, entry.uid, entry.alternatives) : entry)));
    if (mode === "alt") {
      setItems(slotId, (items) => items.map((entry) => (entry.uid === itemUid ? { ...entry, alternatives: [...(entry.alternatives ?? []), makeAlt(result.food, result.amount, result.unit)] } : entry)));
      if (itemUid) setOpenAlts((current) => ({ ...current, [itemUid]: true }));
    }
    setPicker(null);
  };

  const pickerItem = picker?.itemUid ? (day.items[picker.slotId] ?? []).find((entry) => entry.uid === picker.itemUid) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="noscroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          {plan.days.map((item) => {
            const active = item.id === day.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDayId(item.id)}
                className={`press flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-start transition ${
                  active ? "border-transparent bg-[#e9e400] text-black" : "border-[var(--color-line)] bg-[var(--color-card)] hover:border-[#e9e400]/40"
                }`}
              >
                {item.kind === "training" ? <Dumbbell size={15} /> : item.kind === "rest" ? <Moon size={15} /> : <CalendarDays size={15} />}
                <span>
                  <b className="block text-[12.5px] leading-5">{item.name}</b>
                  <span className={`tnum block text-[10px] ${active ? "text-black/70" : "text-[var(--color-mute)]"}`}>
                    {item.weekdays.length === 7 ? tx("همه روزها", "Every day") : item.weekdays.length ? item.weekdays.map((index) => shortNames[index]).join(" ") : tx("بدون روز", "No days")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setAddDayOpen(true)} className="press flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-[#e9e400]/50 px-3.5 text-[12px] font-black text-[#e9e400]">
          <Plus size={15} /> {tx("روز جدید", "New day")}
        </button>
      </div>

      <Card className="!p-3.5">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input value={day.name} onChange={(event) => setDay((current) => ({ ...current, name: event.target.value }))} className={fieldCls} aria-label={tx("نام روز", "Day name")} />
          <select value={day.kind} onChange={(event) => setDay((current) => ({ ...current, kind: event.target.value as DayKind }))} className={fieldCls} aria-label={tx("نوع روز", "Day type")}>
            {(["training", "rest", "custom"] as DayKind[]).map((kind) => <option key={kind} value={kind}>{dayKindLabel(kind, lang)}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <IconBtn label={tx("تکثیر این روز", "Duplicate day")} onClick={duplicateDay}><Copy size={14} /></IconBtn>
            {plan.days.length > 1 && <IconBtn label={tx("حذف این روز", "Delete day")} onClick={removeDay} danger><Trash2 size={14} /></IconBtn>}
          </div>
        </div>
        <div className="mt-3">
          <Label>{tx("روزهای هفته که از این برنامه پیروی می‌کنند", "Weekdays that follow this day")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => {
              const on = day.weekdays.includes(index);
              const elsewhere = !on && assigned.has(index);
              return (
                <button
                  key={index}
                  type="button"
                  title={fullNames[index]}
                  onClick={() => toggleWeekday(index)}
                  aria-pressed={on}
                  className={`press h-9 min-w-9 rounded-xl border px-2.5 text-[12px] font-black transition ${
                    on ? "border-transparent bg-[#e9e400] text-black" : elsewhere ? "border-[var(--color-line)] text-[var(--color-mute)] opacity-60" : "border-[var(--color-line)] text-[var(--color-ink)]"
                  }`}
                >
                  {shortNames[index]}
                </button>
              );
            })}
          </div>
          {plan.days.length > 1 && unassigned.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-400">
              {tx(`${unassigned.map((index) => WEEKDAY_FA[index]).join("، ")} به روزی تخصیص داده نشده و از «${plan.days[0].name}» پیروی می‌کند.`,
                `${unassigned.map((index) => WEEKDAY_EN[index]).join(", ")} ${unassigned.length > 1 ? "are" : "is"} unassigned and will follow “${plan.days[0].name}”.`)}
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--color-bg)] px-3 py-2.5">
          <span className="min-w-0">
            <b className="text-[12.5px]">{tx("اهداف اختصاصی این روز", "Day-specific targets")}</b>
            <span className="block text-[11px] leading-6 text-[var(--color-mute)]">{tx("برای چرخه کربوهیدرات یا روزهای استراحت، کالری و درشت‌مغذی این روز را جداگانه تعیین کنید.", "Use separate calories and macros for carb cycling or rest days.")}</span>
          </span>
          <Toggle on={!!day.targets} onClick={() => setDay((current) => ({ ...current, targets: current.targets ? null : { ...planTargets(plan) } }))} />
        </div>
        {day.targets && (
          <div className="nutri-pop mt-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div><Label>{tx("کالری", "Calories")}</Label><NumInput compact value={day.targets.kcal} onChange={(v) => setTarget("kcal", v)} step={10} max={8000} ariaLabel={tx("کالری", "Calories")} /></div>
              <div><Label>{tx("پروتئین", "Protein")}</Label><NumInput compact value={day.targets.p} onChange={(v) => setTarget("p", v)} max={600} ariaLabel={tx("پروتئین", "Protein")} /></div>
              <div><Label>{tx("کربوهیدرات", "Carbs")}</Label><NumInput compact value={day.targets.c} onChange={(v) => setTarget("c", v)} max={1000} ariaLabel={tx("کربوهیدرات", "Carbs")} /></div>
              <div><Label>{tx("چربی", "Fat")}</Label><NumInput compact value={day.targets.f} onChange={(v) => setTarget("f", v)} max={400} ariaLabel={tx("چربی", "Fat")} /></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip onClick={reduceCarbs}>{tx("کاهش 25 درصدی کربوهیدرات", "Cut carbs by 25%")}</Chip>
              <Chip onClick={() => setDay((current) => ({ ...current, targets: { ...planTargets(plan) } }))}>{tx("بازگشت به اهداف کلی برنامه", "Reset to plan targets")}</Chip>
            </div>
          </div>
        )}
      </Card>

      <Card className="!p-3.5 lg:sticky lg:top-0 lg:z-20">
        <div className="flex flex-wrap items-center gap-4">
          <KcalRing value={totals.kcal} target={targets.kcal} size={96} />
          <div className="grid min-w-[220px] flex-1 gap-2.5 sm:grid-cols-2">
            <MacroBar label={macroLabel("p", lang)} value={totals.p} target={targets.p} color={MACRO_COLORS.p} unit={gUnit(lang)} />
            <MacroBar label={macroLabel("c", lang)} value={totals.c} target={targets.c} color={MACRO_COLORS.c} unit={gUnit(lang)} />
            <MacroBar label={macroLabel("f", lang)} value={totals.f} target={targets.f} color={MACRO_COLORS.f} unit={gUnit(lang)} />
            <MacroBar label={macroLabel("fiber", lang)} value={totals.fiber} target={plan.targetFiber || 0} color={MACRO_COLORS.fiber} unit={gUnit(lang)} />
          </div>
        </div>
      </Card>

      {plan.meals.map((slot, index) => {
        const items = day.items[slot.id] ?? [];
        const sum = sumMacros(items);
        const otherDays = plan.days.filter((item) => item.id !== day.id);
        return (
          <Card key={slot.id} className="!p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9e400]/12 text-[#e9e400]">{slotIcon(slot.slot)}</span>
              <input value={slot.slot} onChange={(event) => setSlot(slot.id, { slot: event.target.value })} aria-label={tx("نام وعده", "Meal name")} className="min-w-[110px] flex-1 rounded-lg bg-transparent text-[14px] font-black outline-none focus:bg-[var(--color-bg)] focus:px-2" />
              <TimeField value={slot.time ?? ""} onChange={(time) => setSlot(slot.id, { time })} ariaLabel={tx("ساعت وعده", "Meal time")} className="h-9 w-[96px]" />
              <div className="flex items-center gap-1">
                <IconBtn label={tx("انتقال به بالا", "Move up")} onClick={() => moveSlot(slot.id, -1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn label={tx("انتقال به پایین", "Move down")} onClick={() => moveSlot(slot.id, 1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn label={tx("توضیح وعده", "Meal note")} onClick={() => setOpenNotes((current) => ({ ...current, [slot.id]: !current[slot.id] }))} active={!!slot.note || !!openNotes[slot.id]}><StickyNote size={14} /></IconBtn>
                <IconBtn label={tx("حذف وعده", "Delete meal")} onClick={() => removeSlot(slot)} danger><Trash2 size={14} /></IconBtn>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 ps-11">
              <MacroInline kcal={sum.kcal} p={sum.p} c={sum.c} f={sum.f} />
              {index === 0 && !items.length && plan.meals.every((meal) => !(day.items[meal.id] ?? []).length) && (
                <span className="text-[10.5px] text-[var(--color-mute)]">{tx("با «افزودن غذا» شروع کنید.", "Start with “Add food”.")}</span>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {items.map((item) => {
                const food = findFood(item.foodId, data);
                const altsOpen = !!openAlts[item.uid];
                return (
                  <div key={item.uid} className="nutri-pop rounded-xl bg-[var(--color-bg)] p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setPicker({ mode: "edit", slotId: slot.id, itemUid: item.uid })} className="min-w-[140px] flex-1 text-start">
                        <b className="block truncate text-[12.5px]">{itemName(item, lang)}</b>
                        <MacroInline kcal={item.macros.kcal} p={item.macros.p} c={item.macros.c} f={item.macros.f} />
                      </button>
                      <NumInput compact value={item.amount} onChange={(amount) => changeAmount(slot.id, item, amount)} step={item.unit === "g" || item.unit === "ml" ? 5 : 0.5} min={0} max={5000} className="w-[76px]" ariaLabel={tx("مقدار", "Amount")} />
                      {food ? (
                        <select value={item.unit} onChange={(event) => changeUnit(slot.id, item, event.target.value as UnitKey)} aria-label={tx("واحد", "Unit")} className="h-9 w-[150px] rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-2 text-[11.5px] font-bold outline-none focus:border-[#e9e400]/50">
                          {food.units.map((unit) => <option key={unit.key} value={unit.key}>{unitOptionLabel(food, unit.key, lang)}</option>)}
                        </select>
                      ) : (
                        <span className="text-[11.5px] font-bold text-[var(--color-mute)]">{formatPortion(item, lang)}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <IconBtn label={tx("غذاهای جایگزین", "Swaps")} onClick={() => setOpenAlts((current) => ({ ...current, [item.uid]: !current[item.uid] }))} active={altsOpen} badge={item.alternatives?.length}><Repeat size={14} /></IconBtn>
                        <IconBtn label={tx("ویرایش", "Edit")} onClick={() => setPicker({ mode: "edit", slotId: slot.id, itemUid: item.uid })}><Pencil size={14} /></IconBtn>
                        <IconBtn label={tx("حذف", "Remove")} onClick={() => setItems(slot.id, (list) => list.filter((entry) => entry.uid !== item.uid))} danger><Trash2 size={14} /></IconBtn>
                      </div>
                    </div>
                    {item.note && <p className="mt-1 text-[11px] text-[var(--color-mute)]">{item.note}</p>}
                    {altsOpen && (
                      <div className="nutri-pop mt-2 space-y-1.5 border-t border-dashed border-[var(--color-line)] pt-2">
                        <p className="text-[11px] font-bold text-[var(--color-mute)]">{tx("جایگزین‌های هم‌ارز؛ شاگرد می‌تواند یکی از این‌ها را به‌جای غذای اصلی مصرف کند.", "Equivalent swaps the athlete may use instead.")}</p>
                        {(item.alternatives ?? []).map((alt, altIndex) => (
                          <div key={`${alt.foodId}-${altIndex}`} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-card)] px-2.5 py-1.5 text-[11.5px]">
                            <span className="min-w-0 truncate"><Repeat size={12} className="me-1 inline text-[#e9e400]" />{itemName(alt, lang)} — <span className="text-[var(--color-mute)]">{formatPortion(alt, lang)}</span></span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="tnum text-[10.5px] text-[var(--color-mute)]">{nf(alt.macros.kcal)} {kcalUnit(lang)}</span>
                              <button type="button" aria-label={tx("حذف جایگزین", "Remove swap")} onClick={() => setItems(slot.id, (list) => list.map((entry) => (entry.uid === item.uid ? { ...entry, alternatives: (entry.alternatives ?? []).filter((_, i) => i !== altIndex) } : entry)))} className="text-[var(--color-mute)] hover:text-red-400">
                                <Trash2 size={13} />
                              </button>
                            </span>
                          </div>
                        ))}
                        <button type="button" onClick={() => setPicker({ mode: "alt", slotId: slot.id, itemUid: item.uid })} className="press flex items-center gap-1 text-[11.5px] font-black text-[#e9e400]">
                          <Plus size={13} /> {tx("افزودن جایگزین هم‌کالری", "Add equal-calorie swap")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!items.length && (
                <p className="rounded-xl border border-dashed border-[var(--color-line)] p-4 text-center text-[11.5px] text-[var(--color-mute)]">
                  {tx("هنوز غذایی به این وعده در این روز اضافه نشده است.", "No foods in this meal for this day yet.")}
                </p>
              )}
            </div>

            {(openNotes[slot.id] || slot.note) && (
              <textarea
                value={slot.note ?? ""}
                onChange={(event) => setSlot(slot.id, { note: event.target.value })}
                rows={2}
                className={`${areaCls} mt-2`}
                placeholder={tx("توضیح وعده برای شاگرد؛ مثلاً 30 دقیقه قبل از تمرین میل شود.", "Meal note for the athlete, e.g. eat 30 minutes before training.")}
              />
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPicker({ mode: "add", slotId: slot.id })} className="press flex h-9 items-center gap-1.5 rounded-full bg-[#e9e400] px-4 text-[12px] font-black text-black">
                <Plus size={14} /> {tx("افزودن غذا", "Add food")}
              </button>
              {otherDays.length > 0 && items.length > 0 && (
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) copySlotTo(slot.id, event.target.value);
                  }}
                  aria-label={tx("کپی وعده به روز دیگر", "Copy meal to another day")}
                  className="h-9 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-3 text-[11.5px] font-bold outline-none"
                >
                  <option value="">{tx("کپی این وعده به…", "Copy this meal to…")}</option>
                  {otherDays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              )}
            </div>
          </Card>
        );
      })}

      <div className="rounded-2xl border border-dashed border-[var(--color-line)] p-3">
        {presetsOpen ? (
          <div className="nutri-pop">
            <p className="mb-2 text-[11.5px] font-bold text-[var(--color-mute)]">{tx("نوع وعده را انتخاب کنید:", "Choose a meal type:")}</p>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_PRESETS.map((preset) => (
                <Chip key={preset.fa} onClick={() => addSlot(preset)} disabled={plan.meals.some((slot) => slot.slot === preset.fa || slot.slot === preset.en)}>
                  {lang === "fa" ? preset.fa : preset.en} <span className="tnum opacity-60" dir="ltr">{preset.time}</span>
                </Chip>
              ))}
              <Chip onClick={() => addSlot()}>{tx("وعده دلخواه", "Custom meal")}</Chip>
              <Chip onClick={() => setPresetsOpen(false)}>{tx("انصراف", "Cancel")}</Chip>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setPresetsOpen(true)} className="press flex w-full items-center justify-center gap-1.5 py-1.5 text-[12.5px] font-black text-[#e9e400]">
            <Plus size={15} /> {tx("افزودن وعده", "Add meal")}
          </button>
        )}
      </div>

      {picker && (
        <FoodPicker
          coachId={coachId}
          title={picker.mode === "alt" ? tx("افزودن غذای جایگزین", "Add a swap") : picker.mode === "edit" ? tx("ویرایش غذا", "Edit food") : tx("افزودن غذا به وعده", "Add food to meal")}
          confirmLabel={picker.mode === "alt" ? tx("افزودن به جایگزین‌ها", "Add swap") : picker.mode === "edit" ? tx("ذخیره تغییرات", "Save changes") : undefined}
          allowNote={picker.mode !== "alt"}
          equivalentTo={picker.mode === "alt" ? pickerItem?.macros : null}
          initial={picker.mode === "edit" && pickerItem ? { foodId: pickerItem.foodId, amount: pickerItem.amount, unit: pickerItem.unit, note: pickerItem.note } : null}
          onClose={() => setPicker(null)}
          onPick={onPick}
        />
      )}

      {addDayOpen && (
        <AddDayDialog
          plan={plan}
          current={day}
          onClose={() => setAddDayOpen(false)}
          onCreate={(created) => {
            update((p) => ({
              ...p,
              days: [...p.days.map((item) => ({ ...item, weekdays: item.weekdays.filter((value) => !created.weekdays.includes(value)) })), created],
            }));
            setDayId(created.id);
            setAddDayOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddDayDialog({ plan, current, onClose, onCreate }: { plan: ProPlan; current: NutriDay; onClose: () => void; onCreate: (day: NutriDay) => void }) {
  const { tx, lang } = useTx();
  const [kind, setKind] = useState<DayKind>("rest");
  const [name, setName] = useState(dayKindLabel("rest", lang));
  const [copy, setCopy] = useState(true);
  const [lowerCarbs, setLowerCarbs] = useState(true);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const shortNames = lang === "fa" ? WEEKDAY_SHORT_FA : WEEKDAY_SHORT_EN;

  const create = () => {
    const day = blankDay(name.trim() || dayKindLabel(kind, lang), kind, [...weekdays].sort((a, b) => a - b));
    if (copy) {
      day.items = Object.fromEntries(Object.entries(current.items).map(([slotId, list]) => [slotId, list.map((entry) => ({ ...structuredClone(entry), uid: uid("ni") }))]));
    }
    if (kind === "rest" && lowerCarbs) {
      const base = current.targets ?? planTargets(plan);
      const carbs = Math.round(base.c * 0.75);
      day.targets = { ...base, c: carbs, kcal: Math.round(base.kcal - (base.c - carbs) * 4) };
    }
    onCreate(day);
  };

  return (
    <Modal open onClose={onClose} title={tx("افزودن روز جدید", "Add a new day")}>
      <div className="space-y-3">
        <div>
          <Label>{tx("نوع روز", "Day type")}</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["training", "rest", "custom"] as DayKind[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setKind(item);
                  setName(dayKindLabel(item, lang));
                }}
                className={`press h-10 rounded-xl border text-[12px] font-black ${kind === item ? "border-transparent bg-[#e9e400] text-black" : "border-[var(--color-line)]"}`}
              >
                {dayKindLabel(item, lang)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>{tx("نام روز", "Day name")}</Label>
          <input value={name} onChange={(event) => setName(event.target.value)} className={fieldCls} />
        </div>
        <div>
          <Label>{tx("روزهای هفته", "Weekdays")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => setWeekdays((list) => (list.includes(index) ? list.filter((value) => value !== index) : [...list, index]))}
                className={`press h-9 min-w-9 rounded-xl border px-2.5 text-[12px] font-black ${weekdays.includes(index) ? "border-transparent bg-[#e9e400] text-black" : "border-[var(--color-line)]"}`}
              >
                {shortNames[index]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10.5px] text-[var(--color-mute)]">{tx("روزهای انتخاب‌شده از روزهای دیگر برنامه جدا می‌شوند.", "Selected weekdays are moved from other days.")}</p>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-bg)] px-3 py-2.5">
          <span className="text-[12px] font-bold">{tx(`کپی غذاها از «${current.name}»`, `Copy foods from “${current.name}”`)}</span>
          <Toggle on={copy} onClick={() => setCopy((value) => !value)} />
        </label>
        {kind === "rest" && (
          <label className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-bg)] px-3 py-2.5">
            <span className="text-[12px] font-bold">{tx("کاهش 25 درصدی کربوهیدرات در هدف این روز", "Lower this day's carb target by 25%")}</span>
            <Toggle on={lowerCarbs} onClick={() => setLowerCarbs((value) => !value)} />
          </label>
        )}
        <button type="button" onClick={create} className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#e9e400] text-[13px] font-black text-black">
          <Plus size={15} /> {tx("ساخت روز", "Create day")}
        </button>
      </div>
    </Modal>
  );
}

/* =================================================================== */
/*  Supplements                                                         */
/* =================================================================== */

function SupplementsSection({ plan, update }: { plan: ProPlan; update: Update }) {
  const { tx, lang } = useTx();
  const set = (id: string, patch: Partial<ProPlan["supplements"][number]>) =>
    update((p) => ({ ...p, supplements: p.supplements.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  const add = (name = "", dose = "", timing = "") => update((p) => ({ ...p, supplements: [...p.supplements, { id: uid("sup"), name, dose, timing, note: "" }] }));
  return (
    <Card>
      <SectionHead
        icon={<PillIcon size={15} />}
        title={tx("مکمل‌های ورزشی و ویتامین‌ها", "Supplements & vitamins")}
        hint={tx("نام مکمل، مقدار مصرف و زمان آن را مشخص کنید. این فهرست در برنامه شاگرد نمایش داده می‌شود.", "Set each supplement, its dose and timing. This list is shown to the athlete.")}
      />
      <div className="flex flex-wrap gap-1.5">
        {SUPPLEMENT_SUGGESTIONS.map((item) => {
          const name = lang === "fa" ? item.fa : item.en;
          return (
            <Chip key={item.fa} onClick={() => add(name, item.dose, item.timing)} disabled={plan.supplements.some((sup) => sup.name === item.fa || sup.name === item.en)}>
              <Plus size={12} /> {name}
            </Chip>
          );
        })}
      </div>
      <datalist id="nutri-timings">{SUPPLEMENT_TIMINGS.map((item) => <option key={item.fa} value={lang === "fa" ? item.fa : item.en} />)}</datalist>
      <div className="mt-4 space-y-2">
        {!plan.supplements.length && (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-center text-[12px] text-[var(--color-mute)]">
            {tx("مکملی ثبت نشده است. از پیشنهادهای بالا انتخاب کنید یا مکمل دلخواه اضافه کنید.", "No supplements yet. Pick a suggestion above or add your own.")}
          </p>
        )}
        {plan.supplements.map((item) => (
          <div key={item.id} className="nutri-pop grid gap-2 rounded-xl bg-[var(--color-bg)] p-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
            <input value={item.name} onChange={(event) => set(item.id, { name: event.target.value })} placeholder={tx("نام مکمل", "Supplement")} className={fieldCls} aria-label={tx("نام مکمل", "Supplement")} />
            <input value={item.dose} onChange={(event) => set(item.id, { dose: event.target.value })} placeholder={tx("مقدار مصرف", "Dose")} className={fieldCls} aria-label={tx("مقدار مصرف", "Dose")} />
            <input value={item.timing} list="nutri-timings" onChange={(event) => set(item.id, { timing: event.target.value })} placeholder={tx("زمان مصرف", "Timing")} className={fieldCls} aria-label={tx("زمان مصرف", "Timing")} />
            <input value={item.note} onChange={(event) => set(item.id, { note: event.target.value })} placeholder={tx("توضیحات (اختیاری)", "Notes (optional)")} className={fieldCls} aria-label={tx("توضیحات", "Notes")} />
            <div className="flex items-center justify-end">
              <IconBtn label={tx("حذف مکمل", "Remove supplement")} onClick={() => update((p) => ({ ...p, supplements: p.supplements.filter((sup) => sup.id !== item.id) }))} danger><Trash2 size={14} /></IconBtn>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => add()} className="press mt-3 flex h-10 items-center gap-1.5 rounded-full border border-dashed border-[#e9e400]/50 px-4 text-[12px] font-black text-[#e9e400]">
        <Plus size={14} /> {tx("افزودن مکمل دلخواه", "Add custom supplement")}
      </button>
    </Card>
  );
}

/* =================================================================== */
/*  Guidance & schedule                                                 */
/* =================================================================== */

function GuideSection({ plan, update }: { plan: ProPlan; update: Update }) {
  const { tx, lang } = useTx();
  const weeks = Math.max(1, Math.round((new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / (7 * 864e5)));
  const lines = plan.guidelines.split("\n").map((line) => line.trim()).filter(Boolean);
  const setStart = (value: string) => {
    if (!value) return;
    const start = new Date(value);
    update((p) => ({ ...p, startDate: value, endDate: isoDate(addDays(start, weeks * 7)), reviewDate: isoDate(addDays(start, Math.max(7, Math.round((weeks * 7) / 2)))) }));
  };
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <Card>
        <SectionHead icon={<CalendarDays size={15} />} title={tx("زمان‌بندی برنامه", "Plan schedule")} hint={tx("تاریخ‌ها در برنامه شاگرد و نسخه چاپی نمایش داده می‌شوند.", "Dates are shown to the athlete and in print.")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <Label>{tx("تاریخ شروع", "Start date")}</Label>
            <input type="date" dir="ltr" value={plan.startDate} onChange={(event) => setStart(event.target.value)} className={`${fieldCls} tnum`} />
            <span className="mt-1 block text-[10.5px] text-[var(--color-mute)]">{formatJalaliDate(plan.startDate)}</span>
          </label>
          <label className="block">
            <Label>{tx("مدت برنامه", "Duration")}</Label>
            <select
              value={weeks}
              onChange={(event) => {
                const count = Number(event.target.value);
                const start = new Date(plan.startDate);
                update((p) => ({ ...p, endDate: isoDate(addDays(start, count * 7)), reviewDate: isoDate(addDays(start, Math.max(7, Math.round((count * 7) / 2)))) }));
              }}
              className={fieldCls}
            >
              {[...new Set([2, 4, 6, 8, 12, weeks])].sort((a, b) => a - b).map((count) => <option key={count} value={count}>{tx(`${count} هفته`, `${count} weeks`)}</option>)}
            </select>
            <span className="mt-1 block text-[10.5px] text-[var(--color-mute)]">{tx("پایان", "Ends")}: {formatJalaliDate(plan.endDate)}</span>
          </label>
          <label className="block sm:col-span-2">
            <Label>{tx("تاریخ بازبینی و ارزیابی مجدد", "Review date")}</Label>
            <input type="date" dir="ltr" value={plan.reviewDate} onChange={(event) => event.target.value && update((p) => ({ ...p, reviewDate: event.target.value }))} className={`${fieldCls} tnum`} />
            <span className="mt-1 block text-[10.5px] text-[var(--color-mute)]">{formatJalaliDate(plan.reviewDate)}</span>
          </label>
        </div>
      </Card>
      <Card>
        <SectionHead icon={<BookOpen size={15} />} title={tx("پیام مربی", "Coach message")} hint={tx("در ابتدای برنامه شاگرد نمایش داده می‌شود؛ هدف این دوره و نکات کلیدی را بنویسید.", "Shown at the top of the athlete's plan — explain the goal of this phase.")} />
        <textarea
          value={plan.coachNote}
          onChange={(event) => update((p) => ({ ...p, coachNote: event.target.value }))}
          rows={6}
          className={areaCls}
          placeholder={tx("مثلاً: هدف این چهار هفته کاهش تدریجی چربی با حفظ قدرت است. وعده‌ها را سر وقت میل کنید و هر هفته وزن خود را ثبت کنید.", "e.g. These four weeks focus on gradual fat loss while keeping strength…")}
        />
      </Card>
      <Card className="xl:col-span-2">
        <SectionHead icon={<FileText size={15} />} title={tx("توصیه‌های تغذیه‌ای", "Nutrition guidelines")} hint={tx("هر خط یک توصیه است. از پیشنهادهای آماده استفاده کنید یا متن دلخواه بنویسید.", "One guideline per line. Use the suggestions or write your own.")} />
        <div className="flex flex-wrap gap-1.5">
          {GUIDELINE_SUGGESTIONS.map((item) => {
            const text = lang === "fa" ? item.fa : item.en;
            const used = lines.includes(text);
            return (
              <Chip key={item.fa} on={used} disabled={used} onClick={() => update((p) => ({ ...p, guidelines: [...p.guidelines.split("\n").filter((line) => line.trim()), text].join("\n") }))}>
                <Plus size={12} /> {text.length > 46 ? `${text.slice(0, 46)}…` : text}
              </Chip>
            );
          })}
        </div>
        <textarea value={plan.guidelines} onChange={(event) => update((p) => ({ ...p, guidelines: event.target.value }))} rows={8} className={`${areaCls} mt-3`} placeholder={tx("توصیه‌های خود را بنویسید؛ هر توصیه در یک خط.", "Write your guidelines, one per line.")} />
      </Card>
    </div>
  );
}

/* =================================================================== */
/*  Adherence report                                                    */
/* =================================================================== */

function AdherenceSection({ plan }: { plan: ProPlan }) {
  const { data } = useStore();
  const { tx, lang } = useTx();
  const report = useMemo(() => adherenceRows(data, plan, 14), [data, plan]);
  const lastLog = data.nutritionLogs
    .filter((log) => log.planId === plan.id && log.studentId === plan.studentId)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
  const bySlot = plan.meals.map((slot) => {
    let planned = 0;
    let done = 0;
    for (const row of report.rows) {
      const day = plan.days.find((item) => item.name === row.dayName) ?? plan.days[0];
      if (!(day.items[slot.id] ?? []).length) continue;
      planned += 1;
      if (data.nutritionLogs.some((log) => log.planId === plan.id && log.date === row.date && log.slotId === slot.id)) done += 1;
    }
    return { slot, planned, done };
  }).filter((entry) => entry.planned > 0);

  if (plan.status !== "active") {
    return (
      <Card>
        <p className="p-8 text-center text-[12.5px] leading-7 text-[var(--color-mute)]">
          {tx("پس از انتشار برنامه، گزارش پایبندی شاگرد بر اساس وعده‌هایی که در اپلیکیشن ثبت می‌کند، اینجا نمایش داده می‌شود.", "After publishing, the athlete's adherence based on logged meals appears here.")}
        </p>
      </Card>
    );
  }

  const weekdayNames = lang === "fa" ? WEEKDAY_SHORT_FA : WEEKDAY_SHORT_EN;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: tx("پایبندی 7 روز اخیر", "Last 7 days"), value: report.weekPct === null ? "—" : `${report.weekPct}%` },
          { label: tx("پایبندی 14 روز اخیر", "Last 14 days"), value: report.pct === null ? "—" : `${report.pct}%` },
          { label: tx("وعده‌های ثبت‌شده", "Meals logged"), value: `${report.rows.reduce((s, r) => s + r.done, 0)} / ${report.rows.reduce((s, r) => s + r.planned, 0)}` },
          { label: tx("آخرین ثبت", "Last log"), value: lastLog ? formatRelative(lastLog.completedAt) : "—" },
        ].map((stat) => (
          <Card key={stat.label} className="!p-3.5">
            <span className="block text-[11px] font-bold text-[var(--color-mute)]">{stat.label}</span>
            <b className="tnum mt-1 block text-[20px] font-black">{stat.value}</b>
          </Card>
        ))}
      </div>
      <Card>
        <SectionHead icon={<ListChecks size={15} />} title={tx("روند روزانه", "Daily trend")} hint={tx("هر ستون نسبت وعده‌های تیک‌خورده به وعده‌های برنامه همان روز است.", "Each bar shows logged meals versus planned meals that day.")} />
        {!report.rows.length ? (
          <p className="p-6 text-center text-[12px] text-[var(--color-mute)]">{tx("هنوز روزی از شروع برنامه نگذشته است.", "The plan has just started.")}</p>
        ) : (
          <div className="flex h-40 items-end gap-1.5">
            {report.rows.map((row) => {
              const pct = row.planned ? row.done / row.planned : 0;
              return (
                <div key={row.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${formatJalaliDate(row.date)} — ${row.done}/${row.planned}`}>
                  <span className="tnum text-[9.5px] font-bold text-[var(--color-mute)]">{row.done}/{row.planned}</span>
                  <div className="relative w-full flex-1 overflow-hidden rounded-lg bg-[var(--color-bg)]">
                    <div className={`absolute inset-x-0 bottom-0 rounded-lg transition-[height] duration-500 ${pct >= 0.8 ? "bg-emerald-500" : pct >= 0.5 ? "bg-[#e9e400]" : pct > 0 ? "bg-amber-500" : "bg-transparent"}`} style={{ height: `${Math.max(pct * 100, pct ? 8 : 0)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[var(--color-mute)]">{weekdayNames[(row.label.getDay() + 1) % 7]}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {!!bySlot.length && (
        <Card>
          <SectionHead icon={<Utensils size={15} />} title={tx("پایبندی به تفکیک وعده", "Adherence by meal")} hint={tx("وعده‌هایی که بیشتر جا می‌افتند را شناسایی و در صورت نیاز ساده‌تر کنید.", "Spot the meals that get skipped most and simplify them.")} />
          <div className="space-y-2.5">
            {bySlot.map(({ slot, planned, done }) => {
              const pct = Math.round((100 * done) / planned);
              return (
                <div key={slot.id}>
                  <div className="flex items-center justify-between text-[12px]">
                    <b>{slot.slot}</b>
                    <span className="tnum text-[var(--color-mute)]">{done}/{planned} • <b className={pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-[#e9e400]" : "text-amber-400"}>{pct}%</b></span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
                    <div className="h-full rounded-full bg-[#e9e400]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
