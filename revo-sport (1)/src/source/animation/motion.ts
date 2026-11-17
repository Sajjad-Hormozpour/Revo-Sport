import * as THREE from "three";
import { CATALOG, type ExerciseDef, type Key } from "./catalog";
import { flatten, mirrorPose, skeletonPoints, solvePose, unflatten, type Backdrop, type Pose, type Studio, type View } from "./rig";

/* =====================================================================
   Timeline: lead-in hold + N repetitions, starting and ending on the
   same frame so the clip loops seamlessly.
   ===================================================================== */

const LEAD = 0.6;

interface Segment { from: number; to: number; duration: number; hold: number; pass: boolean }

export interface Timeline {
  duration: number;
  repDuration: number;
  reps: number;
  sample: (time: number) => { pose: Required<Pose>; effort: number; rep: number; phase: Phase };
}

export type Phase = "start" | "concentric" | "peak" | "eccentric";

const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));

function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number): number[] {
  const t2 = t * t;
  const t3 = t2 * t;
  return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}

export function buildTimeline(def: ExerciseDef): Timeline {
  const reps = def.reps ?? 2;
  const keys = def.keys;
  const n = keys.length;
  const vecs = keys.map((k) => [...flatten(k.p), k.e]);
  const mirrored = keys.map((k) => [...flatten(mirrorPose(k.p)), k.e]);
  const peakIndex = keys.reduce((best, k, i) => (k.e > keys[best].e ? i : best), 0);

  // Segments of one repetition: key i -> key i+1 (closing back to key 0).
  const segments: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const to = (i + 1) % n;
    segments.push({ from: i, to, duration: keys[to].t, hold: keys[to].pass ? 0 : keys[to].hold ?? 0, pass: !!keys[to].pass });
  }
  // Group consecutive pass-through segments so motion only slows at real stops.
  const groups: { segs: Segment[]; duration: number; hold: number }[] = [];
  let current: Segment[] = [];
  segments.forEach((seg) => {
    current.push(seg);
    if (!seg.pass) {
      groups.push({ segs: current, duration: current.reduce((s, x) => s + x.duration, 0), hold: seg.hold });
      current = [];
    }
  });
  if (current.length) groups.push({ segs: current, duration: current.reduce((s, x) => s + x.duration, 0), hold: 0 });
  const repDuration = groups.reduce((s, g) => s + g.duration + g.hold, 0);
  const duration = LEAD + reps * repDuration;

  const sampleRep = (t: number, set: number[][]) => {
    let acc = 0;
    for (const g of groups) {
      if (t <= acc + g.duration) {
        const u = ease((t - acc) / g.duration);
        let s = u * g.duration;
        for (let k = 0; k < g.segs.length; k++) {
          const seg = g.segs[k];
          if (s <= seg.duration || k === g.segs.length - 1) {
            const f = Math.min(1, s / seg.duration);
            const prev = k > 0 ? set[g.segs[k - 1].from] : set[seg.from];
            const next = k < g.segs.length - 1 ? set[g.segs[k + 1].to] : set[seg.to];
            const values = g.segs.length > 1 ? catmull(prev, set[seg.from], set[seg.to], next, f) : set[seg.from].map((x, i) => x + (set[seg.to][i] - x) * f);
            const rising = keys[seg.to].e >= keys[seg.from].e;
            return { values, phase: (rising ? "concentric" : "eccentric") as Phase };
          }
          s -= seg.duration;
        }
      }
      acc += g.duration;
      if (t <= acc + g.hold) {
        const last = g.segs[g.segs.length - 1].to;
        return { values: set[last], phase: (last === peakIndex ? "peak" : "start") as Phase };
      }
      acc += g.hold;
    }
    return { values: set[0], phase: "start" as Phase };
  };

  return {
    duration,
    repDuration,
    reps,
    sample(time: number) {
      const t = ((time % duration) + duration) % duration;
      if (t < LEAD) return { pose: unflatten(vecs[0]), effort: keys[0].e, rep: 0, phase: "start" };
      const rel = t - LEAD;
      const rep = Math.min(reps - 1, Math.floor(rel / repDuration));
      const set = def.mirrorRep && rep % 2 === 1 ? mirrored : vecs;
      const { values, phase } = sampleRep(rel - rep * repDuration, set);
      return { pose: unflatten(values), effort: values[values.length - 1], rep: rep + 1, phase };
    },
  };
}

