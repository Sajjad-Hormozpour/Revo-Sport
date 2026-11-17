import { useMemo, useState } from "react";
import {
  Archive, BookOpen, Calculator, CalendarDays, Database, Eye, LayoutTemplate, ListChecks, PackagePlus, Pencil, Plus, Printer, Repeat, RotateCcw,
  Salad, Search, Sparkles, Trash2, Users,
} from "lucide-react";
import type { FoodEntry, MealPlan, Student } from "../data/types";
import { useStore } from "../lib/store";
import { formatJalaliDate, formatRelative, nowIso } from "../lib/time";
import { Modal, Pill, Toggle } from "../components/ui";
import { FOOD_CATEGORIES, FOOD_DB, normalizeSearch, parseServing, type FoodCategory } from "./foods";
import {
  archivedRecords, clonePlanContent, currentRecord, defaultCalc, defaultProfile, localName, newPlan, nf, normalizePlan, serviceState, syncLegacy, templatesOf,
  type ProPlan, type ServiceState,
} from "./engine";
import PlanEditor from "./PlanEditor";
import { CustomFoodForm } from "./FoodPicker";
import { Card, Chip, Label, PlanSheet, SectionHead, Seg, fieldCls, kcalUnit, useConfirm, useTx } from "./parts";

type Tab = "students" | "templates" | "foods";
type Source = "blank" | "template" | "copy";

