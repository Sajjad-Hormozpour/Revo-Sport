import { useState } from "react";
import { Bell, Database, Globe, LogOut, Palette, Settings, UserRound } from "lucide-react";
import { useStore } from "../../lib/store";
import { useLang } from "../../lib/i18n";
import { AppearanceSettings } from "../../components/appearance";
import BackupPanel from "../../components/backup";
import { LanguageSection, NotificationSection, SettingsSection } from "../../components/settings-blocks";
import { Modal } from "../../components/ui";

export default function CoachSettings({
  onToast,
}: {
  onToast: (title: string, description: string) => void;
}) {
  const { session, userById, logout } = useStore();
  const { t } = useLang();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [exiting, setExiting] = useState(false);
  const me = session ? userById(session.userId) : undefined;

  return (
    <div className="screen-in mx-auto max-w-3xl space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-[18px] font-black">
          <Settings size={19} className="text-[#e9e400]" /> {t("set.title")}
        </h2>
      </div>

      <SettingsSection icon={<Palette size={17} />} title={t("set.appearance")}>
        <AppearanceSettings onToast={onToast} />
      </SettingsSection>

      <SettingsSection icon={<Database size={17} />} title={t("set.backup")} sub="JSON • CSV • Excel">
        <BackupPanel onToast={onToast} />
      </SettingsSection>

      <SettingsSection icon={<Globe size={17} />} title={t("set.language")}>
        <LanguageSection />
      </SettingsSection>

      <SettingsSection icon={<Bell size={17} />} title={t("set.notifications")}>
        <NotificationSection />
      </SettingsSection>

      <SettingsSection icon={<UserRound size={17} />} title={t("set.account")}>
        <div className="flex flex-wrap items-center gap-3">
          {me && (
            <>
              <img src={me.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[13px]">{me.name}</b>
                <span className="block truncate text-[11px] text-[var(--color-mute)]" dir="ltr" style={{ textAlign: "right" }}>
                  {me.email}
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 text-[12.5px] font-black text-red-400 hover:bg-red-500/15"
          >
            <LogOut size={15} /> خروج از حساب
          </button>
        </div>
      </SettingsSection>

      <Modal
        open={confirmLogout}
        onClose={() => { if (!exiting) setConfirmLogout(false); }}
        title="خروج از حساب"
      >
        <p className="text-[13px] leading-7 text-[var(--color-mute)]">
          از حساب خارج می‌شوی؟ اطلاعات شاگردان، برنامه‌ها و کد مربی حفظ می‌شود و با ورود دوباره در دسترس است.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConfirmLogout(false)}
            disabled={exiting}
            className="press h-11 rounded-xl border border-[var(--color-line)] text-[13px] font-bold disabled:opacity-50"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => {
              setExiting(true);
              logout();
            }}
            disabled={exiting}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 text-[13px] font-black text-white disabled:opacity-50"
          >
            <LogOut size={15} /> {exiting ? "در حال خروج…" : "خروج از حساب"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
