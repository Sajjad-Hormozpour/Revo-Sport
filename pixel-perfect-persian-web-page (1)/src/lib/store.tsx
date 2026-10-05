import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  api, computeDelta, detectServer, getToken, noDeletes, setToken,
  type Deletes, type PublicStats,
} from "./remote";
import { emptyData } from "../data/seed";
import { DEFAULT_ASSESSMENT, DEFAULT_PREFS } from "../data/types";
import type {
  AppData, Role, Student, WorkoutProgram, ChatMsg, Notif, Appointment,
  ProgressEntry, Goal, MealPlan, Invoice, ProgramSet, WorkoutLog, User, GoalKind,
  CoachExercise, SubPlan, Prefs, FoodEntry, NutritionLog, WeeklyCheckin, WorkoutTemplate,
} from "../data/types";
import { uid } from "./core";
import { addDays, addMonths, dayKey, inviteCode, nowIso } from "./time";
import { isValidPhone, normalizePhone } from "./phone";
import { workoutStreak } from "./metrics";

/** کلید قبلی حفظ شده تا داده‌های کاربران پاک نشود */
const KEY = "revofit-coach-v3";
/** در حالت سرور فقط ظاهر (تم/تنظیمات) روی دستگاه می‌ماند؛ داده‌ها روی سرور است */
const KEY_REMOTE_PREFS = "revofit-prefs-server";

type Res = string | null | Promise<string | null>;

interface AuthPayload {
  token: string;
  userId: string;
  role: Role;
  rev: number;
  db: AppData;
}

const normalizeDb = (db: Partial<AppData>): AppData => ({ ...emptyData(), ...db }) as AppData;
function reviseProgram(before: WorkoutProgram, after: WorkoutProgram): WorkoutProgram {
  if (JSON.stringify({ name: before.name, days: before.days }) === JSON.stringify({ name: after.name, days: after.days })) {
    return { ...after, version: before.version, revisions: before.revisions };
  }
  const revisions = before.revisions || [];
  const recent = revisions[revisions.length - 1];
  if (recent && Date.now() - new Date(recent.at).getTime() < 120000) {
    return { ...after, version: before.version, revisions };
  }
  return { ...after, version: (before.version || 1) + 1,
    revisions: [...revisions, { version: before.version || 1, at: nowIso(), name: before.name, days: structuredClone(before.days) }].slice(-20) };
}
export const DEFAULT_AVATAR =
  "https://images.pexels.com/photos/3764010/pexels-photo-3764010.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200";

export interface Session {
  userId: string;
  role: Role;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  invite?: string;
  age?: number;
  gender?: "مرد" | "زن";
  height?: number;
  weight?: number;
  goal?: GoalKind;
}

export interface PhoneCodeResult {
  challengeId?: string;
  expiresIn?: number;
  retryAfter?: number;
  demoCode?: string;
  error?: string;
}

interface LocalPhoneChallenge {
  id: string;
  purpose: "login" | "register";
  email: string;
  phone: string;
  code: string;
  sentAt: number;
  expiresAt: number;
  attempts: number;
  userId?: string;
}

export interface LogPayload {
  studentId: string;
  programId: string;
  dayId: string;
  durationMin: number;
  items: WorkoutLog["items"];
  startedAt?: string;
}

interface Store {
  /** داده‌ای که کاربر فعلی اجازه دیدنش را دارد (هر مربی فقط شاگردان خودش) */
  data: AppData;
  session: Session | null;
  light: boolean;
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  resetPrefs: () => void;
  accountsCount: number;
  /** true یعنی اپ به سرور دیتابیس مرکزی وصل است */
  serverMode: boolean;
  ready: boolean;
  sync: "idle" | "saving" | "offline";
  stats: PublicStats;
  requestReset: (email: string) => Promise<string | null>;
  confirmReset: (email: string, code: string, password: string) => Promise<string | null>;
  login: (email: string, password: string) => Res;
  register: (input: RegisterInput) => Res;
  requestPhoneCode: (
    purpose: "login" | "register",
    credentials: { email: string; phone: string; password?: string },
  ) => Promise<PhoneCodeResult>;
  verifyPhoneCode: (challengeId: string, code: string, signup?: RegisterInput) => Promise<string | null>;
  logout: () => void;
  toggleLight: () => void;
  studentOf: (userId?: string) => Student | undefined;
  userById: (id: string) => User | undefined;
  myInvite: () => string;
  emailExists: (email: string) => boolean;
  resetPassword: (email: string, next: string) => string | null;
  updateProfile: (patch: Partial<Pick<User, "name" | "email" | "phone" | "avatar">>) => string | null;
  changePassword: (current: string, next: string) => Res;
  updateMyStudent: (patch: Partial<Student>) => void;
  joinCoach: (code: string) => Res;
  upsertStudent: (s: Student) => void;
  createStudent: (p: { name: string; email: string; password: string; phone?: string } & Partial<Student>) => Res;
  removeStudent: (id: string) => void;
  setStudentStatus: (id: string, status: Student["status"]) => void;
  renameUser: (userId: string, name: string) => void;
  saveProgram: (p: WorkoutProgram) => void;
  removeProgram: (id: string) => void;
  addProgramItem: (programId: string, dayId: string, item: ProgramSet) => void;
  updateProgramItem: (programId: string, dayId: string, item: ProgramSet) => void;
  moveItem: (programId: string, dayId: string, idx: number, dir: -1 | 1) => void;
  removeItem: (programId: string, dayId: string, itemId: string) => void;
  saveCoachExercise: (e: CoachExercise) => void;
  removeCoachExercise: (id: string) => void;
  sendMessage: (
    studentId: string,
    from: "coach" | "student",
    text: string,
    extra?: { replyTo?: string; kind?: ChatMsg["kind"]; attachUrl?: string; attachName?: string; fileSize?: number },
  ) => void;
  editMessage: (id: string, text: string) => void;
  deleteMessage: (id: string) => void;
  reactMessage: (id: string, emoji: string) => void;
  markChatRead: (studentId: string) => void;
  markNotif: (id: string) => void;
  markNotifs: (ids: string[]) => void;
  pushNotif: (n: Omit<Notif, "id">) => void;
  addProgress: (e: Omit<ProgressEntry, "id">) => void;
  addWater: (studentId: string, ml: number) => void;
  setWaterGoal: (studentId: string, goal: number) => void;
  addSleep: (studentId: string, hours: number, bed: string, wake: string) => void;
  logWorkout: (p: LogPayload) => void;
  addAppt: (a: Omit<Appointment, "id">) => void;
  setApptStatus: (id: string, status: Appointment["status"]) => void;
  addGoal: (g: Omit<Goal, "id">) => void;
  saveMeal: (m: MealPlan) => void;
  deleteMeal: (id: string) => void;
  saveFood: (f: FoodEntry) => void;
  deleteFood: (id: string) => void;
  toggleNutritionMeal: (planId: string, slotId: string, date: string) => void;
  saveCheckin: (c: WeeklyCheckin) => void;
  reviewCheckin: (id: string, status: WeeklyCheckin["status"], note: string) => void;
  saveWorkoutTemplate: (template: WorkoutTemplate) => void;
  deleteWorkoutTemplate: (id: string) => void;
  addInvoice: (i: Omit<Invoice, "id">) => void;
  setInvoiceStatus: (id: string, status: Invoice["status"]) => void;
  purchasePlan: (p: {
    studentId: string;
    planId: string;
    planTitle: string;
    sessions: number;
    days: number;
    amount: number;
    coupon?: string;
    method: string;
    cardLast4?: string;
    perks?: string[];
    rrn?: string;
    terminal?: string;
    cardBank?: string;
  }) => string;
  saveCoachPlans: (plans: SubPlan[]) => void;
  restoreData: (d: AppData) => void;
}

