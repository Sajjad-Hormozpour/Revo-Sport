import type { ReactNode } from "react";
import { Check, X, ChevronLeft, Search } from "lucide-react";
import { fa } from "../lib/core";
import { formatJalaliLong, formatTime, useNow } from "../lib/time";

export function ClockLive({ compact = false }: { compact?: boolean }) {
  const now = useNow(1000);
  return (
    <div className="tnum leading-tight" dir="rtl">
      <b className="block text-[12.5px] font-black tracking-wide">{formatTime(now, true)}</b>
      {!compact && <span className="block text-[10px] font-bold text-[var(--color-mute)]">{formatJalaliLong(now)}</span>}
    </div>
  );
}

export function ToastView({ toast }: { toast: { title: string; desc: string } | null }) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
      <div className="toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#e9e400]/40 bg-[var(--color-card)] p-4 text-[var(--color-ink)] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e9e400]">
          <Check size={18} strokeWidth={3} className="text-black" />
        </span>
        <span>
          <b className="block text-[13px] font-black">{toast.title}</b>
          <span className="block text-[11.5px] leading-5 text-[var(--color-mute)]">{toast.desc}</span>
        </span>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="overlay-in fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={`drawer-in glass-strong max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[28px] ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-black">{title}</h3>
          <button onClick={onClose} className="press glass-subtle flex h-9 w-9 items-center justify-center rounded-full" aria-label="بستن">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[var(--color-mute)]">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3 text-[13.5px] font-semibold text-[var(--color-ink)] outline-none focus:border-[#e9e400]/50";

export function BrandBtn({ children, onClick, className = "", type = "button" }: { children: ReactNode; onClick?: () => void; className?: string; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} className={`press flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#f2ff00] to-[#d9d200] px-5 text-[13.5px] font-black text-black shadow-[0_12px_28px_-12px_rgba(233,228,0,0.7),inset_0_1px_0_rgba(255,255,255,0.5)] ${className}`}>
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`press flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-line)] px-5 text-[13px] font-extrabold ${className}`}>
      {children}
    </button>
  );
}

export function Pill({ children, tone = "mute" }: { children: ReactNode; tone?: "ok" | "warn" | "danger" | "brand" | "mute" | "info" }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-500/15 text-emerald-400",
    warn: "bg-amber-500/15 text-amber-400",
    danger: "bg-red-500/15 text-red-400",
    brand: "bg-[#e9e400]/15 text-[#e9e400]",
    info: "bg-sky-500/15 text-sky-400",
    mute: "bg-white/8 text-[var(--color-mute)]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-black ${map[tone]}`}>{children}</span>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5">
      <Search size={16} className="shrink-0 text-[var(--color-mute)]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-[13px] font-semibold outline-none placeholder:text-[var(--color-mute)]" />
      {value && (
        <button onClick={() => onChange("")} aria-label="پاک">
          <X size={14} className="text-[var(--color-mute)]" />
        </button>
      )}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="glass rounded-[20px] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-bold text-[var(--color-mute)]">{label}</span>
        {icon && <span className="glass-subtle flex h-8 w-8 items-center justify-center rounded-xl">{icon}</span>}
      </div>
      <p className="tnum mt-2 text-[22px] font-black tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--color-mute)]">{hint}</p>}
    </div>
  );
}

export function Back({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <button onClick={onClick} className="press flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-card)]" aria-label="بازگشت">
        <ChevronLeft size={18} className="rotate-180" />
      </button>
      <h2 className="text-[16px] font-black">{title}</h2>
    </div>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full rounded-full bg-[#e9e400] transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-8 text-center text-[13px] text-[var(--color-mute)]">{text}</p>;
}

export function money(n: number) {
  return `${fa(n.toLocaleString("en-US"))} تومان`;
}

export function subTone(s: string): "ok" | "warn" | "danger" | "mute" {
  if (s === "فعال") return "ok";
  if (s === "در حال اتمام") return "warn";
  if (s === "منقضی") return "danger";
  return "mute";
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={onClick} className={`relative h-7 w-12 rounded-full transition ${on ? "bg-[#e9e400]" : "bg-white/15"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-1" : "left-6"}`} />
    </button>
  );
}