export default function NutritionCoach({
  routeStudentId, onOpenStudent, onToast,
}: {
  routeStudentId: string | null;
  onOpenStudent: (id: string | null) => void;
  onToast: (title: string, desc: string) => void;
}) {
  const { data, session, userById, saveMeal, deleteMeal, deleteFood, pushNotif } = useStore();
  const { tx, lang } = useTx();
  const { ask, confirmNode } = useConfirm();
  const me = userById(session!.userId)!;
  const [tab, setTab] = useState<Tab>("students");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ServiceState>("all");
  const [newPlanFor, setNewPlanFor] = useState<{ student: Student; source: Source } | null>(null);
  const [archiveFor, setArchiveFor] = useState<Student | null>(null);
  const [templateEditId, setTemplateEditId] = useState<string | null>(null);
  const [applyTemplate, setApplyTemplate] = useState<MealPlan | null>(null);
  const [preview, setPreview] = useState<{ plan: ProPlan; studentName?: string } | null>(null);
  const [foodForm, setFoodForm] = useState<{ initial?: FoodEntry } | null>(null);

  const nameOf = (student: Student) => userById(student.userId)?.name ?? tx("شاگرد", "Athlete");
  const ownerFor = (student?: Student) => (me.role === "admin" ? student?.coachId || me.id : me.id);

  const rows = useMemo(
    () =>
      data.students
        .map((student) => ({ student, user: userById(student.userId), state: serviceState(data, student.id), record: currentRecord(data, student.id) }))
        .sort((a, b) => (a.user?.name ?? "").localeCompare(b.user?.name ?? "", "fa")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const selected = rows.find((row) => row.student.id === routeStudentId) ?? null;
  const counts = {
    active: rows.filter((row) => row.state === "active").length,
    pending: rows.filter((row) => row.state === "pending").length,
    off: rows.filter((row) => row.state === "off").length,
  };
  const visible = rows.filter((row) => {
    if (filter !== "all" && row.state !== filter) return false;
    const q = normalizeSearch(query);
    return !q || normalizeSearch(row.user?.name ?? "").includes(q);
  });
  const templates = templatesOf(data, me.id);

  /* ---------------- service activation ---------------- */

  const notifyEnabled = (student: Student, published: boolean) =>
    pushNotif({
      to: "student",
      studentId: student.id,
      title: "فعال‌سازی بخش تغذیه",
      body: published
        ? "بخش برنامه غذایی در اپلیکیشن شما فعال شد و برنامه اختصاصی‌تان در دسترس است."
        : "بخش برنامه غذایی برای شما فعال شد. مربی به‌زودی برنامه اختصاصی شما را ارسال می‌کند.",
      time: nowIso(),
      read: false,
      type: "info",
    });

  const toggleService = (student: Student) => {
    const record = currentRecord(data, student.id) as (MealPlan & { serviceOff?: boolean }) | undefined;
    const name = nameOf(student);
    if (!record) {
      const plan = newPlan({ student, data, coachId: ownerFor(student), name: tx("برنامه غذایی اختصاصی", "Personal nutrition plan") });
      saveMeal(syncLegacy(plan));
      notifyEnabled(student, false);
      onToast(
        tx("بخش تغذیه فعال شد", "Nutrition enabled"),
        tx(`گزینه «تغذیه» به منوی ${name} اضافه شد. اکنون برنامه را تدوین و منتشر کنید.`, `“Nutrition” was added to ${name}'s menu. Build and publish the plan next.`),
      );
      return;
    }
    const turnOn = !!record.serviceOff;
    saveMeal({ ...record, serviceOff: !turnOn, updatedAt: nowIso() } as MealPlan);
    if (turnOn) notifyEnabled(student, record.status === "active");
    onToast(
      turnOn ? tx("بخش تغذیه فعال شد", "Nutrition enabled") : tx("بخش تغذیه غیرفعال شد", "Nutrition disabled"),
      turnOn
        ? tx(`گزینه «تغذیه» در منوی ${name} نمایش داده می‌شود.`, `“Nutrition” is now shown in ${name}'s menu.`)
        : tx(`گزینه «تغذیه» از منوی ${name} حذف شد؛ اطلاعات برنامه حفظ می‌شود.`, `“Nutrition” was removed from ${name}'s menu; the plan is kept.`),
    );
  };

  /* ---------------- plan lifecycle ---------------- */

  const createPlan = (student: Student, source: Source, name: string, templateId?: string) => {
    const current = currentRecord(data, student.id) as (MealPlan & { serviceOff?: boolean }) | undefined;
    const currentPro = current ? normalizePlan(current, data) : null;
    const owner = ownerFor(student);
    const keepService = current ? current.serviceOff : false;
    let plan: ProPlan;
    const template = templateId ? data.meals.find((meal) => meal.id === templateId) : undefined;
    if (source === "template" && template) {
      const base = normalizePlan(template, data);
      const body = defaultCalc(student, data);
      plan = clonePlanContent(base, {
        studentId: student.id,
        coachId: owner,
        status: "draft",
        name,
        serviceOff: keepService,
        profile: currentPro?.profile ?? defaultProfile(),
        calc: { ...base.calc, weight: body.weight, height: body.height, age: body.age, gender: body.gender, bodyFat: body.bodyFat },
      });
    } else if (source === "copy" && currentPro) {
      plan = clonePlanContent(currentPro, { status: "draft", name, serviceOff: keepService });
    } else {
      plan = { ...newPlan({ student, data, coachId: owner, name }), profile: currentPro?.profile ?? defaultProfile(), serviceOff: keepService };
    }
    if (current) saveMeal({ ...current, status: "archived", updatedAt: nowIso() });
    saveMeal(syncLegacy(plan));
    if (!current) notifyEnabled(student, false);
    onToast(
      tx("برنامه جدید ساخته شد", "New plan created"),
      current
        ? tx("برنامه قبلی بایگانی شد و برنامه جدید به‌صورت پیش‌نویس آماده ویرایش است.", "The previous plan was archived; the new one is ready as a draft.")
        : tx("برنامه به‌صورت پیش‌نویس ساخته شد و بخش تغذیه برای شاگرد فعال است.", "The draft plan was created and nutrition is enabled."),
    );
    setTab("students");
    onOpenStudent(student.id);
  };

  const restoreArchived = (student: Student, record: MealPlan) => {
    const current = currentRecord(data, student.id) as (MealPlan & { serviceOff?: boolean }) | undefined;
    if (current) saveMeal({ ...current, status: "archived", updatedAt: nowIso() });
    saveMeal({ ...record, status: "draft", updatedAt: nowIso(), serviceOff: current ? current.serviceOff : false } as MealPlan);
    setArchiveFor(null);
    onToast(tx("برنامه بازیابی شد", "Plan restored"), tx("برنامه به‌عنوان پیش‌نویس جاری بازگشت؛ پس از بازبینی آن را منتشر کنید.", "The plan is back as the current draft; review and publish it."));
  };

  const newTemplate = () => {
    const plan = newPlan({ data, coachId: me.id, name: tx("قالب جدید برنامه غذایی", "New nutrition template"), status: "template" });
    saveMeal(syncLegacy({ ...plan, profile: defaultProfile() }));
    setTemplateEditId(plan.id);
  };

  const removeTemplate = async (template: MealPlan) => {
    const ok = await ask({
      title: tx("حذف قالب", "Delete template"),
      body: tx(`قالب «${template.name}» برای همیشه حذف می‌شود.`, `“${template.name}” will be deleted permanently.`),
      confirm: tx("حذف شود", "Delete"),
      danger: true,
    });
    if (ok) deleteMeal(template.id);
  };

  /* ---------------- render: template editor (full width) ---------------- */

  const editingTemplate = templateEditId ? templates.find((template) => template.id === templateEditId) : undefined;
  if (tab === "templates" && editingTemplate) {
    return (
      <div className="screen-in mx-auto max-w-6xl">
        <PlanEditor mode="template" record={editingTemplate} coachId={me.id} coachName={me.name} onBack={() => setTemplateEditId(null)} onToast={onToast} />
      </div>
    );
  }

  const stateTone = (state: ServiceState) => (state === "active" ? "ok" : state === "pending" ? "warn" : "mute");
  const stateText = (state: ServiceState) =>
    state === "active" ? tx("منتشرشده", "Published") : state === "pending" ? tx("در انتظار انتشار", "Awaiting publish") : tx("غیرفعال", "Off");

  return (
    <div className="screen-in mx-auto max-w-[1400px] space-y-3">
      <div className={`flex-wrap items-end justify-between gap-3 ${selected && tab === "students" ? "hidden lg:flex" : "flex"}`}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[18px] font-black">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9e400] text-black"><Salad size={18} /></span>
            {tx("برنامه غذایی", "Nutrition")}
          </h2>
          <p className="mt-1 text-[12px] leading-6 text-[var(--color-mute)]">
            {tx("طراحی برنامه غذایی حرفه‌ای، محاسبه دقیق کالری و درشت‌مغذی‌ها و پیگیری پایبندی شاگردان", "Design professional meal plans, calculate calories and macros, and track athlete adherence")}
          </p>
        </div>
        <Seg
          items={[
            { key: "students" as const, label: tx("شاگردان", "Athletes"), icon: <Users size={15} /> },
            { key: "templates" as const, label: tx("قالب‌ها", "Templates"), icon: <LayoutTemplate size={15} /> },
            { key: "foods" as const, label: tx("بانک غذایی", "Food database"), icon: <Database size={15} /> },
          ]}
          value={tab}
          onChange={(key) => {
            setTab(key);
            setTemplateEditId(null);
          }}
        />
      </div>

      {tab === "students" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className={`min-w-0 ${selected ? "hidden lg:block" : ""}`}>
            <Card className="!p-3 lg:sticky lg:top-0">
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: "active" as const, label: tx("منتشرشده", "Published"), value: counts.active, tone: "text-emerald-400" },
                  { key: "pending" as const, label: tx("در انتظار", "Pending"), value: counts.pending, tone: "text-amber-400" },
                  { key: "off" as const, label: tx("غیرفعال", "Off"), value: counts.off, tone: "text-[var(--color-mute)]" },
                ].map((stat) => (
                  <button
                    key={stat.key}
                    type="button"
                    onClick={() => setFilter((current) => (current === stat.key ? "all" : stat.key))}
                    aria-pressed={filter === stat.key}
                    className={`press rounded-xl p-2 text-center transition ${filter === stat.key ? "bg-[#e9e400]/12 ring-1 ring-[#e9e400]/40" : "bg-[var(--color-bg)]"}`}
                  >
                    <b className={`tnum block text-[17px] font-black ${stat.tone}`}>{stat.value}</b>
                    <span className="block text-[10px] font-bold text-[var(--color-mute)]">{stat.label}</span>
                  </button>
                ))}
              </div>
              <label className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3">
                <Search size={15} className="shrink-0 text-[var(--color-mute)]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx("جستجوی شاگرد", "Search athletes")} className="h-10 min-w-0 flex-1 bg-transparent text-[12.5px] font-semibold outline-none placeholder:text-[var(--color-mute)]" />
              </label>
              <p className="mt-2.5 px-1 text-[10.5px] leading-5 text-[var(--color-mute)]">
                {tx("با کلید کنار نام هر شاگرد، گزینه «تغذیه» در اپلیکیشن او فعال یا غیرفعال می‌شود.", "Use the switch next to each athlete to show or hide “Nutrition” in their app.")}
              </p>
              <div className="noscroll mt-2 max-h-[62dvh] space-y-1 overflow-y-auto">
                {!rows.length && (
                  <p className="rounded-xl border border-dashed border-[var(--color-line)] p-5 text-center text-[12px] leading-6 text-[var(--color-mute)]">
                    {tx("هنوز شاگردی ندارید. پس از پیوستن شاگردان با کد مربی، اینجا نمایش داده می‌شوند.", "No athletes yet. They appear here after joining with your coach code.")}
                  </p>
                )}
                {rows.length > 0 && !visible.length && (
                  <p className="p-4 text-center text-[12px] text-[var(--color-mute)]">{tx("شاگردی با این مشخصات پیدا نشد.", "No athletes match.")}</p>
                )}
                {visible.map(({ student, user, state, record }) => {
                  const active = selected?.student.id === student.id;
                  return (
                    <div key={student.id} className={`flex items-center gap-2 rounded-2xl p-2 transition ${active ? "bg-[#e9e400]/10 ring-1 ring-[#e9e400]/35" : "hover:bg-white/5"}`}>
                      <button type="button" onClick={() => onOpenStudent(student.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                        <img src={user?.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        <span className="min-w-0">
                          <b className="block truncate text-[12.5px]">{user?.name}</b>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1">
                            <Pill tone={stateTone(state)}>{stateText(state)}</Pill>
                            {record?.targetKcal ? <span className="tnum text-[10px] text-[var(--color-mute)]">{nf(record.targetKcal)} {kcalUnit(lang)}</span> : null}
                          </span>
                        </span>
                      </button>
                      <Toggle on={state !== "off"} onClick={() => toggleService(student)} />
                    </div>
                  );
                })}
              </div>
            </Card>
          </aside>

          <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
            {selected?.record ? (
              <PlanEditor
                key={selected.record.id}
                mode="student"
                record={selected.record}
                student={selected.student}
                studentName={selected.user?.name}
                studentAvatar={selected.user?.avatar}
                coachId={ownerFor(selected.student)}
                coachName={me.name}
                serviceOn={selected.state !== "off"}
                onToggleService={() => toggleService(selected.student)}
                onBack={() => onOpenStudent(null)}
                onToast={onToast}
                onNewPlan={() => setNewPlanFor({ student: selected.student, source: "blank" })}
                onOpenArchive={() => setArchiveFor(selected.student)}
              />
            ) : selected ? (
              <Card className="nutri-pop">
                <button type="button" onClick={() => onOpenStudent(null)} className="press mb-3 text-[12px] font-bold text-[var(--color-mute)] lg:hidden">
                  {tx("→ بازگشت به فهرست", "← Back to list")}
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <img src={selected.user?.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  <div className="min-w-0">
                    <b className="block text-[16px] font-black">{selected.user?.name}</b>
                    <span className="tnum text-[11.5px] text-[var(--color-mute)]">
                      {selected.student.goal} • {selected.student.age} {tx("سال", "yrs")} • {selected.student.height} {tx("سانتی‌متر", "cm")} • {selected.student.weight} {tx("کیلوگرم", "kg")}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-[12.5px] leading-7 text-[var(--color-mute)]">
                  {tx(
                    "برای این شاگرد هنوز برنامه غذایی ایجاد نشده است. با فعال‌سازی، گزینه «تغذیه» به منوی اپلیکیشن شاگرد اضافه می‌شود و تا زمان انتشار برنامه، پیام «در حال آماده‌سازی» به او نمایش داده می‌شود.",
                    "No nutrition plan exists for this athlete yet. Enabling adds “Nutrition” to their app menu and shows a “being prepared” message until you publish.",
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => toggleService(selected.student)} className="press flex h-11 items-center gap-1.5 rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black">
                    <Sparkles size={15} /> {tx("فعال‌سازی و ایجاد برنامه", "Enable & create plan")}
                  </button>
                  {templates.length > 0 && (
                    <button type="button" onClick={() => setNewPlanFor({ student: selected.student, source: "template" })} className="press flex h-11 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-5 text-[12.5px] font-extrabold">
                      <LayoutTemplate size={15} /> {tx("ایجاد از روی قالب", "Create from template")}
                    </button>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#e9e400]/12 text-[#e9e400]"><Salad size={30} /></span>
                <b className="mt-4 text-[16px] font-black">{tx("یک شاگرد را انتخاب کنید", "Select an athlete")}</b>
                <p className="mt-2 max-w-md text-[12.5px] leading-7 text-[var(--color-mute)]">
                  {tx("برای طراحی یا ویرایش برنامه غذایی، شاگرد مورد نظر را از فهرست انتخاب کنید.", "Choose an athlete from the list to design or edit their meal plan.")}
                </p>
                <div className="mt-6 grid w-full max-w-2xl gap-2 text-start sm:grid-cols-2">
                  {[
                    { icon: <Calculator size={15} />, text: tx("محاسبه کالری و درشت‌مغذی‌ها با سه فرمول معتبر", "Calories & macros with three validated formulas") },
                    { icon: <CalendarDays size={15} />, text: tx("برنامه چندروزه برای روزهای تمرین و استراحت", "Multi-day plans for training and rest days") },
                    { icon: <Repeat size={15} />, text: tx("جایگزین‌های هم‌کالری برای هر غذا", "Equal-calorie swaps for every food") },
                    { icon: <BookOpen size={15} />, text: tx("مکمل‌ها، توصیه‌ها و زمان‌بندی دوره", "Supplements, guidelines and phase schedule") },
                    { icon: <Printer size={15} />, text: tx("خروجی چاپی و PDF با فهرست خرید هفتگی", "Print & PDF with a weekly shopping list") },
                    { icon: <ListChecks size={15} />, text: tx("گزارش پایبندی بر اساس وعده‌های ثبت‌شده", "Adherence report from logged meals") },
                  ].map((feature) => (
                    <div key={feature.text} className="flex items-center gap-2.5 rounded-xl bg-[var(--color-bg)] px-3 py-2.5 text-[12px] font-bold">
                      <span className="text-[#e9e400]">{feature.icon}</span>
                      {feature.text}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-[12px] leading-6 text-[var(--color-mute)]">
              {tx("قالب‌ها برنامه‌های آماده شما هستند. یک بار بسازید و برای هر شاگرد با چند کلیک شخصی‌سازی کنید؛ پرونده تغذیه‌ای شاگرد در قالب ذخیره نمی‌شود.", "Templates are your ready-made plans. Build once and personalise for each athlete in a few clicks; private athlete data is never stored in templates.")}
            </p>
            <button type="button" onClick={newTemplate} className="press flex h-10 items-center gap-1.5 rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black">
              <Plus size={15} /> {tx("قالب جدید", "New template")}
            </button>
          </Card>
          {!templates.length ? (
            <Card className="py-12 text-center">
              <LayoutTemplate size={30} className="mx-auto text-[var(--color-mute)]" />
              <p className="mt-3 text-[12.5px] leading-7 text-[var(--color-mute)]">
                {tx("هنوز قالبی ندارید. یک قالب جدید بسازید یا در ویرایشگر برنامه هر شاگرد، گزینه «ذخیره به‌عنوان قالب» را بزنید.", "No templates yet. Create one, or use “Save as template” inside any athlete's plan.")}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const plan = normalizePlan(template, data);
                const foods = plan.days.reduce((sum, day) => sum + Object.values(day.items).reduce((inner, list) => inner + list.length, 0), 0);
                return (
                  <Card key={template.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-[14px] font-black leading-6">{localName(template.name, lang)}</b>
                      <Pill tone="info">{tx("قالب", "Template")}</Pill>
                    </div>
                    <p className="tnum mt-1 text-[11px] text-[var(--color-mute)]">
                      {nf(template.targetKcal || 0)} {kcalUnit(lang)} • {tx("پ", "P")} {nf(template.targetP || 0)} • {tx("ک", "C")} {nf(template.targetC || 0)} • {tx("چ", "F")} {nf(template.targetF || 0)}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      {[
                        { label: tx("روز", "Days"), value: plan.days.length },
                        { label: tx("وعده", "Meals"), value: plan.meals.length },
                        { label: tx("غذا", "Foods"), value: foods },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl bg-[var(--color-bg)] p-2">
                          <b className="tnum block text-[15px] font-black">{stat.value}</b>
                          <span className="text-[10px] font-bold text-[var(--color-mute)]">{stat.label}</span>
                        </div>
                      ))}
                    </div>
                    <span className="mt-2 text-[10.5px] text-[var(--color-mute)]">{tx("به‌روزرسانی", "Updated")} {formatRelative(template.updatedAt || template.createdAt)}</span>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                      <button type="button" onClick={() => setTemplateEditId(template.id)} className="press flex h-9 items-center gap-1 rounded-full bg-[#e9e400] px-3.5 text-[11.5px] font-black text-black">
                        <Pencil size={13} /> {tx("ویرایش", "Edit")}
                      </button>
                      <button type="button" onClick={() => setApplyTemplate(template)} disabled={!rows.length} className="press flex h-9 items-center gap-1 rounded-full border border-[var(--color-line)] px-3.5 text-[11.5px] font-extrabold disabled:opacity-40">
                        <Users size={13} /> {tx("اعمال برای شاگرد", "Apply to athlete")}
                      </button>
                      <button type="button" onClick={() => setPreview({ plan })} aria-label={tx("پیش‌نمایش", "Preview")} className="press flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)]">
                        <Eye size={14} />
                      </button>
                      <button type="button" onClick={() => removeTemplate(template)} aria-label={tx("حذف قالب", "Delete template")} className="press flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "foods" && <FoodsPanel onEdit={(initial) => setFoodForm({ initial })} onCreate={() => setFoodForm({})} onDelete={async (food) => {
        const ok = await ask({
          title: tx("حذف غذا", "Delete food"),
          body: tx(`«${food.name}» از غذاهای شما حذف می‌شود. برنامه‌هایی که از آن استفاده کرده‌اند تغییری نمی‌کنند.`, `“${food.name}” will be removed. Existing plans keep their values.`),
          confirm: tx("حذف شود", "Delete"),
          danger: true,
        });
        if (ok) deleteFood(food.id);
      }} />}

      {newPlanFor && (
        <NewPlanDialog
          initialSource={newPlanFor.source}
          hasCurrent={!!currentRecord(data, newPlanFor.student.id)}
          templates={templates}
          onClose={() => setNewPlanFor(null)}
          onCreate={(source, name, templateId) => {
            createPlan(newPlanFor.student, source, name, templateId);
            setNewPlanFor(null);
          }}
        />
      )}

      {applyTemplate && (
        <Modal open onClose={() => setApplyTemplate(null)} title={tx("اعمال قالب برای شاگرد", "Apply template to athlete")}>
          <ApplyTemplateForm
            template={applyTemplate}
            students={rows.map((row) => ({ student: row.student, name: row.user?.name ?? "", hasPlan: !!row.record }))}
            onApply={(student, name) => {
              createPlan(student, "template", name, applyTemplate.id);
              setApplyTemplate(null);
            }}
          />
        </Modal>
      )}

      {archiveFor && (
        <Modal open onClose={() => setArchiveFor(null)} title={tx("برنامه‌های بایگانی‌شده", "Archived plans")} wide>
          <div className="space-y-2">
            {!archivedRecords(data, archiveFor.id).length && (
              <p className="p-6 text-center text-[12.5px] text-[var(--color-mute)]">{tx("برنامه بایگانی‌شده‌ای وجود ندارد.", "No archived plans.")}</p>
            )}
            {archivedRecords(data, archiveFor.id).map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] p-3">
                <span className="min-w-0">
                  <b className="block text-[13px]">{localName(record.name, lang)}</b>
                  <span className="tnum text-[11px] text-[var(--color-mute)]">
                    {tx("نسخه", "Version")} {record.version || 1} • {nf(record.targetKcal || 0)} {kcalUnit(lang)} • {formatJalaliDate(record.updatedAt || record.createdAt)}
                  </span>
                </span>
                <span className="flex gap-1.5">
                  <button type="button" onClick={() => setPreview({ plan: normalizePlan(record, data), studentName: nameOf(archiveFor) })} className="press flex h-9 items-center gap-1 rounded-full border border-[var(--color-line)] px-3 text-[11.5px] font-bold">
                    <Eye size={13} /> {tx("پیش‌نمایش", "Preview")}
                  </button>
                  <button type="button" onClick={() => restoreArchived(archiveFor, record)} className="press flex h-9 items-center gap-1 rounded-full border border-[var(--color-line)] px-3 text-[11.5px] font-black text-[#e9e400]">
                    <RotateCcw size={13} /> {tx("بازیابی", "Restore")}
                  </button>
                  <button
                    type="button"
                    aria-label={tx("حذف", "Delete")}
                    onClick={async () => {
                      const ok = await ask({ title: tx("حذف برنامه بایگانی‌شده", "Delete archived plan"), body: tx("این برنامه و سوابق پایبندی آن برای همیشه حذف می‌شود.", "This plan and its adherence history will be deleted."), confirm: tx("حذف شود", "Delete"), danger: true });
                      if (ok) deleteMeal(record.id);
                    }}
                    className="press flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={tx("پیش‌نمایش برنامه", "Plan preview")} wide>
          <PlanSheet plan={preview.plan} studentName={preview.studentName} coachName={me.name} />
        </Modal>
      )}

      {foodForm && (
        <Modal open onClose={() => setFoodForm(null)} title={foodForm.initial ? tx("ویرایش غذا", "Edit food") : tx("تعریف غذای جدید", "New custom food")}>
          <CustomFoodForm
            coachId={me.id}
            initial={foodForm.initial}
            onCancel={() => setFoodForm(null)}
            onSaved={(entry) => {
              setFoodForm(null);
              onToast(tx("غذا ذخیره شد", "Food saved"), entry.name);
            }}
          />
        </Modal>
      )}
      {confirmNode}
    </div>
  );
}

/* =================================================================== */
/*  Dialogs                                                             */
/* =================================================================== */

function NewPlanDialog({
  initialSource, hasCurrent, templates, onClose, onCreate,
}: {
  initialSource: Source; hasCurrent: boolean; templates: MealPlan[];
  onClose: () => void; onCreate: (source: Source, name: string, templateId?: string) => void;
}) {
  const { tx } = useTx();
  const [source, setSource] = useState<Source>(initialSource === "template" && !templates.length ? "blank" : initialSource);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [name, setName] = useState(tx("برنامه غذایی اختصاصی", "Personal nutrition plan"));
  const options: { key: Source; title: string; hint: string; disabled?: boolean }[] = [
    { key: "blank", title: tx("شروع از صفر", "Start from scratch"), hint: tx("وعده‌های پیش‌فرض و اهداف محاسبه‌شده بر اساس مشخصات شاگرد", "Default meals with targets calculated from the athlete's metrics") },
    { key: "template", title: tx("استفاده از قالب", "Use a template"), hint: tx("ساختار و غذاهای یکی از قالب‌های شما", "Structure and foods from one of your templates"), disabled: !templates.length },
    { key: "copy", title: tx("ادامه برنامه فعلی", "Continue current plan"), hint: tx("نسخه جدیدی از برنامه فعلی برای دوره بعد", "A new copy of the current plan for the next phase"), disabled: !hasCurrent },
  ];
  return (
    <Modal open onClose={onClose} title={tx("ایجاد برنامه غذایی جدید", "Create a new nutrition plan")}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={option.disabled}
              onClick={() => setSource(option.key)}
              className={`press flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-start transition disabled:opacity-40 ${
                source === option.key ? "border-[#e9e400]/50 bg-[#e9e400]/10" : "border-[var(--color-line)]"
              }`}
            >
              <span>
                <b className="block text-[12.5px]">{option.title}</b>
                <span className="block text-[11px] text-[var(--color-mute)]">{option.hint}</span>
              </span>
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${source === option.key ? "border-[#e9e400] bg-[#e9e400]" : "border-[var(--color-line)]"}`} />
            </button>
          ))}
        </div>
        {source === "template" && (
          <div>
            <Label>{tx("قالب", "Template")}</Label>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className={fieldCls}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>{tx("نام برنامه", "Plan name")}</Label>
          <input value={name} onChange={(event) => setName(event.target.value)} className={fieldCls} />
        </div>
        {hasCurrent && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-[11.5px] leading-6 text-amber-400">
            {tx("برنامه فعلی شاگرد بایگانی می‌شود و همچنان از بخش «برنامه‌های بایگانی‌شده» در دسترس خواهد بود.", "The current plan will be archived and stays available under Archived plans.")}
          </p>
        )}
        <button
          type="button"
          onClick={() => onCreate(source, name.trim() || tx("برنامه غذایی اختصاصی", "Personal nutrition plan"), source === "template" ? templateId : undefined)}
          className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#e9e400] text-[13px] font-black text-black"
        >
          <Sparkles size={15} /> {tx("ایجاد برنامه", "Create plan")}
        </button>
      </div>
    </Modal>
  );
}

function ApplyTemplateForm({ template, students, onApply }: { template: MealPlan; students: { student: Student; name: string; hasPlan: boolean }[]; onApply: (student: Student, name: string) => void }) {
  const { tx } = useTx();
  const [id, setId] = useState(students[0]?.student.id ?? "");
  const [name, setName] = useState(template.name.replace(/\s—\s(قالب|template)$/i, ""));
  const chosen = students.find((entry) => entry.student.id === id);
  return (
    <div className="space-y-3">
      <div>
        <Label>{tx("شاگرد", "Athlete")}</Label>
        <select value={id} onChange={(event) => setId(event.target.value)} className={fieldCls}>
          {students.map((entry) => <option key={entry.student.id} value={entry.student.id}>{entry.name}</option>)}
        </select>
      </div>
      <div>
        <Label>{tx("نام برنامه", "Plan name")}</Label>
        <input value={name} onChange={(event) => setName(event.target.value)} className={fieldCls} />
      </div>
      <p className="text-[11.5px] leading-6 text-[var(--color-mute)]">
        {tx("مشخصات بدنی شاگرد جایگزین مقادیر قالب می‌شود و برنامه به‌صورت پیش‌نویس ساخته خواهد شد تا پیش از انتشار آن را شخصی‌سازی کنید.", "The athlete's metrics replace the template values and the plan is created as a draft for you to personalise before publishing.")}
      </p>
      {chosen?.hasPlan && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-[11.5px] leading-6 text-amber-400">
          {tx("برنامه فعلی این شاگرد بایگانی خواهد شد.", "This athlete's current plan will be archived.")}
        </p>
      )}
      <button type="button" disabled={!chosen} onClick={() => chosen && onApply(chosen.student, name.trim() || template.name)} className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#e9e400] text-[13px] font-black text-black disabled:opacity-50">
        <Sparkles size={15} /> {tx("ساخت برنامه از قالب", "Create plan from template")}
      </button>
    </div>
  );
}

/* =================================================================== */
/*  Food database                                                       */
/* =================================================================== */

function FoodsPanel({ onEdit, onCreate, onDelete }: { onEdit: (food: FoodEntry) => void; onCreate: () => void; onDelete: (food: FoodEntry) => void }) {
  const { data, session } = useStore();
  const { tx, lang } = useTx();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<FoodCategory | "all">("all");
  const mine = data.foods.filter((food) => food.coachId === session?.userId);
  const q = normalizeSearch(query);
  const list = FOOD_DB.filter((food) => (cat === "all" || food.cat === cat) && (!q || normalizeSearch(food.fa).includes(q) || food.en.toLowerCase().includes(q)));
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
      <Card>
        <SectionHead
          icon={<PackagePlus size={15} />}
          title={tx("غذاهای من", "My foods")}
          hint={tx("غذاها و محصولات اختصاصی خود را با ارزش غذایی دقیق تعریف کنید تا در همه برنامه‌ها در دسترس باشند.", "Define your own foods and products with exact values to use in every plan.")}
          action={
            <button type="button" onClick={onCreate} className="press flex h-9 items-center gap-1.5 rounded-full bg-[#e9e400] px-4 text-[12px] font-black text-black">
              <Plus size={14} /> {tx("غذای جدید", "New food")}
            </button>
          }
        />
        <div className="space-y-1.5">
          {!mine.length && <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-center text-[12px] text-[var(--color-mute)]">{tx("هنوز غذای اختصاصی تعریف نکرده‌اید.", "You haven't added any custom foods yet.")}</p>}
          {mine.map((food) => {
            const serving = parseServing(food.serving);
            return (
              <div key={food.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] p-2.5">
                <span className="min-w-0">
                  <b className="block truncate text-[12.5px]">{food.name}</b>
                  <span className="tnum block text-[10.5px] text-[var(--color-mute)]">
                    {serving.label === "گرم" ? tx(`${serving.grams} گرم`, `${serving.grams} g`) : food.serving}: {nf(food.kcal)} {kcalUnit(lang)} • {tx("پ", "P")} {nf(food.p, 1)} • {tx("ک", "C")} {nf(food.c, 1)} • {tx("چ", "F")} {nf(food.f, 1)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => onEdit(food)} aria-label={tx("ویرایش", "Edit")} className="press flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-line)] hover:text-[#e9e400]"><Pencil size={13} /></button>
                  <button type="button" onClick={() => onDelete(food)} aria-label={tx("حذف", "Delete")} className="press flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-line)] hover:text-red-400"><Trash2 size={13} /></button>
                </span>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionHead
          icon={<Archive size={15} />}
          title={tx("بانک غذایی Revo sport", "Revo sport food database")}
          hint={tx(`${FOOD_DB.length} قلم غذای ایرانی و رایج با ارزش غذایی در 100 گرم و واحدهای خانگی`, `${FOOD_DB.length} Iranian and common foods with values per 100 g and household units`)}
        />
        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3">
          <Search size={15} className="shrink-0 text-[var(--color-mute)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx("جستجو در بانک غذایی", "Search the database")} className="h-10 min-w-0 flex-1 bg-transparent text-[12.5px] font-semibold outline-none placeholder:text-[var(--color-mute)]" />
        </label>
        <div className="noscroll -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip on={cat === "all"} onClick={() => setCat("all")}>{tx("همه", "All")}</Chip>
          {FOOD_CATEGORIES.filter((item) => item.key !== "custom").map((item) => (
            <Chip key={item.key} on={cat === item.key} onClick={() => setCat(item.key)}>{lang === "fa" ? item.fa : item.en}</Chip>
          ))}
        </div>
        <div className="noscroll mt-2 max-h-[60dvh] overflow-y-auto rounded-xl border border-[var(--color-line)]">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[var(--color-card)] text-[10.5px] text-[var(--color-mute)]">
              <tr>
                <th className="p-2.5 text-start font-bold">{tx("غذا (100 گرم)", "Food (100 g)")}</th>
                <th className="p-2.5 font-bold">{tx("کالری", "kcal")}</th>
                <th className="p-2.5 font-bold">{tx("پروتئین", "Protein")}</th>
                <th className="p-2.5 font-bold">{tx("کربو", "Carbs")}</th>
                <th className="p-2.5 font-bold">{tx("چربی", "Fat")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((food) => (
                <tr key={food.id} className="border-t border-[var(--color-line)]">
                  <td className="p-2.5 font-bold">{lang === "fa" ? food.fa : food.en}</td>
                  <td className="tnum p-2.5 text-center">{nf(food.per100.kcal)}</td>
                  <td className="tnum p-2.5 text-center text-sky-400">{nf(food.per100.p, 1)}</td>
                  <td className="tnum p-2.5 text-center text-amber-400">{nf(food.per100.c, 1)}</td>
                  <td className="tnum p-2.5 text-center text-rose-400">{nf(food.per100.f, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
