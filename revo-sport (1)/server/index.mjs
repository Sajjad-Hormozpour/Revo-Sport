/**
 * Revo sport — سرور دیتابیس مرکزی
 * --------------------------------------------------------------
 *  • بدون هیچ وابستگی اضافه (فقط Node 18+)
 *  • یک دیتابیس مشترک برای همه کاربران (فایل JSON روی دیسک)
 *  • ورود با رمز هش‌شده (scrypt) و توکن نشست
 *  • جداسازی دسترسی در سمت سرور: هر مربی فقط شاگردان خودش،
 *    هر شاگرد فقط اطلاعات خودش و مربی‌اش را می‌بیند
 *  • آپلود عکس/ویدیو روی دیسک سرور
 *  • سرو خودکار پوشه dist (همان اپ ساخته‌شده)
 *
 * اجرا:   npm run build && node server/index.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const DIST = path.resolve(process.env.DIST_DIR || path.join(__dirname, "..", "dist"));
const MEDIA_DIR = path.join(DATA_DIR, "media");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const DB_FILE = path.join(DATA_DIR, "db.json");
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const RESET_WEBHOOK = process.env.RESET_WEBHOOK_URL || "";
const SMS_WEBHOOK = process.env.SMS_WEBHOOK_URL || "";
const SMS_WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET || "";
const KAVENEGAR_API_KEY = process.env.KAVENEGAR_API_KEY || "";
const KAVENEGAR_TEMPLATE = process.env.KAVENEGAR_TEMPLATE || "revosportverify";
// Explicit opt-in for testing only; never return codes from a production server.
const OTP_DEV_MODE = process.env.OTP_DEV_MODE === "1" && process.env.NODE_ENV !== "production";
const TRUST_PROXY = !!process.env.TRUST_PROXY;
const SESSION_TTL = 60 * 24 * 3600 * 1000;
const OTP_TTL = 3 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */
const nowIso = () => new Date().toISOString();
const uid = (p) => `${p}_${crypto.randomBytes(6).toString("hex")}`;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const norm = (s) => String(s || "").trim().toLowerCase();
const isStr = (v) => typeof v === "string";
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => (isStr(v) ? v.slice(0, max) : "");
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const localDigits = (v) => String(v || "")
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const phoneNumber = (v) => {
  const digits = localDigits(v).replace(/[^\d+]/g, "");
  if (digits.startsWith("+98")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
};
const validPhone = (v) => /^09\d{9}$/.test(phoneNumber(v));
const ID_RE = /^[A-Za-z0-9_-]{3,80}$/;
const pick = (o, keys) => {
  const out = {};
  if (!isObj(o)) return out;
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
};
const clampNum = (v, d, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const validIso = (v) => {
  const t = Date.parse(v);
  return Number.isFinite(t) && t < Date.now() + 5 * 60 * 1000 ? new Date(t).toISOString() : nowIso();
};

function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}
function checkPw(pw, stored) {
  if (!isStr(stored) || !stored.startsWith("scrypt$")) return false;
  const [, s, h] = stored.split("$");
  const calc = crypto.scryptSync(String(pw), Buffer.from(s, "hex"), 64);
  const hb = Buffer.from(h, "hex");
  return hb.length === calc.length && crypto.timingSafeEqual(hb, calc);
}

const DEFAULT_ASSESSMENT = {
  mainGoal: "فیتنس", level: "مبتدی", history: "", daysPerWeek: 3, sessionMinutes: 45,
  equipment: ["وزن بدن"], lifestyle: "", dailyActivity: "متوسط", sleepHours: 7, foodPrefs: "", limitations: "",
};
const DEFAULT_AVATAR =
  "https://images.pexels.com/photos/3764010/pexels-photo-3764010.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200";

/* ------------------------------------------------------------------ */
/* database (single shared JSON file, atomic writes)                     */
/* ------------------------------------------------------------------ */
const emptyDb = () => ({
  rev: 0,
  users: [], students: [], programs: [], logs: [], meals: [], progress: [], photos: [], goals: [],
  messages: [], notifs: [], appts: [], invoices: [], coachExercises: [],
  coachPlans: {}, water: {}, sleep: {}, xp: {}, streak: {},
  foods: [], nutritionLogs: [], checkins: [], workoutTemplates: [],
  sessions: {}, resetCodes: {}, phoneChallenges: {},
});

fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

let db = emptyDb();
try {
  if (fs.existsSync(DB_FILE)) db = { ...emptyDb(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
} catch (e) {
  console.error("[db] فایل دیتابیس خراب است. نسخه خراب کنار گذاشته شد:", e.message);
  try { fs.renameSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`); } catch { /* ignore */ }
  db = emptyDb();
}
for (const key of ["foods", "nutritionLogs", "checkins", "workoutTemplates"]) if (!Array.isArray(db[key])) db[key] = [];

function pruneSessions() {
  const now = Date.now();
  for (const [k, s] of Object.entries(db.sessions)) if (now - s.at > SESSION_TTL) delete db.sessions[k];
  for (const [k, r] of Object.entries(db.resetCodes)) if (now > r.exp) delete db.resetCodes[k];
  for (const [k, r] of Object.entries(db.phoneChallenges || {})) if (now > r.exp) delete db.phoneChallenges[k];
}
pruneSessions();

let saveTimer = null;
function saveNow() {
  try {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error("[db] ذخیره ناموفق:", e);
  }
}
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 300);
}
function bump() {
  db.rev += 1;
  scheduleSave();
}

// پشتیبان روزانه خودکار (۱۴ نسخه آخر)
function dailyBackup() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const name = `db-${new Date().toISOString().slice(0, 10)}.json`;
    const target = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(target)) fs.copyFileSync(DB_FILE, target);
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("db-")).sort();
    while (files.length > 14) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  } catch (e) {
    console.error("[backup]", e.message);
  }
}
dailyBackup();
setInterval(dailyBackup, 6 * 3600 * 1000).unref();

/* ------------------------------------------------------------------ */
/* users / sessions                                                      */
/* ------------------------------------------------------------------ */
const emailTaken = (email, exceptId) => db.users.some((u) => u.email === email && u.id !== exceptId);
const phoneTaken = (phone, exceptId) => db.users.some((u) => u.id !== exceptId && validPhone(u.phone) && phoneNumber(u.phone) === phone);

async function sendPhoneCode(phone, code, purpose) {
  if (KAVENEGAR_API_KEY) {
    // Official Kavenegar VerifyLookup REST endpoint. Template must exist on the account.
    const endpoint = new URL(`https://api.kavenegar.com/v1/${encodeURIComponent(KAVENEGAR_API_KEY)}/verify/lookup.json`);
    endpoint.searchParams.set("receptor", phone);
    endpoint.searchParams.set("token", code);
    endpoint.searchParams.set("template", KAVENEGAR_TEMPLATE);
    const result = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
    if (!result.ok) throw new Error("سرویس پیامک پاسخ نداد");
    const payload = await result.json();
    if (payload?.return?.status !== 200) throw new Error("ارسال پیامک از سرویس پیامک تأیید نشد");
    return;
  }
  if (SMS_WEBHOOK) {
    const message = `Revo sport: کد تأیید ${purpose === "login" ? "ورود" : "ثبت‌نام"} شما ${code} است. اعتبار: ۳ دقیقه.`;
    const result = await fetch(SMS_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SMS_WEBHOOK_SECRET ? { Authorization: `Bearer ${SMS_WEBHOOK_SECRET}` } : {}),
      },
      body: JSON.stringify({ phone, code, purpose, message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error("ارسال کد توسط سرویس پیامک ناموفق بود");
    return;
  }
  if (OTP_DEV_MODE) {
    console.log(`[otp-dev] ${purpose} ${phone}: ${code}`);
    return;
  }
  throw new Error("سرویس پیامک هنوز تنظیم نشده است؛ KAVENEGAR_API_KEY یا SMS_WEBHOOK_URL را تنظیم کن");
}

function verifyPhoneChallenge(challengeId, code, purpose) {
  const challenge = db.phoneChallenges?.[challengeId];
  if (!challenge || challenge.purpose !== purpose) return { error: "کد تأیید معتبر نیست. دوباره درخواست بده", status: 400 };
  if (Date.now() > challenge.exp) {
    delete db.phoneChallenges[challengeId];
    scheduleSave();
    return { error: "زمان کد تمام شده؛ کد جدید بگیر", status: 400 };
  }
  if (challenge.tries >= 5) return { error: "تعداد تلاش‌ها زیاد شد؛ کد جدید بگیر", status: 429 };
  const input = localDigits(code).replace(/\D/g, "");
  const actual = Buffer.from(sha(`${challengeId}:${input}`), "hex");
  const expected = Buffer.from(challenge.hash, "hex");
  if (!/^\d{6}$/.test(input) || !crypto.timingSafeEqual(actual, expected)) {
    challenge.tries += 1;
    scheduleSave();
    return { error: "کد واردشده درست نیست", status: 400 };
  }
  return { challenge };
}

function inviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let s = "";
    for (let i = 0; i < 6; i++) s += chars[crypto.randomInt(chars.length)];
    if (!db.users.some((u) => u.inviteCode === s)) return s;
  }
}

function newSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions[sha(token)] = { userId, at: Date.now() };
  scheduleSave();
  return token;
}
function dropSessions(userId) {
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === userId) delete db.sessions[k];
}
function authFrom(req) {
  const h = String(req.headers.authorization || "");
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const key = sha(token);
  const s = db.sessions[key];
  if (!s) return null;
  if (Date.now() - s.at > SESSION_TTL) {
    delete db.sessions[key];
    return null;
  }
  const user = db.users.find((u) => u.id === s.userId);
  return user ? { user, token, key } : null;
}

