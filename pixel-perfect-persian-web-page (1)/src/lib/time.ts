import { useEffect, useState } from "react";

const FA = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function fa(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => FA[Number(d)]);
}

export const WEEK = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const WEEK_S = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
export const JMONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export function nowIso(): string {
  return new Date().toISOString();
}

/** کلید روز محلی: 2026-03-22 */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export function parseDate(v: string | Date | number | undefined | null): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(+v) ? null : v;
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(+d) ? null : d;
  }
  const d = new Date(v);
  return isNaN(+d) ? null : d;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** هفته ایرانی: شنبه تا جمعه */
export function startOfWeek(d: Date = new Date()): Date {
  const idx = (d.getDay() + 1) % 7;
  return startOfDay(addDays(d, -idx));
}

export function weekdayIdx(d: Date = new Date()): number {
  return (d.getDay() + 1) % 7;
}

export function weekdayName(d: Date = new Date()): string {
  return WEEK[weekdayIdx(d)];
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

export function toJalali(d: Date): { jy: number; jm: number; jd: number } {
  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function jalaliLeap(jy: number): boolean {
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(((jy + 2346) % 33 + 33) % 33) || jy % 33 === 1;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalaliLeap(jy) ? 30 : 29;
}

export function fromJalali(jy: number, jm: number, jd: number): Date {
  const jy2 = jy - 979;
  const jp = Math.floor(jy2 / 33);
  let jr = jy2 % 33;
  let days = 365 * jy2 + 8 * jp + Math.floor((jr + 3) / 4);
  const md = [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336];
  days += jd - 1 + md[jm - 1];
  let gy = 1600 + 400 * Math.floor(days / 146097);
  days %= 146097;
  let leap = true;
  if (days >= 36525) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days++;
    else leap = false;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days >= 366) {
    leap = false;
    days--;
    gy += Math.floor(days / 365);
    days %= 365;
  }
  const sal_a = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  let gd = days + 1;
  for (let i = 1; i <= 12; i++) {
    if (gd <= sal_a[i]) {
      gm = i;
      break;
    }
    gd -= sal_a[i];
  }
  return new Date(gy, gm - 1, gd);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatTime(d: Date | string, withSec = true): string {
  const x = parseDate(d);
  if (!x) return "—";
  const h = pad2(x.getHours());
  const m = pad2(x.getMinutes());
  const s = pad2(x.getSeconds());
  return fa(withSec ? `${h}:${m}:${s}` : `${h}:${m}`);
}

export function formatJalaliDate(d: Date | string): string {
  const x = parseDate(d);
  if (!x) return "—";
  const { jy, jm, jd } = toJalali(x);
  return fa(`${jy}/${pad2(jm)}/${pad2(jd)}`);
}

export function formatJalaliLong(d: Date | string): string {
  const x = parseDate(d);
  if (!x) return "—";
  const { jy, jm, jd } = toJalali(x);
  return `${weekdayName(x)} ${fa(jd)} ${JMONTHS[jm - 1]} ${fa(jy)}`;
}

export function formatDateTime(d: Date | string): string {
  const x = parseDate(d);
  if (!x) return "—";
  return `${formatJalaliLong(x)}، ${formatTime(x, false)}`;
}

export function formatRelative(d: Date | string, now: Date = new Date()): string {
  const x = parseDate(d);
  if (!x) return "—";
  const diff = now.getTime() - x.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 10 && sec > -10) return "همین الان";
  if (sec < 0) {
    const f = -sec;
    if (f < 60) return `${fa(f)} ثانیه بعد`;
    if (f < 3600) return `${fa(Math.floor(f / 60))} دقیقه بعد`;
    if (f < 86400) return `${fa(Math.floor(f / 3600))} ساعت بعد`;
    return formatDateTime(x);
  }
  if (sec < 60) return `${fa(sec)} ثانیه پیش`;
  if (sec < 3600) return `${fa(Math.floor(sec / 60))} دقیقه پیش`;
  if (sec < 86400) return `${fa(Math.floor(sec / 3600))} ساعت پیش`;
  const days = daysBetween(x, now);
  if (days === 1) return `دیروز ${formatTime(x, false)}`;
  if (days < 7) return `${fa(days)} روز پیش، ${formatTime(x, false)}`;
  return formatDateTime(x);
}

export function localToIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0).toISOString();
}

export function isoToDateInput(iso: string): string {
  const x = parseDate(iso);
  if (!x) return dayKey();
  return dayKey(x);
}

export function isoToTimeInput(iso: string): string {
  const x = parseDate(iso);
  if (!x) return "12:00";
  return `${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
}

export function greetingAt(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "نصف‌شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "ظهر بخیر";
  if (h < 21) return "عصر بخیر";
  return "شب بخیر";
}

/** ساعت زنده سیستم — هر ثانیه به‌روز */
export function useNow(ms = 1000): Date {
  const [n, setN] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setN(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return n;
}

export function inviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
