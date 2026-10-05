import type { AppData, Student, SubStatus } from "../data/types";
import { addDays, dayKey, daysBetween, parseDate, startOfWeek } from "./time";

export function lastWorkoutAt(data: AppData, studentId: string): Date | null {
  let best: Date | null = null;
  for (const l of data.logs) {
    if (l.studentId !== studentId) continue;
    const d = parseDate(l.at || l.date);
    if (d && (!best || d > best)) best = d;
  }
  return best;
}

export function daysSinceWorkout(data: AppData, studentId: string, now = new Date()): number | null {
  const last = lastWorkoutAt(data, studentId);
  if (!last) return null;
  return Math.max(0, daysBetween(last, now));
}

export function logsDayKeys(data: AppData, studentId: string): string[] {
  const set = new Set<string>();
  for (const l of data.logs) {
    if (l.studentId !== studentId) continue;
    const d = parseDate(l.at || l.date);
    if (d) set.add(dayKey(d));
  }
  return [...set].sort();
}

export function workoutStreak(data: AppData, studentId: string, now = new Date()): number {
  const keys = new Set(logsDayKeys(data, studentId));
  if (keys.size === 0) return 0;
  const today = dayKey(now);
  const yest = dayKey(addDays(now, -1));
  let cursor = today;
  if (!keys.has(today)) {
    if (!keys.has(yest)) return 0;
    cursor = yest;
  }
  let n = 0;
  while (keys.has(cursor)) {
    n++;
    const [y, m, d] = cursor.split("-").map(Number);
    cursor = dayKey(addDays(new Date(y, m - 1, d), -1));
  }
  return n;
}

export function xpOf(data: AppData, studentId: string): number {
  const stored = data.xp[studentId];
  const fromLogs = data.logs.filter((l) => l.studentId === studentId).length * 80;
  return Math.max(stored ?? 0, fromLogs);
}

export function weekLogCount(data: AppData, studentId: string, now = new Date()): number {
  const start = startOfWeek(now).getTime();
  const end = addDays(startOfWeek(now), 7).getTime();
  return data.logs.filter((l) => {
    if (l.studentId !== studentId) return false;
    const d = parseDate(l.at || l.date);
    if (!d) return false;
    const t = d.getTime();
    return t >= start && t < end;
  }).length;
}

export function weekMinutes(data: AppData, now = new Date()): number[] {
  const start = startOfWeek(now);
  const arr = [0, 0, 0, 0, 0, 0, 0];
  for (const l of data.logs) {
    const d = parseDate(l.at || l.date);
    if (!d) continue;
    const idx = daysBetween(start, d);
    if (idx >= 0 && idx < 7) arr[idx] += l.durationMin || 0;
  }
  return arr;
}

export function subEndDate(s: Student): Date {
  const e = parseDate(s.subEndsAt);
  if (e) return e;
  const start = parseDate(s.startDate) ?? new Date();
  return addDays(start, typeof s.daysLeft === "number" ? s.daysLeft : 30);
}

export function subDaysLeft(s: Student, now = new Date()): number {
  return daysBetween(now, subEndDate(s));
}

export function liveSubStatus(s: Student, now = new Date()): SubStatus {
  if (s.status === "inactive") return "غیرفعال";
  const left = subDaysLeft(s, now);
  if (left < 0) return "منقضی";
  if (left <= 7) return "در حال اتمام";
  return "فعال";
}

export function programDaysLeft(endDate: string, now = new Date()): number {
  const e = parseDate(endDate);
  if (!e) return 999;
  return daysBetween(now, e);
}

export function todayWater(data: AppData, studentId: string, now = new Date()): { ml: number; goal: number } {
  const w = data.water[studentId];
  const today = dayKey(now);
  if (!w) return { ml: 0, goal: 2500 };
  if (w.date !== today) return { ml: 0, goal: w.goal || 2500 };
  return { ml: w.ml, goal: w.goal || 2500 };
}