function newStudentRecord(userId, coachId, src, forcedId) {
  const at = nowIso();
  const base = {
    id: forcedId || uid("st"), userId, coachId,
    age: 25, gender: "مرد", height: 170, weight: 70, goal: "فیتنس", level: "مبتدی", experience: "",
    startDate: at, subEndsAt: new Date(Date.now() + 30 * 864e5).toISOString(),
    subscription: "فعال", daysLeft: 30, daysSinceWorkout: 0, notes: "", status: "active", category: "عمومی",
    assessment: { ...DEFAULT_ASSESSMENT },
  };
  const s = pick(src, ["age", "gender", "height", "weight", "goal", "level", "experience", "category", "notes", "subEndsAt"]);
  if (isObj(src?.assessment)) s.assessment = { ...DEFAULT_ASSESSMENT, ...src.assessment };
  if (s.age !== undefined) s.age = clampNum(s.age, 25, 5, 120);
  if (s.height !== undefined) s.height = clampNum(s.height, 170, 80, 260);
  if (s.weight !== undefined) s.weight = clampNum(s.weight, 70, 20, 400);
  if (s.gender !== undefined && s.gender !== "مرد" && s.gender !== "زن") s.gender = "مرد";
  if (s.subEndsAt !== undefined && !Number.isFinite(Date.parse(s.subEndsAt))) delete s.subEndsAt;
  for (const k of ["goal", "level", "experience", "category", "notes"]) if (s[k] !== undefined) s[k] = str(s[k], 400);
  return { ...base, ...s };
}

function createUser({ name, email, password, role, phone, avatar, id }) {
  const at = nowIso();
  const user = {
    id: id || uid(role),
    role, name: str(name, 80).trim(), email,
    phone: validPhone(phone) ? phoneNumber(phone) : str(phone, 30),
    avatar: isStr(avatar) && avatar.length < 2_500_000 ? avatar : DEFAULT_AVATAR,
    createdAt: at, lastLoginAt: at,
    passHash: hashPw(password),
  };
  if (role === "coach") user.inviteCode = inviteCode();
  db.users.push(user);
  return user;
}

const publicUser = (u) => {
  const { passHash, ...rest } = u; // eslint-disable-line no-unused-vars
  return { ...rest, password: "" };
};

/* ------------------------------------------------------------------ */
/* scoping: هر کاربر فقط دادهٔ مجاز خودش را می‌بیند                        */
/* ------------------------------------------------------------------ */
function scopeFor(user) {
  if (user.role === "admin") return { all: true };
  if (user.role === "coach") {
    const sts = db.students.filter((s) => s.coachId === user.id);
    const S = new Set(sts.map((s) => s.id));
    const U = new Set(sts.map((s) => s.userId));
    U.add(user.id);
    return { S, U, owner: user.id };
  }
  const me = db.students.find((s) => s.userId === user.id);
  const S = new Set(me ? [me.id] : []);
  const U = new Set([user.id]);
  if (me?.coachId) U.add(me.coachId);
  return { S, U, owner: me?.coachId || "__none__" };
}

