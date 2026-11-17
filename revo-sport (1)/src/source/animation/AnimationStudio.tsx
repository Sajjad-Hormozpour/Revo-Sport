import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Boxes, Camera, CheckCircle2, Clapperboard, Download, Film, HelpCircle, Library, ListChecks, Pause, Play, Save, ScanSearch, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import type { CoachExercise } from "../data/types";
import { EXERCISES } from "../data/library";
import { useStore } from "../lib/store";
import { uid } from "../lib/core";
import { nowIso } from "../lib/time";
import { saveBlob } from "../lib/media";
import { resolveExercise } from "../components/exercise";
import { Modal, Pill, Toggle } from "../components/ui";
import { Card, Chip, SectionHead, Seg, areaCls, useTx } from "../nutrition/parts";
import { CATALOG, CATEGORY_LABEL, EQUIP_LABEL, JOINT_LABEL, MUSCLE_LABEL, VIEW_LABEL, VIEW_REASON, type ExerciseDef } from "./catalog";
import { Studio as Studio3D, type Backdrop, type View } from "./rig";
import { download, fileName, pickFormat, recognize, recordClip, renderAt, splitInput, stage, type Phase, type Recognition, type Timeline } from "./motion";

type Item = Recognition & { key: string; chosen?: ExerciseDef };
type ViewChoice = "auto" | View;

const PREVIEW_W = 1280;
const PREVIEW_H = 720;

const MUSCLE_FOR_MOVE: Record<string, string> = {
  chest: "سینه", back: "پشت", shoulders: "شانه", legs: "پا", glutes: "باسن", core: "شکم", fullBody: "تمام بدن",
};

