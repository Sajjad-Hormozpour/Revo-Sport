import { useState } from "react";
import { Play } from "lucide-react";
import { EXERCISES, getExercise } from "../data/library";
import type { AppData, CoachExercise } from "../data/types";
import { aparatEmbed, isAparat, isYoutube, useMediaUrl, youtubeEmbed } from "../lib/media";

export interface ResolvedExercise {
  id: string;
  name: string;
  en: string;
  muscle: string;
  equipment: string;
  level: string;
  imageUrl: string;
  imageMediaId: string;
  videoUrl: string;
  videoMediaId: string;
  how: string;
  tips: string;
  isCustom: boolean;
  custom?: CoachExercise;
}

const PLACEHOLDER =
  "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=800";

export function resolveExercise(exerciseId: string, data?: AppData): ResolvedExercise {
  const custom = data?.coachExercises?.find((c) => c.id === exerciseId);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      en: custom.en,
      muscle: custom.muscle,
      equipment: custom.equipment,
      level: custom.level,
      imageUrl: custom.imageUrl,
      imageMediaId: custom.imageMediaId,
      videoUrl: custom.videoUrl,
      videoMediaId: custom.videoMediaId,
      how: custom.how,
      tips: custom.tips,
      isCustom: true,
      custom,
    };
  }
  const lib = EXERCISES.find((e) => e.id === exerciseId) ?? getExercise(exerciseId);
  return {
    id: lib.id,
    name: lib.name,
    en: lib.en,
    muscle: lib.muscle,
    equipment: lib.equipment,
    level: lib.level,
    imageUrl: lib.image,
    imageMediaId: "",
    videoUrl: lib.video,
    videoMediaId: "",
    how: lib.how,
    tips: lib.tips,
    isCustom: false,
  };
}

export function ExThumb({
  exerciseId,
  data,
  className = "h-10 w-10 rounded-lg object-cover",
}: {
  exerciseId: string;
  data?: AppData;
  className?: string;
}) {
  const r = resolveExercise(exerciseId, data);
  const mediaUrl = useMediaUrl(r.imageMediaId || null);
  const src = mediaUrl || r.imageUrl || PLACEHOLDER;
  return (
    <img
      src={src}
      alt={r.name}
      className={`${className} bg-[#0e0f0c]`}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

export function ExImage({
  exerciseId,
  data,
  className = "aspect-video w-full object-cover",
  badge = true,
}: {
  exerciseId: string;
  data?: AppData;
  className?: string;
  badge?: boolean;
}) {
  const r = resolveExercise(exerciseId, data);
  const mediaUrl = useMediaUrl(r.imageMediaId || null);
  const src = mediaUrl || r.imageUrl || PLACEHOLDER;
  return (
    <div className="ex-image-wrap relative w-full overflow-hidden rounded-2xl">
      <img
        src={src}
        alt={`${r.name} — اجرای دقیق حرکت`}
        className={className}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
        <div className="glass rounded-xl px-3 py-1.5">
          <p className="text-[11px] font-black text-white">{r.name}</p>
          <p className="text-[10px] font-bold text-white/70" dir="ltr" style={{ textAlign: "right" }}>
            {r.en}
          </p>
        </div>
        {badge && (
          <span className="glass rounded-full px-2.5 py-1 text-[10px] font-black text-[#e9e400]">
            {r.muscle} • {r.equipment}
          </span>
        )}
      </div>
    </div>
  );
}

export function ExVideo({
  exerciseId,
  data,
  posterClass = "aspect-video w-full rounded-xl object-cover",
}: {
  exerciseId: string;
  data?: AppData;
  posterClass?: string;
}) {
  const r = resolveExercise(exerciseId, data);
  const mediaUrl = useMediaUrl(r.videoMediaId || null);
  const imgMedia = useMediaUrl(r.imageMediaId || null);
  const [play, setPlay] = useState(false);
  const poster = imgMedia || r.imageUrl || PLACEHOLDER;

  const url = (mediaUrl || r.videoUrl || "").trim();
  if (!url) {
    // کتابخانه: فقط تصویر حرفه‌ای دقیق حرکت
    return <ExImage exerciseId={exerciseId} data={data} className={posterClass} />;
  }

  if (!play) {
    return (
      <button className="relative block w-full text-right" onClick={() => setPlay(true)}>
        <img src={poster} className={posterClass} alt={r.name} />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e9e400]">
            <Play size={22} className="text-black" fill="currentColor" />
          </span>
        </span>
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] font-bold text-white backdrop-blur">
          {r.isCustom ? "ویدیو مربی" : "ویدیو آموزشی"}
        </span>
      </button>
    );
  }

  if (!mediaUrl && isYoutube(url)) {
    return (
      <iframe
        src={youtubeEmbed(url)}
        className="aspect-video w-full rounded-xl bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={r.name}
      />
    );
  }
  if (!mediaUrl && isAparat(url)) {
    return <iframe src={aparatEmbed(url)} className="aspect-video w-full rounded-xl bg-black" allowFullScreen title={r.name} />;
  }
  return <video src={url} controls autoPlay playsInline className="aspect-video w-full rounded-xl bg-black" />;
}
