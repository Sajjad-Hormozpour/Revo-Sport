import { localize } from "../../i18n";
import { useState, type ReactNode } from "react";
import { Bell, Check, ChevronDown, Globe } from "lucide-react";
import { useLang, useNotifPrefs, type NotifPrefs } from "../lib/i18n";
import { Toggle } from "./ui";

export function SettingsSection({
  icon,
  title,
  sub,
  children,
  defaultOpen = false,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex w-full items-center gap-3 p-4 text-right"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9e400]/15 text-[#e9e400]">
          {localize(icon)}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14px]">{localize(title)}</b>
          {localize(sub && <span className="block truncate text-[11px] text-[var(--color-mute)]">{localize(sub)}</span>)}
        </span>
        <ChevronDown size={17} className={`shrink-0 text-[var(--color-mute)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {localize(open && <div className="border-t border-[var(--color-line)] p-4 pt-3">{localize(children)}</div>)}
    </section>
  );
}

export function LanguageSection() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="space-y-2">
      <p className="text-[11.5px] leading-6 text-[var(--color-mute)]">{localize(t("set.langDesc"))}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={localize(t("set.language"))}>
        {localize((["fa", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lang === l}
            onClick={() => setLang(l)}
            className={`press flex items-center justify-center gap-2 rounded-xl border py-3 text-[13px] font-black transition ${
              lang === l ? "border-[#e9e400] bg-[#e9e400]/10 text-[#e9e400]" : "border-[var(--color-line)] text-[var(--color-mute)]"
            }`}
          >
            <Globe size={15} />
            {localize(l === "fa" ? t("set.fa") : t("set.en"))}
            {localize(lang === l && <Check size={14} strokeWidth={3} />)}
          </button>
        )))}
      </div>
    </div>
  );
}

const NOTIF_ROWS: { key: keyof NotifPrefs; icon: string; labelKey: string }[] = [
  { key: "messages", icon: "💬", labelKey: "set.notifMessages" },
  { key: "workouts", icon: "🏋️", labelKey: "set.notifWorkouts" },
  { key: "payments", icon: "💳", labelKey: "set.notifPayments" },
  { key: "checkins", icon: "📋", labelKey: "set.notifCheckins" },
];

export function NotificationSection() {
  const [prefs, update] = useNotifPrefs();
  const { t } = useLang();
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-[var(--color-mute)]">
        <Bell size={13} /> {localize(t("set.notifDesc"))}
      </p>
      <div className="space-y-1">
        {localize(NOTIF_ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-3 border-b border-[var(--color-line)] py-2.5 last:border-0">
            <span className="text-[18px]">{localize(row.icon)}</span>
            <b className="min-w-0 flex-1 text-[12.5px]">{localize(t(row.labelKey))}</b>
            <Toggle on={prefs[row.key]} onClick={() => update({ [row.key]: !prefs[row.key] })} />
          </div>
        )))}
      </div>
    </div>
  );
}
