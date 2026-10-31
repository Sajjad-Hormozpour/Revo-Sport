const KEY = "revofit-coach-v3";

export type AppRole = "coach" | "student" | "admin";

type VaultUser = {
  id: string;
  role: AppRole;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  password: string;
  createdAt: string;
  lastLoginAt: string;
  inviteCode?: string;
  trainerProfile?: TrainerProfile;
};

export type TrainerProfile = {
  age: number;
  specialization: string;
  specialties?: string[];
  certificationBody?: string;
  certificationLevel?: string;
  certification: string;
  experienceYears: number;
  coachingFormat: "online" | "in-person" | "hybrid";
  bio: string;
};

type Vault = {
  data: Record<string, unknown> & { users: VaultUser[]; students: Record<string, unknown>[] };
  session: { userId: string; role: AppRole } | null;
  light?: boolean;
  prefs?: Record<string, unknown>;
};

const EMPTY = {
  users: [],
  students: [],
  programs: [],
  logs: [],
  meals: [],
  progress: [],
  photos: [],
  goals: [],
  messages: [],
  notifs: [],
  appts: [],
  invoices: [],
  water: {},
  sleep: {},
  xp: {},
  streak: {},
  coachExercises: [],
  coachPlans: {},
  foods: [],
  nutritionLogs: [],
  checkins: [],
  workoutTemplates: [],
};

export function normalizePhone(value: string): string {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d+]/g, "");
  if (digits.startsWith("+98")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidPhone(value: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(value));
}

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

function inviteCode(used: Set<string>): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (used.has(code));
  return code;
}

function readVault(): Vault {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { data: { ...EMPTY, users: [], students: [] }, session: null };
    const parsed = JSON.parse(raw) as Partial<Vault>;
    const data = { ...EMPTY, ...(parsed.data ?? {}) } as Vault["data"];
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.students)) data.students = [];
    return { data, session: parsed.session ?? null, light: parsed.light, prefs: parsed.prefs };
  } catch {
    return { data: { ...EMPTY, users: [], students: [] }, session: null };
  }
}

function writeVault(vault: Vault) {
  localStorage.setItem(KEY, JSON.stringify(vault));
}

let sessionCacheRaw: string | null | undefined;
let sessionCacheValue = false;

export function hasSession(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === sessionCacheRaw) return sessionCacheValue;
    const session = raw ? (JSON.parse(raw) as Partial<Vault>).session : null;
    sessionCacheRaw = raw;
    sessionCacheValue = Boolean(session?.userId && session.role);
    return sessionCacheValue;
  } catch {
    sessionCacheRaw = undefined;
    sessionCacheValue = false;
    return false;
  }
}

export function logoutLocal() {
  const vault = readVault();
  vault.session = null;
  writeVault(vault);
  clearSignupDraft();
  window.location.hash = "/login";
}

export type AuthStats = { members: number; coaches: number; athletes: number };

export function getStats(): AuthStats {
  const vault = readVault();
  const users = Array.isArray(vault.data.users) ? vault.data.users : [];
  const coaches = users.filter((item) => item.role === "coach" || item.role === "admin").length;
  const athletes = users.filter((item) => item.role === "student").length;
  return {
    members: users.length,
    coaches,
    athletes,
  };
}

export type IdentityError = { field: "email" | "phone"; message: string };

export function checkSignupIdentity(email: string, phone: string): IdentityError | null {
  const vault = readVault();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);
  if (vault.data.users.some((item) => item.email.toLowerCase() === normalizedEmail)) {
    return { field: "email", message: "این ایمیل قبلاً ثبت شده است" };
  }
  if (vault.data.users.some((item) => item.phone && normalizePhone(item.phone) === normalizedPhone)) {
    return { field: "phone", message: "این شماره موبایل قبلاً ثبت شده است" };
  }
  return null;
}

export function isCoachCodeValid(code: string): boolean {
  const value = code.trim().toUpperCase();
  if (!value) return true;
  return readVault().data.users.some((item) => item.role === "coach" && item.inviteCode === value);
}

export function loginLocal(identifier: string, password: string): string | null {
  const value = identifier.trim().toLowerCase();
  const phone = normalizePhone(identifier);
  const vault = readVault();
  const user = vault.data.users.find((item) =>
    item.email.toLowerCase() === value || (isValidPhone(phone) && normalizePhone(item.phone) === phone),
  );
  if (!user || user.password !== password) return "ایمیل، شماره موبایل یا رمز عبور صحیح نیست";
  const at = new Date().toISOString();
  vault.data.users = vault.data.users.map((item) => item.id === user.id ? { ...item, lastLoginAt: at } : item);
  vault.session = { userId: user.id, role: user.role };
  writeVault(vault);
  routeFor(user.role);
  return null;
}

