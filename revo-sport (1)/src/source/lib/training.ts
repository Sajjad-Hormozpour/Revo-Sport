import type { AppData } from "../data/types";
import { EXERCISES } from "../data/library";
import { addDays, dayKey, startOfWeek } from "./time";

export interface ExerciseRecord { exerciseId: string; weight: number; reps: number; at: string; previous: number }

export function trainingAnalytics(data: AppData, studentId: string) {
  const logs = data.logs.filter((l) => l.studentId === studentId).slice().sort((a,b) => (a.at || a.date).localeCompare(b.at || b.date));
  const perMuscle: Record<string, number> = {};
  const records: ExerciseRecord[] = [];
  const best = new Map<string, number>();
  let sets = 0, reps = 0, volume = 0, totalRpe = 0, duration = 0;
  for (const log of logs) {
    duration += log.durationMin || 0;
    for (const item of log.items) {
      const muscle = EXERCISES.find((e) => e.id === item.exerciseId)?.muscle ||
        data.coachExercises.find((e) => e.id === item.exerciseId)?.muscle || "سایر";
      for (const set of item.sets) {
        if (!set.done) continue;
        const v = set.weight * set.reps;
        sets++; reps += set.reps; volume += v; totalRpe += set.rpe || 0;
        perMuscle[muscle] = (perMuscle[muscle] || 0) + v;
        const old = best.get(item.exerciseId) || 0;
        if (set.weight > old && set.weight > 0) {
          records.push({ exerciseId: item.exerciseId, weight: set.weight, reps: set.reps, at: log.at || log.date, previous: old });
          best.set(item.exerciseId, set.weight);
        }
      }
    }
  }
  const currentWeek = startOfWeek();
  const weekly = Array.from({length: 6},(_,index) => {
    const start = addDays(currentWeek, (index - 5) * 7);
    const end = addDays(start, 7);
    const weekVolume = logs.filter((l) => (l.at || l.date) >= start.toISOString() && (l.at || l.date) < end.toISOString())
      .flatMap((l) => l.items.flatMap((item) => item.sets))
      .filter((set) => set.done).reduce((total, set) => total + set.weight * set.reps, 0);
    return { week: dayKey(start), volume: weekVolume };
  });
  return { frequency: logs.length, sets, reps, volume, duration, averageRpe: sets ? +(totalRpe / sets).toFixed(1) : 0,
    perMuscle, records: records.reverse(), weekly };
}