/** Bounding box of the full motion, used to place a fixed camera. */
export function motionBounds(def: ExerciseDef, timeline: Timeline): THREE.Box3 {
  const box = new THREE.Box3();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const { pose } = timeline.sample((timeline.duration * i) / steps);
    skeletonPoints(solvePose(pose, def.frame ?? "world")).forEach((p) => box.expandByPoint(p));
  }
  box.expandByPoint(new THREE.Vector3(box.min.x, 0, box.min.z));
  return box;
}

/** Applies an exercise to the studio (equipment + props) and returns its timeline. */
export function stage(studio: Studio, def: ExerciseDef, view: View) {
  studio.setEquipment(def.equip, def.props ?? []);
  const timeline = buildTimeline(def);
  // Frame the full envelope: body plus equipment and props across the whole motion.
  const box = motionBounds(def, timeline);
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const { pose } = timeline.sample((timeline.duration * i) / steps);
    const skeleton = solvePose(pose, def.frame ?? "world");
    studio.equipment?.update(skeleton);
    if (studio.equipment) box.union(new THREE.Box3().setFromObject(studio.equipment.group));
  }
  studio.frame(box, view);
  return timeline;
}

export function renderAt(studio: Studio, def: ExerciseDef, timeline: Timeline, time: number, highlight: boolean) {
  const frame = timeline.sample(time);
  const skeleton = solvePose(frame.pose, def.frame ?? "world");
  studio.mannequin.update(skeleton);
  studio.equipment?.update(skeleton);
  studio.mannequin.highlight(def.primary, def.secondary, frame.effort, highlight);
  studio.render();
  return frame;
}

/* =====================================================================
   Recognition — maps free-text exercise names (Persian or English,
   with sets/reps noise) to catalog definitions.
   ===================================================================== */

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[-_/()،,.:+]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/زیر بغل/g, "زیربغل")
    .replace(/جلوبازو/g, "جلو بازو")
    .replace(/پشتبازو/g, "پشت بازو")
    .replace(/سیمکش/g, "سیم کش")
    .trim();
}