export function currentCoachNeedsProfile(): boolean {
  const vault = readVault();
  if (vault.session?.role !== "coach") return false;
  const user = vault.data.users.find((item) => item.id === vault.session?.userId);
  return Boolean(user && !user.trainerProfile);
}

export function currentUserSummary(): { name: string; email: string } | null {
  const vault = readVault();
  const user = vault.data.users.find((item) => item.id === vault.session?.userId);
  return user ? { name: user.name, email: user.email } : null;
}

export function saveCurrentTrainerProfile(profile: TrainerProfile, avatar: string): string | null {
  const vault = readVault();
  if (vault.session?.role !== "coach") return "حساب مربی پیدا نشد";
  const exists = vault.data.users.some((item) => item.id === vault.session?.userId && item.role === "coach");
  if (!exists) return "حساب مربی پیدا نشد";
  vault.data.users = vault.data.users.map((item) => item.id === vault.session?.userId
    ? { ...item, avatar: avatar || item.avatar, trainerProfile: profile }
    : item);
  writeVault(vault);
  return null;
}

function routeFor(role: AppRole) {
  window.location.hash = role === "student" ? "/student" : role === "admin" ? "/coach/admin" : "/coach";
}

export type SubPlan = {
  id: string;
  sessions: number;
  title: string;
  price: number;
  days: number;
  perSession: number;
  popular?: boolean;
  best?: boolean;
  perks: string[];
  active?: boolean;
};

export type CoachPublic = {
  id: string;
  code: string;
  name: string;
  avatar: string;
  specialization: string;
  specialties: string[];
  certification: string;
  certificationBody: string;
  experienceYears: number;
  coachingFormat: TrainerProfile["coachingFormat"];
  bio: string;
  plans: SubPlan[];
};

/** Original Revo Sport default plans (used until a coach defines their own). */
export const DEFAULT_PLANS: SubPlan[] = [
  { id: "p8", sessions: 8, title: "8 جلسه", price: 1600000, days: 30, perSession: 200000, perks: ["برنامه تمرینی اختصاصی", "پشتیبانی پیام‌رسان", "ثبت و بررسی تمرین"], active: true },
  { id: "p12", sessions: 12, title: "12 جلسه", price: 2160000, days: 45, perSession: 180000, perks: ["همه امکانات پلن 8 جلسه", "بازبینی برنامه در میانه دوره", "گزارش پیشرفت"], popular: true, active: true },
  { id: "p16", sessions: 16, title: "16 جلسه", price: 2720000, days: 60, perSession: 170000, perks: ["همه امکانات پلن 12 جلسه", "اصلاح فرم با ویدیو", "تنظیم هفتگی برنامه"], active: true },
  { id: "p24", sessions: 24, title: "24 جلسه", price: 3840000, days: 90, perSession: 160000, perks: ["همه امکانات پلن 16 جلسه", "اولویت پاسخ‌گویی مربی", "جلسه مشاوره اختصاصی"], best: true, active: true },
];

/** Finds an active coach by invite code and exposes only public profile data + plans. */
export function lookupCoachByCode(code: string): CoachPublic | null {
  const value = code.trim().toUpperCase();
  if (!value) return null;
  const vault = readVault();
  const coach = vault.data.users.find((item) => item.role === "coach" && item.inviteCode === value);
  if (!coach) return null;
  const profile = coach.trainerProfile;
  const own = (vault.data.coachPlans as Record<string, SubPlan[]> | undefined)?.[coach.id];
  const plans = (Array.isArray(own) && own.length ? own : DEFAULT_PLANS).filter((plan) => plan.active !== false);
  return {
    id: coach.id,
    code: coach.inviteCode ?? value,
    name: coach.name,
    avatar: coach.avatar,
    specialization: profile?.specialization ?? "",
    specialties: profile?.specialties ?? (profile?.specialization ? [profile.specialization] : []),
    certification: profile?.certification ?? "",
    certificationBody: profile?.certificationBody ?? "",
    experienceYears: profile?.experienceYears ?? 0,
    coachingFormat: profile?.coachingFormat ?? "hybrid",
    bio: profile?.bio ?? "",
    plans,
  };
}

export function clearSignupDraft() {
  try { sessionStorage.removeItem("revo-onboarding-v5"); } catch { /* ignore */ }
}

