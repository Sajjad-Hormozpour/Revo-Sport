import { useMemo, useRef, useState } from "react";
import {
  Database, Download, Upload, FileSpreadsheet, Table2, Info, Check, HardDriveDownload,
  ShieldAlert, RefreshCcw,
} from "lucide-react";
import { useStore } from "../lib/store";
import { emptyData } from "../data/seed";
import type { AppData } from "../data/types";
import { fa } from "../lib/core";
import { formatDateTime, nowIso } from "../lib/time";
import { BrandBtn, GhostBtn, Toggle } from "./ui";

const EXPORT_KEY = "revofit-last-export";
const BACKUP_VERSION = 1;

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function download(filename: string, content: string, mime: string, bom = false) {
  const blob = new Blob([bom ? "\uFEFF" + content : content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvCell(v: string | number | undefined) {
  const s = v === undefined || v === null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows: (string | number | undefined)[][]) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

interface BackupFile {
  meta?: { app?: string; version?: number; exportedAt?: string; exportedBy?: string };
  data?: AppData;
  users?: unknown;
}

export default function BackupPanel({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { data, session, userById, restoreData, logout } = useStore();
  const [busy, setBusy] = useState<"json" | "csv-students" | "csv-logs" | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [autoMeta, setAutoMeta] = useState(true);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const me = session ? userById(session.userId) : undefined;

  const size = useMemo(() => {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }, [data]);

  const lastExport = typeof window !== "undefined" ? localStorage.getItem(EXPORT_KEY) : null;

  const rows = useMemo(
    () =>
      [
        ["کاربران", data.users.length],
        ["شاگردان", data.students.length],
        ["برنامه‌های تمرینی", data.programs.length],
        ["تمرین‌های ثبت‌شده", data.logs.length],
        ["حرکات اختصاصی", data.coachExercises.length],
        ["پلن‌های اشتراک", Object.values(data.coachPlans ?? {}).flat().length],
        ["پیام‌ها", data.messages.length],
        ["فاکتورها", data.invoices.length],
        ["جلسات رزروشده", data.appts.length],
        ["ثبت پیشرفت", data.progress.length],
        ["اهداف", data.goals.length],
        ["اعلان‌ها", data.notifs.length],
      ] as [string, number][],
    [data]
  );

  const markExport = () => localStorage.setItem(EXPORT_KEY, nowIso());

  const exportJson = () => {
    setBusy("json");
    try {
      const payload = autoMeta
        ? {
            meta: {
              app: "Revo sport",
              kind: "database-export",
              version: BACKUP_VERSION,
              exportedAt: nowIso(),
              exportedBy: `${me?.name ?? ""} <${me?.email ?? ""}>`,
              counts: Object.fromEntries(rows),
              note: "فایل‌های ویدیو و عکس آپلودشده جدا از این فایل نگهداری می‌شوند.",
            },
            data,
          }
        : { data };
      download(`revofit-db-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
      markExport();
      onToast("خروجی دیتابیس ساخته شد", "فایل JSON در پوشه دانلودها ذخیره شد");
    } catch {
      onToast("خروجی ناموفق بود", "دوباره تلاش کن");
    } finally {
      setBusy(null);
    }
  };

  const exportStudentsCsv = () => {
    setBusy("csv-students");
    try {
      const head = [
        "شناسه", "نام", "ایمیل", "موبایل", "سن", "جنسیت", "قد", "وزن", "هدف", "سطح",
        "تاریخ شروع", "پایان اشتراک", "وضعیت اشتراک", "پلن", "تعداد جلسه", "تعداد تمرین ثبت‌شده", "یادداشت مربی",
      ];
      const body = data.students.map((s) => {
        const u = userById(s.userId);
        return [
          s.id, u?.name ?? "", u?.email ?? "", u?.phone ?? "", s.age, s.gender, s.height, s.weight,
          s.goal, s.level, formatDateTime(s.startDate), formatDateTime(s.subEndsAt), s.subscription,
          s.planTitle ?? "", s.sessionsTotal ?? 0, data.logs.filter((l) => l.studentId === s.id).length, s.notes,
        ];
      });
      download(`revofit-students-${stamp()}.csv`, toCsv([head, ...body]), "text/csv", true);
      markExport();
      onToast("خروجی اکسل شاگردان ساخته شد", `${fa(data.students.length)} ردیف • قابل باز شدن در Excel`);
    } finally {
      setBusy(null);
    }
  };

  const exportLogsCsv = () => {
    setBusy("csv-logs");
    try {
      const head = ["شناسه شاگرد", "نام شاگرد", "تاریخ و ساعت", "مدت (دقیقه)", "تعداد حرکت", "ست کامل", "تکرار کل", "حجم کار (کیلو)"];
      const body = data.logs.map((l) => {
        const st = data.students.find((s) => s.id === l.studentId);
        const name = userById(st?.userId ?? "")?.name ?? "";
        const doneSets = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).length, 0);
        const reps = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).reduce((x, s) => x + s.reps, 0), 0);
        const vol = l.items.reduce((a, i) => a + i.sets.filter((s) => s.done).reduce((x, s) => x + s.weight * s.reps, 0), 0);
        return [l.studentId, name, formatDateTime(l.at || l.date), l.durationMin, l.items.length, doneSets, reps, Math.round(vol)];
      });
      download(`revofit-logs-${stamp()}.csv`, toCsv([head, ...body]), "text/csv", true);
      markExport();
      onToast("خروجی تمرین‌ها ساخته شد", `${fa(data.logs.length)} ردیف`);
    } finally {
      setBusy(null);
    }
  };

  const onRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    setErr("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupFile;
      const incoming = (parsed?.data ?? parsed) as AppData;
      if (!incoming || !Array.isArray(incoming.users) || !Array.isArray(incoming.students)) {
        setErr("این فایل، خروجی معتبر Revo sport نیست.");
        return;
      }
      const full = { ...emptyData(), ...incoming } as AppData;
      restoreData(full);
      setConfirmRestore(false);
      onToast("دیتابیس بازگردانی شد", `${fa(full.users.length)} کاربر و ${fa(full.students.length)} شاگرد بارگذاری شد`);
    } catch {
      setErr("خواندن فایل ممکن نشد. فایل JSON خروجی را انتخاب کن.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b className="flex items-center gap-1.5 text-[14px]">
          <Database size={16} className="text-[#e9e400]" /> پشتیبان‌گیری و خروجی دیتابیس
        </b>
        <p className="mt-1 text-[11.5px] leading-6 text-[var(--color-mute)]">
          قبل از به‌روزرسانی نرم‌افزار، یک نسخه کامل از داده‌ها بگیر. این فایل را بعداً می‌توانی همین‌جا بازگردانی کنی.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {rows.slice(0, 8).map(([label, n]) => (
            <div key={label} className="rounded-xl bg-[var(--color-bg)] px-2 py-2 text-center">
              <b className="tnum block text-[15px]">{fa(n)}</b>
              <span className="text-[10px] text-[var(--color-mute)]">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-mute)]">
          <span>حجم تقریبی: <b className="text-[var(--color-ink)]">{fa(Math.max(1, Math.round(size / 1024)))} کیلوبایت</b></span>
          <span>آخرین خروجی: <b className="text-[var(--color-ink)]">{lastExport ? formatDateTime(lastExport) : "—"}</b></span>
          <span>نسخه ساختار: <b className="tnum text-[var(--color-ink)]">{fa(BACKUP_VERSION)}</b></span>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b className="flex items-center gap-1.5 text-[13.5px]"><Download size={15} className="text-[#e9e400]" /> گرفتن خروجی</b>
        <div className="mt-3 space-y-2">
          <button
            onClick={exportJson}
            disabled={busy !== null}
            className="press flex w-full items-center gap-3 rounded-2xl bg-[#e9e400] p-3.5 text-right text-black disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/15"><HardDriveDownload size={19} /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-[13.5px] font-black">{busy === "json" ? "در حال ساخت…" : "خروجی کامل دیتابیس (JSON)"}</b>
              <span className="block text-[11px] text-black/60">برای آپدیت نرم‌افزار و بازگردانی کامل — همه جداول</span>
            </span>
            <Download size={17} />
          </button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={exportStudentsCsv}
              disabled={busy !== null}
              className="press flex items-center gap-2.5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3 text-right disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400"><FileSpreadsheet size={17} /></span>
              <span className="min-w-0 flex-1">
                <b className="block text-[12.5px]">خروجی اکسل شاگردان</b>
                <span className="block text-[10.5px] text-[var(--color-mute)]">{busy === "csv-students" ? "در حال ساخت…" : "CSV قابل باز شدن در Excel"}</span>
              </span>
            </button>
            <button
              onClick={exportLogsCsv}
              disabled={busy !== null}
              className="press flex items-center gap-2.5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3 text-right disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400"><Table2 size={17} /></span>
              <span className="min-w-0 flex-1">
                <b className="block text-[12.5px]">خروجی تمرین‌های ثبت‌شده</b>
                <span className="block text-[10.5px] text-[var(--color-mute)]">{busy === "csv-logs" ? "در حال ساخت…" : "CSV جلسات، ست‌ها و حجم کار"}</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
        <b className="flex items-center gap-1.5 text-[13.5px]"><Upload size={15} className="text-[#e9e400]" /> بازگردانی دیتابیس</b>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-[var(--color-bg)] p-3">
          <div>
            <b className="block text-[12.5px]">افزودن اطلاعات متادیتا به خروجی</b>
            <span className="block text-[10.5px] text-[var(--color-mute)]">نام خروجی‌دهنده، زمان و شمارنده جداول</span>
          </div>
          <Toggle on={autoMeta} onClick={() => setAutoMeta((v) => !v)} />
        </div>

        <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-3">
          <b className="flex items-center gap-1.5 text-[12.5px] text-red-400"><ShieldAlert size={15} /> هشدار</b>
          <p className="mt-1 text-[11px] leading-6 text-[var(--color-mute)]">
            بازگردانی، تمام داده‌های فعلی این دستگاه را با محتوای فایل جایگزین می‌کند. پیشنهاد می‌شود اول خروجی بگیری.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            onRestoreFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {confirmRestore ? (
          <div className="mt-3 space-y-2">
            <p className="rounded-xl bg-[var(--color-bg)] p-3 text-[12px] font-bold">
              مطمئنی؟ با انتخاب فایل، داده‌های فعلی با فایل پشتیبان جایگزین می‌شود.
            </p>
            <div className="flex gap-2">
              <BrandBtn className="flex-1" onClick={() => fileRef.current?.click()}><Check size={15} /> بله، فایل را انتخاب کن</BrandBtn>
              <GhostBtn className="flex-1" onClick={() => setConfirmRestore(false)}>انصراف</GhostBtn>
            </div>
          </div>
        ) : (
          <GhostBtn className="mt-3 w-full" onClick={() => { setErr(""); setConfirmRestore(true); }}>
            <RefreshCcw size={15} /> بازگردانی از فایل پشتیبان
          </GhostBtn>
        )}
        {err && <p className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] font-bold text-red-400">{err}</p>}
      </div>

      <div className="flex gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 text-[11px] leading-6 text-[var(--color-mute)]">
        <Info size={15} className="mt-1 shrink-0 text-[#e9e400]" />
        فایل JSON شامل همه جداول (کاربران، شاگردان، برنامه‌ها، تمرین‌ها، پیام‌ها، مالی و آمار) است.
        ویدیوها و عکس‌های آپلودشده در حافظه جداگانه نگهداری می‌شوند و در فایل JSON جای نمی‌گیرند.
        اگر بعد از بازگردانی حساب فعلی در فایل نباشد، از اپ خارج می‌شوی.
      </div>

      <button
        onClick={() => {
          if (confirm("همه داده‌های این دستگاه پاک و اپ به حالت اول برگردد؟")) {
            restoreData(emptyData());
            logout();
            onToast("ریست شد", "همه داده‌ها پاک شد");
          }
        }}
        className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 py-3 text-[12.5px] font-bold text-red-400"
      >
        <RefreshCcw size={15} /> بازنشانی کامل دیتابیس
      </button>
    </div>
  );
}
