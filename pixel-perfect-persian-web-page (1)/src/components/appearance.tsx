import { useRef } from "react";
import {
  Palette, Sun, Moon, Sparkles, MessageSquare, Check, RotateCcw, Zap, Monitor, Eye, CornerDownLeft, Clock,
} from "lucide-react";
import { useStore } from "../lib/store";
import type { Prefs } from "../data/types";
import { Toggle } from "./ui";

const ACCENTS: { c: string; name: string }[] = [
  { c: "#e9e400", name: "لیمویی (پیش‌فرض)" },
  { c: "#f97316", name: "نارنجی" },
  { c: "#ef4444", name: "قرمز" },
  { c: "#ec4899", name: "صورتی" },
  { c: "#a855f7", name: "بنفش" },
  { c: "#3b82f6", name: "آبی" },
  { c: "#06b6d4", name: "فیروزه‌ای" },
  { c: "#22c55e", name: "سبز" },
];

const BUBBLE_PREVIEW = "چطوری؟ امروز تمرین داری؟";

export function AppearanceSettings({ onToast }: { onToast: (t: string, d: string) => void }) {
  const { prefs, setPrefs, resetPrefs, light, toggleLight } = useStore();
  const colorRef = useRef<HTMLInputElement>(null);
  const isCustomColor = !ACCENTS.some((a) => a.c.toLowerCase() === prefs.accent.toLowerCase());

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs({ [k]: v } as Partial<Prefs>);

  return (
    <div className="space-y-3">
      {/* live preview */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
          <b className="flex items-center gap-1.5 text-[12.5px]"><Eye size={14} className="text-[#e9e400]" /> پیش‌نمایش زنده</b>
          <span className="text-[10.5px] text-[var(--color-mute)]">همین حالا اعمال می‌شود</span>
        </div>
        <div className={`space-y-2 p-4 ${prefs.chatWallpaper === "dots" ? "chat-wall-dots" : prefs.chatWallpaper === "grid" ? "chat-wall-grid" : prefs.chatWallpaper === "glow" ? "chat-wall-glow" : ""}`}>
          <div className="flex justify-start">
            <span className={`max-w-[75%] border border-[var(--color-line)] bg-[var(--color-card2)] px-3 py-2 text-[12.5px] ${prefs.bubble === "classic" ? "rounded-xl" : "rounded-2xl rounded-bl-md"}`}>{BUBBLE_PREVIEW}</span>
          </div>
          <div className="flex justify-end">
            <span className={`max-w-[75%] bg-[#e9e400] px-3 py-2 text-[12.5px] text-black ${prefs.bubble === "classic" ? "rounded-xl" : "rounded-2xl rounded-br-md"}`}>آره حتماً! 💪</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="rounded-full bg-[#e9e400] px-3 py-1 text-[11px] font-black text-black">دکمه اصلی</span>
            <span className="rounded-full bg-[#e9e400]/15 px-3 py-1 text-[11px] font-black text-[#e9e400]">برچسب</span>
            <span className="rounded-full border border-[#e9e400]/40 px-3 py-1 text-[11px] font-bold text-[#e9e400]">حاشیه</span>
          </div>
        </div>
      </div>

      {/* theme */}
      <Section icon={<Monitor size={15} />} title="حالت نمایش">
        <div className="grid grid-cols-2 gap-2">
          <ChoiceCard active={!light} onClick={() => light && toggleLight()} icon={<Moon size={18} />} title="تیره" />
          <ChoiceCard active={light} onClick={() => !light && toggleLight()} icon={<Sun size={18} />} title="روشن" />
        </div>
      </Section>

      {/* accent */}
      <Section icon={<Palette size={15} />} title="رنگ تأکید">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ACCENTS.map((a) => (
            <button
              key={a.c}
              onClick={() => { set("accent", a.c); onToast("رنگ تغییر کرد", a.name); }}
              title={a.name}
              className={`press relative flex h-11 items-center justify-center rounded-xl ring-2 transition ${prefs.accent.toLowerCase() === a.c.toLowerCase() ? "ring-[var(--color-ink)]" : "ring-transparent"}`}
              style={{ background: a.c }}
            >
              {prefs.accent.toLowerCase() === a.c.toLowerCase() && <Check size={17} className="text-black" strokeWidth={3} />}
            </button>
          ))}
        </div>
        <button
          onClick={() => colorRef.current?.click()}
          className={`press mt-2 flex w-full items-center gap-2 rounded-xl border p-2.5 text-right ${isCustomColor ? "border-[var(--color-ink)]" : "border-[var(--color-line)]"}`}
        >
          <span className="h-8 w-8 shrink-0 rounded-lg border border-[var(--color-line)]" style={{ background: prefs.accent }} />
          <span className="flex-1">
            <b className="block text-[12px]">رنگ دلخواه</b>
            <span className="text-[10.5px] text-[var(--color-mute)]" dir="ltr">{prefs.accent.toUpperCase()}</span>
          </span>
          <span className="rounded-lg bg-[var(--color-bg)] px-2.5 py-1.5 text-[11px] font-bold">انتخاب</span>
          <input ref={colorRef} type="color" value={prefs.accent} onChange={(e) => set("accent", e.target.value)} className="sr-only" />
        </button>
      </Section>

      {/* chat look */}
      <Section icon={<MessageSquare size={15} />} title="ظاهر گفتگو">
        <p className="mb-1.5 text-[11px] font-bold text-[var(--color-mute)]">شکل حباب پیام</p>
        <div className="grid grid-cols-2 gap-2">
          <ChoiceCard active={prefs.bubble === "modern"} onClick={() => set("bubble", "modern")} icon={<Sparkles size={16} />} title="مدرن" />
          <ChoiceCard active={prefs.bubble === "classic"} onClick={() => set("bubble", "classic")} icon={<MessageSquare size={16} />} title="کلاسیک" />
        </div>
        <p className="mb-1.5 mt-3 text-[11px] font-bold text-[var(--color-mute)]">کاغذدیواری گفتگو</p>
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["none", "ساده"],
              ["dots", "نقطه"],
              ["grid", "شبکه"],
              ["glow", "نور"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => set("chatWallpaper", id)}
              className={`press overflow-hidden rounded-xl border text-[10.5px] font-bold ${prefs.chatWallpaper === id ? "border-[var(--color-ink)]" : "border-[var(--color-line)]"}`}
            >
              <span className={`block h-9 w-full ${id === "dots" ? "chat-wall-dots" : id === "grid" ? "chat-wall-grid" : id === "glow" ? "chat-wall-glow" : "bg-[var(--color-bg)]"}`} />
              <span className="block py-1">{label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* behavior toggles */}
      <Section icon={<Zap size={15} />} title="رفتار و دسترس‌پذیری">
        <ToggleRow icon={<CornerDownLeft size={15} />} title="ارسال با Enter" sub="خاموش: با Ctrl+Enter ارسال می‌شود" on={prefs.enterToSend} onClick={() => set("enterToSend", !prefs.enterToSend)} />
        <ToggleRow icon={<Clock size={15} />} title="نمایش ثانیه در ساعت" sub="زمان دقیق‌تر پیام‌ها و ساعت" on={prefs.showSeconds} onClick={() => set("showSeconds", !prefs.showSeconds)} />
        <ToggleRow icon={<Sparkles size={15} />} title="کاهش انیمیشن" sub="حرکت کمتر برای چشم راحت‌تر" on={prefs.reduceMotion} onClick={() => set("reduceMotion", !prefs.reduceMotion)} />
      </Section>

      <button
        onClick={() => { resetPrefs(); onToast("بازنشانی شد", "ظاهر به حالت پیش‌فرض برگشت"); }}
        className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-line)] py-3 text-[12.5px] font-extrabold text-[var(--color-mute)]"
      >
        <RotateCcw size={15} /> بازگرداندن ظاهر به پیش‌فرض
      </button>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4">
      <b className="mb-3 flex items-center gap-1.5 text-[13.5px]">
        <span className="text-[#e9e400]">{icon}</span> {title}
      </b>
      {children}
    </div>
  );
}

function ChoiceCard({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      className={`press flex items-center justify-center gap-2 rounded-xl border py-3 text-[13px] font-black transition ${active ? "border-[#e9e400] bg-[#e9e400]/10 text-[#e9e400]" : "border-[var(--color-line)] text-[var(--color-mute)]"}`}
    >
      {icon} {title}
      {active && <Check size={14} strokeWidth={3} />}
    </button>
  );
}

function ToggleRow({ icon, title, sub, on, onClick }: { icon: React.ReactNode; title: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-line)] py-2.5 last:border-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg)] text-[#e9e400]">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[12.5px]">{title}</b>
        <span className="block text-[10.5px] text-[var(--color-mute)]">{sub}</span>
      </span>
      <Toggle on={on} onClick={onClick} />
    </div>
  );
}
