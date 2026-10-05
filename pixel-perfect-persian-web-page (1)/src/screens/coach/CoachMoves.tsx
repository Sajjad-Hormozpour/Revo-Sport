import { useMemo, useRef, useState } from "react";
import {
  Plus, Play, Pencil, Trash2, Send, Video, Image as ImageIcon,
  Link as LinkIcon, Upload, X, Dumbbell,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { EQUIPMENT, MUSCLES } from "../../data/library";
import type { AppData, CoachExercise, ProgramSet, WorkoutProgram } from "../../data/types";
import { fa, uid } from "../../lib/core";
import { addDays, dayKey, formatJalaliDate, nowIso, WEEK } from "../../lib/time";
import { deleteBlob, saveBlob, useMediaUrl } from "../../lib/media";
import { ExThumb, ExVideo, resolveExercise } from "../../components/exercise";
import {
  BrandBtn, Empty, Field, GhostBtn, Modal, Pill, SearchBox, inputCls,
} from "../../components/ui";

export default function CoachMoves({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, session, saveCoachExercise, removeCoachExercise } = useStore();
  const coachId = session?.userId ?? "";
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("همه");
  const [form, setForm] = useState<CoachExercise | "new" | null>(null);
  const [preview, setPreview] = useState<CoachExercise | null>(null);
  const [assign, setAssign] = useState<CoachExercise | null>(null);

  const mine = useMemo(
    () => data.coachExercises.filter((c) => !c.coachId || c.coachId === coachId),
    [data.coachExercises, coachId]
  );
  const list = mine.filter((c) => {
    if (q && !c.name.includes(q)) return false;
    if (muscle !== "همه" && c.muscle !== muscle) return false;
    return true;
  });

  const startDelete = async (c: CoachExercise) => {
    if (!confirm(`«${c.name}» حذف شود؟`)) return;
    if (c.imageMediaId) await deleteBlob(c.imageMediaId);
    if (c.videoMediaId) await deleteBlob(c.videoMediaId);
    removeCoachExercise(c.id);
    onToast("حذف شد", c.name);
  };

  return (
    <div className="screen-in">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-black">حرکات و ویدیوهای من</h2>
          <p className="tnum mt-0.5 text-[12px] text-[var(--color-mute)]">
            {fa(list.length)} حرکت اختصاصی ذخیره شده • با ست و تکرار به شاگرد بده
          </p>
        </div>
        <BrandBtn onClick={() => setForm("new")}>
          <Plus size={16} /> حرکت جدید
        </BrandBtn>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px]">
        <SearchBox value={q} onChange={setQ} placeholder="جستجو در حرکات من…" />
        <select className={inputCls} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option>همه</option>
          {MUSCLES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      {list.length === 0 && (
        <Empty text="هنوز حرکتی نساختی. دکمه «حرکت جدید» را بزن، ویدیو بگذار و ذخیره کن — بعد به هر شاگردی با ست و تکرار دلخواه بده." />
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
            <button onClick={() => setPreview(c)} className="press relative block w-full text-right">
              <span className="relative block h-36">
                <ExThumb exerciseId={c.id} data={data} className="h-full w-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 left-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#e9e400]">
                  <Play size={15} className="text-black" fill="currentColor" />
                </span>
                <span className="absolute right-2 top-2">
                  <Pill tone="brand">اختصاصی من</Pill>
                </span>
              </span>
            </button>
            <div className="p-3">
              <b className="block truncate text-[14px]">{c.name}</b>
              <p className="tnum mt-1 text-[11.5px] text-[var(--color-mute)]">
                {fa(c.defaultSets)} ست × {c.defaultReps} • استراحت {fa(c.defaultRest)} ثانیه
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Pill>{c.muscle}</Pill>
                <Pill>{c.equipment}</Pill>
                <Pill tone="info">{c.level}</Pill>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setAssign(c)}
                  className="press flex items-center justify-center gap-1 rounded-xl bg-[#e9e400] py-2 text-[11.5px] font-black text-black"
                >
                  <Send size={13} /> دادن به شاگرد
                </button>
                <button
                  onClick={() => setForm(c)}
                  className="press flex items-center justify-center gap-1 rounded-xl bg-[var(--color-bg)] py-2 text-[11.5px] font-bold"
                >
                  <Pencil size={13} /> ویرایش
                </button>
                <button
                  onClick={() => startDelete(c)}
                  className="press flex items-center justify-center gap-1 rounded-xl bg-red-500/10 py-2 text-[11.5px] font-bold text-red-400"
                >
                  <Trash2 size={13} /> حذف
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <MoveForm
          key={form === "new" ? "new" : form.id}
          initial={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSave={(c) => {
            saveCoachExercise(c);
            setForm(null);
            onToast("ذخیره شد", `«${c.name}» در حرکات تو ماند و بعد از خروج هم هست`);
          }}
          onToast={onToast}
        />
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? ""} wide>
        {preview && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <ExVideo exerciseId={preview.id} data={data} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill tone="brand">{preview.muscle}</Pill>
                <Pill>{preview.equipment}</Pill>
                <Pill tone="info">{preview.level}</Pill>
              </div>
            </div>
            <div className="space-y-3 text-[13px] leading-7">
              <div className="rounded-2xl bg-[var(--color-bg)] p-3">
                <b className="text-[12px] text-[var(--color-mute)]">پیش‌فرض پیشنهادی به شاگرد</b>
                <p className="tnum mt-1 font-black">
                  {fa(preview.defaultSets)} ست × {preview.defaultReps} • {preview.defaultWeight} • استراحت{" "}
                  {fa(preview.defaultRest)} ثانیه • RPE {fa(preview.defaultRpe)}
                </p>
              </div>
              {preview.how && <p>{preview.how}</p>}
              {preview.tips && (
                <p>
                  <b>نکته مربی: </b>
                  {preview.tips}
                </p>
              )}
              <p className="text-[11.5px] text-[var(--color-mute)]">ساخته شده در {formatJalaliDate(preview.createdAt)}</p>
              <div className="flex gap-2">
                <BrandBtn
                  onClick={() => {
                    setAssign(preview);
                    setPreview(null);
                  }}
                >
                  <Send size={15} /> دادن به شاگرد
                </BrandBtn>
                <GhostBtn
                  onClick={() => {
                    setForm(preview);
                    setPreview(null);
                  }}
                >
                  ویرایش
                </GhostBtn>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {assign && (
        <AssignMove
          key={assign.id}
          exercise={assign}
          onClose={() => setAssign(null)}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function blankMove(coachId: string): CoachExercise {
  return {
    id: uid("cx"),
    coachId,
    name: "",
    en: "",
    muscle: "سینه",
    equipment: "وزن بدن",
    level: "مبتدی",
    imageUrl: "",
    imageMediaId: "",
    videoUrl: "",
    videoMediaId: "",
    how: "",
    tips: "",
    defaultSets: 3,
    defaultReps: "۱۰",
    defaultWeight: "وزن بدن",
    defaultRest: 60,
    defaultRpe: 7,
    defaultTempo: "۳-۰-۱",
    createdAt: nowIso(),
  };
}

function MoveForm({
  initial, onClose, onSave, onToast,
}: {
  initial: CoachExercise | null;
  onClose: () => void;
  onSave: (c: CoachExercise) => void;
  onToast: (t: string, d: string) => void;
}) {
  const { session } = useStore();
  const [m, setM] = useState<CoachExercise>(() => initial ?? blankMove(session?.userId ?? ""));
  const [imgTab, setImgTab] = useState<"url" | "upload">(m.imageMediaId ? "upload" : "url");
  const [vidTab, setVidTab] = useState<"url" | "upload">(m.videoMediaId ? "upload" : "url");
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const imgPreview = useMediaUrl(imgTab === "upload" ? m.imageMediaId || null : null);
  const vidPreview = useMediaUrl(vidTab === "upload" ? m.videoMediaId || null : null);

  const set = (p: Partial<CoachExercise>) => setM((x) => ({ ...x, ...p }));

  const pickImage = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return onToast("فایل معتبر نیست", "یک عکس انتخاب کن");
    setBusy(true);
    try {
      const id = uid("media");
      await saveBlob(id, f);
      if (m.imageMediaId) await deleteBlob(m.imageMediaId);
      set({ imageMediaId: id, imageUrl: "" });
      onToast("عکس ذخیره شد", "روی همین دستگاه می‌ماند");
    } finally {
      setBusy(false);
    }
  };

  const pickVideo = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) return onToast("فایل معتبر نیست", "یک ویدیو انتخاب کن");
    if (f.size > 200 * 1024 * 1024) return onToast("حجم زیاد است", "ویدیو کمتر از ۲۰۰ مگابایت بگذار");
    setBusy(true);
    try {
      const id = uid("media");
      await saveBlob(id, f);
      if (m.videoMediaId) await deleteBlob(m.videoMediaId);
      set({ videoMediaId: id, videoUrl: "" });
      onToast("ویدیو ذخیره شد", "حتی بعد از بستن اپ هم پخش می‌شود");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!m.name.trim()) return onToast("نام لازم است", "اسم حرکت را بنویس");
    onSave({ ...m, name: m.name.trim(), coachId: session?.userId ?? m.coachId });
  };

  return (
    <Modal open onClose={onClose} title={initial ? "ویرایش حرکت من" : "حرکت جدید من"} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام حرکت *">
          <input className={inputCls} value={m.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً پرس سینه اختصاصی" />
        </Field>
        <Field label="نام انگلیسی">
          <input className={inputCls} value={m.en} onChange={(e) => set({ en: e.target.value })} dir="ltr" placeholder="My Bench Press" />
        </Field>
        <Field label="عضله">
          <select className={inputCls} value={m.muscle} onChange={(e) => set({ muscle: e.target.value })}>
            {MUSCLES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="وسیله">
          <select className={inputCls} value={m.equipment} onChange={(e) => set({ equipment: e.target.value })}>
            {EQUIPMENT.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="سطح">
          <select className={inputCls} value={m.level} onChange={(e) => set({ level: e.target.value as CoachExercise["level"] })}>
            <option>مبتدی</option>
            <option>متوسط</option>
            <option>پیشرفته</option>
          </select>
        </Field>
        <Field label="نحوه اجرا">
          <input className={inputCls} value={m.how} onChange={(e) => set({ how: e.target.value })} placeholder="یک خط توضیح برای شاگرد" />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <b className="flex items-center gap-1.5 text-[13px]">
              <ImageIcon size={15} className="text-[#e9e400]" /> عکس حرکت
            </b>
            <div className="flex gap-1">
              <TabBtn active={imgTab === "url"} onClick={() => setImgTab("url")}>لینک</TabBtn>
              <TabBtn active={imgTab === "upload"} onClick={() => setImgTab("upload")}>آپلود</TabBtn>
            </div>
          </div>
          {imgTab === "url" ? (
            <input className={inputCls} value={m.imageUrl} onChange={(e) => set({ imageUrl: e.target.value, imageMediaId: "" })} placeholder="https://…" dir="ltr" />
          ) : (
            <>
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
              <button onClick={() => imgRef.current?.click()} disabled={busy} className="press flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-line)] py-3 text-[12.5px] font-bold">
                <Upload size={15} /> {m.imageMediaId ? "تعویض عکس" : "انتخاب عکس از گوشی / کامپیوتر"}
              </button>
              {(imgPreview || m.imageMediaId) && <p className="mt-1 text-[11px] text-emerald-400">عکس آپلود شده و ذخیره است ✓</p>}
            </>
          )}
          {(imgPreview || m.imageUrl) && (
            <img src={imgPreview || m.imageUrl} alt="" className="mt-2 h-28 w-full rounded-xl object-cover" />
          )}
        </div>

        <div className="rounded-2xl bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <b className="flex items-center gap-1.5 text-[13px]">
              <Video size={15} className="text-[#e9e400]" /> ویدیو حرکت
            </b>
            <div className="flex gap-1">
              <TabBtn active={vidTab === "url"} onClick={() => setVidTab("url")}>لینک</TabBtn>
              <TabBtn active={vidTab === "upload"} onClick={() => setVidTab("upload")}>آپلود</TabBtn>
            </div>
          </div>
          {vidTab === "url" ? (
            <>
              <input className={inputCls} value={m.videoUrl} onChange={(e) => set({ videoUrl: e.target.value, videoMediaId: "" })} placeholder="mp4 / یوتیوب / آپارات…" dir="ltr" />
              <p className="mt-1 flex items-center gap-1 text-[10.5px] text-[var(--color-mute)]">
                <LinkIcon size={11} /> لینک مستقیم mp4، یوتیوب و آپارات پخش می‌شود
              </p>
            </>
          ) : (
            <>
              <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={(e) => pickVideo(e.target.files?.[0])} />
              <button onClick={() => vidRef.current?.click()} disabled={busy} className="press flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-line)] py-3 text-[12.5px] font-bold">
                <Upload size={15} /> {m.videoMediaId ? "تعویض ویدیو" : "انتخاب ویدیو از گوشی / کامپیوتر"}
              </button>
              {(vidPreview || m.videoMediaId) && <p className="mt-1 text-[11px] text-emerald-400">ویدیو آپلود و ذخیره شد ✓</p>}
              {vidPreview && <video src={vidPreview} className="mt-2 h-28 w-full rounded-xl bg-black object-cover" controls />}
            </>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-[#e9e400]/25 bg-[#e9e400]/[0.05] p-3">
        <b className="flex items-center gap-1.5 text-[13px]">
          <Dumbbell size={15} className="text-[#e9e400]" /> پیش‌فرض ست و تکرار برای شاگرد
        </b>
        <p className="mt-1 text-[11.5px] text-[var(--color-mute)]">موقع دادن به شاگرد می‌توانی همین‌ها را تغییر بدهی.</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Field label="ست">
            <input className={inputCls} type="number" min={1} max={12} value={m.defaultSets} onChange={(e) => set({ defaultSets: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <Field label="تکرار">
            <input className={inputCls} value={m.defaultReps} onChange={(e) => set({ defaultReps: e.target.value })} />
          </Field>
          <Field label="وزن">
            <input className={inputCls} value={m.defaultWeight} onChange={(e) => set({ defaultWeight: e.target.value })} />
          </Field>
          <Field label="استراحت (ثانیه)">
            <input className={inputCls} type="number" value={m.defaultRest} onChange={(e) => set({ defaultRest: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="RPE">
            <input className={inputCls} type="number" min={1} max={10} value={m.defaultRpe} onChange={(e) => set({ defaultRpe: Number(e.target.value) || 7 })} />
          </Field>
          <Field label="Tempo">
            <input className={inputCls} value={m.defaultTempo} onChange={(e) => set({ defaultTempo: e.target.value })} dir="ltr" />
          </Field>
        </div>
      </div>

      <Field label="نکته مربی">
        <input className={inputCls} value={m.tips} onChange={(e) => set({ tips: e.target.value })} placeholder="مثلاً کمر را صاف نگه دار" />
      </Field>

      <BrandBtn className="mt-4 w-full" onClick={save}>
        ذخیره حرکت
      </BrandBtn>
    </Modal>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-black ${active ? "bg-[#e9e400] text-black" : "bg-white/10"}`}
    >
      {children}
    </button>
  );
}

function AssignMove({
  exercise, onClose, onToast,
}: {
  exercise: CoachExercise;
  onClose: () => void;
  onToast: (t: string, d: string) => void;
}) {
  const { data, userById, addProgramItem, saveProgram } = useStore();
  const [sid, setSid] = useState(data.students[0]?.id ?? "");
  const progs = data.programs.filter((p) => p.studentId === sid);
  const [pid, setPid] = useState("");
  const program = progs.find((p) => p.id === pid) ?? progs[0];
  const [dayId, setDayId] = useState("");
  const [sets, setSets] = useState(exercise.defaultSets);
  const [reps, setReps] = useState(exercise.defaultReps);
  const [weight, setWeight] = useState(exercise.defaultWeight);
  const [rest, setRest] = useState(exercise.defaultRest);
  const [rpe, setRpe] = useState(exercise.defaultRpe);
  const [tempo, setTempo] = useState(exercise.defaultTempo);
  const [notes, setNotes] = useState("");

  const day = program?.days.find((d) => d.id === (dayId || program.days[0]?.id));

  const createProgram = () => {
    if (!sid) return onToast("شاگرد انتخاب کن", "");
    const p: WorkoutProgram = {
      id: uid("pr"),
      studentId: sid,
      name: `برنامه ${exercise.name}`,
      goal: "عمومی",
      weeks: 4,
      startDate: dayKey(),
      endDate: dayKey(addDays(new Date(), 28)),
      createdAt: nowIso(),
      status: "فعال",
      days: WEEK.slice(0, 3).map((w) => ({ id: uid("d"), weekday: w, focus: "تمرین", items: [] })),
    };
    saveProgram(p);
    setPid(p.id);
    onToast("برنامه ساخته شد", "حالا روز را انتخاب کن");
  };

  const submit = () => {
    if (!sid) return onToast("شاگرد انتخاب کن", "");
    if (!program || !day) return onToast("برنامه و روز لازم است", "");
    const item: ProgramSet = {
      id: uid("it"),
      exerciseId: exercise.id,
      sets,
      reps,
      weight,
      rest,
      tempo,
      rpe,
      notes,
    };
    addProgramItem(program.id, day.id, item);
    onToast("به شاگرد داده شد", `${exercise.name} • ${fa(sets)}×${reps} در ${program.name} / ${day.weekday}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`دادن «${exercise.name}» به شاگرد`} wide>
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-[var(--color-bg)] p-2.5">
        <ExThumb exerciseId={exercise.id} data={data} className="h-14 w-14 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[13.5px]">{exercise.name}</b>
          <span className="text-[11.5px] text-[var(--color-mute)]">{exercise.muscle} • {exercise.equipment}</span>
        </div>
        <button onClick={onClose} className="text-[var(--color-mute)]">
          <X size={16} />
        </button>
      </div>

      {data.students.length === 0 ? (
        <Empty text="هنوز شاگردی نداری. اول از بخش شاگردان اضافه کن." />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="شاگرد">
              <select
                className={inputCls}
                value={sid}
                onChange={(e) => {
                  setSid(e.target.value);
                  setPid("");
                  setDayId("");
                }}
              >
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {userById(s.userId)?.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="برنامه">
              <select className={inputCls} value={program?.id ?? ""} onChange={(e) => { setPid(e.target.value); setDayId(""); }}>
                {progs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="روز">
              <select className={inputCls} value={day?.id ?? ""} onChange={(e) => setDayId(e.target.value)}>
                {(program?.days ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.weekday} — {d.focus}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {progs.length === 0 && (
            <button onClick={createProgram} className="press mt-2 w-full rounded-xl border border-dashed border-[#e9e400]/40 py-2.5 text-[12.5px] font-black text-[#e9e400]">
              این شاگرد برنامه ندارد — ساخت برنامه جدید
            </button>
          )}

          <div className="mt-3 rounded-2xl bg-[var(--color-bg)] p-3">
            <b className="text-[13px]">تنظیم ست و تکرار برای این شاگرد</b>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label="تعداد ست">
                <input className={inputCls} type="number" min={1} max={12} value={sets} onChange={(e) => setSets(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
              <Field label="تکرار هر ست">
                <input className={inputCls} value={reps} onChange={(e) => setReps(e.target.value)} />
              </Field>
              <Field label="وزن">
                <input className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} />
              </Field>
              <Field label="استراحت (ثانیه)">
                <input className={inputCls} type="number" value={rest} onChange={(e) => setRest(Number(e.target.value) || 0)} />
              </Field>
              <Field label="RPE">
                <input className={inputCls} type="number" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value) || 7)} />
              </Field>
              <Field label="Tempo">
                <input className={inputCls} value={tempo} onChange={(e) => setTempo(e.target.value)} dir="ltr" />
              </Field>
            </div>
            <Field label="توضیح برای شاگرد">
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً این هفته سبک بزن" />
            </Field>
          </div>

          <BrandBtn className="mt-3 w-full" onClick={submit}>
            <Send size={15} /> ثبت در برنامه شاگرد
          </BrandBtn>
        </>
      )}
    </Modal>
  );
}

export function coachExerciseName(id: string, data: AppData): string {
  return resolveExercise(id, data).name;
}