export type SignupInput = {
  role: "trainer" | "trainee";
  name: string;
  email: string;
  phone: string;
  password: string;
  avatar?: string;
  age: number;
  gender: "male" | "female";
  height: number;
  weight: number;
  goals: string[];
  activity: "Beginner" | "Intermediate" | "Advanced";
  coachCode?: string;
  trainerProfile?: TrainerProfile;
  plan?: { id: string; title: string; sessions: number; days: number; price: number; perks: string[]; paid?: boolean } | null;
};

const GOAL_MAP: Record<string, string> = {
  "Get Fitter": "فیتنس",
  "Gain Weight": "عضله‌سازی",
  "Lose Weight": "کاهش وزن",
  "Building Muscles": "عضله‌سازی",
  "Improving Endurance": "افزایش استقامت",
  Others: "فیتنس",
};

const LEVEL_MAP = { Beginner: "مبتدی", Intermediate: "متوسط", Advanced: "پیشرفته" } as const;

export function registerLocal(input: SignupInput): string | null {
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  const name = input.name.trim();
  if (!name) return "نام کامل را وارد کن";
  if (!isValidEmail(email)) return "ایمیل معتبر وارد کن";
  if (!isValidPhone(phone)) return "شماره موبایل 11 رقمی با 09 وارد کن";
  if (input.password.length < 4) return "رمز عبور حداقل 4 کاراکتر باشد";

  const vault = readVault();
  if (vault.data.users.some((item) => item.email.toLowerCase() === email)) return "این ایمیل قبلاً ثبت شده";
  if (vault.data.users.some((item) => item.phone && normalizePhone(item.phone) === phone)) {
    return "این شماره موبایل قبلاً ثبت شده";
  }

  const role: AppRole = input.role === "trainer" ? "coach" : "student";
  const at = new Date().toISOString();
  const used = new Set(vault.data.users.map((item) => item.inviteCode).filter(Boolean) as string[]);
  let coachId = "";
  if (role === "student" && input.coachCode?.trim()) {
    const code = input.coachCode.trim().toUpperCase();
    const coach = vault.data.users.find((item) => item.role === "coach" && item.inviteCode === code);
    if (!coach) return "کد مربی معتبر نیست";
    coachId = coach.id;
  }

  const userId = uid(role === "coach" ? "coach" : "student");
  const user: VaultUser = {
    id: userId,
    role,
    name,
    email,
    phone,
    avatar:
      input.avatar ||
      "https://images.pexels.com/photos/3764010/pexels-photo-3764010.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
    password: input.password,
    createdAt: at,
    lastLoginAt: at,
    inviteCode: role === "coach" ? inviteCode(used) : undefined,
    trainerProfile: role === "coach" ? input.trainerProfile : undefined,
  };
  vault.data.users.push(user);

  if (role === "student") {
    const goal = GOAL_MAP[input.goals[0]] || "فیتنس";
    const level = LEVEL_MAP[input.activity];
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    const studentId = uid("st");
    vault.data.students.push({
      ...(input.plan ? {
        planId: input.plan.id,
        planTitle: input.plan.title,
        planDays: input.plan.days,
        planPerks: input.plan.perks,
        sessionsTotal: 0,
        selectedPlanPending: !input.plan.paid,
      } : {}),
      id: studentId,
      userId,
      coachId,
      age: input.age,
      gender: input.gender === "female" ? "زن" : "مرد",
      height: input.height,
      weight: input.weight,
      goal,
      level,
      experience: "",
      startDate: at,
      subEndsAt: end.toISOString(),
      subscription: "فعال",
      daysLeft: 30,
      daysSinceWorkout: 0,
      notes: "",
      status: "active",
      category: "عمومی",
      assessment: {
        mainGoal: goal,
        level,
        history: "",
        daysPerWeek: 3,
        sessionMinutes: 45,
        equipment: ["وزن بدن"],
        lifestyle: "",
        dailyActivity: level,
        sleepHours: 7,
        foodPrefs: "",
        limitations: "",
      },
    });
    if (coachId) {
      const notifs = Array.isArray(vault.data.notifs) ? vault.data.notifs : [];
      notifs.unshift({
        id: uid("n"),
        to: "coach",
        coachId,
        studentId,
        title: "شاگرد جدید",
        body: input.plan
          ? `${name} با کد دعوت به شما وصل شد و پلن ${input.plan.title} را ${input.plan.paid ? "با پرداخت فعال کرد" : "انتخاب کرد (در انتظار پرداخت)"}.`
          : `${name} با کد دعوت به شما وصل شد.`,
        time: at,
        read: false,
        type: "success",
      });
      vault.data.notifs = notifs;
    }
  }

  vault.session = { userId, role };
  writeVault(vault);
  routeFor(role);
  return null;
}

