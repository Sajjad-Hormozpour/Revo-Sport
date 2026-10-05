import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fa" | "en";

const KEY = "revo-lang";

const dict: Record<string, { fa: string; en: string }> = {
  // coach nav
  "nav.dash": { fa: "داشبورد", en: "Dashboard" },
  "nav.students": { fa: "شاگردان", en: "Students" },
  "nav.programs": { fa: "برنامه‌های تمرینی", en: "Workouts" },
  "nav.moves": { fa: "حرکات و ویدیوهای من", en: "My Moves" },
  "nav.library": { fa: "کتابخانه حرکات", en: "Library" },
  "nav.calendar": { fa: "تقویم جلسات", en: "Calendar" },
  "nav.chat": { fa: "پیام‌ها", en: "Messages" },
  "nav.reports": { fa: "گزارش‌ها", en: "Reports" },
  "nav.ai": { fa: "دستیار هوشمند", en: "AI Coach" },
  "nav.billing": { fa: "اشتراک و پرداخت", en: "Billing" },
  "nav.settings": { fa: "تنظیمات و شخصی‌سازی", en: "Settings" },
  "nav.admin": { fa: "مدیریت سیستم", en: "Admin" },
  "nav.profile": { fa: "پروفایل من", en: "My Profile" },
  // student nav
  "snav.home": { fa: "خانه", en: "Home" },
  "snav.workout": { fa: "تمرین", en: "Workout" },
  "snav.history": { fa: "سوابق", en: "History" },
  "snav.progress": { fa: "پیشرفت", en: "Progress" },
  "snav.chat": { fa: "پیام‌ها", en: "Messages" },
  "snav.subscription": { fa: "اشتراک", en: "Plan" },
  "stitle.home": { fa: "خانه", en: "Home" },
  "stitle.workout": { fa: "تمرین امروز", en: "Today's Workout" },
  "stitle.history": { fa: "تمرین‌های ثبت‌شده", en: "Workout History" },
  "stitle.progress": { fa: "پیشرفت من", en: "My Progress" },
  "stitle.chat": { fa: "پیام با مربی", en: "Coach Chat" },
  "stitle.subscription": { fa: "اشتراک من", en: "My Plan" },
  "stitle.profile": { fa: "پروفایل و تنظیمات", en: "Profile & Settings" },
  // auth
  "auth.login": { fa: "ورود", en: "Login" },
  "auth.register": { fa: "ثبت‌نام", en: "Sign up" },
  "auth.welcome": { fa: "به Revo sport خوش برگشتی", en: "Welcome back to Revo sport" },
  "auth.create": { fa: "ساخت حساب جدید", en: "Create new account" },
  "auth.email": { fa: "ایمیل", en: "Email" },
  "auth.password": { fa: "رمز عبور", en: "Password" },
  "auth.phone": { fa: "شماره موبایل (الزامی)", en: "Mobile number (required)" },
  "auth.name": { fa: "نام کامل", en: "Full name" },
  "auth.forgot": { fa: "رمز را فراموش کردی؟", en: "Forgot password?" },
  "auth.noAccount": { fa: "حساب کاربری نداری؟", en: "No account yet?" },
  "auth.doRegister": { fa: "ثبت‌نام کن", en: "Sign up" },
  "auth.backLogin": { fa: "بازگشت به ورود", en: "Back to login" },
  "auth.getCodeLogin": { fa: "دریافت کد تأیید و ورود", en: "Get code & log in" },
  "auth.getCodeRegister": { fa: "دریافت کد تأیید و ثبت‌نام", en: "Get code & sign up" },
  "auth.stepRole": { fa: "نقش", en: "Role" },
  "auth.stepAccount": { fa: "حساب کاربری", en: "Account" },
  "auth.stepInfo": { fa: "مشخصات", en: "Details" },
  "auth.stepReview": { fa: "تأیید نهایی", en: "Review" },
  "auth.next": { fa: "ادامه", en: "Continue" },
  "auth.prev": { fa: "قبلی", en: "Back" },
  "auth.coach": { fa: "مربی", en: "Coach" },
  "auth.student": { fa: "شاگرد", en: "Athlete" },
  "auth.code": { fa: "کد مربی", en: "Coach code" },
  "auth.age": { fa: "سن", en: "Age" },
  "auth.gender": { fa: "جنسیت", en: "Gender" },
  "auth.height": { fa: "قد", en: "Height" },
  "auth.weight": { fa: "وزن", en: "Weight" },
  "auth.goal": { fa: "هدف", en: "Goal" },
  // common
  "c.save": { fa: "ذخیره", en: "Save" },
  "c.cancel": { fa: "انصراف", en: "Cancel" },
  "c.back": { fa: "بازگشت", en: "Back" },
  "c.search": { fa: "جستجو شاگرد…", en: "Search athlete…" },
  "c.close": { fa: "بستن", en: "Close" },
  // settings
  "set.title": { fa: "تنظیمات و شخصی‌سازی", en: "Settings & Personalization" },
  "set.appearance": { fa: "ظاهر", en: "Appearance" },
  "set.backup": { fa: "پشتیبان‌گیری", en: "Backup" },
  "set.language": { fa: "زبان", en: "Language" },
  "set.notifications": { fa: "اعلان‌ها", en: "Notifications" },
  "set.account": { fa: "حساب کاربری", en: "Account" },
  "set.langDesc": { fa: "زبان رابط کاربری", en: "Interface language" },
  "set.fa": { fa: "فارسی (راست‌چین)", en: "Persian (RTL)" },
  "set.en": { fa: "انگلیسی (چپ‌چین)", en: "English (LTR)" },
  "set.notifMessages": { fa: "پیام‌های جدید", en: "New messages" },
  "set.notifWorkouts": { fa: "ثبت تمرین شاگرد", en: "Workout logs" },
  "set.notifPayments": { fa: "پرداخت و اشتراک", en: "Payments & plans" },
  "set.notifCheckins": { fa: "چک‌این هفتگی", en: "Weekly check-ins" },
  "set.notifDesc": { fa: "کدام اعلان‌ها نمایش داده شود", en: "Which notifications to show" },
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const Ctx = createContext<LangCtx>({ lang: "fa", setLang: () => {}, t: (k) => k, dir: "rtl" });

function loadLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "fa";
  } catch {
    return "fa";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const t = (key: string) => dict[key]?.[lang] ?? dict[key]?.fa ?? key;

  return <Ctx.Provider value={{ lang, setLang, t, dir: lang === "fa" ? "rtl" : "ltr" }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}

export interface NotifPrefs {
  messages: boolean;
  workouts: boolean;
  payments: boolean;
  checkins: boolean;
}

const NOTIF_KEY = "revo-notif-prefs";
const DEFAULT_NOTIF: NotifPrefs = { messages: true, workouts: true, payments: true, checkins: true };

export function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return { ...DEFAULT_NOTIF };
    return { ...DEFAULT_NOTIF, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIF };
  }
}

export function useNotifPrefs(): [NotifPrefs, (patch: Partial<NotifPrefs>) => void, () => void] {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const update = (patch: Partial<NotifPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const reset = () => {
    setPrefs({ ...DEFAULT_NOTIF });
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(DEFAULT_NOTIF));
    } catch {
      /* ignore */
    }
  };
  return [prefs, update, reset];
}

/** فیلتر نمایشی اعلان‌ها بر اساس تنظیمات کاربر */
export function notifVisible(title: string, prefs: NotifPrefs): boolean {
  if (/پیام/.test(title)) return prefs.messages;
  if (/پرداخت|اشتراک|فاکتور/.test(title)) return prefs.payments;
  if (/چک‌این|check/i.test(title)) return prefs.checkins;
  if (/تمرین|برنامه/.test(title)) return prefs.workouts;
  return true;
}