/** Removes numbering and prescription noise like "4x10", "3 ست 12 تکرار", "60 kg". */
export function cleanLine(line: string): string {
  return normalizeName(line)
    .replace(/^\s*\d+\s*[).-]?\s*/, "")
    .replace(/\d+\s*[x×*]\s*\d+(\s*[-–]\s*\d+)?/g, " ")
    .replace(/\d+\s*(ست|تکرار|ثانیه|دقیقه|کیلو|کیلوگرم|sets?|reps?|kg|lbs?|sec|min)\b/g, " ")
    .replace(/\b(sets?|reps?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitInput(text: string): string[] {
  return text
    .split(/\n|،|;|؛|,/)
    .map((line) => line.trim())
    .filter((line) => cleanLine(line).length > 1);
}

function tokens(s: string): string[] {
  return normalizeName(s).split(" ").filter((t) => t.length > 1);
}

function score(query: string, def: ExerciseDef): number {
  const q = cleanLine(query);
  if (!q) return 0;
  const names = [def.fa, def.en, ...def.aliases].map(normalizeName);
  let best = 0;
  for (const name of names) {
    if (name === q) return 1;
    // Whole-word containment only — "شنا" must not match inside "ناشناخته".
    const padQ = ` ${q} `;
    const padN = ` ${name} `;
    if (name.length > 2 && (padQ.includes(padN) || padN.includes(padQ))) best = Math.max(best, 0.6 + 0.3 * (Math.min(name.length, q.length) / Math.max(name.length, q.length)));
    const a = new Set(tokens(q));
    const b = new Set(tokens(name));
    if (a.size && b.size) {
      const inter = [...a].filter((t) => b.has(t)).length;
      best = Math.max(best, (inter / new Set([...a, ...b]).size) * 0.85);
    }
  }
  return best;
}

export interface Recognition {
  input: string;
  status: "ok" | "ambiguous" | "unknown";
  def?: ExerciseDef;
  confidence: number;
  suggestions: ExerciseDef[];
}

export function recognize(input: string): Recognition {
  const ranked = CATALOG.map((def) => ({ def, s: score(input, def) })).sort((a, b) => b.s - a.s);
  const [first, second] = ranked;
  const suggestions = ranked.filter((r) => r.s > 0.18).slice(0, 4).map((r) => r.def);
  if (first.s >= 0.62 && (!second || first.s - second.s > 0.04 || first.s >= 0.95)) {
    return { input, status: "ok", def: first.def, confidence: first.s, suggestions };
  }
  if (first.s >= 0.3) return { input, status: "ambiguous", confidence: first.s, suggestions };
  return { input, status: "unknown", confidence: first.s, suggestions };
}

/* =====================================================================
   Video export — renders 1920×1080 frames and records them with
   MediaRecorder (H.264 MP4 when the browser supports it, WebM otherwise).
   ===================================================================== */

export interface Format { mime: string; ext: "mp4" | "webm"; label: string }

export function pickFormat(alpha: boolean): Format | null {
  if (typeof MediaRecorder === "undefined") return null;
  const mp4 = ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.4d0028", "video/mp4;codecs=avc1", "video/mp4"];
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const order = alpha ? [...webm.slice(1), webm[0]] : [...mp4, ...webm];
  for (const mime of order) {
    if (MediaRecorder.isTypeSupported(mime)) {
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      return { mime, ext, label: ext === "mp4" ? "MP4 (H.264)" : mime.includes("vp9") ? "WebM (VP9)" : "WebM (VP8)" };
    }
  }
  return null;
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function fileName(def: ExerciseDef, view: View, ext: string, backdrop: Backdrop): string {
  const viewSlug = view === "threeQuarter" ? "three_quarter" : view;
  return `${slug(def.en)}_${viewSlug}${backdrop === "transparent" ? "_alpha" : ""}_v1.${ext}`;
}

export async function recordClip(options: {
  studio: Studio;
  def: ExerciseDef;
  view: View;
  backdrop: Backdrop;
  highlight: boolean;
  fps: 30 | 60;
  onProgress?: (p: number) => void;
  signal?: { cancelled: boolean };
}): Promise<{ blob: Blob; format: Format }> {
  const { studio, def, view, backdrop, highlight, fps, onProgress, signal } = options;
  const format = pickFormat(backdrop === "transparent");
  if (!format) throw new Error("recorder-unsupported");
  studio.setBackdrop(backdrop);
  studio.setSize(1920, 1080);
  const timeline = stage(studio, def, view);
  renderAt(studio, def, timeline, 0, highlight);
  const stream = studio.canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(250);
  await new Promise<void>((resolve) => {
    const startAt = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startAt) / 1000;
      if (signal?.cancelled || elapsed >= timeline.duration) {
        renderAt(studio, def, timeline, 0, highlight);
        resolve();
        return;
      }
      renderAt(studio, def, timeline, elapsed, highlight);
      onProgress?.(elapsed / timeline.duration);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await new Promise((r) => setTimeout(r, 120));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  if (signal?.cancelled) throw new Error("cancelled");
  return { blob: new Blob(chunks, { type: format.mime.split(";")[0] }), format };
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type { Key };