function view(user) {
  const sc = scopeFor(user);
  if (sc.all) {
    return {
      users: db.users.map(publicUser), students: db.students, programs: db.programs, logs: db.logs, meals: db.meals,
      foods: db.foods, nutritionLogs: db.nutritionLogs, checkins: db.checkins, workoutTemplates: db.workoutTemplates,
      progress: db.progress, photos: db.photos, goals: db.goals, messages: db.messages, notifs: db.notifs,
      appts: db.appts, invoices: db.invoices, coachExercises: db.coachExercises, coachPlans: db.coachPlans,
      water: db.water, sleep: db.sleep, xp: db.xp, streak: db.streak,
    };
  }
  const f = (a) => a.filter((x) => sc.S.has(x.studentId));
  const rec = (r) => Object.fromEntries(Object.entries(r || {}).filter(([k]) => sc.S.has(k)));
  return {
    users: db.users.filter((u) => sc.U.has(u.id)).map(publicUser),
    students: db.students.filter((s) => sc.S.has(s.id)),
    programs: f(db.programs), logs: f(db.logs),
    meals: db.meals.filter((m) => sc.S.has(m.studentId) || (user.role === "coach" && m.status === "template" && m.coachId === user.id)),
    foods: db.foods.filter((food) => food.coachId === sc.owner),
    nutritionLogs: f(db.nutritionLogs), checkins: f(db.checkins),
    workoutTemplates: db.workoutTemplates.filter((template) => template.coachId === sc.owner), progress: f(db.progress),
    photos: f(db.photos), goals: f(db.goals), messages: f(db.messages), appts: f(db.appts), invoices: f(db.invoices),
    notifs: db.notifs.filter((n) =>
      user.role === "coach"
        ? n.to === "coach" && (n.coachId === user.id || (n.studentId && sc.S.has(n.studentId)))
        : n.to === "student" && n.studentId && sc.S.has(n.studentId),
    ),
    coachExercises: db.coachExercises.filter((c) => c.coachId === sc.owner),
    coachPlans: db.coachPlans[sc.owner] ? { [sc.owner]: db.coachPlans[sc.owner] } : {},
    water: rec(db.water), sleep: rec(db.sleep), xp: rec(db.xp), streak: rec(db.streak),
  };
}

const authPayload = (user, token) => ({ token, userId: user.id, role: user.role, rev: db.rev, db: view(user) });

/* ------------------------------------------------------------------ */
/* merge: فقط رکوردهای تغییرکرده (delta) و فقط در محدودهٔ مجاز کاربر         */
/* ------------------------------------------------------------------ */
const STUDENT_SELF_FIELDS = [
  "age", "gender", "height", "weight", "goal", "level", "experience", "assessment",
];

function sanitizeMsg(m, studentId) {
  const kinds = ["text", "image", "file", "voice"];
  const rec = {
    id: m.id, studentId, from: m.from,
    text: str(m.text, 6000),
    time: validIso(m.time),
    kind: kinds.includes(m.kind) ? m.kind : "text",
    unread: m.unread !== false,
  };
  if (isStr(m.replyTo)) rec.replyTo = m.replyTo.slice(0, 80);
  if (isStr(m.attachUrl) && m.attachUrl.length < 6_000_000) rec.attachUrl = m.attachUrl;
  if (isStr(m.attachName)) rec.attachName = m.attachName.slice(0, 200);
  if (Number.isFinite(Number(m.fileSize))) rec.fileSize = Number(m.fileSize);
  if (isStr(m.reaction)) rec.reaction = m.reaction.slice(0, 8);
  return rec;
}