const Ctx = createContext<Store | null>(null);

function uniqueInvite(users: User[]): string {
  const used = new Set(users.map((u) => u.inviteCode).filter(Boolean));
  let c = inviteCode();
  while (used.has(c)) c = inviteCode();
  return c;
}

function load(remote: boolean): { data: AppData; session: Session | null; light: boolean; prefs: Prefs } {
  const base = emptyData();
  if (remote) {
    // حالت سرور: داده‌ها از سرور می‌آید؛ فقط ظاهر از دستگاه خوانده می‌شود
    let light = false;
    let prefs: Prefs = { ...DEFAULT_PREFS };
    try {
      const p = JSON.parse(localStorage.getItem(KEY_REMOTE_PREFS) || localStorage.getItem(KEY) || "{}") as { light?: boolean; prefs?: Partial<Prefs> };
      light = !!p.light;
      prefs = { ...DEFAULT_PREFS, ...(p.prefs ?? {}) };
    } catch {
      /* ignore */
    }
    return { data: base, session: null, light, prefs };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { data: base, session: null, light: false, prefs: { ...DEFAULT_PREFS } };
    const p = JSON.parse(raw) as { data?: Partial<AppData>; session?: Session | null; light?: boolean; prefs?: Partial<Prefs> };
    const d: AppData = { ...base, ...(p.data ?? {}) } as AppData;
    (Object.keys(base) as (keyof AppData)[]).forEach((k) => {
      if (d[k] == null) (d as unknown as Record<string, unknown>)[k] = base[k];
    });
    // مهاجرت: هر مربی یک کد دعوت دائمی داشته باشد
    const users: User[] = [];
    d.users.forEach((u) => {
      if (u.role === "coach" && !u.inviteCode) users.push({ ...u, inviteCode: uniqueInvite([...d.users, ...users]) });
      else users.push(u);
    });
    d.users = users;
    // مهاجرت: دکمه «تأیید و ارسال» حذف شده؛ برنامه‌های پیش‌نویس قدیمی فعال شوند
    d.programs = d.programs.map((pr) => (pr.status === "پیش‌نویس" ? { ...pr, status: "فعال" } : pr));
    let session = p.session ?? null;
    if (session && !d.users.some((u) => u.id === session!.userId)) session = null;
    return { data: d, session, light: !!p.light, prefs: { ...DEFAULT_PREFS, ...(p.prefs ?? {}) } };
  } catch {
    return { data: base, session: null, light: false, prefs: { ...DEFAULT_PREFS } };
  }
}

function persist(data: AppData, session: Session | null, light: boolean, prefs: Prefs, remote: boolean) {
  try {
    if (remote) {
      // هیچ داده‌ای از سرور روی دستگاه کش نمی‌شود (دستگاه مشترک امن بماند)
      localStorage.setItem(KEY_REMOTE_PREFS, JSON.stringify({ light, prefs }));
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ data, session, light, prefs }));
  } catch {
    /* quota */
  }
}

function pickRecord<T>(r: Record<string, T>, ids: Set<string>): Record<string, T> {
  const out: Record<string, T> = {};
  Object.keys(r).forEach((k) => {
    if (ids.has(k)) out[k] = r[k];
  });
  return out;
}

/** جداسازی کامل داده‌ها بر اساس نقش */
function scope(raw: AppData, session: Session | null): AppData {
  if (!session || session.role === "admin") return raw;
  let ids: Set<string>;
  let uids: Set<string>;
  let coachForExercises = "";
  if (session.role === "coach") {
    const students = raw.students.filter((s) => s.coachId === session.userId);
    ids = new Set(students.map((s) => s.id));
    uids = new Set(students.map((s) => s.userId));
    uids.add(session.userId);
    coachForExercises = session.userId;
  } else {
    const me = raw.students.find((s) => s.userId === session.userId);
    ids = new Set(me ? [me.id] : []);
    uids = new Set([session.userId]);
    if (me?.coachId) uids.add(me.coachId);
    coachForExercises = me?.coachId ?? "__none__";
  }
  const f = <T extends { studentId: string }>(a: T[]) => a.filter((x) => ids.has(x.studentId));
  return {
    ...raw,
    users: raw.users.filter((u) => uids.has(u.id)),
    students: raw.students.filter((s) => ids.has(s.id)),
    programs: f(raw.programs),
    logs: f(raw.logs),
    meals: raw.meals.filter((m) => ids.has(m.studentId) || (session.role === "coach" && m.status === "template" && m.coachId === session.userId)),
    foods: raw.foods.filter((food) => food.coachId === coachForExercises),
    nutritionLogs: f(raw.nutritionLogs),
    checkins: f(raw.checkins),
    workoutTemplates: raw.workoutTemplates.filter((template) => template.coachId === coachForExercises),
    progress: f(raw.progress),
    photos: f(raw.photos),
    goals: f(raw.goals),
    messages: f(raw.messages),
    appts: f(raw.appts),
    invoices: f(raw.invoices),
    notifs: raw.notifs.filter((n) => {
      if (session.role === "coach") {
        return n.to === "coach" && (n.coachId === session.userId || (!!n.studentId && ids.has(n.studentId)));
      }
      return n.to === "student" && !!n.studentId && ids.has(n.studentId);
    }),
    water: pickRecord(raw.water, ids),
    sleep: pickRecord(raw.sleep, ids),
    xp: pickRecord(raw.xp, ids),
    streak: pickRecord(raw.streak, ids),
    coachExercises: raw.coachExercises.filter((c) => c.coachId === coachForExercises),
    coachPlans: raw.coachPlans?.[coachForExercises] ? { [coachForExercises]: raw.coachPlans[coachForExercises] } : {},
  };
}

