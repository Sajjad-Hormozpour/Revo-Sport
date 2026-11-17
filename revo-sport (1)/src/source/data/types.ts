export type Role = "admin" | "coach" | "student";
export type SubStatus = "فعال" | "در حال اتمام" | "منقضی" | "غیرفعال";
export type ProgramStatus = "فعال" | "در حال اتمام" | "تمام‌شده" | "پیش‌نویس";
export type GoalKind =
  | "عضله‌سازی"
  | "کاهش وزن"
  | "چربی‌سوزی"
  | "افزایش قدرت"
  | "فیتنس"
  | "افزایش استقامت"
  | "تغییر ترکیب بدنی";

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  password: string;
  createdAt: string;
  lastLoginAt: string;
  inviteCode?: string;
}

export interface Assessment {
  mainGoal: GoalKind;
  level: string;
  history: string;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: string[];
  lifestyle: string;
  dailyActivity: string;
  sleepHours: number;
  foodPrefs: string;
  limitations: string;
}

export interface Student {
  id: string;
  userId: string;
  coachId: string;
  age: number;
  gender: "مرد" | "زن";
  height: number;
  weight: number;
  goal: GoalKind;
  level: string;
  experience: string;
  startDate: string;
  subEndsAt: string;
  subscription: SubStatus;
  planId?: string;
  planTitle?: string;
  sessionsTotal?: number;
  planStartedAt?: string;
  planPerks?: string[];
  planDays?: number;
  daysLeft: number;
  daysSinceWorkout: number;
  notes: string;
  status: "active" | "inactive";
  category: string;
  assessment: Assessment;
}

export interface ProgramSet {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  weight: string;
  rest: number;
  tempo: string;
  rpe: number;
  notes: string;
}

export interface WorkoutDay {
  id: string;
  weekday: string;
  focus: string;
  items: ProgramSet[];
}

export interface WorkoutProgram {
  id: string;
  studentId: string;
  name: string;
  goal: string;
  weeks: number;
  startDate: string;
  endDate: string;
  days: WorkoutDay[];
  status: ProgramStatus;
  createdAt: string;
  version?: number;
  revisions?: { version: number; at: string; name: string; days: WorkoutDay[] }[];
}

export interface WorkoutTemplate {
  id: string;
  coachId: string;
  name: string;
  days: WorkoutDay[];
  createdAt: string;
}

export interface SetLog {
  set: number;
  weight: number;
  reps: number;
  rpe: number;
  done: boolean;
}

export interface WorkoutLog {
  id: string;
  studentId: string;
  programId: string;
  dayId: string;
  date: string;
  at: string;
  startedAt?: string;
  durationMin: number;
  items: { exerciseId: string; sets: SetLog[] }[];
}

export interface MealItem {
  foodId: string;
  qty: number;
  note: string;
  /** Snapshot of custom food at assignment time. */
  food?: FoodEntry;
}

export interface FoodEntry {
  id: string;
  coachId: string;
  name: string;
  serving: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
}

export interface MealSlot {
  id?: string;
  slot: string;
  items: MealItem[];
}

export interface MealPlan {
  id: string;
  studentId: string;
  name: string;
  meals: MealSlot[];
  createdAt: string;
  updatedAt?: string;
  version?: number;
  status?: "draft" | "active" | "archived" | "template";
  coachId?: string;
  sourceId?: string;
  targetKcal?: number;
  targetP?: number;
  targetC?: number;
  targetF?: number;
  targetFiber?: number;
  waterGoal?: number;
  history?: { version: number; at: string; name: string; meals: MealSlot[] }[];
}

export interface NutritionLog {
  id: string;
  studentId: string;
  planId: string;
  date: string;
  slotId: string;
  completedAt: string;
}

export interface WeeklyCheckin {
  id: string;
  studentId: string;
  weekStart: string;
  submittedAt: string;
  weight: number;
  energy: number;
  sleep: number;
  stress: number;
  hunger: number;
  difficulty: number;
  nutritionAdherence: number;
  feeling: string;
  soreness: number;
  notes: string;
  status: "pending" | "approved" | "changes_requested";
  coachNote?: string;
  reviewedAt?: string;
}

