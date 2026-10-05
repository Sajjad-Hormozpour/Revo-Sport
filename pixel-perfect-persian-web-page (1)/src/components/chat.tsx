import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, CheckCheck, ChevronDown, Send, Smile, Reply, Pencil, Trash2, X, Plus, Image as ImageIcon,
  Paperclip, Search, CornerUpLeft, FileText, Download, MoreHorizontal,
} from "lucide-react";
import type { ChatMsg } from "../data/types";
import { useStore } from "../lib/store";
import { fa } from "../lib/core";
import { dayKey, formatJalaliLong, formatTime, parseDate } from "../lib/time";

const QUICK_COACH = ["آفرین، عالی بود 👏", "امروز تمرینت را ثبت کن", "ویدیوی فرم حرکت را بفرست", "استراحت بین ست‌ها را رعایت کن"];
const QUICK_STUDENT = ["ممنون مربی 🙏", "امروز تمرین را انجام دادم", "یک سؤال درباره حرکت دارم", "امروز نتوانستم تمرین کنم"];
const EMOJIS = ["💪", "🔥", "👏", "🙏", "✅", "😀", "😅", "🤝", "⏱️", "🏋️", "❤️", "👍", "😍", "😂", "🤔", "🎯", "💯", "😴", "🥵", "👌", "🙌", "😎", "🤯", "🍎"];
const REACTIONS = ["👍", "❤️", "🔥", "👏", "😂", "🙏"];

function dayLabel(iso: string): string {
  const d = parseDate(iso);
  if (!d) return "";
  const k = dayKey(d);
  const today = dayKey();
  const yest = dayKey(new Date(Date.now() - 86400000));
  if (k === today) return "امروز";
  if (k === yest) return "دیروز";
  return formatJalaliLong(d);
}

function bytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${fa(n)} بایت`;
  if (n < 1024 * 1024) return `${fa(Math.round(n / 1024))} کیلوبایت`;
  return `${fa((n / 1024 / 1024).toFixed(1))} مگابایت`;
}

export function ChatThread({
  studentId,
  me,
  peerName,
  peerAvatar,
  placeholder,
  compact = false,
}: {
  studentId: string;
  me: "coach" | "student";
  peerName: string;
  peerAvatar?: string;
  placeholder: string;
  compact?: boolean;
}) {
  const { data, prefs, sendMessage, editMessage, deleteMessage, reactMessage } = useStore();
  const messages = useMemo(() => data.messages.filter((m) => m.studentId === studentId), [data.messages, studentId]);

  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [reply, setReply] = useState<ChatMsg | null>(null);
  const [editing, setEditing] = useState<ChatMsg | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOn, setSearchOn] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const quick = me === "coach" ? QUICK_COACH : QUICK_STUDENT;

  const filtered = useMemo(
    () => (query.trim() ? messages.filter((m) => !m.deleted && m.text.includes(query.trim())) : messages),
    [messages, query]
  );

  const groups = useMemo(() => {
    const out: { label: string; items: ChatMsg[] }[] = [];
    filtered.forEach((m) => {
      const label = dayLabel(m.time);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(m);
      else out.push({ label, items: [m] });
    });
    return out;
  }, [filtered]);

  const byId = (id?: string) => messages.find((m) => m.id === id);
  const scrollDown = (smooth = true) => endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });

  useEffect(() => {
    if (atBottom && !query) scrollDown(messages.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
  };

  const grow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(120, el.scrollHeight)}px`;
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    if (editing) {
      editMessage(editing.id, t);
      setEditing(null);
    } else {
      sendMessage(studentId, me, t, { replyTo: reply?.id });
      setReply(null);
    }
    setText("");
    setEmoji(false);
    requestAnimationFrame(() => {
      grow();
      scrollDown();
    });
  };

  const startEdit = (m: ChatMsg) => {
    setEditing(m);
    setReply(null);
    setText(m.text);
    setMenu(null);
    requestAnimationFrame(() => {
      taRef.current?.focus();
      grow();
    });
  };

  const attachImage = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => sendMessage(studentId, me, "", { kind: "image", attachUrl: String(r.result), attachName: f.name, fileSize: f.size, replyTo: reply?.id });
    r.readAsDataURL(f);
    setReply(null);
    setAttachOpen(false);
  };

  const attachFile = (f?: File) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      sendMessage(studentId, me, `📎 ${f.name} (${bytes(f.size)}) — حجم زیاد برای ذخیره`, { replyTo: reply?.id });
    } else {
      const r = new FileReader();
      r.onload = () => sendMessage(studentId, me, "", { kind: "file", attachUrl: String(r.result), attachName: f.name, fileSize: f.size, replyTo: reply?.id });
      r.readAsDataURL(f);
    }
    setReply(null);
    setAttachOpen(false);
  };

  const wall =
    prefs.chatWallpaper === "dots" ? "chat-wall-dots" : prefs.chatWallpaper === "grid" ? "chat-wall-grid" : prefs.chatWallpaper === "glow" ? "chat-wall-glow" : "";
  const classic = prefs.bubble === "classic";

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {searchOn && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-bg2)] px-3 py-2">
          <Search size={15} className="text-[var(--color-mute)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="جستجو در پیام‌ها…"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none sm:text-[12.5px]"
          />
          {query && <span className="tnum text-[10.5px] text-[var(--color-mute)]">{fa(filtered.filter((m) => !m.deleted).length)} نتیجه</span>}
          <button onClick={() => { setSearchOn(false); setQuery(""); }} aria-label="بستن جستجو"><X size={16} /></button>
        </div>
      )}

      <div ref={boxRef} onScroll={onScroll} className={`relative noscroll min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-3 sm:px-3 ${wall} ${compact ? "overscroll-contain" : ""}`}>
        {!searchOn && (
          <button
            onClick={() => setSearchOn(true)}
            className="press absolute left-3 top-2 z-[2] flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)]/80 text-[var(--color-mute)] backdrop-blur"
            aria-label="جستجو"
          >
            <Search size={15} />
          </button>
        )}

        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[12.5px] font-bold">{query ? "پیامی پیدا نشد" : `شروع گفتگو با ${peerName}`}</p>
            {!query && <p className="mt-1 text-[11.5px] text-[var(--color-mute)]">پیام‌ها فقط بین شما دو نفر است.</p>}
          </div>
        )}

        {groups.map((g) => (
          <div key={g.label} className="space-y-1">
            <div className="sticky top-0 z-[1] flex justify-center py-1">
              <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-bg2)]/90 px-3 py-1 text-[10.5px] font-bold text-[var(--color-mute)] backdrop-blur">
                {g.label}
              </span>
            </div>
            {g.items.map((m, i) => {
              const mine = m.from === me;
              const prev = g.items[i - 1];
              const grouped = prev && prev.from === m.from && !m.replyTo;
              const repliedTo = byId(m.replyTo);
              return (
                <div key={m.id} id={`msg-${m.id}`} className={`group flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-2"}`}>
                  {!mine &&
                    (grouped ? (
                      <span className="w-7 shrink-0" />
                    ) : peerAvatar ? (
                      <img src={peerAvatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-card2)] text-[10px] font-black">{peerName.slice(0, 1)}</span>
                    ))}

                  <div className="relative max-w-[86%] sm:max-w-[82%]">
                    {/* hover actions */}
                    {!m.deleted && (
                      <div className={`absolute -top-3 z-[3] flex gap-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-1 py-0.5 shadow transition ${menu === `a-${m.id}` || menu === `r-${m.id}` ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"} ${mine ? "left-1" : "right-1"}`}>
                        <button onClick={() => setMenu(menu === `r-${m.id}` ? null : `r-${m.id}`)} className="press flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-mute)]" aria-label="واکنش"><Smile size={13} /></button>
                        <button onClick={() => { setReply(m); setEditing(null); taRef.current?.focus(); }} className="press flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-mute)]" aria-label="پاسخ"><Reply size={13} /></button>
                        {mine && m.kind === "text" && <button onClick={() => startEdit(m)} className="press flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-mute)]" aria-label="ویرایش"><Pencil size={12} /></button>}
                        {mine && <button onClick={() => { if (confirm("این پیام حذف شود؟")) deleteMessage(m.id); }} className="press flex h-6 w-6 items-center justify-center rounded-full text-red-400" aria-label="حذف"><Trash2 size={12} /></button>}
                      </div>
                    )}
                    {menu === `r-${m.id}` && (
                      <div className={`absolute -top-10 z-[4] flex gap-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-1.5 py-1 shadow-lg ${mine ? "left-0" : "right-0"}`}>
                        {REACTIONS.map((e) => (
                          <button key={e} onClick={() => { reactMessage(m.id, e); setMenu(null); }} className="press rounded-full px-1 text-[16px] hover:scale-125">{e}</button>
                        ))}
                      </div>
                    )}

                    <div
                      className={`${classic ? "rounded-xl" : "rounded-2xl"} px-3 py-2 text-[13px] leading-6 shadow-sm ${prefs.reduceMotion ? "" : "msg-in"} ${
                        m.deleted
                          ? "border border-dashed border-[var(--color-line)] bg-transparent text-[var(--color-mute)] italic"
                          : mine
                            ? `bg-[#e9e400] text-black ${grouped ? "" : classic ? "" : "rounded-br-md"}`
                            : `border border-[var(--color-line)] bg-[var(--color-card2)] ${grouped ? "" : classic ? "" : "rounded-bl-md"}`
                      }`}
                    >
                      {repliedTo && !m.deleted && (
                        <button
                          onClick={() => document.getElementById(`msg-${repliedTo.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                          className={`mb-1.5 flex w-full items-start gap-1.5 rounded-lg border-r-2 px-2 py-1 text-right ${mine ? "border-black/40 bg-black/10" : "border-[#e9e400] bg-[var(--color-bg)]"}`}
                        >
                          <CornerUpLeft size={11} className="mt-0.5 shrink-0 opacity-60" />
                          <span className="min-w-0">
                            <b className="block text-[10px] opacity-70">{repliedTo.from === me ? "شما" : peerName}</b>
                            <span className="block truncate text-[10.5px] opacity-80">{repliedTo.deleted ? "پیام حذف‌شده" : repliedTo.kind === "image" ? "🖼️ تصویر" : repliedTo.kind === "file" ? "📎 فایل" : repliedTo.text}</span>
                          </span>
                        </button>
                      )}

                      {m.deleted ? (
                        <p className="flex items-center gap-1.5"><Trash2 size={12} /> این پیام حذف شد</p>
                      ) : m.kind === "image" && m.attachUrl ? (
                        <a href={m.attachUrl} target="_blank" rel="noreferrer" className="block">
                          <img src={m.attachUrl} alt={m.attachName ?? ""} className="max-h-52 w-full rounded-lg object-cover" />
                          {m.text && <p className="mt-1.5 whitespace-pre-wrap break-words">{m.text}</p>}
                        </a>
                      ) : m.kind === "file" && m.attachUrl ? (
                        <a href={m.attachUrl} download={m.attachName} className={`flex items-center gap-2 rounded-lg p-2 ${mine ? "bg-black/10" : "bg-[var(--color-bg)]"}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e9e400]/20 text-[#c9c400]"><FileText size={17} /></span>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-[12px]">{m.attachName}</b>
                            <span className="text-[10px] opacity-70">{bytes(m.fileSize)}</span>
                          </span>
                          <Download size={15} className="shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      )}

                      {!m.deleted && (
                        <span className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "justify-start text-black/55" : "text-[var(--color-mute)]"}`} dir="ltr">
                          {mine && (m.unread ? <Check size={12} /> : <CheckCheck size={12} className="text-emerald-700" />)}
                          {prefs.showSeconds ? fa(formatTime(m.time, true)) : fa(formatTime(m.time, false))}
                          {m.editedAt && <span className="opacity-70">(ویرایش‌شده)</span>}
                        </span>
                      )}
                    </div>

                    {!m.deleted && (
                      <button
                        type="button"
                        onClick={() => setMenu(menu === `a-${m.id}` ? null : `a-${m.id}`)}
                        aria-label="گزینه‌های پیام"
                        aria-expanded={menu === `a-${m.id}` || menu === `r-${m.id}`}
                        className={`press absolute bottom-0 z-[2] flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-mute)] shadow-sm sm:hidden ${mine ? "-left-3" : "-right-3"}`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    )}

                    {m.reaction && !m.deleted && (
                      <button
                        onClick={() => reactMessage(m.id, m.reaction!)}
                        className={`absolute -bottom-2.5 flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-1.5 text-[11px] shadow ${mine ? "right-1" : "left-1"}`}
                      >
                        {m.reaction}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {!atBottom && filtered.length > 3 && (
        <button
          onClick={() => scrollDown()}
          className="press absolute bottom-[120px] left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)] shadow-lg"
          aria-label="آخرین پیام‌ها"
        >
          <ChevronDown size={17} />
        </button>
      )}

      <div className="glass-strong mobile-safe-bottom shrink-0 border-x-0 border-b-0 p-2 sm:p-2.5">
        {(reply || editing) && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border-r-2 border-[#e9e400] bg-[var(--color-card)] px-3 py-1.5">
            {editing ? <Pencil size={13} className="shrink-0 text-[#e9e400]" /> : <Reply size={13} className="shrink-0 text-[#e9e400]" />}
            <span className="min-w-0 flex-1">
              <b className="block text-[10.5px] text-[#e9e400]">{editing ? "ویرایش پیام" : `پاسخ به ${reply?.from === me ? "خودت" : peerName}`}</b>
              <span className="block truncate text-[11px] text-[var(--color-mute)]">{editing ? editing.text : reply?.kind === "image" ? "🖼️ تصویر" : reply?.kind === "file" ? "📎 فایل" : reply?.text}</span>
            </span>
            <button onClick={() => { setReply(null); setEditing(null); setText(""); }} aria-label="لغو"><X size={15} className="text-[var(--color-mute)]" /></button>
          </div>
        )}

        {!editing && (
          <>
            <button
              type="button"
              onClick={() => setQuickOpen((value) => !value)}
              aria-expanded={quickOpen}
              className="press mb-1.5 flex items-center gap-1 text-[11px] font-bold text-[var(--color-mute)] sm:hidden"
            >
              پاسخ‌های آماده <ChevronDown size={13} className={quickOpen ? "rotate-180" : ""} />
            </button>
            <div className={`noscroll mb-1.5 gap-1.5 overflow-x-auto sm:mb-2 ${quickOpen ? "flex" : "hidden sm:flex"}`}>
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => { setText(q); setQuickOpen(false); requestAnimationFrame(() => { taRef.current?.focus(); grow(); }); }}
                  className="press shrink-0 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-mute)]"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        )}

        {emoji && (
          <div className="noscroll mb-2 grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-2">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => { setText((t) => t + e); taRef.current?.focus(); }} className="press rounded-lg py-1 text-[19px] hover:bg-[var(--color-bg)]">{e}</button>
            ))}
          </div>
        )}

        {attachOpen && !editing && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button onClick={() => imgRef.current?.click()} className="press flex items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] py-2.5 text-[12px] font-bold">
              <ImageIcon size={15} className="text-[#e9e400]" /> ارسال تصویر
            </button>
            <button onClick={() => fileRef.current?.click()} className="press flex items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] py-2.5 text-[12px] font-bold">
              <Paperclip size={15} className="text-[#e9e400]" /> ارسال فایل
            </button>
          </div>
        )}
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { attachImage(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { attachFile(e.target.files?.[0]); e.target.value = ""; }} />

        <div className="flex items-end gap-1.5">
          {!editing && (
            <button
              onClick={() => { setAttachOpen((v) => !v); setEmoji(false); }}
              className={`press flex h-11 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-line)] ${attachOpen ? "bg-[#e9e400]/15 text-[#e9e400]" : "bg-[var(--color-card)] text-[var(--color-mute)]"}`}
              aria-label="پیوست"
            >
              <Plus size={19} className={`transition ${attachOpen ? "rotate-45" : ""}`} />
            </button>
          )}
          <button
            onClick={() => { setEmoji((v) => !v); setAttachOpen(false); }}
            className={`press flex h-11 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-line)] ${emoji ? "bg-[#e9e400]/15 text-[#e9e400]" : "bg-[var(--color-card)] text-[var(--color-mute)]"}`}
            aria-label="ایموجی"
          >
            <Smile size={18} />
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); grow(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (prefs.enterToSend ? !e.shiftKey : e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={placeholder}
            className="max-h-[120px] min-h-[44px] min-w-0 flex-1 resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5 text-[16px] leading-6 outline-none focus:border-[#e9e400]/50 sm:px-3.5 sm:py-3 sm:text-[13px]"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e9e400] text-black transition disabled:opacity-40"
            aria-label={editing ? "ذخیره" : "ارسال"}
          >
            {editing ? <Check size={18} /> : <Send size={17} />}
          </button>
        </div>
        <p className="mt-1 hidden text-center text-[9.5px] text-[var(--color-mute)] sm:block">
          {prefs.enterToSend ? "Enter برای ارسال • Shift+Enter خط جدید" : "Ctrl+Enter برای ارسال"}
        </p>
      </div>
    </div>
  );
}
