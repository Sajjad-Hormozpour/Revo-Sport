import { currentLanguage, localize, localizeStatic } from "../../../i18n";
import { useState } from "react";
import {
  Plus, ChevronUp, ChevronDown, ChevronLeft, Trash2, Sparkles, Pencil, CloudCheck,
  Grid2X2, List, RotateCcw, SlidersHorizontal, BookOpen, Dumbbell, Search, Camera, Play,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { EXERCISES, MUSCLES, EQUIPMENT } from "../../data/library";
import type { WorkoutProgram, ProgramSet } from "../../data/types";
import { fa, uid, WEEK } from "../../lib/core";
import { addDays, dayKey, nowIso } from "../../lib/time";
import { ExThumb, ExVideo, resolveExercise } from "../../components/exercise";
import { libraryAnimation } from "../../components/ExerciseAnimation";
import { BrandBtn, Empty, Field, Modal, Pill, SearchBox, inputCls } from "../../components/ui";

export default function CoachTraining({
  mode, onToast, onGoMoves,
}: {
  mode: "programs" | "library";
  onToast: (t: string, d: string) => void;
  onGoMoves?: () => void;
}) {
  return mode === "library" ? <Library onGoMoves={onGoMoves} /> : <Programs onToast={onToast} />;
}

function Library({ onGoMoves }: { onGoMoves?: () => void }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("همه");
  const [eq, setEq] = useState("همه");
  const [lv, setLv] = useState("همه");
  const [ex, setEx] = useState<(typeof EXERCISES)[0] | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"name" | "muscle" | "level">("name");

  const term = q.trim().toLowerCase();
  const levelOrder = { مبتدی: 1, متوسط: 2, پیشرفته: 3 } as const;
  const list = EXERCISES
    .filter((e) => {
      if (term && !`${e.name} ${e.en} ${e.muscle} ${e.equipment}`.toLowerCase().includes(term)) return false;
      if (muscle !== "همه" && e.muscle !== muscle) return false;
      if (eq !== "همه" && e.equipment !== eq) return false;
      if (lv !== "همه" && e.level !== lv) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "muscle") return a.muscle.localeCompare(b.muscle, "fa") || a.name.localeCompare(b.name, "fa");
      if (sort === "level") return levelOrder[a.level] - levelOrder[b.level] || a.name.localeCompare(b.name, "fa");
      return a.name.localeCompare(b.name, "fa");
    });

  const reset = () => {
    setQ("");
    setMuscle("همه");
    setEq("همه");
    setLv("همه");
    setSort("name");
  };
  const filtered = !!q || muscle !== "همه" || eq !== "همه" || lv !== "همه";
  const hasAnimation = EXERCISES.filter((e) => !!libraryAnimation(e.id)).length;
  const difficulty = (level: (typeof EXERCISES)[number]["level"]) => levelOrder[level];

  return (
    <div className="screen-in space-y-4">
      <section data-reveal className="library-hero relative overflow-hidden rounded-3xl border border-[var(--color-line)] p-5 sm:p-6">
        <div className="pointer-events-none absolute -left-16 -top-20 h-60 w-60 rounded-full bg-[#e9e400]/15 blur-[80px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-lg">
            <span className="flex items-center gap-1.5 text-[11px] font-black text-[#e9e400]">
              <BookOpen size={14} />{localizeStatic(" مرجع حرکات مربی")}</span>
            <h2 className="mt-1 text-[22px] font-black sm:text-[26px]">{localizeStatic("کتابخانه حرکات")}</h2>
               <p className="mt-1 text-[12.5px] leading-7 text-[var(--color-mute)]">{localizeStatic("نمایش سه‌بعدی حرکت با آواتار، مراحل صحیح اجرا، اشتباهات رایج و عضلات درگیر.")}</p>
          </div>
          <button
            onClick={onGoMoves}
            className="press glass flex h-11 items-center gap-2 rounded-2xl bg-[#e9e400] px-4 text-[12.5px] font-black text-black shadow-[0_12px_30px_-12px_rgba(233,228,0,0.75)]"
          >
            <Plus size={15} />{localizeStatic(" ساخت حرکت اختصاصی")}</button>
        </div>
        <div className="glass relative mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-[var(--color-line)] rounded-2xl py-3">
          <LibraryStat value={EXERCISES.length} label={localizeStatic("حرکت استاندارد")} icon={<Dumbbell size={14} />} />
          <LibraryStat value={MUSCLES.length} label={localizeStatic("گروه عضلانی")} icon={<Sparkles size={14} />} />
           <LibraryStat value={hasAnimation} label={localizeStatic("انیمیشن سه‌بعدی")} icon={<Camera size={14} />} />
        </div>
      </section>

      <section data-reveal className="sticky top-0 z-20 space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg2)]/90 p-3 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5 focus-within:border-[#e9e400]/40">
            <Search size={16} className="shrink-0 text-[var(--color-mute)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={localizeStatic("نام فارسی یا انگلیسی، عضله یا وسیله…")}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
            />
            {localize(q && <button onClick={() => setQ("")} aria-label={localizeStatic("پاک کردن جستجو")}><RotateCcw size={13} className="text-[var(--color-mute)]" /></button>)}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <select aria-label={localizeStatic("فیلتر وسیله")} className={`${inputCls} h-10 min-w-0 text-[11.5px] sm:w-32`} value={eq} onChange={(e) => setEq(e.target.value)}>
              <option value="همه">{localizeStatic("همه")}</option>{localize(EQUIPMENT.map((m) => <option key={m} value={m}>{localize(m)}</option>))}
            </select>
            <select aria-label={localizeStatic("فیلتر سطح")} className={`${inputCls} h-10 min-w-0 text-[11.5px] sm:w-28`} value={lv} onChange={(e) => setLv(e.target.value)}>
              <option value="همه">{localizeStatic("همه")}</option><option value="مبتدی">{localizeStatic("مبتدی")}</option><option value="متوسط">{localizeStatic("متوسط")}</option><option value="پیشرفته">{localizeStatic("پیشرفته")}</option>
            </select>
            <select aria-label={localizeStatic("مرتب‌سازی")} className={`${inputCls} h-10 min-w-0 text-[11.5px] sm:w-32`} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="name">{localizeStatic("ترتیب نام")}</option><option value="muscle">{localizeStatic("گروه عضلانی")}</option><option value="level">{localizeStatic("سطح سختی")}</option>
            </select>
          </div>
        </div>
        <div className="noscroll flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {localize(["همه", ...MUSCLES].map((m) => (
            <button
              key={m}
              onClick={() => setMuscle(m)}
              className={`press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition ${muscle === m ? "bg-[#e9e400] text-black" : "bg-[var(--color-card)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"}`}
            >
              {localize(m)}
            </button>
          )))}
          {localize(filtered && (
            <button onClick={reset} className="press mr-auto flex shrink-0 items-center gap-1 rounded-full border border-red-500/20 px-3 py-1.5 text-[10.5px] font-bold text-red-400">
              <RotateCcw size={12} />{localizeStatic(" پاک کردن فیلترها")}</button>
          ))}
        </div>
      </section>

      <div data-reveal className="flex items-center justify-between gap-2">
        <p className="tnum text-[12px] text-[var(--color-mute)]">{localizeStatic("نمایش ")}<b className="text-[var(--color-ink)]">{localize(fa(list.length))}</b>{localizeStatic(" از ")}{localize(fa(EXERCISES.length))}{localizeStatic(" حرکت")}</p>
        <div className="flex rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-1" aria-label={localizeStatic("نوع نمایش")}>
          <button onClick={() => setView("grid")} aria-label={localizeStatic("نمای شبکه‌ای")} aria-pressed={view === "grid"} className={`press flex h-7 w-8 items-center justify-center rounded-lg ${view === "grid" ? "bg-[#e9e400] text-black" : "text-[var(--color-mute)]"}`}><Grid2X2 size={14} /></button>
          <button onClick={() => setView("list")} aria-label={localizeStatic("نمای فهرستی")} aria-pressed={view === "list"} className={`press flex h-7 w-8 items-center justify-center rounded-lg ${view === "list" ? "bg-[#e9e400] text-black" : "text-[var(--color-mute)]"}`}><List size={15} /></button>
        </div>
      </div>

      <div className={view === "grid" ? "grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2"}>
        {localize(list.map((e) => (
          <button
            key={e.id}
            data-reveal
            onClick={() => setEx(e)}
            className={`library-card glass group overflow-hidden text-right ${view === "grid" ? "rounded-[20px]" : "flex w-full items-center gap-3 rounded-[20px] p-2"}`}
          >
            <span className={`ex-image-wrap relative block shrink-0 overflow-hidden bg-black ${view === "grid" ? "h-36 w-full sm:h-44" : "h-[76px] w-[92px] rounded-2xl sm:h-20 sm:w-28"}`}>
              <img src={e.image} alt={localize(`${e.name} — اجرای دقیق`)} loading="lazy" decoding="async" className="h-full w-full object-cover" />
               <span className="glass absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black text-white">
                 <Play size={11} className="text-[#e9e400]" />{localizeStatic(" نمایش سه‌بعدی")}</span>
              {localize(view === "grid" && (
                <span className="glass absolute right-2 top-2 rounded-full px-2 py-1 text-[9px] font-black text-white">
                  {localize(e.level)}
                </span>
              ))}
            </span>
            <span className={`block min-w-0 flex-1 ${view === "grid" ? "p-3" : "py-1 pl-1"}`}>
              <b className="block truncate text-[13px] sm:text-[13.5px]">{localize(e.name)}</b>
              {currentLanguage() === "en" && <span dir="ltr" className="mt-0.5 block truncate text-left text-[9px] font-semibold tracking-wide text-[var(--color-mute)] sm:text-[9.5px]">{e.en}</span>}
              <span className="mt-2 flex flex-wrap gap-1">
                <Pill tone="brand">{localize(e.muscle)}</Pill><Pill>{localize(e.equipment)}</Pill>
                {localize(view === "list" && <Pill tone="info">{localize(e.level)}</Pill>)}
              </span>
              {localize(view === "list" && <span className="mt-1.5 line-clamp-1 block text-[11px] text-[var(--color-mute)]">{localize(e.how)}</span>)}
            </span>
            {localize(view === "list" && <ChevronLeft size={16} className="shrink-0 text-[var(--color-mute)] transition-transform group-hover:-translate-x-1" />)}
          </button>
        )))}
      </div>
      {localize(list.length === 0 && (
        <div data-reveal className="rounded-3xl border border-dashed border-[var(--color-line)] py-12 text-center">
          <SlidersHorizontal size={24} className="mx-auto text-[var(--color-mute)]" />
          <b className="mt-2 block text-[13px]">{localizeStatic("حرکتی با این مشخصات پیدا نشد")}</b>
          <p className="mt-1 text-[11.5px] text-[var(--color-mute)]">{localizeStatic("فیلترها را تغییر بده یا همه را پاک کن.")}</p>
          <button onClick={reset} className="press mt-3 rounded-full bg-[#e9e400] px-4 py-2 text-[11.5px] font-black text-black">{localizeStatic("نمایش همه حرکات")}</button>
        </div>
      ))}

      <Modal open={!!ex} onClose={() => setEx(null)} title={localize(ex?.name ?? "")} wide>
        {localize(ex && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
               <ExVideo exerciseId={ex.id} posterClass="aspect-[4/3] w-full rounded-xl object-cover sm:aspect-video" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill tone="brand">{localize(ex.muscle)}</Pill>
                <Pill>{localize(ex.equipment)}</Pill>
                <Pill tone="info">{localize(ex.level)}</Pill>
              </div>
              <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">{localizeStatic("سطح سختی")}</span>
                  <b>{localize(ex.level)}</b>
                </div>
                <div className="mt-2 flex gap-1.5" dir="ltr">
                  {localize([1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= difficulty(ex.level) ? "bg-[#e9e400]" : "bg-white/10"}`} />))}
                </div>
              </div>
            </div>
            <div className="space-y-4 text-[12.5px] leading-7">
              <div>
                <span className="text-[10px] font-black tracking-wider text-[#e9e400]">{localizeStatic("نحوه اجرا")}</span>
                <p className="mt-1 text-[var(--color-mute)]">{localize(ex.how)}</p>
              </div>
              <div>
                <b className="text-[12px]">{localizeStatic("مراحل حرکت")}</b>
                <ol className="mt-2 space-y-2">
                  {localize(ex.steps.map((s, i) => (
                    <li key={s} className="flex items-start gap-2 rounded-xl bg-[var(--color-bg)] p-2.5">
                      <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e9e400] text-[10px] font-black text-black">{localize(fa(i + 1))}</span>
                      <span className="text-[var(--color-mute)]">{localize(s)}</span>
                    </li>
                  )))}
                </ol>
              </div>
              <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.06] p-3">
                <b className="text-[12px] text-red-400">{localizeStatic("اشتباهات رایج")}</b>
                <ul className="mt-1 list-disc pr-5 text-[var(--color-mute)]">{localize(ex.mistakes.map((s) => <li key={s}>{localize(s)}</li>))}</ul>
              </div>
              <div className="rounded-2xl border border-[#e9e400]/20 bg-[#e9e400]/[0.06] p-3">
                <b className="text-[12px] text-[#e9e400]">{localizeStatic("نکته مربی")}</b>
                <p className="mt-1 text-[var(--color-mute)]">{localize(ex.tips)}</p>
              </div>
              <p className="text-[11.5px] text-[var(--color-mute)]"><b className="text-[var(--color-ink)]">{localizeStatic("حرکات جایگزین: ")}</b>{localize(ex.alternatives.join("، "))}</p>
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}

function LibraryStat({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 px-2">
      <span className="hidden text-[#e9e400] sm:block">{localize(icon)}</span>
      <span>
        <b className="tnum block text-center text-[16px] font-black sm:text-right">{localize(fa(value))}</b>
        <span className="block text-center text-[9.5px] text-[var(--color-mute)] sm:text-right">{localize(label)}</span>
      </span>
    </div>
  );
}

function Programs({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, session, userById, saveProgram, removeProgram, addProgramItem, updateProgramItem, moveItem, removeItem, saveWorkoutTemplate, deleteWorkoutTemplate } = useStore();
  const [sid, setSid] = useState(data.students[0]?.id ?? "");
  const [pid, setPid] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<"lib" | "mine">("lib");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ dayId: string; item: ProgramSet } | null>(null);

  const list = data.programs.filter((p) => !sid || p.studentId === sid);
  const program = data.programs.find((p) => p.id === pid) ?? list[0];
  const mine = data.coachExercises.filter((c) => !c.coachId || c.coachId === session?.userId);

  const createDraft = () => {
    if (!sid) { onToast("شاگرد نیست", "اول از بخش شاگردان یک نفر اضافه کن"); return; }
    const p: WorkoutProgram = {
      id: uid("pr"),
      studentId: sid,
      name: "برنامه جدید",
      goal: "عمومی",
      weeks: 8,
      startDate: dayKey(),
      endDate: dayKey(addDays(new Date(), 56)),
      createdAt: nowIso(),
      status: "فعال",
      days: WEEK.slice(0, 4).map((w, i) => ({ id: uid("d"), weekday: w, focus: i % 2 ? "بالاتنه" : "پایین‌تنه", items: [] })),
    };
    saveProgram(p);
    setPid(p.id);
    onToast("برنامه ساخته و ذخیره شد", "هر تغییری خودکار برای شاگرد ذخیره می‌شود");
  };

  const suggest = () => {
    const st = data.students.find((s) => s.id === sid);
    const days = st?.assessment.daysPerWeek ?? 4;
    if (!sid) { onToast("شاگرد نیست", "اول شاگرد اضافه کن"); return; }
    const p: WorkoutProgram = {
      id: uid("pr"),
      studentId: sid,
      name: `پیشنهاد هوشمند — ${st?.goal ?? "فیتنس"}`,
      goal: st?.goal ?? "فیتنس",
      weeks: 8,
      startDate: dayKey(),
      endDate: dayKey(addDays(new Date(), 56)),
      createdAt: nowIso(),
      status: "فعال",
      days: WEEK.slice(0, days).map((w, i) => ({
        id: uid("d"),
        weekday: w,
        focus: ["سینه + پشت بازو", "پشت + جلو بازو", "پا + باسن", "شانه + شکم", "تمام بدن"][i % 5],
        items: [
          { id: uid("it"), exerciseId: ["ex-bench", "ex-lat", "ex-squat", "ex-ohp", "ex-pushup"][i % 5], sets: 4, reps: "۱۰", weight: "RPE ۸", rest: 90, tempo: "۳-۰-۱", rpe: 8, notes: "پیشنهاد AI — قابل ویرایش" },
          { id: uid("it"), exerciseId: ["ex-incline-db", "ex-row", "ex-rdl", "ex-latraise", "ex-plank"][i % 5], sets: 3, reps: "۱۲", weight: "متوسط", rest: 75, tempo: "۲-۰-۱", rpe: 7, notes: "" },
        ],
      })),
    };
    saveProgram(p);
    setPid(p.id);
    onToast("برنامه پیشنهادی ذخیره شد", "هر تغییری خودکار ذخیره می‌شود");
  };

  return (
    <div className="screen-in grid gap-3 lg:grid-cols-[280px_1fr]">
      <div>
        <Field label={localizeStatic("شاگرد")}>
          <select className={inputCls} value={sid} onChange={(e) => { setSid(e.target.value); setPid(null); }}>
            {data.students.map((s) => <option key={s.id} value={s.id}>{userById(s.userId)?.name}</option>)}
          </select>
        </Field>
        <div className="mt-3 flex gap-2">
          <BrandBtn className="flex-1 text-[12px]" onClick={createDraft}><Plus size={14} />{localizeStatic(" برنامه")}</BrandBtn>
          <button onClick={suggest} className="press flex h-11 flex-1 items-center justify-center gap-1 rounded-full border border-[#e9e400]/40 text-[12px] font-black text-[#e9e400]"><Sparkles size={14} />{localizeStatic(" پیشنهاد AI")}</button>
        </div>
        <div className="mt-3 space-y-2">
          {localize(list.map((p) => {
            const active = program?.id === p.id;
            const exCount = p.days.reduce((a, d) => a + d.items.length, 0);
            return (
              <div key={p.id} className={`flex items-center gap-1 rounded-2xl border p-2 ${active ? "border-[#e9e400] bg-[#e9e400]/10" : "border-[var(--color-line)] bg-[var(--color-card)]"}`}>
                <button onClick={() => setPid(p.id)} className="press min-w-0 flex-1 text-right">
                  <b className="block truncate text-[13px]">{p.name}</b>
                  <span className="tnum text-[11px] text-[var(--color-mute)]">{localize(p.status)} • {localize(fa(p.days.length))}{localizeStatic(" روز • ")}{localize(fa(exCount))}{localizeStatic(" حرکت")}</span>
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`برنامه «${p.name}» برای همیشه حذف شود؟ شاگرد دیگر آن را نمی‌بیند.`)) return;
                    removeProgram(p.id);
                    if (pid === p.id) setPid(null);
                    onToast("برنامه حذف شد", p.name);
                  }}
                  className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
                  aria-label={localizeStatic("حذف برنامه")}
                  title={localizeStatic("حذف برنامه")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          }))}
          {localize(list.length === 0 && <Empty text="برنامه‌ای نیست" />)}
        </div>
        <div className="mt-4 space-y-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3">
          <b className="text-[12px]">{localizeStatic("قالب‌های تمرینی من")}</b>
          {localize(data.workoutTemplates.length === 0 && <p className="text-[11px] text-[var(--color-mute)]">{localizeStatic("از یک برنامه ساخته‌شده، قالب ذخیره کن و دوباره استفاده کن.")}</p>)}
          {localize(data.workoutTemplates.map((template) => <div key={template.id} className="flex items-center gap-1 rounded-xl bg-[var(--color-bg)] p-2 text-[11px]"><span className="min-w-0 flex-1 truncate">{template.name} • {localize(fa(template.days.length))}{localizeStatic(" روز")}</span><button title={localizeStatic("ساخت برنامه از قالب")} className="text-[#e9e400]" onClick={() => { if (!sid) return onToast("شاگرد انتخاب کن", ""); const p: WorkoutProgram = {id:uid('pr'),studentId:sid,name:template.name,goal:'عمومی',weeks:8,startDate:dayKey(),endDate:dayKey(addDays(new Date(),56)),createdAt:nowIso(),status:'فعال',days:structuredClone(template.days).map((d) => ({...d,id:uid('d'),items:d.items.map((it) => ({...it,id:uid('it')}))}))};saveProgram(p);setPid(p.id);onToast("برنامه از قالب ساخته شد",template.name); }}>{localizeStatic("استفاده")}</button><button title={localizeStatic("حذف قالب")} className="text-red-400" onClick={() => { if(confirm('قالب حذف شود؟')) deleteWorkoutTemplate(template.id); }}><Trash2 size={13}/></button></div>))}
        </div>
      </div>

      {localize(program ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input className={`${inputCls} max-w-xs`} value={program.name} onChange={(e) => saveProgram({ ...program, name: e.target.value })} />
            <Pill tone={program.status === "فعال" ? "ok" : program.status === "پیش‌نویس" ? "info" : "warn"}>{localize(program.status)}</Pill>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-400">
              <CloudCheck size={13} />{localizeStatic(" ذخیره خودکار")}</span>
            <button className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[11px]" onClick={() => { saveWorkoutTemplate({id:uid('template'),coachId:session?.userId || '',name:program.name,days:structuredClone(program.days),createdAt:nowIso()});onToast('قالب ذخیره شد',program.name); }}>{localizeStatic("ذخیره به‌عنوان قالب")}</button>
            <button
              onClick={() => {
                if (!confirm(`برنامه «${program.name}» برای همیشه حذف شود؟`)) return;
                removeProgram(program.id);
                setPid(null);
                onToast("برنامه حذف شد", program.name);
              }}
              className="press mr-auto flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1.5 text-[11.5px] font-bold text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={13} />{localizeStatic(" حذف برنامه")}</button>
          </div>
          <div className="space-y-3">
            {localize(program.days.map((day) => (
              <div key={day.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-2 text-[12.5px] font-black outline-none focus:border-[#e9e400]/50"
                    value={day.weekday}
                    onChange={(e) => saveProgram({ ...program, days: program.days.map((x) => (x.id === day.id ? { ...x, weekday: e.target.value } : x)) })}
                    aria-label={localizeStatic("روز هفته")}
                  >
                    {localize(WEEK.map((w) => <option key={w} value={w}>{localize(w)}</option>))}
                  </select>
                  <input
                    className="h-9 min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 text-[12.5px] outline-none focus:border-[#e9e400]/50"
                    value={day.focus}
                    onChange={(e) => saveProgram({ ...program, days: program.days.map((x) => (x.id === day.id ? { ...x, focus: e.target.value } : x)) })}
                    placeholder={localizeStatic("تمرکز روز (مثلاً سینه + پشت بازو)")}
                  />
                  <button onClick={() => setPicker(day.id)} className="press flex items-center gap-1 rounded-full bg-[#e9e400] px-3 py-1.5 text-[11px] font-black text-black"><Plus size={12} />{localizeStatic(" حرکت")}</button>
                  <button
                    onClick={() => { if (confirm("این روز از برنامه حذف شود؟")) saveProgram({ ...program, days: program.days.filter((x) => x.id !== day.id) }); }}
                    className="press text-red-400"
                    aria-label={localizeStatic("حذف روز")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {localize(day.items.map((it, idx) => {
                  const e = resolveExercise(it.exerciseId, data);
                  return (
                    <div key={it.id} className="mb-1.5 flex items-center gap-2 rounded-xl bg-[var(--color-bg)] p-2">
                      <ExThumb exerciseId={it.exerciseId} data={data} />
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-[12.5px]">
                          {localize(e.name)}
                          {localize(e.isCustom && <span className="mr-1.5 rounded-full bg-[#e9e400]/15 px-1.5 py-0.5 text-[9px] font-black text-[#e9e400]">{localizeStatic("من")}</span>)}
                        </b>
                        <span className="tnum text-[11px] text-[var(--color-mute)]">{localize(fa(it.sets))}{localizeStatic(" ست × ")}{localize(it.reps)} • {localize(it.weight)}{localizeStatic(" • استراحت ")}{localize(fa(it.rest))}{localizeStatic("ث • RPE ")}{localize(fa(it.rpe))}</span>
                      </div>
                      <button onClick={() => setEditing({ dayId: day.id, item: { ...it } })} className="text-[#e9e400]" title={localizeStatic("تنظیم ست و تکرار")}><Pencil size={14} /></button>
                      <button onClick={() => moveItem(program.id, day.id, idx, -1)} className="text-[var(--color-mute)]"><ChevronUp size={16} /></button>
                      <button onClick={() => moveItem(program.id, day.id, idx, 1)} className="text-[var(--color-mute)]"><ChevronDown size={16} /></button>
                      <button onClick={() => removeItem(program.id, day.id, it.id)} className="text-red-400"><Trash2 size={14} /></button>
                    </div>
                  );
                }))}
                {localize(day.items.length === 0 && <p className="py-2 text-center text-[11.5px] text-[var(--color-mute)]">{localizeStatic("حرکتی نیست — دکمه «حرکت» را بزن")}</p>)}
              </div>
            )))}
            <button
              onClick={() => {
                const used = new Set(program.days.map((d) => d.weekday));
                const wd = WEEK.find((w) => !used.has(w)) ?? WEEK[0];
                saveProgram({ ...program, days: [...program.days, { id: uid("d"), weekday: wd, focus: "تمرین", items: [] }] });
              }}
              className="press flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#e9e400]/40 py-3 text-[12.5px] font-black text-[#e9e400]"
            >
              <Plus size={14} />{localizeStatic(" افزودن روز تمرین")}</button>
          </div>
          {localize(!!program.revisions?.length && <details className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3">
            <summary className="cursor-pointer text-[12px] font-bold">{localizeStatic("نسخه‌های پیشین برنامه (")}{localize(fa(program.revisions.length))})</summary>
            <div className="mt-2 space-y-1.5">{localize([...program.revisions].reverse().map((revision) => <div key={`${revision.version}-${revision.at}`} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-bg)] p-2 text-[11px]"><span>{localizeStatic("نسخه ")}{localize(fa(revision.version))} • {revision.name} • {localize(fa(revision.days.length))}{localizeStatic(" روز")}</span><button className="text-[#e9e400]" onClick={() => { if (confirm("نسخه قبلی روی برنامه فعلی اعمال شود؟ نسخه فعلی در تاریخچه باقی می‌ماند.")) saveProgram({ ...program, name: revision.name, days: structuredClone(revision.days) }); }}>{localizeStatic("بازیابی")}</button></div>))}</div>
          </details>)}
        </div>
      ) : (
        <Empty text="یک برنامه انتخاب کن یا بساز" />
      ))}

      <Modal open={!!picker} onClose={() => setPicker(null)} title={localizeStatic("افزودن حرکت به برنامه")} wide>
        <div className="mb-2 flex gap-2">
          <button onClick={() => setPickerTab("lib")} className={`press rounded-full px-4 py-2 text-[12px] font-black ${pickerTab === "lib" ? "bg-[#e9e400] text-black" : "bg-[var(--color-bg)]"}`}>{localizeStatic("کتابخانه عمومی")}</button>
          <button onClick={() => setPickerTab("mine")} className={`press rounded-full px-4 py-2 text-[12px] font-black ${pickerTab === "mine" ? "bg-[#e9e400] text-black" : "bg-[var(--color-bg)]"}`}>{localizeStatic("حرکات من (")}{localize(fa(mine.length))})
          </button>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder={localizeStatic("جستجو حرکت…")} />
        <div className="mt-3 grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {localize(pickerTab === "lib" &&
            EXERCISES.filter((e) => !q || e.name.includes(q)).map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  if (!program || !picker) return;
                  const item: ProgramSet = { id: uid("it"), exerciseId: e.id, sets: 3, reps: "۱۰", weight: "—", rest: 90, tempo: "۳-۰-۱", rpe: 7, notes: "" };
                  addProgramItem(program.id, picker, item);
                  setPicker(null);
                  setEditing({ dayId: picker, item });
                }}
                className="press flex items-center gap-2 rounded-xl bg-[var(--color-bg)] p-2 text-right"
              >
                <img src={e.image} className="h-10 w-10 rounded-lg object-cover" alt="" />
                <span className="flex-1"><b className="block text-[12.5px]">{localize(e.name)}</b><span className="text-[11px] text-[var(--color-mute)]">{localize(e.muscle)}</span></span>
              </button>
            )))}
          {localize(pickerTab === "mine" && mine.length === 0 && (
            <p className="col-span-2 rounded-xl bg-[var(--color-bg)] p-4 text-center text-[12px] text-[var(--color-mute)]">{localizeStatic("هنوز حرکتی نساختی. از منوی «حرکات و ویدیوهای من» بساز.")}</p>
          ))}
          {localize(pickerTab === "mine" &&
            mine.filter((e) => !q || e.name.includes(q)).map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  if (!program || !picker) return;
                  const item: ProgramSet = {
                    id: uid("it"),
                    exerciseId: e.id,
                    sets: e.defaultSets,
                    reps: e.defaultReps,
                    weight: e.defaultWeight,
                    rest: e.defaultRest,
                    tempo: e.defaultTempo,
                    rpe: e.defaultRpe,
                    notes: "",
                  };
                  addProgramItem(program.id, picker, item);
                  setPicker(null);
                  setEditing({ dayId: picker, item });
                }}
                className="press flex items-center gap-2 rounded-xl border border-[#e9e400]/25 bg-[var(--color-bg)] p-2 text-right"
              >
                <ExThumb exerciseId={e.id} data={data} />
                <span className="flex-1">
                  <b className="block text-[12.5px]">{localize(e.name)}</b>
                  <span className="tnum text-[11px] text-[var(--color-mute)]">{localize(e.muscle)} • {localize(fa(e.defaultSets))}×{localize(e.defaultReps)}</span>
                </span>
              </button>
            )))}
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={localizeStatic("تنظیم ست و تکرار")}>
        {localize(editing && program && (
          <ItemEditor
            name={resolveExercise(editing.item.exerciseId, data).name}
            item={editing.item}
            onChange={(item) => setEditing({ ...editing, item })}
            onSave={() => {
              updateProgramItem(program.id, editing.dayId, editing.item);
              setEditing(null);
              onToast("ذخیره شد", `${fa(editing.item.sets)} ست × ${editing.item.reps}`);
            }}
          />
        ))}
      </Modal>
    </div>
  );
}

function ItemEditor({
  name, item, onChange, onSave,
}: {
  name: string;
  item: ProgramSet;
  onChange: (item: ProgramSet) => void;
  onSave: () => void;
}) {
  const set = (p: Partial<ProgramSet>) => onChange({ ...item, ...p });
  return (
    <div>
      <p className="mb-3 rounded-2xl bg-[var(--color-bg)] p-3 text-[13px] font-black">{localize(name)}</p>
      <div className="grid grid-cols-3 gap-2">
        <Field label={localizeStatic("تعداد ست")}>
          <input className={inputCls} type="number" min={1} max={12} value={item.sets} onChange={(e) => set({ sets: Math.max(1, Number(e.target.value) || 1) })} />
        </Field>
        <Field label={localizeStatic("تکرار هر ست")}>
          <input className={inputCls} value={item.reps} onChange={(e) => set({ reps: e.target.value })} />
        </Field>
        <Field label={localizeStatic("وزن")}>
          <input className={inputCls} value={item.weight} onChange={(e) => set({ weight: e.target.value })} />
        </Field>
        <Field label={localizeStatic("استراحت (ثانیه)")}>
          <input className={inputCls} type="number" value={item.rest} onChange={(e) => set({ rest: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={localizeStatic("RPE")}>
          <input className={inputCls} type="number" min={1} max={10} value={item.rpe} onChange={(e) => set({ rpe: Number(e.target.value) || 7 })} />
        </Field>
        <Field label={localizeStatic("Tempo")}>
          <input className={inputCls} value={item.tempo} onChange={(e) => set({ tempo: e.target.value })} dir="ltr" />
        </Field>
      </div>
      <div className="mt-2">
        <Field label={localizeStatic("توضیح برای شاگرد")}>
          <input className={inputCls} value={item.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      <BrandBtn className="mt-3 w-full" onClick={onSave}>{localizeStatic("ذخیره در برنامه")}</BrandBtn>
    </div>
  );
}