export function StoreProvider({
  children, remote = false, initialStats,
}: {
  children: ReactNode;
  remote?: boolean;
  initialStats?: PublicStats;
}) {
  const init = useMemo(() => load(remote), [remote]);
  const [raw, setRaw] = useState<AppData>(remote ? emptyData() : init.data);
  const [session, setSession] = useState<Session | null>(remote ? null : init.session);
  const [light, setLight] = useState(init.light);
  const [prefs, setPrefsState] = useState<Prefs>(init.prefs);
  const [ready, setReady] = useState(!remote || !getToken());
  const [sync, setSync] = useState<"idle" | "saving" | "offline">("idle");
  const [serverStats, setServerStats] = useState<PublicStats>(initialStats ?? { users: 0, coaches: 0, students: 0 });

  /* --- وضعیت همگام‌سازی با سرور (فقط در حالت سرور استفاده می‌شود) --- */
  const tokenRef = useRef<string | null>(remote ? getToken() : null);
  const baseRef = useRef<AppData>(emptyData());
  const revRef = useRef(0);
  const seqRef = useRef(0);
  const dirtyRef = useRef(false);
  const pushingRef = useRef(false);
  const againRef = useRef(false);
  const deletesRef = useRef<Deletes>(noDeletes());
  const rawRef = useRef(raw);
  const phoneChallengeRef = useRef<LocalPhoneChallenge | null>(null);
  rawRef.current = raw;

  /** هر تغییر محلی = علامت «نیاز به ارسال به سرور» */
  const setData: typeof setRaw = (a) => {
    dirtyRef.current = true;
    seqRef.current += 1;
    setRaw(a);
  };

  const data = useMemo(() => scope(raw, session), [raw, session]);

  const stats: PublicStats = remote
    ? serverStats
    : {
        users: raw.users.length,
        coaches: raw.users.filter((u) => u.role === "coach").length,
        students: raw.users.filter((u) => u.role === "student").length,
      };

  const clearRemoteState = () => {
    setToken(null);
    tokenRef.current = null;
    baseRef.current = emptyData();
    dirtyRef.current = false;
    deletesRef.current = noDeletes();
    setRaw(emptyData());
    setSession(null);
    setSync("idle");
  };

  const applyAuth = (r: AuthPayload) => {
    setToken(r.token);
    tokenRef.current = r.token;
    const db = normalizeDb(r.db);
    baseRef.current = db;
    dirtyRef.current = false;
    deletesRef.current = noDeletes();
    revRef.current = r.rev;
    setRaw(db);
    setSession({ userId: r.userId, role: r.role });
    setReady(true);
  };

  /** پذیرفتن دیتابیس تازه‌ای که سرور در پاسخ یک درخواست فرستاده */
  const adoptServerDb = (db: AppData, rev: number) => {
    if (!dirtyRef.current && !pushingRef.current) {
      revRef.current = rev;
      const n = normalizeDb(db);
      baseRef.current = n;
      setRaw(n);
    } else {
      revRef.current = -1; // در نوبت بعدی دوباره از سرور خوانده شود
    }
  };

  /** ارسال تغییرات محلی (فقط رکوردهای تغییرکرده) به دیتابیس مرکزی */
  const flush = async (): Promise<void> => {
    if (!remote || !tokenRef.current) return;
    if (pushingRef.current) {
      againRef.current = true;
      return;
    }
    pushingRef.current = true;
    try {
      do {
        againRef.current = false;
        if (!dirtyRef.current) break;
        const seq = seqRef.current;
        const snap = rawRef.current;
        const { delta, empty } = computeDelta(baseRef.current, snap);
        const dels = deletesRef.current;
        const hasDel = dels.students.length + dels.programs.length + dels.coachExercises.length + dels.meals.length + dels.foods.length + dels.nutritionLogs.length + dels.workoutTemplates.length > 0;
        if (empty && !hasDel) {
          if (seqRef.current === seq) dirtyRef.current = false;
          break;
        }
        setSync("saving");
        const r = await api<{ rev: number; db: AppData }>("PUT", "db", { delta, deletes: dels }, { token: tokenRef.current });
        if (r.status === 401) {
          clearRemoteState();
          return;
        }
        if (!r.ok) {
          setSync("offline");
          return;
        }
        revRef.current = r.data.rev;
        deletesRef.current = {
          students: deletesRef.current.students.filter((x) => !dels.students.includes(x)),
          programs: deletesRef.current.programs.filter((x) => !dels.programs.includes(x)),
          coachExercises: deletesRef.current.coachExercises.filter((x) => !dels.coachExercises.includes(x)),
          meals: deletesRef.current.meals.filter((x) => !dels.meals.includes(x)),
          foods: deletesRef.current.foods.filter((x) => !dels.foods.includes(x)),
          nutritionLogs: deletesRef.current.nutritionLogs.filter((x) => !dels.nutritionLogs.includes(x)),
          workoutTemplates: deletesRef.current.workoutTemplates.filter((x) => !dels.workoutTemplates.includes(x)),
        };
        if (seqRef.current === seq) {
          const db = normalizeDb(r.data.db);
          baseRef.current = db;
          dirtyRef.current = false;
          setRaw(db);
        } else {
          baseRef.current = snap;
          againRef.current = true;
        }
        setSync("idle");
      } while (againRef.current);
    } finally {
      pushingRef.current = false;
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // بازیابی نشست بعد از باز کردن دوبارهٔ اپ
  useEffect(() => {
    if (!remote) return;
    const t = getToken();
    if (!t) {
      setReady(true);
      return;
    }
    tokenRef.current = t;
    let cancelled = false;
    const boot = async () => {
      const r = await api<AuthPayload>("GET", "me", undefined, { token: t });
      if (cancelled) return;
      if (r.ok) {
        applyAuth({ ...r.data, token: t });
        return;
      }
      if (r.status === 401) {
        setToken(null);
        tokenRef.current = null;
        setReady(true);
        return;
      }
      window.setTimeout(() => void boot(), 3000); // سرور در دسترس نیست؛ دوباره تلاش
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote]);

  // با هر تغییر محلی، کمی بعد به سرور ارسال می‌شود
  useEffect(() => {
    if (!remote || !session || !dirtyRef.current) return;
    const t = window.setTimeout(() => void flushRef.current(), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  // هر ۳ ثانیه بررسی می‌شود کسی (مثلاً مربی یا شاگرد) چیزی تغییر داده یا نه
  useEffect(() => {
    if (!remote || !session) return;
    const tick = async () => {
      if (pushingRef.current) return;
      if (dirtyRef.current) {
        void flushRef.current();
        return;
      }
      const r = await api<{ rev: number }>("GET", "rev", undefined, { token: tokenRef.current });
      if (r.status === 401) {
        clearRemoteState();
        return;
      }
      if (!r.ok) {
        setSync("offline");
        return;
      }
      setSync("idle");
      if (r.data.rev !== revRef.current) {
        const seq = seqRef.current;
        const d = await api<{ rev: number; db: AppData }>("GET", "db", undefined, { token: tokenRef.current });
        if (d.ok && seqRef.current === seq && !dirtyRef.current && !pushingRef.current) {
          revRef.current = d.data.rev;
          const db = normalizeDb(d.data.db);
          baseRef.current = db;
          setRaw(db);
        }
      }
    };
    const id = window.setInterval(() => void tick(), 3000);
    const vis = () => {
      if (document.visibilityState === "visible") void tick();
      else void flushRef.current();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, session?.userId]);

  // هشدار هنگام بستن صفحه اگر هنوز چیزی به سرور نرسیده
  useEffect(() => {
    if (!remote) return;
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [remote]);

  // آمار زندهٔ صفحه ورود (تعداد حساب‌ها)
  useEffect(() => {
    if (!remote || session) return;
    const id = window.setInterval(async () => {
      const r = await detectServer();
      if (r.ok && r.stats) setServerStats(r.stats);
    }, 20000);
    return () => window.clearInterval(id);
  }, [remote, session]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  // اعمال تنظیمات ظاهری روی ریشه سند
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", prefs.accent);
    r.classList.toggle("custom-accent", prefs.accent.toLowerCase() !== "#e9e400");
    r.classList.toggle("reduce-motion", prefs.reduceMotion);
    const root = document.getElementById("root");
    root?.style.removeProperty("zoom");
  }, [prefs]);

  useEffect(() => {
    persist(raw, session, light, prefs, remote);
  }, [raw, session, light, prefs, remote]);

  useEffect(() => {
    const save = () => persist(raw, session, light, prefs, remote);
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [raw, session, light, prefs, remote]);

  const userById = (id: string) => raw.users.find((u) => u.id === id);

  const studentOf = (userId?: string) => {
    const id = userId ?? session?.userId;
    return data.students.find((s) => s.userId === id || s.id === id);
  };

  const myInvite = () => {
    const u = session ? userById(session.userId) : undefined;
    return u?.inviteCode ?? "";
  };

  const emailExists = (email: string) =>
    raw.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  const requestPhoneCode: Store["requestPhoneCode"] = async (purpose, credentials) => {
    const email = credentials.email.trim().toLowerCase();
    const phone = normalizePhone(credentials.phone);
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "ایمیل معتبر وارد کن" };
    if (!isValidPhone(phone)) return { error: "شماره موبایل معتبر (۱۱ رقم با ۰۹) وارد کن" };
    if (remote) {
      const response = await api<PhoneCodeResult>("POST", "auth/phone/request", {
        purpose, email, phone, password: purpose === "login" ? credentials.password : undefined,
      });
      return response.ok ? response.data : { error: response.data.error || "ارسال کد ناموفق بود" };
    }

    const user = raw.users.find((u) => u.email.toLowerCase() === email);
    if (purpose === "login") {
      if (!user || user.password !== credentials.password) return { error: "ایمیل یا رمز عبور اشتباه است" };
      if (user.phone && normalizePhone(user.phone) !== phone) return { error: "موبایل با شماره ثبت‌شده این حساب یکسان نیست" };
    } else if (user) {
      return { error: "این ایمیل قبلاً ثبت شده" };
    }
    if (raw.users.some((u) => u.id !== user?.id && isValidPhone(u.phone) && normalizePhone(u.phone) === phone)) {
      return { error: "این شماره موبایل قبلاً ثبت شده" };
    }
    const existing = phoneChallengeRef.current;
    if (existing && existing.purpose === purpose && existing.email === email && Date.now() - existing.sentAt < 60000) {
      return { error: "برای ارسال کد جدید کمی صبر کن" };
    }
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(100000 + (random[0] % 900000));
    const id = uid("otp");
    phoneChallengeRef.current = {
      id, purpose, email, phone, code, sentAt: Date.now(), expiresAt: Date.now() + 180000,
      attempts: 0, userId: user?.id,
    };
    return { challengeId: id, expiresIn: 180, retryAfter: 60, demoCode: code };
  };

  const verifyPhoneCode: Store["verifyPhoneCode"] = async (challengeId, code, signup) => {
    const otp = code.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
    if (!/^\d{6}$/.test(otp)) return "کد شش‌رقمی را کامل وارد کن";
    if (remote) {
      const response = signup
        ? await api<AuthPayload>("POST", "auth/register", {
            challengeId, code: otp, input: { ...signup, phone: normalizePhone(signup.phone ?? "") },
          })
        : await api<AuthPayload>("POST", "auth/phone/verify", { challengeId, code: otp });
      if (!response.ok) return response.data.error || "تأیید کد ناموفق بود";
      applyAuth(response.data);
      return null;
    }
    const challenge = phoneChallengeRef.current;
    if (!challenge || challenge.id !== challengeId) return "کد معتبر نیست؛ دوباره درخواست بده";
    if (Date.now() >= challenge.expiresAt) return "زمان کد تمام شده؛ دوباره درخواست بده";
    if (challenge.attempts >= 5) return "تعداد تلاش‌ها زیاد شد؛ کد جدید بگیر";
    if (challenge.code !== otp) {
      challenge.attempts += 1;
      return "کد واردشده درست نیست";
    }
    if (challenge.purpose === "register") {
      if (!signup || signup.email.trim().toLowerCase() !== challenge.email || normalizePhone(signup.phone ?? "") !== challenge.phone) {
        return "اطلاعات با درخواست کد یکسان نیست";
      }
      const error = await Promise.resolve(register({ ...signup, phone: challenge.phone }));
      if (!error) phoneChallengeRef.current = null;
      return error;
    }
    const user = raw.users.find((u) => u.id === challenge.userId && u.email.toLowerCase() === challenge.email);
    if (!user || (user.phone && normalizePhone(user.phone) !== challenge.phone)) return "حساب معتبر نیست؛ دوباره وارد شو";
    setData((d) => ({
      ...d,
      users: d.users.map((u) => u.id === user.id ? { ...u, phone: challenge.phone, lastLoginAt: nowIso() } : u),
    }));
    setSession({ userId: user.id, role: user.role });
    phoneChallengeRef.current = null;
    return null;
  };

  const login = (email: string, password: string): Res => {
    if (remote) {
      return "برای ورود ابتدا کد تأیید موبایل را دریافت کن";
    }
    const u = raw.users.find(
      (x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password
    );
    if (!u) return "ایمیل یا رمز عبور اشتباه است";
    const at = nowIso();
    setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, lastLoginAt: at } : x)) }));
    setSession({ userId: u.id, role: u.role });
    return null;
  };

  const register = (input: RegisterInput): Res => {
    const email = input.email.trim().toLowerCase();
    if (!input.name.trim()) return "نام را وارد کن";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "ایمیل معتبر نیست";
    if (!isValidPhone(input.phone ?? "")) return "شماره موبایل معتبر (۰۹...) لازم است";
    if (input.password.length < 4) return "رمز حداقل ۴ کاراکتر باشد";
    if (remote) {
      return "برای ثبت‌نام ابتدا شماره موبایل را تأیید کن";
    }
    if (emailExists(email)) return "این ایمیل قبلاً ثبت شده";

    const at = nowIso();
    const id = uid(input.role);
    let coachId = "";
    if (input.role === "student" && input.invite?.trim()) {
      const code = input.invite.trim().toUpperCase();
      const coach = raw.users.find((u) => u.role === "coach" && u.inviteCode === code);
      if (!coach) return "کد دعوت مربی نامعتبر است";
      coachId = coach.id;
    }

    const user: User = {
      id,
      role: input.role,
      name: input.name.trim(),
      email,
      phone: normalizePhone(input.phone ?? ""),
      avatar: DEFAULT_AVATAR,
      password: input.password,
      createdAt: at,
      lastLoginAt: at,
      inviteCode: input.role === "coach" ? uniqueInvite(raw.users) : undefined,
    };

    setData((d) => {
      const next: AppData = { ...d, users: [...d.users, user] };
      if (input.role === "student") {
        const st: Student = {
          id: uid("st"),
          userId: id,
          coachId,
          age: input.age ?? 25,
          gender: input.gender ?? "مرد",
          height: input.height ?? 170,
          weight: input.weight ?? 70,
          goal: input.goal ?? "فیتنس",
          level: "مبتدی",
          experience: "",
          startDate: at,
          subEndsAt: addMonths(new Date(), 1).toISOString(),
          subscription: "فعال",
          daysLeft: 30,
          daysSinceWorkout: 0,
          notes: "",
          status: "active",
          category: "عمومی",
          assessment: { ...DEFAULT_ASSESSMENT, mainGoal: input.goal ?? "فیتنس" },
        };
        next.students = [...d.students, st];
        if (coachId) {
          next.notifs = [
            {
              id: uid("n"),
              to: "coach",
              coachId,
              studentId: st.id,
              title: "شاگرد جدید",
              body: `${user.name} با کد دعوت به شما وصل شد.`,
              time: at,
              read: false,
              type: "success",
            },
            ...d.notifs,
          ];
        }
      }
      return next;
    });
    setSession({ userId: id, role: input.role });
    return null;
  };

  const createStudent = (p: { name: string; email: string; password: string; phone?: string } & Partial<Student>): Res => {
    const email = p.email.trim().toLowerCase();
    if (!p.name.trim()) return "نام لازم است";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "ایمیل شاگرد معتبر نیست";
    if (remote) {
      return (async () => {
        const r = await api<{ rev: number; db: AppData }>(
          "POST", "students", { ...p, email, password: p.password || "1234" }, { token: tokenRef.current }
        );
        if (!r.ok) return r.data.error || "ساخت شاگرد ناموفق بود";
        adoptServerDb(r.data.db, r.data.rev);
        return null;
      })();
    }
    if (emailExists(email)) return "این ایمیل قبلاً ثبت شده";
    const at = nowIso();
    const userId = uid("student");
    const stId = p.id && !raw.students.some((s) => s.id === p.id) ? p.id : uid("st");
    const user: User = {
      id: userId,
      role: "student",
      name: p.name.trim(),
      email,
      phone: p.phone ?? "",
      avatar: DEFAULT_AVATAR,
      password: p.password || "1234",
      createdAt: at,
      lastLoginAt: at,
    };
    const st: Student = {
      id: stId,
      userId,
      coachId: session?.userId ?? "",
      age: p.age ?? 25,
      gender: p.gender ?? "مرد",
      height: p.height ?? 170,
      weight: p.weight ?? 70,
      goal: p.goal ?? "فیتنس",
      level: p.level ?? "مبتدی",
      experience: p.experience ?? "",
      startDate: at,
      subEndsAt: p.subEndsAt ?? addMonths(new Date(), 1).toISOString(),
      subscription: "فعال",
      daysLeft: 30,
      daysSinceWorkout: 0,
      notes: p.notes ?? "",
      status: "active",
      category: p.category ?? "عمومی",
      assessment: p.assessment ?? { ...DEFAULT_ASSESSMENT },
    };
    setData((d) => ({ ...d, users: [...d.users, user], students: [...d.students, st] }));
    return null;
  };

  const updateProfile: Store["updateProfile"] = (patch) => {
    if (!session) return "وارد نشده‌ای";
    if (patch.name !== undefined && !patch.name.trim()) return "نام نمی‌تواند خالی باشد";
    if (patch.email !== undefined) {
      const e = patch.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e)) return "ایمیل معتبر نیست";
      if (raw.users.some((u) => u.id !== session.userId && u.email.toLowerCase() === e)) return "این ایمیل برای حساب دیگری است";
      patch = { ...patch, email: e };
    }
    setData((d) => ({ ...d, users: d.users.map((u) => (u.id === session.userId ? { ...u, ...patch } : u)) }));
    return null;
  };

  const changePassword: Store["changePassword"] = (current, next) => {
    if (remote) {
      return (async () => {
        if (next.length < 4) return "رمز جدید حداقل ۴ کاراکتر باشد";
        const r = await api("POST", "auth/change-password", { current, next }, { token: tokenRef.current });
        return r.ok ? null : r.data.error || "تغییر رمز ناموفق بود";
      })();
    }
    const me = session ? userById(session.userId) : undefined;
    if (!me) return "وارد نشده‌ای";
    if (me.password !== current) return "رمز فعلی درست نیست";
    if (next.length < 4) return "رمز جدید حداقل ۴ کاراکتر باشد";
    setData((d) => ({ ...d, users: d.users.map((u) => (u.id === me.id ? { ...u, password: next } : u)) }));
    return null;
  };

  const resetPassword: Store["resetPassword"] = (email, next) => {
    const e = email.trim().toLowerCase();
    if (!emailExists(e)) return "حسابی با این ایمیل پیدا نشد";
    if (next.length < 4) return "رمز جدید حداقل ۴ کاراکتر باشد";
    setData((d) => ({ ...d, users: d.users.map((u) => (u.email.toLowerCase() === e ? { ...u, password: next } : u)) }));
    return null;
  };

  const joinCoach: Store["joinCoach"] = (code) => {
    if (remote) {
      return (async () => {
        const r = await api<{ rev: number; db: AppData }>("POST", "join", { code }, { token: tokenRef.current });
        if (!r.ok) return r.data.error || "اتصال به مربی ناموفق بود";
        adoptServerDb(r.data.db, r.data.rev);
        return null;
      })();
    }
    const me = studentOf();
    if (!me) return "پروفایل شاگرد پیدا نشد";
    const coach = raw.users.find((u) => u.role === "coach" && u.inviteCode === code.trim().toUpperCase());
    if (!coach) return "کد مربی نامعتبر است";
    const at = nowIso();
    const who = userById(me.userId)?.name ?? "شاگرد";
    setData((d) => ({
      ...d,
      students: d.students.map((s) => (s.id === me.id ? { ...s, coachId: coach.id } : s)),
      notifs: [
        { id: uid("n"), to: "coach", coachId: coach.id, studentId: me.id, title: "شاگرد جدید", body: `${who} با کد دعوت به شما وصل شد.`, time: at, read: false, type: "success" },
        ...d.notifs,
      ],
    }));
    return null;
  };

  const store: Store = {
    data,
    session,
    light,
    prefs,
    setPrefs: (patch) => setPrefsState((p) => ({ ...p, ...patch })),
    resetPrefs: () => setPrefsState({ ...DEFAULT_PREFS }),
    accountsCount: stats.users,
    serverMode: remote,
    ready,
    sync,
    stats,
    requestReset: async (email) => {
      const r = await api("POST", "auth/forgot", { email });
      return r.ok ? null : r.data.error || "درخواست ناموفق بود";
    },
    confirmReset: async (email, code, password) => {
      const r = await api("POST", "auth/reset", { email, code, password });
      return r.ok ? null : r.data.error || "بازیابی رمز ناموفق بود";
    },
    login,
    register,
    requestPhoneCode,
    verifyPhoneCode,
    logout: () => {
      if (!remote) {
        setSession(null);
        return;
      }
      // ابتدا تغییرات ارسال‌نشده به سرور می‌رسد، بعد نشست بسته می‌شود
      void (async () => {
        if (dirtyRef.current) {
          try {
            await flushRef.current();
          } catch {
            /* ignore */
          }
        }
        const t = tokenRef.current;
        if (t) void api("POST", "auth/logout", {}, { token: t });
        clearRemoteState();
      })();
    },
    toggleLight: () => setLight((v) => !v),
    studentOf,
    userById,
    myInvite,
    emailExists,
    resetPassword,
    updateProfile,
    changePassword,
    joinCoach,
    updateMyStudent: (patch) => {
      const me = studentOf();
      if (!me) return;
      setData((d) => ({ ...d, students: d.students.map((s) => (s.id === me.id ? { ...s, ...patch, id: s.id, userId: s.userId, coachId: s.coachId } : s)) }));
    },
    upsertStudent: (s) =>
      setData((d) => ({
        ...d,
        students: d.students.some((x) => x.id === s.id) ? d.students.map((x) => (x.id === s.id ? s : x)) : [...d.students, s],
      })),
    createStudent,
    removeStudent: (id) => {
      if (remote) deletesRef.current.students.push(id);
      setData((d) => ({
        ...d,
        students: d.students.filter((s) => s.id !== id),
        programs: d.programs.filter((p) => p.studentId !== id),
      }));
    },
    setStudentStatus: (id, status) =>
      setData((d) => ({ ...d, students: d.students.map((s) => (s.id === id ? { ...s, status } : s)) })),
    renameUser: (userId, name) =>
      setData((d) => ({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, name } : u)) })),
    saveProgram: (p) =>
      setData((d) => ({
        ...d,
        programs: d.programs.some((x) => x.id === p.id) ? d.programs.map((x) => {
          if (x.id !== p.id) return x;
          return reviseProgram(x, p);
        }) : [...d.programs, {...p,version:1,revisions:[]}],
      })),
    removeProgram: (id) => {
      if (remote) deletesRef.current.programs.push(id);
      setData((d) => ({ ...d, programs: d.programs.filter((p) => p.id !== id) }));
    },
    addProgramItem: (programId, dayId, item) =>
      setData((d) => ({
        ...d,
        programs: d.programs.map((p) =>
          p.id !== programId ? p : reviseProgram(p, { ...p, days: p.days.map((day) => (day.id !== dayId ? day : { ...day, items: [...day.items, item] })) })
        ),
      })),
    updateProgramItem: (programId, dayId, item) =>
      setData((d) => ({
        ...d,
        programs: d.programs.map((p) =>
          p.id !== programId
            ? p
            : reviseProgram(p, { ...p, days: p.days.map((day) => (day.id !== dayId ? day : { ...day, items: day.items.map((x) => (x.id === item.id ? item : x)) })) })
        ),
      })),
    moveItem: (programId, dayId, idx, dir) =>
      setData((d) => ({
        ...d,
        programs: d.programs.map((p) => {
          if (p.id !== programId) return p;
          return reviseProgram(p, {
            ...p,
            days: p.days.map((day) => {
              if (day.id !== dayId) return day;
              const arr = [...day.items];
              const j = idx + dir;
              if (j < 0 || j >= arr.length) return day;
              [arr[idx], arr[j]] = [arr[j], arr[idx]];
              return { ...day, items: arr };
            }),
          });
        }),
      })),
    removeItem: (programId, dayId, itemId) =>
      setData((d) => ({
        ...d,
        programs: d.programs.map((p) =>
          p.id !== programId ? p : reviseProgram(p, { ...p, days: p.days.map((day) => (day.id !== dayId ? day : { ...day, items: day.items.filter((i) => i.id !== itemId) })) })
        ),
      })),
    saveCoachExercise: (e) =>
      setData((d) => {
        const withOwner = { ...e, coachId: e.coachId || session?.userId || "" };
        return {
          ...d,
          coachExercises: d.coachExercises.some((x) => x.id === e.id)
            ? d.coachExercises.map((x) => (x.id === e.id ? withOwner : x))
            : [...d.coachExercises, withOwner],
        };
      }),
    removeCoachExercise: (id) => {
      if (remote) deletesRef.current.coachExercises.push(id);
      setData((d) => ({ ...d, coachExercises: d.coachExercises.filter((x) => x.id !== id) }));
    },
    sendMessage: (studentId, from, text, extra) => {
      const at = nowIso();
      setData((d) => {
        const st = d.students.find((s) => s.id === studentId);
        const msg: ChatMsg = {
          id: uid("m"),
          studentId,
          from,
          text,
          time: at,
          kind: extra?.kind ?? "text",
          unread: true,
          replyTo: extra?.replyTo,
          attachUrl: extra?.attachUrl,
          attachName: extra?.attachName,
          fileSize: extra?.fileSize,
        };
        const preview = extra?.kind === "image" ? "🖼️ تصویر" : extra?.kind === "voice" ? "🎤 پیام صوتی" : extra?.kind === "file" ? "📎 فایل" : text.slice(0, 80);
        return {
          ...d,
          messages: [...d.messages, msg],
          notifs:
            from === "student"
              ? [{ id: uid("n"), to: "coach", coachId: st?.coachId, studentId, title: "پیام جدید شاگرد", body: preview, time: at, read: false, type: "info" as const }, ...d.notifs]
              : [{ id: uid("n"), to: "student", studentId, title: "پیام جدید مربی", body: preview, time: at, read: false, type: "info" as const }, ...d.notifs],
        };
      });
    },
    editMessage: (id, text) =>
      setData((d) => ({
        ...d,
        messages: d.messages.map((m) => (m.id === id ? { ...m, text, editedAt: nowIso() } : m)),
      })),
    deleteMessage: (id) =>
      setData((d) => ({
        ...d,
        messages: d.messages.map((m) =>
          m.id === id ? { ...m, deleted: true, text: "", attachUrl: undefined, attachName: undefined, reaction: undefined } : m
        ),
      })),
    reactMessage: (id, emoji) =>
      setData((d) => ({
        ...d,
        messages: d.messages.map((m) => (m.id === id ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m)),
      })),
    markChatRead: (studentId) =>
      setData((d) => ({
        ...d,
        messages: d.messages.map((m) =>
          m.studentId === studentId && m.from !== (session?.role === "student" ? "student" : "coach") ? { ...m, unread: false } : m
        ),
      })),
    markNotif: (id) => setData((d) => ({ ...d, notifs: d.notifs.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    markNotifs: (ids) => {
      const visible = new Set(data.notifs.map((n) => n.id));
      const requested = new Set(ids.filter((id) => visible.has(id)));
      if (!requested.size) return;
      setData((d) => ({ ...d, notifs: d.notifs.map((n) => requested.has(n.id) && !n.read ? { ...n, read: true } : n) }));
    },
    pushNotif: (n) => setData((d) => ({ ...d, notifs: [{ ...n, id: uid("n"), time: n.time || nowIso() }, ...d.notifs] })),
    addProgress: (e) =>
      setData((d) => ({ ...d, progress: [...d.progress, { ...e, id: uid("p"), date: e.date && e.date.includes("T") ? e.date : nowIso() }] })),
    addWater: (studentId, ml) =>
      setData((d) => {
        const today = dayKey();
        const cur = d.water[studentId];
        const goal = cur?.goal || 2500;
        const base = cur && cur.date === today ? cur.ml : 0;
        return { ...d, water: { ...d.water, [studentId]: { date: today, goal, ml: Math.max(0, base + ml) } } };
      }),
    setWaterGoal: (studentId, goal) =>
      setData((d) => {
        const today = dayKey();
        const cur = d.water[studentId];
        const ml = cur && cur.date === today ? cur.ml : 0;
        return { ...d, water: { ...d.water, [studentId]: { date: today, ml, goal } } };
      }),
    addSleep: (studentId, hours, bed, wake) =>
      setData((d) => {
        const today = dayKey();
        const list = (d.sleep[studentId] ?? []).filter((x) => x.date !== today);
        return { ...d, sleep: { ...d.sleep, [studentId]: [...list, { date: today, hours, bed, wake }] } };
      }),
    logWorkout: (p) => {
      const at = nowIso();
      setData((d) => {
        const nextLogs = [
          ...d.logs,
          { id: uid("log"), studentId: p.studentId, programId: p.programId, dayId: p.dayId, date: dayKey(), at, startedAt: p.startedAt, durationMin: Math.max(1, p.durationMin), items: p.items },
        ];
        const streak = workoutStreak({ ...d, logs: nextLogs }, p.studentId);
        const st = d.students.find((s) => s.id === p.studentId);
        const name = d.users.find((u) => u.id === st?.userId)?.name ?? "شاگرد";
        return {
          ...d,
          logs: nextLogs,
          streak: { ...d.streak, [p.studentId]: streak },
          xp: { ...d.xp, [p.studentId]: (d.xp[p.studentId] ?? 0) + 80 },
          students: d.students.map((s) => (s.id === p.studentId ? { ...s, daysSinceWorkout: 0 } : s)),
          notifs: [
            { id: uid("n"), to: "coach", coachId: st?.coachId, studentId: p.studentId, title: "تمرین ثبت شد", body: `${name} یک جلسه ${p.durationMin} دقیقه‌ای ثبت کرد.`, time: at, read: false, type: "success" as const },
            ...d.notifs,
          ],
        };
      });
    },
    addAppt: (a) => setData((d) => ({ ...d, appts: [...d.appts, { ...a, id: uid("a") }] })),
    setApptStatus: (id, status) => setData((d) => ({ ...d, appts: d.appts.map((a) => (a.id === id ? { ...a, status } : a)) })),
    addGoal: (g) => setData((d) => ({ ...d, goals: [...d.goals, { ...g, id: uid("g") }] })),
    saveMeal: (m) =>
      setData((d) => ({ ...d, meals: d.meals.some((x) => x.id === m.id) ? d.meals.map((x) => (x.id === m.id ? m : x)) : [...d.meals, m] })),
    deleteMeal: (id) => {
      if (!data.meals.some((m) => m.id === id)) return;
      if (remote) deletesRef.current.meals.push(id);
      setData((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) }));
    },
    saveFood: (food) => {
      if (!session || session.role === "student") return;
      const record = { ...food, coachId: session.userId };
      setData((d) => ({
        ...d,
        foods: d.foods.some((f) => f.id === record.id)
          ? d.foods.map((f) => f.id === record.id ? record : f)
          : [...d.foods, record],
      }));
    },
    deleteFood: (id) => {
      if (!data.foods.some((f) => f.id === id)) return;
      if (remote) deletesRef.current.foods.push(id);
      setData((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }));
    },
    toggleNutritionMeal: (planId, slotId, date) => {
      const me = studentOf();
      if (!me || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const plan = data.meals.find((m) => m.id === planId && m.studentId === me.id && m.status !== "draft");
      if (!plan || !plan.meals.some((slot, index) => (slot.id || `${index}`) === slotId)) return;
      const logged = data.nutritionLogs.find((log) =>
        log.studentId === me.id && log.planId === planId && log.date === date && log.slotId === slotId
      );
      if (logged && remote) deletesRef.current.nutritionLogs.push(logged.id);
      setData((d) => {
        const existing = d.nutritionLogs.find((log) =>
          log.studentId === me.id && log.planId === planId && log.date === date && log.slotId === slotId
        );
        return {
          ...d,
          nutritionLogs: existing
            ? d.nutritionLogs.filter((log) => log.id !== existing.id)
            : [...d.nutritionLogs, { id: uid("nl"), studentId: me.id, planId, slotId, date, completedAt: nowIso() } satisfies NutritionLog],
        };
      });
    },
    saveCheckin: (checkin) => {
      const me = studentOf();
      if (!me || checkin.studentId !== me.id) return;
      const record: WeeklyCheckin = {
        ...checkin,
        studentId: me.id,
        status: "pending",
        coachNote: undefined,
        reviewedAt: undefined,
        submittedAt: nowIso(),
      };
      setData((d) => ({
        ...d,
        checkins: d.checkins.some((c) => c.id === record.id)
          ? d.checkins.map((c) => c.id === record.id ? record : c)
          : [...d.checkins, record],
        notifs: me.coachId ? [{ id: uid("n"), to: "coach", studentId: me.id, coachId: me.coachId,
          title: "چک‌این هفتگی جدید", body: "شاگرد چک‌این هفتگی ثبت کرد؛ منتظر بررسی شماست.", time: nowIso(), read: false,
          type: "info" as const }, ...d.notifs] : d.notifs,
      }));
    },
    reviewCheckin: (id, status, note) => {
      if (!session || session.role === "student" || !data.checkins.some((c) => c.id === id)) return;
      setData((d) => ({
        ...d,
        checkins: d.checkins.map((c) => c.id === id ? { ...c, status, coachNote: note.trim().slice(0, 2000), reviewedAt: nowIso() } : c),
      }));
    },
    saveWorkoutTemplate: (template) => {
      if (!session || session.role === "student") return;
      const record = { ...template, coachId: session.userId };
      setData((d) => ({ ...d, workoutTemplates: d.workoutTemplates.some((t) => t.id === record.id)
        ? d.workoutTemplates.map((t) => t.id === record.id ? record : t) : [...d.workoutTemplates, record] }));
    },
    deleteWorkoutTemplate: (id) => {
      if (!data.workoutTemplates.some((t) => t.id === id)) return;
      if (remote) deletesRef.current.workoutTemplates.push(id);
      setData((d) => ({ ...d, workoutTemplates: d.workoutTemplates.filter((t) => t.id !== id) }));
    },
    addInvoice: (i) => setData((d) => ({ ...d, invoices: [...d.invoices, { ...i, id: uid("inv"), date: i.date || nowIso() }] })),
    setInvoiceStatus: (id, status) => setData((d) => ({ ...d, invoices: d.invoices.map((i) => (i.id === id ? { ...i, status } : i)) })),
    purchasePlan: (p) => {
      const at = nowIso();
      const refId = `RS${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
      setData((d) => {
        const st = d.students.find((s) => s.id === p.studentId);
        const name = d.users.find((u) => u.id === st?.userId)?.name ?? "شاگرد";
        const base = st && new Date(st.subEndsAt).getTime() > Date.now() ? new Date(st.subEndsAt) : new Date();
        const nextEnd = addDays(base, p.days).toISOString();
        return {
          ...d,
          students: d.students.map((s) =>
            s.id !== p.studentId
              ? s
              : {
                  ...s,
                  subEndsAt: nextEnd,
                  subscription: "فعال",
                  status: "active",
                  planId: p.planId,
                  planTitle: p.planTitle,
                  sessionsTotal: (s.planId === p.planId && s.planStartedAt ? s.sessionsTotal ?? 0 : 0) + p.sessions,
                  planStartedAt: s.planStartedAt && s.planId === p.planId ? s.planStartedAt : at,
                  planPerks: p.perks ?? s.planPerks,
                  planDays: p.days,
                },
          ),
          invoices: [
            ...d.invoices,
            {
              id: uid("inv"),
              studentId: p.studentId,
              plan: `${p.planTitle} — کوچینگ`,
              amount: p.amount,
              date: at,
              status: "پرداخت‌شده" as const,
              coupon: p.coupon,
              planId: p.planId,
              sessions: p.sessions,
              method: p.method,
              refId,
              cardLast4: p.cardLast4,
              rrn: p.rrn,
              terminal: p.terminal,
              cardBank: p.cardBank,
            },
          ],
          notifs: [
            {
              id: uid("n"),
              to: "coach" as const,
              coachId: st?.coachId,
              studentId: p.studentId,
              title: "خرید اشتراک جدید",
              body: `${name} پلن ${p.planTitle} را خرید. مبلغ ${p.amount.toLocaleString("en-US")} تومان • کد پیگیری ${refId}`,
              time: at,
              read: false,
              type: "success" as const,
            },
            ...d.notifs,
          ],
        };
      });
      return refId;
    },
    saveCoachPlans: (plans) => {
      if (!session || session.role === "student") return;
      const owner = session.userId;
      setData((d) => ({ ...d, coachPlans: { ...(d.coachPlans ?? {}), [owner]: plans } }));
    },
    restoreData: (incoming) => {
      const base = emptyData();
      const d: AppData = { ...base, ...incoming } as AppData;
      (Object.keys(base) as (keyof AppData)[]).forEach((k) => {
        if (d[k] == null) (d as unknown as Record<string, unknown>)[k] = base[k];
      });
      setData(d);
      if (session && !d.users.some((u) => u.id === session.userId)) setSession(null);
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("store");
  return s;
}

export function defaultStudent(partial?: Partial<Student>): Student {
  const at = nowIso();
  return {
    id: uid("st"),
    userId: uid("u"),
    coachId: "",
    age: 25,
    gender: "مرد",
    height: 170,
    weight: 70,
    goal: "فیتنس",
    level: "مبتدی",
    experience: "",
    startDate: at,
    subEndsAt: addDays(new Date(), 30).toISOString(),
    subscription: "فعال",
    daysLeft: 30,
    daysSinceWorkout: 0,
    notes: "",
    status: "active",
    category: "عمومی",
    assessment: { ...DEFAULT_ASSESSMENT },
    ...partial,
  };
}
