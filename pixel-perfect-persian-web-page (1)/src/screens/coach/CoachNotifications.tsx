import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bell, CalendarDays, Check, CheckCheck, CheckCircle, ChevronLeft,
  CreditCard, Dumbbell, Info, MessageCircle, Search, X,
} from "lucide-react";
import { useStore } from "../../lib/store";
import { notifVisible, useNotifPrefs } from "../../lib/i18n";
import type { Notif } from "../../data/types";
import { fa } from "../../lib/core";
import {
  addDays, dayKey, formatDateTime, formatJalaliLong, formatRelative, parseDate, useNow,
} from "../../lib/time";
import type { CoachView } from "./CoachApp";

function notificationIcon(notification: Notif) {
  if (/پرداخت|اشتراک|فاکتور/.test(notification.title)) return CreditCard;
  if (/پیام/.test(notification.title)) return MessageCircle;
  if (/جلسه|رزرو/.test(notification.title)) return CalendarDays;
  if (/تمرین/.test(notification.title)) return Dumbbell;
  if (notification.type === "alert") return AlertTriangle;
  if (notification.type === "success") return CheckCircle;
  return Info;
}

export default function CoachNotifications({
  onView,
}: {
  onView: (view: CoachView, studentId?: string) => void;
}) {
  const { data, userById, markNotif, markNotifs } = useStore();
  const [notifPrefs] = useNotifPrefs();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const panelId = `${id}-notifications`;
  const titleId = `${id}-notifications-title`;
  const now = useNow(60000);

  const notifications = useMemo(
    () => data.notifs
      .filter((notification) => notification.to === "coach")
      .slice()
      .sort((a, b) => (parseDate(b.time)?.getTime() ?? 0) - (parseDate(a.time)?.getTime() ?? 0)),
    [data.notifs],
  );
  const unread = notifications.filter((notification) => !notification.read);
  const filtered = notifications.filter((notification) => {
    if (!notifVisible(notification.title, notifPrefs)) return false;
    if (filter === "unread" && notification.read) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    const student = data.students.find((s) => s.id === notification.studentId);
    const name = student ? userById(student.userId)?.name ?? "" : "";
    return `${notification.title} ${notification.body} ${name}`.toLowerCase().includes(term);
  });

  const groups: { key: string; title: string; items: Notif[] }[] = [];
  filtered.forEach((notification) => {
    const date = parseDate(notification.time);
    const key = date ? dayKey(date) : "undated";
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const title = !date
        ? "بدون تاریخ"
        : key === dayKey(now)
          ? "امروز"
          : key === dayKey(addDays(now, -1))
            ? "دیروز"
            : formatJalaliLong(date);
      group = { key, title, items: [] };
      groups.push(group);
    }
    group.items.push(notification);
  });

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("focusin", focusOutside);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("focusin", focusOutside);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) { setFilter("all"); setQuery(""); }
          setOpen((value) => !value);
        }}
        aria-label={`اعلان‌ها${unread.length ? `، ${fa(unread.length)} خوانده‌نشده` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        className={`press relative flex h-9 w-9 items-center justify-center rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-[#e9e400] ${
          open ? "bg-[#e9e400]/15 text-[#e9e400]" : "bg-[var(--color-card)] hover:bg-[var(--color-card2)]"
        }`}
      >
        <Bell size={17} />
        {unread.length > 0 && (
          <span
            aria-hidden="true"
            className="tnum absolute -left-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-[var(--color-bg)] bg-red-500 px-1 text-[8px] font-black leading-3 text-white"
          >
            {fa(unread.length > 99 ? "99+" : unread.length)}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="screen-in fixed left-3 right-3 top-[106px] z-[80] flex max-h-[min(76dvh,660px)] flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[0_22px_70px_-20px_rgba(0,0,0,0.55)] outline-none sm:absolute sm:left-0 sm:right-auto sm:top-[calc(100%+12px)] sm:w-[410px]"
          dir="rtl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-3.5">
            <div>
              <h2 id={titleId} className="text-[14px] font-black">اعلان‌ها و یادآوری‌ها</h2>
              <p className="mt-0.5 text-[10.5px] text-[var(--color-mute)]" aria-live="polite">
                {unread.length ? `${fa(unread.length)} اعلان خوانده‌نشده` : "همه اعلان‌ها خوانده شده‌اند"}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="بستن اعلان‌ها"
              className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-mute)]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="shrink-0 border-b border-[var(--color-line)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1 rounded-full bg-[var(--color-bg)] p-0.5" aria-label="فیلتر اعلان‌ها">
                {(["all", "unread"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`press rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                      filter === value ? "bg-[#e9e400] text-black" : "text-[var(--color-mute)]"
                    }`}
                  >
                    {value === "all" ? "همه" : "خوانده‌نشده"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => markNotifs(unread.map((notification) => notification.id))}
                disabled={unread.length === 0}
                className="press flex items-center gap-1 text-[10.5px] font-bold text-[#e9e400] disabled:cursor-default disabled:opacity-40"
              >
                <CheckCheck size={13} /> خواندن همه
              </button>
            </div>

            {notifications.length > 0 && (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2">
                <Search size={14} className="shrink-0 text-[var(--color-mute)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="جستجو در اعلان‌ها…"
                  aria-label="جستجو در اعلان‌ها"
                  className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--color-mute)]"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جستجو" className="text-[var(--color-mute)]">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {groups.length === 0 && (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-bg)] text-[var(--color-mute)]">
                  <Bell size={22} />
                </span>
                <p className="mt-3 text-[12.5px] font-bold">
                  {notifications.length === 0 ? "هنوز اعلانی نداری" : query ? "اعلانی پیدا نشد" : "اعلان خوانده‌نشده‌ای نداری"}
                </p>
                <p className="mt-1 text-[11px] leading-6 text-[var(--color-mute)]">
                  {notifications.length === 0 ? "پیام‌ها، خرید اشتراک و فعالیت شاگردان اینجا نمایش داده می‌شود." : "همه اعلان‌های قبلی در فهرست «همه» باقی می‌مانند."}
                </p>
                {(filter !== "all" || query) && (
                  <button
                    type="button"
                    onClick={() => { setFilter("all"); setQuery(""); }}
                    className="press mt-3 text-[11.5px] font-black text-[#e9e400]"
                  >
                    نمایش همه اعلان‌ها
                  </button>
                )}
              </div>
            )}

            {groups.map((group) => (
              <section key={group.key} aria-label={group.title}>
                <h3 className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-bg2)]/95 px-4 py-2 text-[10px] font-bold text-[var(--color-mute)] backdrop-blur">
                  {group.title}
                </h3>
                <ul>
                  {group.items.map((notification) => {
                    const Icon = notificationIcon(notification);
                    const student = data.students.find((s) => s.id === notification.studentId);
                    const studentName = student ? userById(student.userId)?.name : undefined;
                    return (
                      <li
                        key={notification.id}
                        className={`border-b border-[var(--color-line)] px-4 py-3.5 transition-colors last:border-b-0 ${
                          notification.read ? "" : "bg-[#e9e400]/[0.04]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            notification.type === "alert"
                              ? "bg-red-500/10 text-red-400"
                              : notification.type === "success"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-sky-500/10 text-sky-400"
                          }`}>
                            <Icon size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <b className="text-[12.5px] leading-6">{notification.title}</b>
                              {!notification.read && <span aria-label="خوانده‌نشده" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e9e400]" />}
                            </div>
                            <p className="whitespace-pre-wrap break-words text-[11.5px] leading-6 text-[var(--color-mute)]">{notification.body}</p>
                            {studentName && <p className="mt-0.5 text-[10.5px] font-bold text-[var(--color-ink)]">{studentName}</p>}
                            <time dateTime={parseDate(notification.time)?.toISOString()} title={formatDateTime(notification.time)} className="tnum mt-1 block text-[10px] text-[var(--color-mute)]">
                              {formatRelative(notification.time, now)}
                            </time>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              {student && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!notification.read) markNotif(notification.id);
                                    setOpen(false);
                                    onView("student", student.id);
                                  }}
                                  className="press flex items-center gap-0.5 text-[10.5px] font-bold text-[#e9e400]"
                                >
                                  مشاهده شاگرد <ChevronLeft size={12} />
                                </button>
                              )}
                              {notification.read ? (
                                <span className="mr-auto flex items-center gap-1 text-[10px] text-[var(--color-mute)]"><CheckCheck size={12} /> خوانده‌شده</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => markNotif(notification.id)}
                                  className="press mr-auto flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[10px] font-bold hover:bg-[var(--color-bg)]"
                                >
                                  <Check size={12} /> خواندم
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <div className="shrink-0 border-t border-[var(--color-line)] px-4 py-2.5 text-center text-[10.5px] text-[var(--color-mute)]">
            {fa(filtered.length)} از {fa(notifications.length)} اعلان
          </div>
        </div>
      )}
    </div>
  );
}