export interface ProgressEntry {
  id: string;
  studentId: string;
  date: string;
  weight: number;
  arm: number;
  waist: number;
  chest: number;
  thigh: number;
  bodyFat?: number;
}

export interface ProgressPhoto {
  id: string;
  studentId: string;
  date: string;
  angle: "جلو" | "کنار" | "پشت";
  url: string;
}

export interface Goal {
  id: string;
  studentId: string;
  title: string;
  unit: string;
  start: number;
  current: number;
  target: number;
}

export interface ChatMsg {
  id: string;
  studentId: string;
  from: "coach" | "student";
  text: string;
  time: string;
  kind: "text" | "image" | "file" | "voice";
  unread?: boolean;
  editedAt?: string;
  deleted?: boolean;
  replyTo?: string;
  reaction?: string;
  attachUrl?: string;
  attachName?: string;
  fileSize?: number;
}

export interface Prefs {
  accent: string;
  radius: "sharp" | "soft" | "round";
  density: "compact" | "cozy";
  bubble: "modern" | "classic";
  chatWallpaper: string;
  reduceMotion: boolean;
  enterToSend: boolean;
  showSeconds: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  accent: "#e9e400",
  radius: "soft",
  density: "cozy",
  bubble: "modern",
  chatWallpaper: "none",
  reduceMotion: false,
  enterToSend: true,
  showSeconds: true,
};

export interface Notif {
  id: string;
  to: "coach" | "student";
  studentId?: string;
  coachId?: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: "alert" | "info" | "success";
}

export interface Appointment {
  id: string;
  studentId: string;
  title: string;
  date: string;
  time: string;
  startAt: string;
  duration: number;
  status: "رزرو" | "انجام‌شده" | "لغو";
}

export interface Invoice {
  id: string;
  studentId: string;
  plan: string;
  amount: number;
  date: string;
  status: "پرداخت‌شده" | "در انتظار" | "منقضی";
  coupon?: string;
  planId?: string;
  sessions?: number;
  method?: string;
  refId?: string;
  cardLast4?: string;
  rrn?: string;
  terminal?: string;
  cardBank?: string;
}

/** پلن اشتراک (پیش‌فرض سیستم یا تعریف‌شده توسط مربی) */
export interface SubPlan {
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
}

export interface WaterLog {
  date: string;
  ml: number;
  goal: number;
}

export interface SleepLog {
  date: string;
  bed: string;
  wake: string;
  hours: number;
}

export interface CoachExercise {
  id: string;
  coachId: string;
  name: string;
  en: string;
  muscle: string;
  equipment: string;
  level: "مبتدی" | "متوسط" | "پیشرفته";
  imageUrl: string;
  imageMediaId: string;
  videoUrl: string;
  videoMediaId: string;
  how: string;
  tips: string;
  defaultSets: number;
  defaultReps: string;
  defaultWeight: string;
  defaultRest: number;
  defaultRpe: number;
  defaultTempo: string;
  createdAt: string;
}

export interface AppData {
  users: User[];
  students: Student[];
  programs: WorkoutProgram[];
  logs: WorkoutLog[];
  meals: MealPlan[];
  progress: ProgressEntry[];
  photos: ProgressPhoto[];
  goals: Goal[];
  messages: ChatMsg[];
  notifs: Notif[];
  appts: Appointment[];
  invoices: Invoice[];
  water: Record<string, WaterLog>;
  sleep: Record<string, SleepLog[]>;
  xp: Record<string, number>;
  streak: Record<string, number>;
  coachExercises: CoachExercise[];
  coachPlans: Record<string, SubPlan[]>;
  foods: FoodEntry[];
  nutritionLogs: NutritionLog[];
  checkins: WeeklyCheckin[];
  workoutTemplates: WorkoutTemplate[];
}

export const DEFAULT_ASSESSMENT: Assessment = {
  mainGoal: "فیتنس",
  level: "مبتدی",
  history: "",
  daysPerWeek: 3,
  sessionMinutes: 45,
  equipment: ["وزن بدن"],
  lifestyle: "",
  dailyActivity: "متوسط",
  sleepHours: 7,
  foodPrefs: "",
  limitations: "",
};
