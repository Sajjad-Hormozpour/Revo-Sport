import type { AppData, WorkoutProgram } from "../data/types";
import { nutritionAdherence } from "./nutrition";
import { addDays, dayKey, startOfWeek, weekdayName } from "./time";

export interface Adherence {
  workout: number | null;
  nutrition: number | null;
  checkin: number | null;
  overall: number | null;
}

export function activeProgram(data: AppData, studentId: string): WorkoutProgram | undefined {
  return data.programs.filter((p) => p.studentId === studentId && p.status === "فعال")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function calculateAdherence(data: AppData, studentId: string, now = new Date()): Adherence {
  const program = activeProgram(data, studentId);
  let workout: number | null = null;
  if (program) {
    const start = startOfWeek(now);
    const assigned = new Set(program.days.filter((d) => d.items.length).map((d) => d.weekday));
    let expected = 0;
    let completed = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      if (date > now || date < new Date(program.startDate)) continue;
      if (!assigned.has(weekdayName(date))) continue;
      expected++;
      if (data.logs.some((l) => l.studentId === studentId && l.date === dayKey(date))) completed++;
    }
    workout = expected ? Math.round(100 * completed / expected) : null;
  }
  const nutrition = nutritionAdherence(data, studentId, now);
  const week = dayKey(startOfWeek(now));
  const checkin = data.checkins.some((c) => c.studentId === studentId && c.weekStart === week) ? 100 : 0;
  const parts = [workout, nutrition, checkin].filter((n): n is number => n !== null);
  return { workout, nutrition, checkin, overall: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null };
}