function applyDelta(user, delta, deletes) {
  const admin = user.role === "admin";
  const coach = user.role === "coach";
  const student = user.role === "student";
  const sc = scopeFor(user);
  const S = admin ? null : sc.S;
  const inS = (id) => isStr(id) && (admin || S.has(id));
  const arr = (k) => (Array.isArray(delta[k]) ? delta[k].filter((x) => isObj(x) && isStr(x.id) && x.id.length < 100) : []);
  const map = (k) => (isObj(delta[k]) ? delta[k] : {});
  let changed = false;
  let pruneNeeded = false;

  /* ---- deletions (صریح؛ هرگز با «غایب بودن» حذف نمی‌شود) ---- */
  if (coach || admin) {
    for (const id of Array.isArray(deletes.students) ? deletes.students : []) {
      const st = db.students.find((s) => s.id === id);
      if (!st || !(admin || st.coachId === user.id)) continue;
      db.students = db.students.filter((s) => s.id !== id);
      const u = db.users.find((x) => x.id === st.userId);
      if (u && u.role === "student") {
        db.users = db.users.filter((x) => x.id !== u.id);
        dropSessions(u.id);
      }
      if (S) S.delete(id);
      pruneNeeded = true;
      changed = true;
    }
    for (const id of Array.isArray(deletes.programs) ? deletes.programs : []) {
      const p = db.programs.find((x) => x.id === id);
      if (!p || !inS(p.studentId)) continue;
      db.programs = db.programs.filter((x) => x.id !== id);
      changed = true;
    }
    for (const id of Array.isArray(deletes.coachExercises) ? deletes.coachExercises : []) {
      const e = db.coachExercises.find((x) => x.id === id);
      if (!e || !(admin || e.coachId === user.id)) continue;
      db.coachExercises = db.coachExercises.filter((x) => x.id !== id);
      changed = true;
    }
    for (const id of Array.isArray(deletes.meals) ? deletes.meals : []) {
      const meal = db.meals.find((x) => x.id === id);
      if (!meal || !(admin || (meal.status === "template" ? meal.coachId === user.id : inS(meal.studentId)))) continue;
      db.meals = db.meals.filter((x) => x.id !== id);
      db.nutritionLogs = db.nutritionLogs.filter((x) => x.planId !== id);
      changed = true;
    }
    for (const id of Array.isArray(deletes.foods) ? deletes.foods : []) {
      const food = db.foods.find((x) => x.id === id);
      if (!food || !(admin || food.coachId === user.id)) continue;
      db.foods = db.foods.filter((x) => x.id !== id);
      changed = true;
    }
    for (const id of Array.isArray(deletes.workoutTemplates) ? deletes.workoutTemplates : []) {
      const template = db.workoutTemplates.find((t) => t.id === id);
      if (!template || !(admin || template.coachId === user.id)) continue;
      db.workoutTemplates = db.workoutTemplates.filter((t) => t.id !== id);
      changed = true;
    }
  }
  if (student || admin) {
    for (const id of Array.isArray(deletes.nutritionLogs) ? deletes.nutritionLogs : []) {
      const log = db.nutritionLogs.find((x) => x.id === id);
      if (!log || !inS(log.studentId)) continue;
      db.nutritionLogs = db.nutritionLogs.filter((x) => x.id !== id);
      changed = true;
    }
  }

  /* ---- شاگردان جدید (مثلاً بازیابی پشتیبان توسط مربی) ---- */
  if (coach || admin) {
    const incUsers = arr("users");
    for (const st of arr("students")) {
      if (db.students.some((s) => s.id === st.id) || !ID_RE.test(st.id) || !isStr(st.userId)) continue;
      const u = incUsers.find((x) => x.id === st.userId);
      if (!u || !ID_RE.test(u.id) || db.users.some((x) => x.id === u.id)) continue;
      const email = norm(u.email);
      if (!EMAIL_RE.test(email) || emailTaken(email) || !isStr(u.name) || !u.name.trim()) continue;
      const pw = isStr(u.password) && u.password.length >= 4 ? u.password : crypto.randomBytes(9).toString("base64url");
      createUser({ name: u.name, email, password: pw, role: "student", phone: u.phone, avatar: u.avatar, id: u.id });
      db.students.push(newStudentRecord(u.id, admin && isStr(st.coachId) ? st.coachId : user.id, st, st.id));
      if (S) S.add(st.id);
      changed = true;
    }
  }

  /* ---- پروفایل کاربران موجود ---- */
  for (const u of arr("users")) {
    const cur = db.users.find((x) => x.id === u.id);
    if (!cur) continue;
    const self = cur.id === user.id;
    const mine = coach && sc.U && sc.U.has(cur.id);
    if (!(self || mine || admin)) continue;
    const patch = {};
    if (isStr(u.name) && u.name.trim()) patch.name = u.name.trim().slice(0, 80);
    if (isStr(u.phone)) patch.phone = u.phone.slice(0, 30);
    if (isStr(u.avatar) && u.avatar.length < 2_500_000) patch.avatar = u.avatar;
    if ((self || admin) && isStr(u.email)) {
      const e = norm(u.email);
      if (EMAIL_RE.test(e) && (e === cur.email || !emailTaken(e, cur.id))) patch.email = e;
    }
    const before = JSON.stringify(pick(cur, Object.keys(patch)));
    if (Object.keys(patch).length && before !== JSON.stringify(patch)) {
      Object.assign(cur, patch);
      changed = true;
    }
  }

  /* ---- رکورد شاگردان موجود ---- */
  for (const st of arr("students")) {
    const cur = db.students.find((s) => s.id === st.id);
    if (!cur) continue;
    if (admin || (coach && cur.coachId === user.id)) {
      const i = db.students.indexOf(cur);
      db.students[i] = {
        ...st, id: cur.id, userId: cur.userId,
        coachId: admin && isStr(st.coachId) ? st.coachId : cur.coachId,
      };
      changed = true;
    } else if (student && cur.userId === user.id) {
      Object.assign(cur, pick(st, STUDENT_SELF_FIELDS));
      changed = true;
    }
  }

  /* ---- مجموعه‌هایی که با studentId به شاگرد وصل‌اند ---- */
  const upsertByStudent = (key, roles) => {
    if (!roles.includes(user.role)) return;
    for (const r of arr(key)) {
      if (!inS(r.studentId)) continue;
      const i = db[key].findIndex((x) => x.id === r.id);
      if (i >= 0) {
        if (db[key][i].studentId !== r.studentId) continue;
        db[key][i] = r;
      } else db[key].push(r);
      changed = true;
    }
  };
  upsertByStudent("programs", ["coach", "admin"]);
  // Nutrition plans are editable only by the assigned coach; templates belong to that coach.
  if (coach || admin) for (const meal of arr("meals")) {
    const template = meal.status === "template";
    if (template ? (!admin && meal.coachId !== user.id) : !inS(meal.studentId)) continue;
    if (!isStr(meal.name) || !Array.isArray(meal.meals) || meal.meals.length > 12) continue;
    if (!meal.meals.every((slot) => isObj(slot) && isStr(slot.slot) && Array.isArray(slot.items) && slot.items.length <= 30)) continue;
    const i = db.meals.findIndex((x) => x.id === meal.id);
    if (i >= 0 && db.meals[i].studentId !== meal.studentId) continue;
    const old = i >= 0 ? db.meals[i] : null;
    const record = { ...meal, coachId: admin ? meal.coachId : user.id,
      version: Math.max(1, Number(meal.version) || 1),
      history: Array.isArray(meal.history) ? meal.history.slice(-20) : [],
      createdAt: old?.createdAt || nowIso(), updatedAt: nowIso(),
    };
    if (i >= 0) db.meals[i] = record;
    else db.meals.push(record);
    changed = true;
  }
  if (coach || admin) for (const food of arr("foods")) {
    if (!isStr(food.name) || !isStr(food.serving) || !food.name.trim()) continue;
    const i = db.foods.findIndex((f) => f.id === food.id);
    if (i >= 0 && !admin && db.foods[i].coachId !== user.id) continue;
    const record = { id: food.id, coachId: admin ? food.coachId : user.id,
      name: str(food.name, 120), serving: str(food.serving, 80),
      kcal: clampNum(food.kcal, 0, 0, 5000), p: clampNum(food.p, 0, 0, 500),
      c: clampNum(food.c, 0, 0, 500), f: clampNum(food.f, 0, 0, 500), fiber: clampNum(food.fiber, 0, 0, 200),
    };
    if (i >= 0) db.foods[i] = record;
    else db.foods.push(record);
    changed = true;
  }
  if (coach || admin) for (const template of arr("workoutTemplates")) {
    if (!isStr(template.name) || !Array.isArray(template.days) || template.days.length > 7) continue;
    const i = db.workoutTemplates.findIndex((t) => t.id === template.id);
    if (i >= 0 && !admin && db.workoutTemplates[i].coachId !== user.id) continue;
    const record = { id: template.id, coachId: admin ? template.coachId : user.id,
      name: str(template.name, 120), days: template.days, createdAt: i >= 0 ? db.workoutTemplates[i].createdAt : nowIso() };
    if (i >= 0) db.workoutTemplates[i] = record;
    else db.workoutTemplates.push(record);
    changed = true;
  }
  if (student || admin) for (const log of arr("nutritionLogs")) {
    if (!inS(log.studentId) || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) continue;
    const plan = db.meals.find((m) => m.id === log.planId && m.studentId === log.studentId && m.status !== "draft");
    if (!plan || !plan.meals?.some((slot, index) => (slot.id || `${index}`) === log.slotId)) continue;
    if (db.nutritionLogs.some((x) => x.id === log.id ||
      (x.studentId === log.studentId && x.planId === log.planId && x.date === log.date && x.slotId === log.slotId))) continue;
    db.nutritionLogs.push({ id: log.id, studentId: log.studentId, planId: log.planId,
      slotId: log.slotId, date: log.date, completedAt: nowIso() });
    changed = true;
  }
  for (const checkin of arr("checkins")) {
    if (!inS(checkin.studentId) || !/^\d{4}-\d{2}-\d{2}$/.test(checkin.weekStart)) continue;
    const i = db.checkins.findIndex((x) => x.id === checkin.id);
    const old = i >= 0 ? db.checkins[i] : null;
    if (old && (old.studentId !== checkin.studentId || old.weekStart !== checkin.weekStart)) continue;
    if (!old && db.checkins.some((x) => x.studentId === checkin.studentId && x.weekStart === checkin.weekStart)) continue;
    if (student && old && old.status === "approved") continue;
    if (student) {
      const record = { id: checkin.id, studentId: checkin.studentId, weekStart: checkin.weekStart,
        submittedAt: nowIso(), weight: clampNum(checkin.weight, 0, 20, 400),
        energy: clampNum(checkin.energy, 5, 1, 10), sleep: clampNum(checkin.sleep, 7, 0, 24),
        stress: clampNum(checkin.stress, 5, 1, 10), hunger: clampNum(checkin.hunger, 5, 1, 10),
        difficulty: clampNum(checkin.difficulty, 5, 1, 10),
        nutritionAdherence: clampNum(checkin.nutritionAdherence, 0, 0, 100),
        feeling: str(checkin.feeling, 160), soreness: clampNum(checkin.soreness, 5, 1, 10),
        notes: str(checkin.notes, 2000), status: "pending", coachNote: "", reviewedAt: "" };
      if (i >= 0) db.checkins[i] = record;
      else db.checkins.push(record);
    } else if (old && (admin || db.students.find((s) => s.id === old.studentId)?.coachId === user.id)) {
      if (!["approved", "changes_requested", "pending"].includes(checkin.status)) continue;
      db.checkins[i] = { ...old, status: checkin.status, coachNote: str(checkin.coachNote, 2000), reviewedAt: nowIso() };
    } else continue;
    changed = true;
  }
  upsertByStudent("appts", ["coach", "admin"]);
  for (const k of ["logs", "progress", "photos", "goals"]) upsertByStudent(k, ["coach", "student", "admin"]);
  // Subscriptions and invoices are never writable by a student through the generic data endpoint.
  upsertByStudent("invoices", ["coach", "admin"]);

  /* ---- پیام‌ها ---- */
  const myRole = admin ? null : user.role;
  for (const m of arr("messages")) {
    if (!inS(m.studentId)) continue;
    const cur = db.messages.find((x) => x.id === m.id);
    if (!cur) {
      if (!["coach", "student"].includes(m.from) || (myRole && m.from !== myRole)) continue;
      db.messages.push(sanitizeMsg(m, m.studentId));
      changed = true;
      continue;
    }
    if (cur.studentId !== m.studentId) continue;
    const next = { ...cur };
    if ("unread" in m) next.unread = !!m.unread;
    if ("reaction" in m) next.reaction = isStr(m.reaction) && m.reaction ? m.reaction.slice(0, 8) : undefined;
    if (!myRole || cur.from === myRole) {
      if (isStr(m.text)) next.text = m.text.slice(0, 6000);
      next.editedAt = isStr(m.editedAt) ? m.editedAt : cur.editedAt;
      next.deleted = !!m.deleted;
      if (m.deleted) { next.text = ""; next.attachUrl = undefined; next.attachName = undefined; next.reaction = undefined; }
    }
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      Object.assign(cur, next);
      changed = true;
    }
  }

  /* ---- اعلان‌ها ---- */
  for (const n of arr("notifs")) {
    const cur = db.notifs.find((x) => x.id === n.id);
    if (!cur) {
      if (!inS(n.studentId) || !["coach", "student"].includes(n.to)) continue;
      const st = db.students.find((s) => s.id === n.studentId);
      db.notifs.unshift({
        id: n.id, to: n.to, studentId: n.studentId,
        coachId: n.to === "coach" ? st?.coachId : undefined,
        title: str(n.title, 120), body: str(n.body, 400), time: validIso(n.time), read: false,
        type: ["alert", "info", "success"].includes(n.type) ? n.type : "info",
      });
      changed = true;
    } else {
      const visible =
        admin ||
        (coach && cur.to === "coach" && (cur.coachId === user.id || (cur.studentId && S.has(cur.studentId)))) ||
        (student && cur.to === "student" && cur.studentId && S.has(cur.studentId));
      if (visible && n.read === true && !cur.read) {
        cur.read = true;
        changed = true;
      }
    }
  }

  /* ---- حرکات و پلن‌های مربی ---- */
  if (coach || admin) {
    for (const e of arr("coachExercises")) {
      const owner = admin && isStr(e.coachId) ? e.coachId : user.id;
      const i = db.coachExercises.findIndex((x) => x.id === e.id);
      const rec = { ...e, coachId: owner };
      if (i >= 0) {
        if (db.coachExercises[i].coachId !== owner) continue;
        db.coachExercises[i] = rec;
      } else db.coachExercises.push(rec);
      changed = true;
    }
    for (const [k, v] of Object.entries(map("coachPlans"))) {
      if (!Array.isArray(v) || (!admin && k !== user.id)) continue;
      db.coachPlans[k] = v;
      changed = true;
    }
  }

  /* ---- دادهٔ کلید-مقدار (آب، خواب، XP، استریک) ---- */
  for (const key of ["water", "sleep", "xp", "streak"]) {
    for (const [k, v] of Object.entries(map(key))) {
      if (!inS(k) || !db.students.some((s) => s.id === k)) continue;
      db[key][k] = v;
      changed = true;
    }
  }

  if (pruneNeeded) {
    const ids = new Set(db.students.map((s) => s.id));
    for (const k of ["programs", "logs", "meals", "nutritionLogs", "checkins", "progress", "photos", "goals", "messages", "appts", "invoices"]) {
      db[k] = db[k].filter((x) => ids.has(x.studentId));
    }
    db.notifs = db.notifs.filter((n) => !n.studentId || ids.has(n.studentId));
    for (const k of ["water", "sleep", "xp", "streak"]) {
      for (const id of Object.keys(db[k])) if (!ids.has(id)) delete db[k][id];
    }
  }
  return changed;
}