/* ---------------- phone verification (SMS one-time code) ---------------- */
export type OtpChallenge = {
  id: string;
  phone: string;
  expiresAt: number;
  mode: "sms" | "preview";
  previewCode?: string;
};

const OTP_TTL_MS = 3 * 60 * 1000;
const SMS_API_BASE = (((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SMS_API_URL) ?? "").replace(/\/+$/, "");
export const SMS_PROVIDER_CONFIGURED = SMS_API_BASE.length > 0;

function secureDigits(length: number): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => String(value % 10)).join("");
}

/**
 * Sends a one-time code to the phone.
 * - With VITE_SMS_API_URL: POST {base}/otp/send {phone} -> { challengeId }  (the server generates, stores and delivers the code).
 * - Without it: preview mode. No SMS is sent; the code is shown in the UI and labelled as a preview.
 */
export async function sendPhoneOtp(phone: string): Promise<{ challenge?: OtpChallenge; error?: string }> {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) return { error: "شماره موبایل 11 رقمی با 09 وارد کن" };
  const expiresAt = Date.now() + OTP_TTL_MS;
  if (!SMS_PROVIDER_CONFIGURED) {
    return { challenge: { id: uid("otp"), phone: normalized, expiresAt, mode: "preview", previewCode: secureDigits(6) } };
  }
  try {
    const response = await fetch(`${SMS_API_BASE}/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized, purpose: "signup" }),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as { challengeId?: string; error?: string };
    if (!response.ok || !data.challengeId) return { error: data.error ?? "ارسال پیامک ناموفق بود؛ دوباره تلاش کن" };
    return { challenge: { id: data.challengeId, phone: normalized, expiresAt, mode: "sms" } };
  } catch {
    return { error: "ارتباط با سرویس پیامک برقرار نشد" };
  }
}

/** Verifies the code. SMS mode asks the server (POST {base}/otp/verify {challengeId, code}). */
export async function checkPhoneOtp(challenge: OtpChallenge, code: string): Promise<{ ok: boolean; error?: string }> {
  if (Date.now() > challenge.expiresAt) return { ok: false, error: "کد منقضی شد؛ کد جدید بگیر" };
  if (challenge.mode === "preview") return { ok: code === challenge.previewCode };
  try {
    const response = await fetch(`${SMS_API_BASE}/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: challenge.id, code }),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (response.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error ?? "کد اشتباه است" };
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد" };
  }
}

/* ---------------- real Iranian payment gateway ---------------- */
export type PaymentIntent = { authority: string; redirectUrl: string };

const PAY_API_BASE = (((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PAY_API_URL) ?? "").replace(/\/+$/, "");
export const PAYMENT_CONFIGURED = PAY_API_BASE.length > 0;

/**
 * Creates a payment with your backend, which calls the gateway (ZarinPal / IDPay / ...).
 *   POST {VITE_PAY_API_URL}/payments/create
 *     body { amount, planId, planTitle, email, phone, callbackUrl }
 *     ->   { authority, redirectUrl }
 * The gateway amount must be in Toman and at least 10000.
 */
export async function createPayment(input: {
  amount: number;
  planId: string;
  planTitle: string;
  email: string;
  phone: string;
}): Promise<{ intent?: PaymentIntent; error?: string }> {
  if (!PAYMENT_CONFIGURED) return { error: "درگاه پرداخت واقعی تنظیم نشده است" };
  if (!Number.isFinite(input.amount) || input.amount < 10000) {
    return { error: "مبلغ پرداخت معتبر نیست" };
  }
  const callbackUrl = `${window.location.origin}${window.location.pathname}#/payment/callback`;
  try {
    const response = await fetch(`${PAY_API_BASE}/payments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, callbackUrl }),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as Partial<PaymentIntent> & { error?: string };
    if (!response.ok || !data.authority || !data.redirectUrl) {
      return { error: data.error ?? "ساخت تراکنش ناموفق بود؛ دوباره تلاش کن" };
    }
    return { intent: { authority: data.authority, redirectUrl: data.redirectUrl } };
  } catch {
    return { error: "ارتباط با درگاه پرداخت برقرار نشد" };
  }
}

/** Asks the backend to verify the transaction after returning from the gateway. */
export async function verifyPayment(authority: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!PAYMENT_CONFIGURED) return { ok: false, error: "درگاه پرداخت واقعی تنظیم نشده است" };
  try {
    const response = await fetch(`${PAY_API_BASE}/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authority, status }),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (response.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error ?? "تراکنش تأیید نشد" };
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد" };
  }
}