export default function AnimationStudio({ onToast }: { onToast: (title: string, desc: string) => void }) {
  const { data, session, saveCoachExercise } = useStore();
  const { tx, lang } = useTx();
  const L = (pair: [string, string]) => (lang === "fa" ? pair[0] : pair[1]);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewChoice, setViewChoice] = useState<ViewChoice>("auto");
  const [backdrop, setBackdrop] = useState<Backdrop>("light");
  const [highlight, setHighlight] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState<30 | 60>(30);
  const [hud, setHud] = useState<{ phase: Phase; rep: number; progress: number }>({ phase: "start", rep: 0, progress: 0 });
  const [busy, setBusy] = useState<{ label: string; progress: number; index?: number; total?: number } | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const studioRef = useRef<Studio3D | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const clockRef = useRef({ time: 0, last: 0 });
  const recordingRef = useRef(false);
  const cancelRef = useRef({ cancelled: false });
  const [glError, setGlError] = useState(false);

  const current = items.find((item) => item.key === selected);
  const def = current?.chosen ?? current?.def ?? null;
  const view: View = viewChoice === "auto" ? def?.view ?? "side" : viewChoice;
  const format = useMemo(() => pickFormat(backdrop === "transparent"), [backdrop]);
  const ready = items.filter((item) => item.chosen ?? item.def);

  /* ---------------- 3D studio lifecycle ---------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const studio = new Studio3D(canvas);
      studio.setSize(PREVIEW_W, PREVIEW_H);
      studioRef.current = studio;
    } catch {
      setGlError(true);
      return;
    }
    let raf = 0;
    let lastHud = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const studio = studioRef.current;
      const timeline = timelineRef.current;
      const active = currentDefRef.current;
      if (!studio || !timeline || !active || recordingRef.current) return;
      const clock = clockRef.current;
      const dt = clock.last ? Math.min(0.1, (now - clock.last) / 1000) : 0;
      clock.last = now;
      if (playingRef.current) clock.time = (clock.time + dt) % timeline.duration;
      const frame = renderAt(studio, active, timeline, clock.time, highlightRef.current);
      if (now - lastHud > 120) {
        lastHud = now;
        setHud({ phase: frame.phase, rep: frame.rep, progress: clock.time / timeline.duration });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      studioRef.current?.dispose();
      studioRef.current = null;
    };
  }, []);

  const currentDefRef = useRef<ExerciseDef | null>(null);
  const playingRef = useRef(playing);
  const highlightRef = useRef(highlight);
  playingRef.current = playing;
  highlightRef.current = highlight;

  useEffect(() => {
    const studio = studioRef.current;
    currentDefRef.current = def;
    if (!studio || !def || recordingRef.current) return;
    studio.setBackdrop(backdrop);
    studio.setSize(PREVIEW_W, PREVIEW_H);
    timelineRef.current = stage(studio, def, view);
    clockRef.current.time = 0;
  }, [def, view, backdrop]);

  /* ---------------- recognition ---------------- */

  const analyze = useCallback(
    (source: string) => {
      const lines = splitInput(source);
      if (!lines.length) {
        onToast(tx("فهرستی وارد نشده است", "Nothing to analyze"), tx("نام یک یا چند حرکت را وارد کنید؛ هر حرکت در یک خط.", "Enter one or more exercise names, one per line."));
        return;
      }
      const seen = new Set<string>();
      const next: Item[] = [];
      lines.forEach((line, index) => {
        const result = recognize(line);
        const dedupe = result.def ? result.def.id : `?${line}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        next.push({ ...result, key: `${index}-${dedupe}` });
      });
      setItems(next);
      const first = next.find((item) => item.def);
      setSelected(first?.key ?? next[0]?.key ?? null);
      const ok = next.filter((item) => item.status === "ok").length;
      onToast(
        tx("تحلیل انجام شد", "Analysis complete"),
        tx(`${next.length} حرکت بررسی شد؛ ${ok} مورد با اطمینان شناسایی شد.`, `${next.length} exercises analyzed; ${ok} identified with confidence.`),
      );
    },
    [onToast, tx],
  );

  const loadPreset = (source: "catalog" | "library" | "programs") => {
    let names: string[] = [];
    if (source === "catalog") names = CATALOG.map((d) => (lang === "fa" ? d.fa : d.en));
    if (source === "library") names = EXERCISES.map((e) => (lang === "fa" ? e.name : e.en));
    if (source === "programs") {
      const ids = new Set<string>();
      data.programs.forEach((program) => program.days?.forEach((day) => day.items?.forEach((item) => ids.add(item.exerciseId))));
      names = [...ids].map((id) => resolveExercise(id, data)).map((ex) => ex.name).filter(Boolean);
      if (!names.length) {
        onToast(tx("برنامه‌ای پیدا نشد", "No programs found"), tx("هنوز برنامه تمرینی با حرکت ثبت نکرده‌اید.", "You haven't created any workout programs with exercises yet."));
        return;
      }
    }
    const value = names.join("\n");
    setText(value);
    analyze(value);
  };

  const choose = (key: string, defId: string) => {
    const chosen = CATALOG.find((d) => d.id === defId);
    setItems((list) => list.map((item) => (item.key === key ? { ...item, chosen, status: chosen ? "ok" : item.status } : item)));
    setSelected(key);
  };

  /* ---------------- export ---------------- */

  const withRecording = async <T,>(fn: (studio: Studio3D) => Promise<T>): Promise<T | null> => {
    const studio = studioRef.current;
    if (!studio) return null;
    recordingRef.current = true;
    cancelRef.current = { cancelled: false };
    try {
      return await fn(studio);
    } catch (error) {
      const message = (error as Error).message;
      if (message === "cancelled") onToast(tx("تولید متوقف شد", "Export cancelled"), tx("ساخت ویدیو لغو شد.", "Video export was cancelled."));
      else if (message === "recorder-unsupported") onToast(tx("مرورگر پشتیبانی نمی‌کند", "Not supported"), tx("ضبط ویدیو در این مرورگر در دسترس نیست؛ از نسخه به‌روز کروم یا اج استفاده کنید.", "Video recording isn't available in this browser; use an up-to-date Chrome or Edge."));
      else onToast(tx("خطا در ساخت ویدیو", "Export failed"), message);
      return null;
    } finally {
      recordingRef.current = false;
      setBusy(null);
      if (def) {
        studio.setBackdrop(backdrop);
        studio.setSize(PREVIEW_W, PREVIEW_H);
        timelineRef.current = stage(studio, def, view);
      }
    }
  };

  const exportOne = async () => {
    if (!def) return;
    await withRecording(async (studio) => {
      setBusy({ label: lang === "fa" ? def.fa : def.en, progress: 0 });
      const { blob, format: used } = await recordClip({ studio, def, view, backdrop, highlight, fps, onProgress: (p) => setBusy((b) => (b ? { ...b, progress: p } : b)), signal: cancelRef.current });
      download(blob, fileName(def, view, used.ext, backdrop));
      onToast(tx("ویدیو آماده شد", "Video ready"), `${fileName(def, view, used.ext, backdrop)} • ${used.label}`);
    });
  };

  const saveToMoves = async () => {
    if (!def || !session) return;
    await withRecording(async (studio) => {
      setBusy({ label: lang === "fa" ? def.fa : def.en, progress: 0 });
      const { blob } = await recordClip({ studio, def, view, backdrop: backdrop === "transparent" ? "light" : backdrop, highlight, fps, onProgress: (p) => setBusy((b) => (b ? { ...b, progress: p } : b)), signal: cancelRef.current });
      // Poster frame at the peak of the movement.
      const timeline = stage(studio, def, view);
      const peakTime = findPeak(timeline);
      renderAt(studio, def, timeline, peakTime, highlight);
      const poster = await new Promise<Blob | null>((resolve) => studio.canvas.toBlob(resolve, "image/jpeg", 0.88));
      const videoId = uid("media");
      await saveBlob(videoId, blob);
      let imageId = "";
      if (poster) {
        imageId = uid("media");
        await saveBlob(imageId, poster);
      }
      const muscle = def.category === "arms" ? (def.primary.includes("triceps") ? "پشت بازو" : "جلو بازو") : def.primary.includes("calves") ? "ساق" : MUSCLE_FOR_MOVE[def.category];
      const move: CoachExercise = {
        id: uid("cx"),
        coachId: session.userId,
        name: def.fa,
        en: def.en,
        muscle,
        equipment: EQUIP_LABEL[def.equipKey][0].replace(" (سیم‌کش)", ""),
        level: "متوسط",
        imageUrl: "",
        imageMediaId: imageId,
        videoUrl: "",
        videoMediaId: videoId,
        how: [def.info.fa.start, def.info.fa.con, def.info.fa.ecc].join("\n"),
        tips: def.info.fa.mistakes.map((m) => `پرهیز از ${m}`).join("\n"),
        defaultSets: 3,
        defaultReps: def.isometric ? "30 ثانیه" : "10-12",
        defaultWeight: "",
        defaultRest: 90,
        defaultRpe: 8,
        defaultTempo: def.isometric ? "" : "2-0-1-1",
        createdAt: nowIso(),
      };
      saveCoachExercise(move);
      onToast(tx("به «حرکات من» اضافه شد", "Added to My Moves"), tx(`«${def.fa}» با ویدیوی سه‌بعدی ذخیره شد و در برنامه‌های تمرینی قابل استفاده است.`, `“${def.en}” was saved with its 3D video and can be used in programs.`));
    });
  };

  const exportLibrary = async (views: "auto" | View) => {
    setBatchOpen(false);
    const list = ready.map((item) => (item.chosen ?? item.def)!) as ExerciseDef[];
    if (!list.length) return;
    await withRecording(async (studio) => {
      const manifest: Record<string, unknown>[] = [];
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        const v = views === "auto" ? d.view : views;
        setBusy({ label: lang === "fa" ? d.fa : d.en, progress: 0, index: i + 1, total: list.length });
        const { blob, format: used } = await recordClip({ studio, def: d, view: v, backdrop, highlight, fps, onProgress: (p) => setBusy((b) => (b ? { ...b, progress: p } : b)), signal: cancelRef.current });
        const name = fileName(d, v, used.ext, backdrop);
        download(blob, name);
        manifest.push({
          file: name, id: d.id, name_fa: d.fa, name_en: d.en, category: d.category, equipment: d.equipKey, view: v,
          primary_muscles: d.primary, secondary_muscles: d.secondary, joints: d.joints, reps: d.reps ?? 2,
          resolution: "1920x1080", fps, format: used.label,
        });
        await new Promise((r) => setTimeout(r, 400));
      }
      download(new Blob([JSON.stringify({ generator: "Revo sport 3D Studio", createdAt: nowIso(), clips: manifest }, null, 2)], { type: "application/json" }), "exercise_library.json");
      onToast(tx("کتابخانه ویدیویی آماده شد", "Video library ready"), tx(`${list.length} ویدیو به‌همراه فایل فهرست کتابخانه دانلود شد.`, `${list.length} videos and a library manifest were downloaded.`));
    });
  };

  /* ---------------- render ---------------- */

  const phaseLabel: Record<Phase, string> = {
    start: tx("وضعیت شروع", "Start position"),
    concentric: def?.isometric ? tx("نگه داشتن", "Hold") : tx("فاز درونگرا", "Concentric"),
    peak: tx("نقطه اوج", "Peak position"),
    eccentric: def?.isometric ? tx("نگه داشتن", "Hold") : tx("فاز برونگرا", "Eccentric"),
  };
  const statusPill = (item: Item) =>
    item.chosen || item.status === "ok" ? <Pill tone="ok">{tx("شناسایی شد", "Identified")}</Pill>
      : item.status === "ambiguous" ? <Pill tone="warn">{tx("نیاز به تأیید", "Confirm")}</Pill>
        : <Pill tone="danger">{tx("نامشخص", "Unclear")}</Pill>;

  return (
    <div className="screen-in mx-auto max-w-[1400px] space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[18px] font-black">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9e400] text-black"><Clapperboard size={18} /></span>
            {tx("استودیو انیمیشن سه‌بعدی حرکات", "3D Exercise Animation Studio")}
          </h2>
          <p className="mt-1 text-[12px] leading-6 text-[var(--color-mute)]">
            {tx("نام حرکات یا برنامه تمرینی را وارد کنید؛ هر حرکت به‌صورت خودکار شناسایی، تحلیل بیومکانیکی و با آواتار سه‌بعدی اجرا می‌شود.", "Enter exercise names or a workout plan; each exercise is identified, biomechanically analyzed and performed by a 3D avatar.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10.5px] font-bold">
          <span className="rounded-full bg-[var(--color-card)] px-3 py-1.5 text-[var(--color-mute)]">{CATALOG.length} {tx("حرکت در موتور انیمیشن", "exercises in the engine")}</span>
          <span className="tnum rounded-full bg-[var(--color-card)] px-3 py-1.5 text-[var(--color-mute)]">1920×1080 • {fps} FPS • {format?.label ?? tx("ضبط پشتیبانی نمی‌شود", "No recorder")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3">
          <Card>
            <SectionHead icon={<ScanSearch size={15} />} title={tx("شناسایی خودکار حرکات", "Automatic recognition")} hint={tx("هر حرکت در یک خط؛ ست و تکرار به‌صورت خودکار نادیده گرفته می‌شود.", "One exercise per line; sets and reps are ignored automatically.")} />
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              className={areaCls}
              placeholder={tx("مثلاً:\nاسکوات هالتر 4×8\nپرس سینه\nزیربغل سیم‌کش\nPlank", "e.g.\nBarbell squat 4x8\nBench press\nLat pulldown\nپلانک")}
            />
            <button type="button" onClick={() => analyze(text)} className="press mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#e9e400] text-[13px] font-black text-black">
              <Wand2 size={16} /> {tx("تحلیل و ساخت انیمیشن", "Analyze & animate")}
            </button>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip onClick={() => loadPreset("library")}><Library size={12} /> {tx("کتابخانه حرکات اپ", "App library")}</Chip>
              <Chip onClick={() => loadPreset("programs")}><ListChecks size={12} /> {tx("حرکات برنامه‌های من", "My programs")}</Chip>
              <Chip onClick={() => loadPreset("catalog")}><Boxes size={12} /> {tx("همه حرکات موتور", "All engine exercises")}</Chip>
            </div>
          </Card>

          {items.length > 0 && (
            <Card className="!p-2.5">
              <div className="mb-2 flex items-center justify-between px-1.5">
                <b className="text-[12.5px]">{tx("نتیجه تحلیل", "Analysis results")} <span className="tnum text-[var(--color-mute)]">({ready.length}/{items.length})</span></b>
                <button type="button" onClick={() => setItems([])} className="text-[11px] font-bold text-[var(--color-mute)] hover:text-red-400"><Trash2 size={13} className="me-1 inline" />{tx("پاک کردن", "Clear")}</button>
              </div>
              <div className="noscroll max-h-[46dvh] space-y-1 overflow-y-auto">
                {items.map((item) => {
                  const d = item.chosen ?? item.def;
                  const active = item.key === selected;
                  return (
                    <div key={item.key} className={`rounded-xl p-2.5 transition ${active ? "bg-[#e9e400]/10 ring-1 ring-[#e9e400]/40" : "hover:bg-white/5"}`}>
                      <button type="button" onClick={() => setSelected(item.key)} className="flex w-full items-start justify-between gap-2 text-start">
                        <span className="min-w-0">
                          <b className="block truncate text-[12.5px]">{d ? (lang === "fa" ? d.fa : d.en) : item.input}</b>
                          <span className="block truncate text-[10.5px] text-[var(--color-mute)]">
                            {d ? `${tx("ورودی", "Input")}: ${item.input}` : tx("نیاز به توضیح بیشتر", "Needs clarification")}
                          </span>
                        </span>
                        {statusPill(item)}
                      </button>
                      {!item.chosen && item.status !== "ok" && (
                        <div className="mt-2">
                          <p className="mb-1.5 text-[10.5px] leading-5 text-[var(--color-mute)]">
                            {item.status === "ambiguous"
                              ? tx("چند حرکت مشابه پیدا شد؛ حرکت مورد نظر را انتخاب کنید.", "Several similar exercises match; pick the intended one.")
                              : tx("این حرکت با اطمینان شناسایی نشد. برای جلوگیری از ساخت انیمیشن نادرست، نزدیک‌ترین حرکت را انتخاب کنید یا نام دقیق‌تر همراه با تجهیزات بنویسید.", "This exercise couldn't be identified reliably. To avoid an incorrect animation, choose the closest match or enter a more specific name with the equipment.")}
                          </p>
                          <select value="" onChange={(event) => event.target.value && choose(item.key, event.target.value)} className="h-9 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-2 text-[11.5px] font-bold outline-none">
                            <option value="">{tx("انتخاب حرکت…", "Choose exercise…")}</option>
                            {item.suggestions.length > 0 && (
                              <optgroup label={tx("پیشنهادها", "Suggestions")}>
                                {item.suggestions.map((s) => <option key={s.id} value={s.id}>{lang === "fa" ? s.fa : s.en}</option>)}
                              </optgroup>
                            )}
                            <optgroup label={tx("همه حرکات", "All exercises")}>
                              {CATALOG.map((s) => <option key={s.id} value={s.id}>{lang === "fa" ? s.fa : s.en}</option>)}
                            </optgroup>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {ready.length > 1 && (
                <button type="button" disabled={!!busy || !format} onClick={() => setBatchOpen(true)} className="press mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#e9e400]/50 text-[12px] font-black text-[#e9e400] disabled:opacity-40">
                  <Film size={14} /> {tx(`تولید کتابخانه ویدیویی (${ready.length} حرکت)`, `Export video library (${ready.length})`)}
                </button>
              )}
            </Card>
          )}
        </aside>

        <div className="min-w-0 space-y-3">
          <Card className="!p-2.5">
            <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9", background: backdrop === "dark" ? "#15171a" : backdrop === "light" ? "#e9ebee" : "repeating-conic-gradient(#d9dbe0 0% 25%, #f1f2f4 0% 50%) 50% / 24px 24px" }}>
              <canvas ref={canvasRef} className="block h-full w-full" />
              {glError && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-[12.5px] text-[var(--color-mute)]">
                  {tx("مرورگر شما از WebGL پشتیبانی نمی‌کند؛ برای نمایش سه‌بعدی از مرورگر به‌روز استفاده کنید.", "Your browser doesn't support WebGL; use an up-to-date browser for 3D playback.")}
                </div>
              )}
              {!def && !glError && (
                <div className="absolute inset-0 grid place-items-center bg-[var(--color-card)]/92 p-6 text-center">
                  <div>
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9e400]/12 text-[#e9e400]"><Sparkles size={26} /></span>
                    <b className="mt-3 block text-[15px] font-black">{tx("حرکتی برای نمایش انتخاب نشده است", "No exercise selected")}</b>
                    <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-6 text-[var(--color-mute)]">{tx("نام حرکات را وارد و «تحلیل و ساخت انیمیشن» را بزنید یا یکی از مجموعه‌های آماده را انتخاب کنید.", "Enter exercise names and press “Analyze & animate”, or load one of the presets.")}</p>
                  </div>
                </div>
              )}
              {def && (
                <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                  <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-black text-white backdrop-blur">{phaseLabel[hud.phase]}</span>
                  <span className="tnum rounded-full bg-black/55 px-3 py-1 text-[11px] font-black text-white backdrop-blur">
                    {def.isometric ? tx("نگه داشتن ایستا", "Isometric hold") : `${tx("تکرار", "Rep")} ${Math.max(1, hud.rep)} / ${def.reps ?? 2}`}
                  </span>
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 p-6 text-center text-white backdrop-blur-sm">
                  <div className="w-full max-w-xs">
                    <Film size={26} className="mx-auto text-[#e9e400]" />
                    <b className="mt-2 block text-[14px] font-black">{tx("در حال ضبط ویدیو 1920×1080", "Recording 1920×1080 video")}</b>
                    <span className="mt-1 block text-[12px] opacity-80">{busy.label}{busy.total ? ` • ${busy.index}/${busy.total}` : ""}</span>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#e9e400] transition-[width]" style={{ width: `${Math.round(busy.progress * 100)}%` }} /></div>
                    <button type="button" onClick={() => { cancelRef.current.cancelled = true; }} className="pointer-events-auto mt-4 inline-flex items-center gap-1 rounded-full border border-white/30 px-4 py-1.5 text-[12px] font-bold">
                      <X size={13} /> {tx("توقف", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {def && (
              <>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="h-full bg-[#e9e400]" style={{ width: `${hud.progress * 100}%` }} /></div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? tx("توقف", "Pause") : tx("پخش", "Play")} className="press flex h-10 w-10 items-center justify-center rounded-full bg-[#e9e400] text-black">
                    {playing ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <Seg
                    items={[
                      { key: "auto" as ViewChoice, label: tx(`خودکار (${L(VIEW_LABEL[def.view])})`, `Auto (${L(VIEW_LABEL[def.view])})`), icon: <Camera size={13} /> },
                      { key: "side" as ViewChoice, label: L(VIEW_LABEL.side) },
                      { key: "front" as ViewChoice, label: L(VIEW_LABEL.front) },
                      { key: "threeQuarter" as ViewChoice, label: L(VIEW_LABEL.threeQuarter) },
                      { key: "rear" as ViewChoice, label: L(VIEW_LABEL.rear) },
                    ]}
                    value={viewChoice}
                    onChange={setViewChoice}
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] font-bold">
                  <span className="flex items-center gap-1.5">
                    {tx("پس‌زمینه", "Backdrop")}:
                    {(["light", "dark", "transparent"] as Backdrop[]).map((b) => (
                      <Chip key={b} on={backdrop === b} onClick={() => setBackdrop(b)}>
                        {b === "light" ? tx("استودیو روشن", "Light studio") : b === "dark" ? tx("استودیو تیره", "Dark studio") : tx("شفاف (آزمایشی)", "Transparent (beta)")}
                      </Chip>
                    ))}
                  </span>
                  <span className="flex items-center gap-2">{tx("نمایش درگیری عضلات", "Muscle engagement")} <Toggle on={highlight} onClick={() => setHighlight((h) => !h)} /></span>
                  <span className="flex items-center gap-1.5">FPS: <Chip on={fps === 30} onClick={() => setFps(30)}>30</Chip><Chip on={fps === 60} onClick={() => setFps(60)}>60</Chip></span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={!!busy || !format} onClick={exportOne} className="press flex h-10 items-center gap-1.5 rounded-full bg-[#e9e400] px-5 text-[12.5px] font-black text-black disabled:opacity-40">
                    <Download size={15} /> {tx("دریافت ویدیو", "Download video")}
                  </button>
                  <button type="button" disabled={!!busy || !format} onClick={saveToMoves} className="press flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-5 text-[12.5px] font-extrabold disabled:opacity-40">
                    <Save size={15} /> {tx("افزودن به «حرکات من»", "Add to My Moves")}
                  </button>
                  <span className="self-center text-[10.5px] text-[var(--color-mute)]">{fileName(def, view, format?.ext ?? "mp4", backdrop)}</span>
                </div>
                {backdrop === "transparent" && (
                  <p className="mt-2 text-[10.5px] leading-5 text-amber-400">{tx("حفظ شفافیت در فایل WebM به پشتیبانی مرورگر بستگی دارد؛ برای اپلیکیشن، نسخه استودیو روشن یا تیره توصیه می‌شود.", "Alpha in WebM depends on browser support; for the app, the light or dark studio version is recommended.")}</p>
                )}
              </>
            )}
          </Card>

          {def && <AnalysisPanel def={def} view={view} />}
        </div>
      </div>

      {batchOpen && (
        <Modal open onClose={() => setBatchOpen(false)} title={tx("تولید کتابخانه ویدیویی", "Export video library")}>
          <p className="text-[12.5px] leading-7 text-[var(--color-mute)]">
            {tx(`برای هر یک از ${ready.length} حرکت یک ویدیوی مستقل با همان آواتار، نورپردازی و کیفیت ساخته و دانلود می‌شود؛ در پایان، فایل فهرست کتابخانه (JSON) هم دریافت می‌کنید. مرورگر ممکن است برای دانلود چند فایل اجازه بخواهد.`,
              `A separate video with the same avatar, lighting and quality is created for each of the ${ready.length} exercises, followed by a library manifest (JSON). Your browser may ask permission to download multiple files.`)}
          </p>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={() => exportLibrary("auto")} className="press flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#e9e400] text-[13px] font-black text-black">
              <Camera size={15} /> {tx("زاویه پیشنهادی هر حرکت", "Recommended angle per exercise")}
            </button>
            {viewChoice !== "auto" && (
              <button type="button" onClick={() => exportLibrary(viewChoice)} className="press flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-line)] text-[12.5px] font-extrabold">
                {tx(`همه با ${L(VIEW_LABEL[viewChoice])}`, `All in ${L(VIEW_LABEL[viewChoice])}`)}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function findPeak(timeline: Timeline): number {
  let best = 0;
  let bestEffort = -1;
  for (let i = 0; i <= 60; i++) {
    const t = (timeline.duration * i) / 60;
    const { effort } = timeline.sample(t);
    if (effort > bestEffort) {
      bestEffort = effort;
      best = t;
    }
  }
  return best;
}

function AnalysisPanel({ def, view }: { def: ExerciseDef; view: View }) {
  const { tx, lang } = useTx();
  const L = (pair: [string, string]) => (lang === "fa" ? pair[0] : pair[1]);
  const info = def.info[lang];
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <Card>
        <SectionHead icon={<CheckCircle2 size={15} />} title={lang === "fa" ? def.fa : def.en} hint={`${lang === "fa" ? def.en : def.fa} • ${L(CATEGORY_LABEL[def.category])} • ${L(EQUIP_LABEL[def.equipKey])}`} />
        <div className="space-y-3 text-[12px]">
          <div>
            <span className="mb-1.5 block text-[11px] font-bold text-[var(--color-mute)]">{tx("عضلات اصلی", "Primary muscles")}</span>
            <div className="flex flex-wrap gap-1.5">{def.primary.map((m) => <span key={m} className="rounded-full bg-[#ff9a00]/15 px-2.5 py-1 text-[11px] font-black text-[#ffb547]">{L(MUSCLE_LABEL[m])}</span>)}</div>
          </div>
          {def.secondary.length > 0 && (
            <div>
              <span className="mb-1.5 block text-[11px] font-bold text-[var(--color-mute)]">{tx("عضلات کمکی", "Secondary muscles")}</span>
              <div className="flex flex-wrap gap-1.5">{def.secondary.map((m) => <span key={m} className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold text-[var(--color-mute)]">{L(MUSCLE_LABEL[m])}</span>)}</div>
            </div>
          )}
          <div>
            <span className="mb-1.5 block text-[11px] font-bold text-[var(--color-mute)]">{tx("مفاصل درگیر", "Joints involved")}</span>
            <div className="flex flex-wrap gap-1.5">{def.joints.map((j) => <span key={j} className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] font-bold">{L(JOINT_LABEL[j])}</span>)}</div>
          </div>
          <div className="rounded-xl bg-[var(--color-bg)] p-3">
            <b className="flex items-center gap-1.5 text-[12px]"><Camera size={13} className="text-[#e9e400]" /> {L(VIEW_LABEL[view])}</b>
            <p className="mt-1 text-[11.5px] leading-6 text-[var(--color-mute)]">{L(VIEW_REASON[view])}</p>
          </div>
        </div>
      </Card>
      <Card>
        <SectionHead icon={<HelpCircle size={15} />} title={tx("تحلیل تکنیک", "Technique analysis")} />
        <dl className="space-y-2.5 text-[12px] leading-6">
          {[
            [tx("وضعیت شروع", "Starting position"), info.start],
            [def.isometric ? tx("اجرا", "Execution") : tx("فاز درونگرا (انقباض)", "Concentric phase"), info.con],
            [def.isometric ? tx("تنفس", "Breathing") : tx("فاز برونگرا (بازگشت)", "Eccentric phase"), info.ecc],
            [tx("دامنه حرکتی", "Range of motion"), info.rom],
          ].map(([title, body]) => (
            <div key={title}>
              <dt className="text-[11px] font-black text-[#e9e400]">{title}</dt>
              <dd className="m-0">{body}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[11px] font-black text-red-400">{tx("اشتباهات رایج", "Common mistakes")}</dt>
            <dd className="m-0">
              <ul className="mt-1 space-y-1">
                {info.mistakes.map((m) => <li key={m} className="flex gap-1.5"><AlertTriangle size={13} className="mt-1.5 shrink-0 text-red-400" />{m}</li>)}
              </ul>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
