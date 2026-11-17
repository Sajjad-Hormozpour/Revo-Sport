import { useEffect, useRef, useState } from "react";
import { Camera, Pause, Play, RotateCcw } from "lucide-react";
import { useLang } from "../lib/i18n";
import { CATALOG, VIEW_LABEL, type ExerciseDef } from "../animation/catalog";
import { stage, renderAt, type Phase, type Timeline } from "../animation/motion";
import { Studio, type View } from "../animation/rig";

const PHASE: Record<Phase, { fa: string; en: string }> = {
  start: { fa: "وضعیت شروع", en: "Start position" },
  concentric: { fa: "فاز درون‌گرا", en: "Concentric" },
  peak: { fa: "نقطه اوج", en: "Peak position" },
  eccentric: { fa: "فاز برون‌گرا", en: "Eccentric" },
};

export function libraryAnimation(exerciseId: string): ExerciseDef | undefined {
  return CATALOG.find((item) => item.libId === exerciseId);
}

export default function ExerciseAnimation({
  def,
  poster,
  title,
  fallbackUrl,
  className = "aspect-video w-full rounded-xl object-cover",
}: {
  def: ExerciseDef;
  poster: string;
  title: string;
  fallbackUrl?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const clockRef = useRef({ time: 0, last: 0 });
  const playingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<View>(def.view);
  const [phase, setPhase] = useState<Phase>("start");
  const [rep, setRep] = useState(0);
  const [failed, setFailed] = useState(false);
  const { lang } = useLang();
  const tx = (fa: string, en: string) => (lang === "fa" ? fa : en);

  useEffect(() => {
    setView(def.view);
    setPlaying(false);
    playingRef.current = false;
    clockRef.current = { time: 0, last: 0 };
    setFailed(false);
  }, [def.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    let studio: Studio;
    try {
      studio = new Studio(canvas);
      studioRef.current = studio;
    } catch {
      setFailed(true);
      return;
    }

    const fit = () => {
      const rect = frame.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      studio.setSize(width, height);
      timelineRef.current = stage(studio, def, view);
      clockRef.current = { time: 0, last: 0 };
      renderAt(studio, def, timelineRef.current, 0, true);
    };

    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(frame);

    let raf = 0;
    let lastUi = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const timeline = timelineRef.current;
      if (!timeline || studioRef.current !== studio) return;
      const clock = clockRef.current;
      const dt = clock.last ? Math.min(0.1, (now - clock.last) / 1000) : 0;
      clock.last = now;
      if (playingRef.current) clock.time = (clock.time + dt) % timeline.duration;
      const result = renderAt(studio, def, timeline, clock.time, true);
      if (now - lastUi > 150) {
        lastUi = now;
        setPhase(result.phase);
        setRep(result.rep);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      if (studioRef.current === studio) studioRef.current = null;
      studio.dispose();
    };
  }, [def, view]);

  const togglePlay = () => {
    if (!playing && clockRef.current.time === 0) clockRef.current.time = 0;
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  };

  const replay = () => {
    clockRef.current.time = 0;
    clockRef.current.last = 0;
    playingRef.current = true;
    setPlaying(true);
  };

  const viewChoices: View[] = ["side", "front", "threeQuarter", "rear"];
  const viewShort: Record<View, { fa: string; en: string }> = {
    side: { fa: "جانبی", en: "Side" },
    front: { fa: "روبه‌رو", en: "Front" },
    threeQuarter: { fa: "سه‌رخ", en: "3/4" },
    rear: { fa: "پشت", en: "Rear" },
  };
  const displayedName = lang === "fa" ? def.fa : def.en;
  const phaseName = PHASE[phase][lang];
  const totalReps = def.reps ?? 2;
  const frameClass = className
    .split(/\s+/)
    .filter((name) => /^(?:[a-z]+:)?(?:aspect-|w-|rounded)/.test(name))
    .join(" ");

  return (
    <div ref={frameRef} className={`exercise-3d-player relative isolate overflow-hidden bg-[#121416] ${frameClass || "aspect-video w-full rounded-xl"}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={tx(`انیمیشن سه‌بعدی ${def.fa}`, `3D ${def.en} animation`)} />

      {failed && (
        <div className="absolute inset-0">
          {fallbackUrl ? (
            <video src={fallbackUrl} controls playsInline className="h-full w-full bg-black object-contain" />
          ) : (
            <img src={poster} alt={title} className="h-full w-full object-cover" />
          )}
          <span className="absolute inset-x-0 top-0 bg-black/55 px-3 py-2 text-center text-[11px] font-bold text-white">
            {tx("پخش سه‌بعدی در این مرورگر در دسترس نیست", "3D playback is unavailable in this browser")}
          </span>
        </div>
      )}

      {!failed && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent p-3 text-white">
            <span className="max-w-[75%] truncate text-[11.5px] font-black">{displayedName}</span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#e9e400] px-2 py-1 text-[9px] font-black text-black">
              <Camera size={11} /> {lang === "fa" ? VIEW_LABEL[view][0] : VIEW_LABEL[view][1]}
            </span>
          </div>

          {!playing && (
            <button type="button" onClick={togglePlay} aria-label={tx("پخش انیمیشن", "Play animation")} className="absolute inset-0 grid place-items-center bg-black/10 transition hover:bg-black/20">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[#e9e400] text-black shadow-[0_10px_35px_rgba(0,0,0,.35)] transition hover:scale-105">
                <Play size={21} fill="currentColor" />
              </span>
            </button>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-white">
            <div className="flex items-center gap-2">
              <button type="button" onClick={togglePlay} aria-label={playing ? tx("مکث", "Pause") : tx("پخش", "Play")} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition hover:bg-white/25">
                {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              <button type="button" onClick={replay} aria-label={tx("پخش از ابتدا", "Replay")} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
                <RotateCcw size={13} />
              </button>
              <span className="text-[10px] font-bold text-white/80">{phaseName}</span>
            </div>
            <div className="flex items-center gap-1">
              {viewChoices.map((choice) => (
                <button key={choice} type="button" onClick={() => setView(choice)} aria-label={lang === "fa" ? VIEW_LABEL[choice][0] : VIEW_LABEL[choice][1]} title={lang === "fa" ? VIEW_LABEL[choice][0] : VIEW_LABEL[choice][1]} className={`h-6 rounded-full px-2 text-[8.5px] font-black transition ${view === choice ? "bg-[#e9e400] text-black" : "bg-white/10 text-white/75 hover:bg-white/20"}`}>
                  {viewShort[choice][lang]}
                </button>
              ))}
            </div>
          </div>
          <span className="pointer-events-none absolute bottom-[48px] rounded-full bg-black/50 px-2 py-1 text-[9px] font-bold text-white/85" style={{ insetInlineStart: 12 }}>
            {def.isometric ? tx("نگه‌داشتن ایستا", "Isometric") : `${lang === "fa" ? "تکرار" : "Rep"} ${Math.max(1, rep)} / ${totalReps}`}
          </span>
        </>
      )}
    </div>
  );
}