/* ------------------------------------------------------------------ */
/* http utils                                                            */
/* ------------------------------------------------------------------ */
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.t > windowMs) {
    hits.set(key, { n: 1, t: now });
    return true;
  }
  h.n += 1;
  return h.n <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, h] of hits) if (now - h.t > 3600e3) hits.delete(k);
}, 600e3).unref();

const clientIp = (req) =>
  (TRUST_PROXY ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "") || req.socket.remoteAddress || "?";

function json(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": Buffer.byteLength(b),
  });
  res.end(b);
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        reject(Object.assign(new Error("حجم درخواست زیاد است"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJson(req, max = 40 * 1024 * 1024) {
  const b = await readBody(req, max);
  if (!b.length) return {};
  try {
    return JSON.parse(b.toString("utf8"));
  } catch {
    throw Object.assign(new Error("درخواست نامعتبر است"), { status: 400 });
  }
}

function requireAuth(req, res) {
  const a = authFrom(req);
  if (!a) json(res, 401, { error: "نشست منقضی شده؛ دوباره وارد شو" });
  return a;
}

/* ------------------------------------------------------------------ */
/* media (عکس / ویدیو)                                                   */
/* ------------------------------------------------------------------ */
const MEDIA_TYPE_RE = /^(image\/(png|jpe?g|webp|gif|avif)|video\/(mp4|webm|quicktime|ogg))$/;
const MEDIA_LIMIT = 300 * 1024 * 1024;

async function handleMedia(req, res, id) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return json(res, 400, { error: "شناسه فایل نامعتبر است" });
  const file = path.join(MEDIA_DIR, id);
  const meta = `${file}.meta`;
  const m = req.method;

  if (m === "GET" || m === "HEAD") {
    if (!fs.existsSync(file)) return json(res, 404, { error: "فایل پیدا نشد" });
    const size = fs.statSync(file).size;
    let ct = "application/octet-stream";
    try { ct = fs.readFileSync(meta, "utf8").trim() || ct; } catch { /* ignore */ }
    let start = 0;
    let end = size - 1;
    let status = 200;
    const range = req.headers.range;
    if (range) {
      const mm = /^bytes=(\d*)-(\d*)$/.exec(String(range));
      if (mm) {
        if (mm[1] !== "") {
          start = Number(mm[1]);
          if (mm[2] !== "") end = Math.min(Number(mm[2]), size - 1);
        } else if (mm[2] !== "") {
          start = Math.max(0, size - Number(mm[2]));
        }
        if (start > end || start >= size) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` });
          return res.end();
        }
        status = 206;
      }
    }
    const headers = {
      "Content-Type": ct, "Accept-Ranges": "bytes", "Content-Length": end - start + 1,
      "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    };
    if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    res.writeHead(status, headers);
    if (m === "HEAD") return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }

  const auth = requireAuth(req, res);
  if (!auth) return;
  if (auth.user.role === "student") return json(res, 403, { error: "اجازه آپلود نداری" });

  if (m === "POST" || m === "PUT") {
    const ct = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!MEDIA_TYPE_RE.test(ct)) return json(res, 415, { error: "فقط عکس و ویدیو مجاز است" });
    const tmp = `${file}.part`;
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmp);
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > MEDIA_LIMIT) {
          reject(Object.assign(new Error("حجم فایل بیش از ۳۰۰ مگابایت است"), { status: 413 }));
          out.destroy();
          req.destroy();
        }
      });
      req.on("error", reject);
      out.on("error", reject);
      out.on("finish", resolve);
      req.pipe(out);
    }).catch((e) => {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw e;
    });
    fs.renameSync(tmp, file);
    fs.writeFileSync(meta, ct);
    return json(res, 200, { ok: true, id });
  }

  if (m === "DELETE") {
    for (const f of [file, meta]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: "متد مجاز نیست" });
}

/* ------------------------------------------------------------------ */
/* API                                                                   */
/* ------------------------------------------------------------------ */
async function handleApi(req, res, url) {
  const p = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  const m = req.method;

  if (m === "GET" && p === "health") {
    return json(res, 200, {
      ok: true, app: "revo-sport",
      users: db.users.length,
      coaches: db.users.filter((u) => u.role === "coach").length,
      students: db.users.filter((u) => u.role === "student").length,
    });
  }

  if (p.startsWith("media/")) return handleMedia(req, res, p.slice(6));

  /* ---- شماره موبایل: صدور کد یک‌بارمصرف بدون ساخت نشست ---- */
  if (m === "POST" && p === "auth/phone/request") {
    const b = await readJson(req, 1e5);
    const purpose = b.purpose;
    const phone = phoneNumber(b.phone);
    const email = norm(b.email);
    if (purpose !== "login" && purpose !== "register") return json(res, 400, { error: "نوع درخواست نامعتبر است" });
    if (!EMAIL_RE.test(email) || !validPhone(phone)) return json(res, 400, { error: "ایمیل یا شماره موبایل معتبر نیست" });
    if (!limit(`otp-ip:${clientIp(req)}`, 12, 15 * 60e3) || !limit(`otp-phone:${phone}`, 4, 15 * 60e3)) {
      return json(res, 429, { error: "تعداد درخواست‌های کد زیاد شده؛ چند دقیقه بعد تلاش کن" });
    }
    let user;
    if (purpose === "login") {
      const key = `login:${clientIp(req)}:${email}`;
      if (!limit(key, 8, 10 * 60e3)) return json(res, 429, { error: "تعداد تلاش‌های ورود زیاد شده" });
      user = db.users.find((u) => u.email === email);
      if (!user || !checkPw(String(b.password || ""), user.passHash)) {
        return json(res, 401, { error: "ایمیل یا رمز عبور اشتباه است" });
      }
      if (user.phone && phoneNumber(user.phone) !== phone) {
        return json(res, 403, { error: "موبایل با شماره ثبت‌شده این حساب یکسان نیست" });
      }
      if (phoneTaken(phone, user.id)) return json(res, 409, { error: "این موبایل به حساب دیگری تعلق دارد" });
      hits.delete(key);
    } else {
      if (emailTaken(email)) return json(res, 409, { error: "این ایمیل قبلاً ثبت شده" });
      if (phoneTaken(phone)) return json(res, 409, { error: "این شماره موبایل قبلاً ثبت شده" });
    }
    const id = uid("otp");
    const code = String(crypto.randomInt(100000, 1000000));
    try {
      await sendPhoneCode(phone, code, purpose);
    } catch (e) {
      console.error("[otp]", e.message);
      return json(res, 503, { error: e.message });
    }
    for (const [key, item] of Object.entries(db.phoneChallenges)) {
      if (item.email === email && item.purpose === purpose) delete db.phoneChallenges[key];
    }
    db.phoneChallenges[id] = {
      purpose, email, phone, userId: user?.id, hash: sha(`${id}:${code}`),
      exp: Date.now() + OTP_TTL, tries: 0,
    };
    scheduleSave();
    return json(res, 200, { challengeId: id, expiresIn: 180, retryAfter: 60, ...(OTP_DEV_MODE ? { devCode: code } : {}) });
  }

  /* ---- تأیید موبایل برای ورود؛ توکن نشست فقط بعد از کد درست صادر می‌شود ---- */
  if (m === "POST" && p === "auth/phone/verify") {
    if (!limit(`otp-verify:${clientIp(req)}`, 24, 15 * 60e3)) {
      return json(res, 429, { error: "تعداد تلاش‌های تأیید زیاد شده" });
    }
    const b = await readJson(req, 1e5);
    const result = verifyPhoneChallenge(str(b.challengeId, 80), b.code, "login");
    if (result.error) return json(res, result.status, { error: result.error });
    const challenge = result.challenge;
    const user = db.users.find((u) => u.id === challenge.userId && u.email === challenge.email);
    if (!user || (user.phone && phoneNumber(user.phone) !== challenge.phone) || phoneTaken(challenge.phone, user.id)) {
      delete db.phoneChallenges[b.challengeId];
      return json(res, 403, { error: "حساب یا شماره موبایل معتبر نیست؛ دوباره وارد شو" });
    }
    delete db.phoneChallenges[b.challengeId];
    user.phone = challenge.phone; // حساب‌های قدیمی که شماره نداشتند بعد از تأیید متصل می‌شوند
    user.lastLoginAt = nowIso();
    bump();
    return json(res, 200, authPayload(user, newSession(user.id)));
  }

  /* ---- ثبت‌نام ---- */
  if (m === "POST" && p === "auth/register") {
    if (!limit(`reg:${clientIp(req)}`, 20, 3600e3)) return json(res, 429, { error: "تعداد ثبت‌نام‌ها زیاد است؛ بعداً تلاش کن" });
    const b = await readJson(req, 3e6);
    const input = isObj(b.input) ? b.input : b;
    const name = str(input.name, 80).trim();
    const email = norm(input.email);
    const password = String(input.password || "");
    const phone = phoneNumber(input.phone);
    let role = input.role === "coach" ? "coach" : "student";
    if (!name) return json(res, 400, { error: "نام را وارد کن" });
    if (!EMAIL_RE.test(email)) return json(res, 400, { error: "ایمیل معتبر نیست" });
    if (!validPhone(phone)) return json(res, 400, { error: "موبایل معتبر وارد کن" });
    if (password.length < 4) return json(res, 400, { error: "رمز حداقل ۴ کاراکتر باشد" });
    if (emailTaken(email)) return json(res, 409, { error: "این ایمیل قبلاً ثبت شده" });
    if (phoneTaken(phone)) return json(res, 409, { error: "این موبایل قبلاً ثبت شده" });
    const proof = verifyPhoneChallenge(str(b.challengeId, 80), b.code, "register");
    if (proof.error) return json(res, proof.status, { error: proof.error });
    if (proof.challenge.email !== email || proof.challenge.phone !== phone) {
      return json(res, 400, { error: "ایمیل یا موبایل با درخواست کد یکسان نیست" });
    }
    if (ADMIN_EMAIL && email === ADMIN_EMAIL) role = "admin";

    let coach = null;
    if (role === "student" && isStr(input.invite) && input.invite.trim()) {
      const code = input.invite.trim().toUpperCase();
      coach = db.users.find((u) => u.role === "coach" && u.inviteCode === code);
      if (!coach) return json(res, 400, { error: "کد دعوت مربی نامعتبر است" });
    }
    delete db.phoneChallenges[b.challengeId];
    const user = createUser({ name, email, password, role, phone });
    if (role === "student") {
      const goal = str(input.goal, 60) || "فیتنس";
      const st = newStudentRecord(user.id, coach?.id || "", {
        age: input.age, gender: input.gender, height: input.height, weight: input.weight, goal,
        assessment: { ...DEFAULT_ASSESSMENT, mainGoal: goal },
      });
      db.students.push(st);
      if (coach) {
        db.notifs.unshift({
          id: uid("n"), to: "coach", coachId: coach.id, studentId: st.id, title: "شاگرد جدید",
          body: `${user.name} با کد دعوت به شما وصل شد.`, time: nowIso(), read: false, type: "success",
        });
      }
    }
    bump();
    return json(res, 200, authPayload(user, newSession(user.id)));
  }

  /* ---- ورود ---- */
  if (m === "POST" && p === "auth/login") {
    return json(res, 403, { error: "برای ورود، موبایل و کد تأیید پیامکی لازم است" });
  }

  if (m === "POST" && p === "auth/logout") {
    const a = authFrom(req);
    if (a) {
      delete db.sessions[a.key];
      scheduleSave();
    }
    return json(res, 200, { ok: true });
  }

  /* ---- بازیابی رمز ---- */
  if (m === "POST" && p === "auth/forgot") {
    if (!limit(`forgot:${clientIp(req)}`, 5, 600e3)) return json(res, 429, { error: "تعداد درخواست‌ها زیاد است؛ بعداً تلاش کن" });
    const b = await readJson(req, 1e5);
    const email = norm(b.email);
    const u = db.users.find((x) => x.email === email);
    if (u) {
      const code = String(crypto.randomInt(100000, 1000000));
      db.resetCodes[email] = { hash: sha(code), exp: Date.now() + 10 * 60 * 1000, tries: 0 };
      scheduleSave();
      console.log(`[reset] کد بازیابی برای ${email}: ${code} (۱۰ دقیقه اعتبار)`);
      if (RESET_WEBHOOK) {
        fetch(RESET_WEBHOOK, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code, name: u.name }),
        }).catch((e) => console.error("[reset] webhook:", e.message));
      }
    }
    return json(res, 200, { ok: true });
  }

  if (m === "POST" && p === "auth/reset") {
    const b = await readJson(req, 1e5);
    const email = norm(b.email);
    const rec = db.resetCodes[email];
    const u = db.users.find((x) => x.email === email);
    if (!rec || !u) return json(res, 400, { error: "کد نامعتبر است؛ دوباره درخواست بده" });
    if (Date.now() > rec.exp) {
      delete db.resetCodes[email];
      return json(res, 400, { error: "کد منقضی شده؛ کد جدید بگیر" });
    }
    if (rec.tries >= 5) return json(res, 429, { error: "تعداد تلاش زیاد شد؛ کد جدید بگیر" });
    if (sha(String(b.code || "").trim()) !== rec.hash) {
      rec.tries += 1;
      scheduleSave();
      return json(res, 400, { error: "کد اشتباه است" });
    }
    const pw = String(b.password || "");
    if (pw.length < 4) return json(res, 400, { error: "رمز جدید حداقل ۴ کاراکتر باشد" });
    u.passHash = hashPw(pw);
    delete db.resetCodes[email];
    dropSessions(u.id);
    bump();
    return json(res, 200, { ok: true });
  }

  /* ---- از اینجا به بعد نیاز به ورود دارد ---- */
  const auth = requireAuth(req, res);
  if (!auth) return;
  const user = auth.user;

  if (m === "GET" && p === "me") return json(res, 200, { ...authPayload(user, auth.token), token: auth.token });
  if (m === "GET" && p === "rev") return json(res, 200, { rev: db.rev });
  if (m === "GET" && p === "db") return json(res, 200, { rev: db.rev, db: view(user) });

  if (m === "PUT" && p === "db") {
    const b = await readJson(req);
    const changed = applyDelta(user, isObj(b.delta) ? b.delta : {}, isObj(b.deletes) ? b.deletes : {});
    if (changed) bump();
    return json(res, 200, { rev: db.rev, db: view(user) });
  }

  if (m === "POST" && p === "auth/change-password") {
    const b = await readJson(req, 1e5);
    if (!checkPw(String(b.current || ""), user.passHash)) return json(res, 400, { error: "رمز فعلی درست نیست" });
    const next = String(b.next || "");
    if (next.length < 4) return json(res, 400, { error: "رمز جدید حداقل ۴ کاراکتر باشد" });
    user.passHash = hashPw(next);
    for (const [k, s] of Object.entries(db.sessions)) if (s.userId === user.id && k !== auth.key) delete db.sessions[k];
    bump();
    return json(res, 200, { ok: true });
  }

  if (m === "POST" && p === "join") {
    if (user.role !== "student") return json(res, 403, { error: "فقط شاگرد می‌تواند به مربی وصل شود" });
    const b = await readJson(req, 1e5);
    const code = String(b.code || "").trim().toUpperCase();
    const coach = db.users.find((u) => u.role === "coach" && u.inviteCode === code);
    if (!coach) return json(res, 400, { error: "کد مربی نامعتبر است" });
    const st = db.students.find((s) => s.userId === user.id);
    if (!st) return json(res, 400, { error: "پروفایل شاگرد پیدا نشد" });
    st.coachId = coach.id;
    db.notifs.unshift({
      id: uid("n"), to: "coach", coachId: coach.id, studentId: st.id, title: "شاگرد جدید",
      body: `${user.name} با کد دعوت به شما وصل شد.`, time: nowIso(), read: false, type: "success",
    });
    bump();
    return json(res, 200, { rev: db.rev, db: view(user) });
  }

  if (m === "POST" && p === "students") {
    if (user.role !== "coach" && user.role !== "admin") return json(res, 403, { error: "دسترسی نداری" });
    const b = await readJson(req, 3e6);
    const name = str(b.name, 80).trim();
    const email = norm(b.email);
    const password = String(b.password || "1234");
    if (!name) return json(res, 400, { error: "نام لازم است" });
    if (!EMAIL_RE.test(email)) return json(res, 400, { error: "ایمیل شاگرد معتبر نیست" });
    if (password.length < 4) return json(res, 400, { error: "رمز حداقل ۴ کاراکتر باشد" });
    if (emailTaken(email)) return json(res, 409, { error: "این ایمیل قبلاً ثبت شده" });
    const u = createUser({ name, email, password, role: "student", phone: b.phone });
    db.students.push(newStudentRecord(u.id, user.id, b));
    bump();
    return json(res, 200, { rev: db.rev, db: view(user) });
  }

  return json(res, 404, { error: "مسیر پیدا نشد" });
}

/* ------------------------------------------------------------------ */
/* static files (اپ ساخته‌شده)                                            */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8",
};

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end();
  }
  let rel = "/";
  try { rel = decodeURIComponent(pathname); } catch { /* ignore */ }
  let file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("اپ ساخته نشده است. اول دستور npm run build را اجرا کن.");
  }
  const ext = path.extname(file).toLowerCase();
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
    "Content-Length": fs.statSync(file).size,
  };
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ */
/* server                                                                */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  try {
    if (CORS_ORIGIN) {
      res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,HEAD,OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
    }
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) json(res, status, { error: status === 500 ? "خطای داخلی سرور" : e.message });
    else res.end();
  }
});
server.requestTimeout = 0; // آپلود ویدیوهای حجیم
server.listen(PORT, HOST, () => {
  console.log(`\n  Revo sport server روی http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`  دیتابیس: ${DB_FILE}`);
  console.log(`  کاربران فعلی: ${db.users.length}`);
  if (!fs.existsSync(path.join(DIST, "index.html"))) console.log("  ⚠ پوشه dist پیدا نشد؛ اول npm run build را اجرا کن.");
  if (ADMIN_EMAIL) console.log(`  ادمین: ${ADMIN_EMAIL}`);
  console.log("");
});

function shutdown() {
  if (saveTimer) clearTimeout(saveTimer);
  saveNow();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
