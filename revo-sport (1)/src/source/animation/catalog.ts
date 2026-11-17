import type { Equip, HandFrame, MuscleKey, Pose, Prop, V3, View } from "./rig";

/* =====================================================================
   Exercise motion catalog. Keyframes are authored in meters/degrees
   against a 1.78 m reference athlete. Every definition encodes the
   start position, peak position and the path between them.
   ===================================================================== */

export type JointKey = "shoulder" | "scapula" | "elbow" | "wrist" | "spine" | "hip" | "knee" | "ankle";
export type CategoryKey = "chest" | "back" | "shoulders" | "arms" | "legs" | "glutes" | "core" | "fullBody";
export type EquipKey = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell" | "band";

export interface Key { p: Pose; t: number; hold?: number; e: number; pass?: boolean }
export interface Info { start: string; con: string; ecc: string; rom: string; mistakes: string[] }

export interface ExerciseDef {
  id: string;
  fa: string;
  en: string;
  aliases: string[];
  libId?: string;
  category: CategoryKey;
  equipKey: EquipKey;
  equip: Equip;
  props?: Prop[];
  frame?: HandFrame;
  keys: Key[];
  reps?: number;
  mirrorRep?: boolean;
  isometric?: boolean;
  view: View;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  joints: JointKey[];
  info: { fa: Info; en: Info };
}

/* ---------------- dictionaries ---------------- */

export const MUSCLE_LABEL: Record<MuscleKey, [string, string]> = {
  chest: ["سینه", "Chest"], upperChest: ["بالاسینه", "Upper chest"], lats: ["زیربغل (لت)", "Lats"], upperBack: ["پشت بالا و رومبوئید", "Upper back & rhomboids"],
  traps: ["ذوزنقه", "Trapezius"], frontDelts: ["سرشانه جلو", "Front delts"], sideDelts: ["سرشانه میانی", "Side delts"], rearDelts: ["سرشانه پشت", "Rear delts"],
  biceps: ["جلو بازو", "Biceps"], brachialis: ["بازویی و براکیورادیالیس", "Brachialis"], forearms: ["ساعد", "Forearms"], triceps: ["پشت بازو", "Triceps"],
  quads: ["چهارسر ران", "Quadriceps"], hamstrings: ["همسترینگ", "Hamstrings"], glutes: ["سرینی (باسن)", "Glutes"], calves: ["ساق پا", "Calves"],
  abs: ["عضلات شکم", "Abs"], obliques: ["مورب‌های شکم", "Obliques"], lowerBack: ["فیله کمر", "Lower back"], hipFlexors: ["خم‌کننده‌های ران", "Hip flexors"], adductors: ["نزدیک‌کننده‌های ران", "Adductors"],
};

export const EQUIP_LABEL: Record<EquipKey, [string, string]> = {
  barbell: ["هالتر", "Barbell"], dumbbell: ["دمبل", "Dumbbell"], machine: ["دستگاه", "Machine"], cable: ["کابل (سیم‌کش)", "Cable"],
  bodyweight: ["وزن بدن", "Bodyweight"], kettlebell: ["کتل‌بل", "Kettlebell"], band: ["کش مقاومتی", "Resistance band"],
};

export const JOINT_LABEL: Record<JointKey, [string, string]> = {
  shoulder: ["مفصل شانه", "Shoulder"], scapula: ["کتف", "Scapula"], elbow: ["آرنج", "Elbow"], wrist: ["مچ دست", "Wrist"],
  spine: ["ستون فقرات", "Spine"], hip: ["مفصل ران", "Hip"], knee: ["زانو", "Knee"], ankle: ["مچ پا", "Ankle"],
};

export const CATEGORY_LABEL: Record<CategoryKey, [string, string]> = {
  chest: ["سینه", "Chest"], back: ["پشت", "Back"], shoulders: ["سرشانه", "Shoulders"], arms: ["بازو", "Arms"],
  legs: ["پا", "Legs"], glutes: ["باسن", "Glutes"], core: ["شکم و مرکز بدن", "Core"], fullBody: ["تمام بدن", "Full body"],
};

export const VIEW_LABEL: Record<View, [string, string]> = {
  side: ["نمای جانبی", "Side view"], front: ["نمای روبه‌رو", "Front view"], threeQuarter: ["نمای سه‌رخ", "Three-quarter view"], rear: ["نمای پشت", "Rear view"],
};

export const VIEW_REASON: Record<View, [string, string]> = {
  side: ["بهترین زاویه برای دیدن خم شدن مفصل ران و زانو، مسیر وزنه و صاف ماندن ستون فقرات.", "Best for hip and knee angles, bar path and a neutral spine."],
  front: ["بهترین زاویه برای حرکات در صفحه جانبی و کنترل تقارن دو طرف بدن.", "Best for movements in the frontal plane and left–right symmetry."],
  threeQuarter: ["عمق حرکت و عرض دست‌ها را هم‌زمان نشان می‌دهد.", "Shows depth and grip width at the same time."],
  rear: ["حرکت کتف‌ها و عضلات پشت را به‌وضوح نشان می‌دهد.", "Clearly shows scapular movement and the back muscles."],
};

/* ---------------- pose helpers ---------------- */

const STAND: Pose = { pelvis: [0, 0.99, 0], pitch: 0, hl: [0.24, 0.88, 0.03], elbow: [0.3, 0, -1], fl: [0.14, 0.07, 0.02], knee: [0.12, 0, 1] };
const st = (o: Partial<Pose>): Pose => ({ ...STAND, ...o });
const SUPINE: Pose = { pelvis: [0, 0.11, 0.05], pitch: -90, hl: [0.26, 0.04, 0.05], elbow: [0.2, 1, 0], fl: [0.13, 0.07, 0.45], knee: [0.15, 1, 0.3] };
const sup = (o: Partial<Pose>): Pose => ({ ...SUPINE, ...o });
const BENCH_BODY: Partial<Pose> = { pelvis: [0, 0.56, 0.22], pitch: -90, fl: [0.3, 0.07, 0.6], knee: [0.4, 1, 0.3] };

/** Ankle position that keeps the ball of the foot on a point while the foot pitches. */
function ankleFromBall(ball: V3, pitch: number): V3 {
  const r = (pitch * Math.PI) / 180;
  const y = -0.075 * Math.cos(r) - 0.13 * Math.sin(r);
  const z = -0.075 * Math.sin(r) + 0.13 * Math.cos(r);
  return [ball[0], ball[1] - y, ball[2] - z];
}

const FLAT_BENCH: Prop[] = [
  { kind: "box", pos: [0, 0.22, 0.02], size: [0.3, 0.44, 1.2], tone: "pad" },
  { kind: "box", pos: [0, 0.03, 0.02], size: [0.5, 0.06, 1.0], tone: "frame" },
];
const MAT: Prop[] = [{ kind: "mat", pos: [0, 0, 0], size: [0.75, 1.95] }];

/* ---------------- shared movement templates ---------------- */

function curlKeys(x: number, hold = 0.4): Key[] {
  return [
    { p: st({ hl: [x, 0.885, 0.03], elbow: [0, -0.1, -1] }), t: 0.9, hold: 0.3, e: 0.15 },
    { p: st({ hl: [x, 1.155, 0.27], elbow: [0, -0.1, -1] }), t: 0.55, e: 0.7, pass: true },
    { p: st({ hl: [x, 1.36, 0.17], elbow: [0, -0.1, -1] }), t: 0.55, hold, e: 1 },
    { p: st({ hl: [x, 1.155, 0.27], elbow: [0, -0.1, -1] }), t: 0.95, e: 0.7, pass: true },
  ];
}

/* =====================================================================
   Catalog
   ===================================================================== */

export const CATALOG: ExerciseDef[] = [
  /* ------------------------------- LEGS ------------------------------- */
  {
    id: "back_squat", libId: "ex-squat", fa: "اسکوات هالتر از پشت", en: "Barbell Back Squat",
    aliases: ["اسکوات هالتر", "اسکوات", "اسکات", "back squat", "squat", "barbell squat"],
    category: "legs", equipKey: "barbell", equip: { kind: "barbell" }, frame: "chest", view: "threeQuarter",
    keys: [
      { p: st({ pitch: 4, hl: [0.42, -0.02, -0.085], elbow: [0.3, -1, -0.4], fl: [0.17, 0.07, 0.02], knee: [0.28, 0, 1] }), t: 1.4, hold: 0.5, e: 0.2 },
      { p: st({ pelvis: [0, 0.56, -0.27], pitch: 38, head: -15, hl: [0.42, -0.02, -0.085], elbow: [0.3, -1, -0.4], fl: [0.17, 0.07, 0.02], knee: [0.32, 0, 1] }), t: 2.0, hold: 0.35, e: 1 },
    ],
    primary: ["quads", "glutes"], secondary: ["hamstrings", "adductors", "lowerBack", "abs"], joints: ["hip", "knee", "ankle", "spine"],
    info: {
      fa: { start: "ایستاده، پاها کمی بازتر از عرض شانه، هالتر روی عضله ذوزنقه و آرنج‌ها رو به پایین.", con: "با فشار کف پا، زانو و لگن را هم‌زمان باز کنید و به حالت ایستاده برگردید.", ecc: "لگن را به عقب و پایین ببرید و زانوها را در راستای پنجه پا خم کنید.", rom: "تا جایی که ران موازی زمین یا کمی پایین‌تر شود، بدون گرد شدن کمر.", mistakes: ["جمع شدن زانوها به داخل", "بلند شدن پاشنه‌ها و گرد شدن کمر"] },
      en: { start: "Stand with feet slightly wider than shoulders, bar on the upper traps, elbows down.", con: "Drive through the whole foot, extending hips and knees together.", ecc: "Sit the hips back and down while the knees track over the toes.", rom: "Thighs to parallel or slightly below without rounding the lower back.", mistakes: ["Knees caving inward", "Heels lifting or lower back rounding"] },
    },
  },
  {
    id: "goblet_squat", fa: "اسکوات گابلت", en: "Goblet Squat", aliases: ["گابلت اسکوات", "اسکوات دمبل", "goblet squat", "dumbbell squat"],
    category: "legs", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "along", single: "mid" }, frame: "chest", view: "side",
    keys: [
      { p: st({ pitch: 2, hl: [0.05, -0.2, 0.2], elbow: [0.4, -1, 0.3], fl: [0.19, 0.07, 0.04], knee: [0.35, 0, 1] }), t: 1.3, hold: 0.45, e: 0.2 },
      { p: st({ pelvis: [0, 0.5, -0.17], pitch: 22, head: -6, hl: [0.05, -0.2, 0.2], elbow: [0.4, -1, 0.3], fl: [0.19, 0.07, 0.04], knee: [0.38, 0, 1] }), t: 1.9, hold: 0.35, e: 1 },
    ],
    primary: ["quads", "glutes"], secondary: ["adductors", "abs", "upperBack"], joints: ["hip", "knee", "ankle"],
    info: {
      fa: { start: "دمبل را عمودی جلوی سینه نگه دارید و آرنج‌ها رو به پایین باشد.", con: "از کف پا فشار دهید و با تنه صاف بالا بیایید.", ecc: "با تنه نسبتاً عمودی بین دو پا پایین بروید.", rom: "تا عمق کامل، به‌طوری که آرنج‌ها بین زانوها قرار گیرند.", mistakes: ["خم شدن بیش از حد تنه به جلو", "بلند شدن پاشنه‌ها"] },
      en: { start: "Hold the dumbbell vertically against the chest, elbows pointing down.", con: "Drive through the feet and stand tall with an upright torso.", ecc: "Sit down between the feet keeping the torso upright.", rom: "Full depth with the elbows tracking inside the knees.", mistakes: ["Leaning the torso too far forward", "Heels lifting off the floor"] },
    },
  },
  {
    id: "romanian_deadlift", libId: "ex-rdl", fa: "ددلیفت رومانیایی", en: "Romanian Deadlift", aliases: ["ددلیفت رومانی", "rdl", "romanian deadlift", "رومانیایی"],
    category: "legs", equipKey: "barbell", equip: { kind: "barbell" }, view: "threeQuarter",
    keys: [
      { p: st({ pitch: 3, hl: [0.22, 0.8, 0.1], elbow: [0.3, 0, -1], fl: [0.13, 0.07, 0.02], knee: [0.15, 0, 1] }), t: 1.4, hold: 0.45, e: 0.2 },
      { p: st({ pelvis: [0, 0.82, -0.36], pitch: 70, head: -22, hl: [0.22, 0.38, 0.1], elbow: [0.3, 0, -1], fl: [0.13, 0.07, 0.02], knee: [0.15, 0, 1] }), t: 2.1, hold: 0.35, e: 1 },
    ],
    primary: ["hamstrings", "glutes"], secondary: ["lowerBack", "forearms", "upperBack"], joints: ["hip", "knee", "spine"],
    info: {
      fa: { start: "ایستاده با هالتر جلوی ران‌ها، زانوها کمی خم و شانه‌ها عقب.", con: "لگن را به جلو برانید و با انقباض باسن صاف بایستید.", ecc: "لگن را به عقب ببرید و هالتر را نزدیک پاها تا وسط ساق پایین بیاورید.", rom: "تا جایی که همسترینگ کشیده شود و کمر صاف بماند.", mistakes: ["گرد شدن کمر", "دور شدن هالتر از پاها"] },
      en: { start: "Stand holding the bar against the thighs, soft knees, shoulders back.", con: "Drive the hips forward and squeeze the glutes to stand tall.", ecc: "Push the hips back, sliding the bar down the legs to mid-shin.", rom: "Until the hamstrings are stretched while the back stays flat.", mistakes: ["Rounding the lower back", "Letting the bar drift away from the legs"] },
    },
  },
  {
    id: "deadlift", fa: "ددلیفت کلاسیک", en: "Conventional Deadlift", aliases: ["ددلیفت", "deadlift", "conventional deadlift"],
    category: "legs", equipKey: "barbell", equip: { kind: "barbell" }, view: "threeQuarter",
    keys: [
      { p: st({ pelvis: [0, 0.62, -0.3], pitch: 58, head: -30, hl: [0.24, 0.175, 0.105], elbow: [0.3, 0, -1], fl: [0.14, 0.07, 0.04], knee: [0.45, 0, 1] }), t: 1.0, hold: 0.45, e: 0.3 },
      { p: st({ pelvis: [0, 0.72, -0.2], pitch: 40, head: -20, hl: [0.24, 0.5, 0.11], elbow: [0.3, 0, -1], fl: [0.14, 0.07, 0.04], knee: [0.45, 0, 1] }), t: 0.7, e: 0.9, pass: true },
      { p: st({ pitch: 2, hl: [0.24, 0.8, 0.1], elbow: [0.3, 0, -1], fl: [0.14, 0.07, 0.04], knee: [0.2, 0, 1] }), t: 0.7, hold: 0.45, e: 1 },
      { p: st({ pelvis: [0, 0.72, -0.2], pitch: 40, head: -20, hl: [0.24, 0.5, 0.11], elbow: [0.3, 0, -1], fl: [0.14, 0.07, 0.04], knee: [0.45, 0, 1] }), t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["glutes", "hamstrings", "lowerBack"], secondary: ["quads", "traps", "forearms", "lats"], joints: ["hip", "knee", "spine", "ankle"],
    info: {
      fa: { start: "هالتر روی زمین بالای وسط پا، ساق‌ها نزدیک میله، کمر صاف و سینه رو به جلو.", con: "پاها را به زمین فشار دهید و هالتر را نزدیک بدن تا ایستادن کامل بالا بکشید.", ecc: "ابتدا لگن را به عقب ببرید، سپس با عبور از زانو هالتر را روی زمین بگذارید.", rom: "از زمین تا ایستادن کامل با باز شدن کامل لگن.", mistakes: ["گرد شدن کمر در شروع حرکت", "بالا آمدن زودتر لگن نسبت به شانه‌ها"] },
      en: { start: "Bar over mid-foot, shins close, flat back and chest up.", con: "Push the floor away and drag the bar up the legs to full lockout.", ecc: "Hinge the hips back first, then bend the knees once the bar passes them.", rom: "From the floor to full hip extension.", mistakes: ["Rounding the back off the floor", "Hips shooting up before the shoulders"] },
    },
  },
  {
    id: "dumbbell_lunge", libId: "ex-lunge", fa: "لانج دمبل", en: "Dumbbell Lunge", aliases: ["لانج", "lunge", "forward lunge", "لانج جلو"],
    category: "legs", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "z" }, frame: "chest", view: "side", mirrorRep: true,
    keys: [
      { p: st({ hl: [0.25, -0.57, 0.03], elbow: [0.2, 0, -1], fl: [0.12, 0.07, 0] }), t: 0.55, hold: 0.35, e: 0.15 },
      { p: st({ pelvis: [0, 0.93, 0.12], hl: [0.25, -0.57, 0.03], elbow: [0.2, 0, -1], fl: [0.12, 0.2, 0.36], fr: [-0.12, 0.08, 0], fpr: 10 }), t: 0.55, e: 0.5, pass: true },
      { p: st({ pelvis: [0, 0.53, 0.33], pitch: 4, hl: [0.25, -0.57, 0.03], elbow: [0.2, 0, -1], fl: [0.13, 0.07, 0.7], fr: [-0.12, 0.14, -0.02], fpr: 40 }), t: 0.75, hold: 0.3, e: 1 },
      { p: st({ pelvis: [0, 0.93, 0.12], hl: [0.25, -0.57, 0.03], elbow: [0.2, 0, -1], fl: [0.12, 0.2, 0.36], fr: [-0.12, 0.08, 0], fpr: 10 }), t: 0.7, e: 0.6, pass: true },
    ],
    primary: ["quads", "glutes"], secondary: ["hamstrings", "adductors", "calves"], joints: ["hip", "knee", "ankle"],
    info: {
      fa: { start: "ایستاده با دمبل‌ها در کنار بدن و پاها به عرض لگن.", con: "از پاشنه پای جلو فشار دهید و به حالت ایستاده برگردید.", ecc: "یک گام بلند به جلو بردارید و هر دو زانو را خم کنید.", rom: "تا زاویه حدود 90 درجه در هر دو زانو؛ زانوی عقب نزدیک زمین.", mistakes: ["جلو رفتن زیاد زانوی جلو از پنجه پا", "خم شدن تنه به جلو"] },
      en: { start: "Stand tall, dumbbells at the sides, feet hip-width apart.", con: "Push through the front heel and return to standing.", ecc: "Take a long step forward and bend both knees.", rom: "About 90° at both knees with the rear knee near the floor.", mistakes: ["Front knee travelling far past the toes", "Leaning the torso forward"] },
    },
  },
  {
    id: "leg_extension", fa: "جلو پا دستگاه", en: "Leg Extension", aliases: ["جلوپا", "جلو ران دستگاه", "leg extension"],
    category: "legs", equipKey: "machine", equip: { kind: "none" }, view: "side",
    props: [
      { kind: "box", pos: [0, 0.26, 0.05], size: [0.42, 0.52, 0.48], tone: "pad" },
      { kind: "box", pos: [0, 0.86, -0.26], size: [0.42, 0.7, 0.08], rot: [-10, 0, 0], tone: "pad" },
      { kind: "bar", a: [0.27, 0.58, 0.46], b: [0.27, 0.1, 0.4], r: 0.03 },
      { kind: "bar", a: [-0.27, 0.58, 0.46], b: [-0.27, 0.1, 0.4], r: 0.03 },
      { kind: "jointPad", joint: "ankle", offset: [0, 0.0, 0.07], pivot: [0, 0.58, 0.46] },
    ],
    keys: [
      { p: { pelvis: [0, 0.62, 0], pitch: -10, hl: [0.27, 0.56, 0.08], elbow: [0.5, 0, -1], fl: [0.12, 0.15, 0.42], knee: [0.05, 1, 0.2] }, t: 1.7, hold: 0.3, e: 0.15 },
      { p: { pelvis: [0, 0.62, 0], pitch: -10, hl: [0.27, 0.56, 0.08], elbow: [0.5, 0, -1], fl: [0.12, 0.27, 0.76], knee: [0.05, 1, 0.2], fpl: -10 }, t: 0.55, e: 0.6, pass: true },
      { p: { pelvis: [0, 0.62, 0], pitch: -10, hl: [0.27, 0.56, 0.08], elbow: [0.5, 0, -1], fl: [0.12, 0.58, 0.88], knee: [0.05, 1, 0.2], fpl: -15 }, t: 0.5, hold: 0.5, e: 1 },
      { p: { pelvis: [0, 0.62, 0], pitch: -10, hl: [0.27, 0.56, 0.08], elbow: [0.5, 0, -1], fl: [0.12, 0.27, 0.76], knee: [0.05, 1, 0.2], fpl: -10 }, t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["quads"], secondary: [], joints: ["knee"],
    info: {
      fa: { start: "نشسته، پشت به تکیه‌گاه، محور دستگاه هم‌راستای زانو و پد روی مچ پا.", con: "زانوها را تا صاف شدن کامل باز کنید و چهارسر را منقبض نگه دارید.", ecc: "به‌آرامی وزنه را تا زاویه حدود 90 درجه پایین بیاورید.", rom: "از حدود 90 درجه خم تا صاف شدن کامل زانو.", mistakes: ["بلند شدن لگن از صندلی", "پرتاب کردن وزنه با ضربه"] },
      en: { start: "Seated, back on the pad, knee aligned with the machine axis, pad on the ankles.", con: "Extend the knees fully and squeeze the quads.", ecc: "Lower slowly back to about 90°.", rom: "From roughly 90° of knee flexion to full extension.", mistakes: ["Hips lifting off the seat", "Kicking the weight up with momentum"] },
    },
  },
  {
    id: "lying_leg_curl", fa: "پشت پا خوابیده دستگاه", en: "Lying Leg Curl", aliases: ["پشت پا دستگاه", "پشت ران خوابیده", "leg curl", "lying leg curl"],
    category: "legs", equipKey: "machine", equip: { kind: "none" }, view: "side",
    props: [
      { kind: "box", pos: [0, 0.31, 0.12], size: [0.34, 0.62, 1.15], tone: "pad" },
      { kind: "jointPad", joint: "ankle", offset: [0, 0.06, -0.02], pivot: [0, 0.68, -0.47] },
    ],
    keys: [
      { p: { pelvis: [0, 0.74, 0.02], pitch: 86, head: -18, hl: [0.2, 0.6, 0.66], elbow: [0.4, -1, 0], fl: [0.11, 0.7, -0.89], knee: [0, -1, 0], fpl: -10 }, t: 1.8, hold: 0.3, e: 0.15 },
      { p: { pelvis: [0, 0.74, 0.02], pitch: 86, head: -18, hl: [0.2, 0.6, 0.66], elbow: [0.4, -1, 0], fl: [0.11, 1.07, -0.67], knee: [0, -1, 0], fpl: -10 }, t: 0.55, e: 0.6, pass: true },
      { p: { pelvis: [0, 0.74, 0.02], pitch: 86, head: -18, hl: [0.2, 0.6, 0.66], elbow: [0.4, -1, 0], fl: [0.11, 1.11, -0.3], knee: [0, -1, 0], fpl: -10 }, t: 0.55, hold: 0.45, e: 1 },
      { p: { pelvis: [0, 0.74, 0.02], pitch: 86, head: -18, hl: [0.2, 0.6, 0.66], elbow: [0.4, -1, 0], fl: [0.11, 1.07, -0.67], knee: [0, -1, 0], fpl: -10 }, t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["hamstrings"], secondary: ["calves"], joints: ["knee"],
    info: {
      fa: { start: "روی شکم بخوابید، زانوها کمی بیرون از لبه صندلی و پد پشت مچ پا.", con: "پاشنه‌ها را به سمت باسن بکشید و همسترینگ را منقبض کنید.", ecc: "به‌آرامی پاها را تا صاف شدن نسبی پایین بیاورید.", rom: "از زانوی تقریباً صاف تا خم شدن حدود 110 درجه.", mistakes: ["بلند شدن لگن از نیمکت", "استفاده از حرکت ضربه‌ای"] },
      en: { start: "Lie face down, knees just off the bench edge, pad behind the ankles.", con: "Curl the heels toward the glutes and squeeze the hamstrings.", ecc: "Lower slowly until the knees are almost straight.", rom: "From near-straight knees to roughly 110° of flexion.", mistakes: ["Hips lifting off the bench", "Swinging the weight"] },
    },
  },
  {
    id: "standing_calf_raise", libId: "ex-calf", fa: "ساق پا ایستاده", en: "Standing Calf Raise", aliases: ["ساق ایستاده", "ساق پا", "calf raise", "standing calf raise"],
    category: "legs", equipKey: "machine", equip: { kind: "none" }, frame: "chest", view: "threeQuarter",
    props: [
      { kind: "box", pos: [0, 0.05, 0.1], size: [0.52, 0.1, 0.22], tone: "frame" },
      { kind: "bar", a: [0.42, 0, -0.18], b: [0.42, 1.95, -0.18], r: 0.03 },
      { kind: "bar", a: [-0.42, 0, -0.18], b: [-0.42, 1.95, -0.18], r: 0.03 },
      { kind: "bar", a: [-0.42, 1.95, -0.18], b: [0.42, 1.95, -0.18], r: 0.03 },
      { kind: "yoke", offset: [0, 0.03, -0.02], size: [0.62, 0.07, 0.17] },
    ],
    keys: (() => {
      const low = ankleFromBall([0.12, 0.1, 0.12], -15);
      const high = ankleFromBall([0.12, 0.1, 0.12], 32);
      const body = (a: V3, pitch: number, e: number, t: number, hold: number): Key => ({
        p: { pelvis: [0, a[1] + 0.915, a[2]], pitch: 0, hl: [0.27, 0.05, 0.1], elbow: [0.6, -1, -0.3], fl: a, knee: [0.1, 0, 1], fpl: pitch },
        t, hold, e,
      });
      return [body(low, -15, 0.2, 1.4, 0.35), body(high, 32, 1, 0.9, 0.5)];
    })(),
    primary: ["calves"], secondary: [], joints: ["ankle"],
    info: {
      fa: { start: "سینه پا روی لبه سکو، پاشنه‌ها آزاد و پدهای دستگاه روی شانه‌ها.", con: "روی پنجه بلند شوید و در بالاترین نقطه ساق را منقبض کنید.", ecc: "پاشنه‌ها را آرام پایین‌تر از سطح سکو ببرید تا ساق کشیده شود.", rom: "از کشش کامل ساق تا بالاترین ارتفاع ممکن روی پنجه.", mistakes: ["خم و باز کردن زانوها", "دامنه حرکتی کوتاه و سریع"] },
      en: { start: "Balls of the feet on the step edge, heels free, pads on the shoulders.", con: "Rise onto the toes and squeeze the calves at the top.", ecc: "Lower the heels slowly below the step for a full stretch.", rom: "From a full calf stretch to maximum height on the toes.", mistakes: ["Bending the knees to bounce", "Short, rushed repetitions"] },
    },
  },

  /* ------------------------------- GLUTES ------------------------------- */
  {
    id: "hip_thrust", libId: "ex-hip", fa: "هیپ تراست هالتر", en: "Barbell Hip Thrust", aliases: ["هیپ‌تراست", "هیپ تراست", "hip thrust", "barbell hip thrust"],
    category: "glutes", equipKey: "barbell", equip: { kind: "barbell" }, frame: "pelvis", view: "threeQuarter",
    props: [{ kind: "box", pos: [0, 0.25, -0.53], size: [1.1, 0.5, 0.3], tone: "pad" }],
    keys: [
      { p: { pelvis: [0, 0.33, -0.02], pitch: -50, head: 25, hl: [0.33, 0.06, 0.14], elbow: [0.8, 0.6, -0.2], fl: [0.17, 0.07, 0.43], knee: [0.15, 0.6, 1] }, t: 1.6, hold: 0.35, e: 0.2 },
      { p: { pelvis: [0, 0.62, 0.1], pitch: -88, head: 35, hl: [0.33, 0.06, 0.14], elbow: [0.8, 0.6, -0.2], fl: [0.17, 0.07, 0.43], knee: [0.15, 0.6, 1] }, t: 1.1, hold: 0.6, e: 1 },
    ],
    primary: ["glutes"], secondary: ["hamstrings", "quads", "abs"], joints: ["hip", "knee"],
    info: {
      fa: { start: "بالای کمر روی لبه نیمکت، هالتر روی چین ران و کف پاها روی زمین.", con: "با فشار پاشنه‌ها لگن را تا هم‌راستا شدن تنه و ران بالا ببرید.", ecc: "لگن را کنترل‌شده تا نزدیک زمین پایین بیاورید.", rom: "تا جایی که در بالا ساق عمود بر زمین و تنه موازی زمین باشد.", mistakes: ["قوس دادن بیش از حد کمر در بالا", "فشار آوردن از پنجه به‌جای پاشنه"] },
      en: { start: "Upper back on the bench edge, bar in the hip crease, feet flat.", con: "Drive through the heels until the torso and thighs form a straight line.", ecc: "Lower the hips under control toward the floor.", rom: "Until shins are vertical and the torso is parallel to the floor at the top.", mistakes: ["Over-arching the lower back at the top", "Pushing through the toes instead of the heels"] },
    },
  },
  {
    id: "glute_bridge", fa: "پل باسن", en: "Glute Bridge", aliases: ["پل", "بریج", "glute bridge", "bridge"],
    category: "glutes", equipKey: "bodyweight", equip: { kind: "none" }, view: "side", props: MAT,
    keys: [
      { p: sup({ pelvis: [0, 0.12, 0.03], hl: [0.27, 0.04, -0.02], fl: [0.15, 0.07, 0.38] }), t: 1.5, hold: 0.35, e: 0.2 },
      { p: sup({ pelvis: [0, 0.45, -0.087], pitch: -130, head: 40, hl: [0.27, 0.04, -0.02], fl: [0.15, 0.07, 0.38] }), t: 1.0, hold: 0.6, e: 1 },
    ],
    primary: ["glutes"], secondary: ["hamstrings", "abs"], joints: ["hip"],
    info: {
      fa: { start: "به پشت بخوابید، زانوها خم و کف پاها نزدیک باسن روی زمین.", con: "باسن را منقبض کنید و لگن را تا یک خط صاف از شانه تا زانو بالا ببرید.", ecc: "لگن را آرام روی زمین برگردانید.", rom: "تا هم‌راستا شدن شانه، لگن و زانو.", mistakes: ["قوس دادن کمر به‌جای انقباض باسن", "باز شدن زانوها به طرفین"] },
      en: { start: "Lie on your back, knees bent, feet flat near the glutes.", con: "Squeeze the glutes and lift the hips into a straight shoulder-to-knee line.", ecc: "Lower the hips slowly back to the floor.", rom: "Until shoulders, hips and knees are aligned.", mistakes: ["Arching the back instead of using the glutes", "Knees falling outward"] },
    },
  },

  /* ------------------------------- CHEST ------------------------------- */
  {
    id: "barbell_bench_press", libId: "ex-bench", fa: "پرس سینه هالتر", en: "Barbell Bench Press", aliases: ["پرس سینه", "پرس سینه تخت", "bench press", "barbell bench press", "flat bench"],
    category: "chest", equipKey: "barbell", equip: { kind: "barbell" }, view: "threeQuarter",
    props: [
      ...FLAT_BENCH,
    ],
    keys: [
      { p: { ...BENCH_BODY, hl: [0.4, 1.07, -0.21], elbow: [1, -0.8, 0.25] } as Pose, t: 1.2, hold: 0.4, e: 0.25 },
      { p: { ...BENCH_BODY, hl: [0.4, 0.71, -0.15], elbow: [1, -0.8, 0.25] } as Pose, t: 1.8, hold: 0.3, e: 1 },
    ],
    primary: ["chest"], secondary: ["frontDelts", "triceps"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "روی نیمکت بخوابید، کتف‌ها جمع، کف پاها روی زمین و هالتر بالای شانه‌ها با دست‌های صاف.", con: "هالتر را با فشار سینه به بالا و کمی به سمت شانه‌ها برانید.", ecc: "هالتر را کنترل‌شده تا پایین سینه پایین بیاورید.", rom: "از تماس سبک با پایین سینه تا صاف شدن دست‌ها بدون قفل کامل آرنج.", mistakes: ["باز شدن زیاد آرنج‌ها به طرفین", "کوبیدن هالتر روی سینه"] },
      en: { start: "Lie on the bench, shoulder blades retracted, feet flat, bar over the shoulders with straight arms.", con: "Press the bar up and slightly back toward the shoulders.", ecc: "Lower the bar under control to the lower chest.", rom: "From a light touch on the lower chest to straight arms.", mistakes: ["Flaring the elbows too wide", "Bouncing the bar off the chest"] },
    },
  },
  {
    id: "incline_dumbbell_press", libId: "ex-incline-db", fa: "پرس بالا سینه دمبل", en: "Incline Dumbbell Press", aliases: ["پرس بالاسینه دمبل", "بالا سینه دمبل", "incline dumbbell press", "incline press"],
    category: "chest", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "x" }, view: "threeQuarter",
    props: [
      { kind: "box", pos: [0, 0.245, 0.2], size: [0.32, 0.49, 0.42], tone: "pad" },
      { kind: "box", pos: [0, 0.63, -0.17], size: [0.3, 0.07, 0.95], rot: [-145, 0, 0], tone: "pad" },
      { kind: "bar", a: [0, 0.02, -0.55], b: [0, 0.02, 0.45], r: 0.03 },
    ],
    keys: [
      { p: { pelvis: [0, 0.6, 0.12], pitch: -55, head: 8, hl: [0.16, 1.4, -0.17], elbow: [1, -1, -0.1], fl: [0.25, 0.07, 0.62], knee: [0.3, 0.5, 1] }, t: 1.2, hold: 0.4, e: 0.25 },
      { p: { pelvis: [0, 0.6, 0.12], pitch: -55, head: 8, hl: [0.37, 0.98, -0.12], elbow: [1, -1, -0.1], fl: [0.25, 0.07, 0.62], knee: [0.3, 0.5, 1] }, t: 1.8, hold: 0.3, e: 1 },
    ],
    primary: ["upperChest"], secondary: ["frontDelts", "triceps"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "روی نیمکت شیب‌دار 30 تا 45 درجه، دمبل‌ها بالای بالاسینه با دست‌های صاف.", con: "دمبل‌ها را رو به بالا و کمی به داخل پرس کنید.", ecc: "دمبل‌ها را با آرنج‌های حدود 45 درجه تا کنار بالاسینه پایین بیاورید.", rom: "از کشش کامل سینه تا صاف شدن دست‌ها.", mistakes: ["بلند شدن لگن از نیمکت", "پایین آوردن ناکافی دمبل‌ها"] },
      en: { start: "Incline bench at 30–45°, dumbbells over the upper chest with straight arms.", con: "Press up and slightly inward.", ecc: "Lower with elbows at about 45° to the sides of the upper chest.", rom: "From a full chest stretch to straight arms.", mistakes: ["Hips lifting off the bench", "Partial range of motion"] },
    },
  },
  {
    id: "dumbbell_fly", fa: "قفسه سینه دمبل", en: "Dumbbell Chest Fly", aliases: ["قفسه سینه", "فلای دمبل", "dumbbell fly", "chest fly"],
    category: "chest", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "z" }, view: "threeQuarter", props: FLAT_BENCH,
    keys: [
      { p: { ...BENCH_BODY, hl: [0.15, 1.07, -0.24], elbow: [0.6, -1, 0] } as Pose, t: 1.1, hold: 0.35, e: 0.25 },
      { p: { ...BENCH_BODY, hl: [0.5, 0.98, -0.24], elbow: [0.6, -1, 0] } as Pose, t: 0.8, e: 0.6, pass: true },
      { p: { ...BENCH_BODY, hl: [0.68, 0.7, -0.24], elbow: [0.6, -1, 0] } as Pose, t: 0.9, hold: 0.3, e: 1 },
      { p: { ...BENCH_BODY, hl: [0.5, 0.98, -0.24], elbow: [0.6, -1, 0] } as Pose, t: 0.6, e: 0.7, pass: true },
    ],
    primary: ["chest"], secondary: ["frontDelts"], joints: ["shoulder"],
    info: {
      fa: { start: "روی نیمکت تخت، دمبل‌ها بالای سینه با کف دست‌های رو به هم و آرنج کمی خم.", con: "دمبل‌ها را در یک مسیر کمانی به بالای سینه برگردانید.", ecc: "دست‌ها را با آرنج ثابت و کمی خم به طرفین باز کنید.", rom: "تا هم‌سطح شدن دمبل‌ها با سینه و احساس کشش.", mistakes: ["صاف یا زیاد خم کردن آرنج در طول حرکت", "پایین بردن بیش از حد و فشار به شانه"] },
      en: { start: "On a flat bench, dumbbells over the chest, palms facing, soft elbows.", con: "Bring the dumbbells back over the chest in a wide arc.", ecc: "Open the arms to the sides keeping the elbow angle fixed.", rom: "Until the dumbbells reach chest level with a stretch.", mistakes: ["Changing the elbow angle during the rep", "Going too deep and stressing the shoulders"] },
    },
  },
  {
    id: "push_up", libId: "ex-pushup", fa: "شنا سوئدی", en: "Push-Up", aliases: ["شنای سوئدی", "شنا", "push up", "pushup", "press up"],
    category: "chest", equipKey: "bodyweight", equip: { kind: "none" }, view: "side",
    keys: [
      { p: { pelvis: [0, 0.427, 0.005], pitch: 69, hl: [0.29, 0.05, 0.47], elbow: [0.7, 0.5, -1], fl: [0.1, 0.1, -0.85], knee: [0, -1, 0], fpl: 62 }, t: 1.0, hold: 0.35, e: 0.3 },
      { p: { pelvis: [0, 0.164, 0.063], pitch: 86, hl: [0.29, 0.05, 0.47], elbow: [0.7, 0.5, -1], fl: [0.1, 0.1, -0.85], knee: [0, -1, 0], fpl: 62 }, t: 1.6, hold: 0.25, e: 1 },
    ],
    primary: ["chest"], secondary: ["triceps", "frontDelts", "abs"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "حالت پلانک بلند، دست‌ها کمی بازتر از شانه و بدن در یک خط صاف.", con: "زمین را به عقب هل دهید و تا صاف شدن دست‌ها بالا بیایید.", ecc: "با آرنج‌های حدود 45 درجه، سینه را تا نزدیک زمین پایین ببرید.", rom: "تا فاصله چند سانتی‌متری سینه از زمین.", mistakes: ["افتادن لگن یا بالا رفتن باسن", "باز شدن آرنج‌ها به طرفین"] },
      en: { start: "High plank, hands slightly wider than shoulders, body in a straight line.", con: "Push the floor away until the arms are straight.", ecc: "Lower the chest toward the floor with elbows at about 45°.", rom: "Until the chest is a few centimeters from the floor.", mistakes: ["Sagging hips or piking up", "Flaring the elbows out wide"] },
    },
  },
  {
    id: "parallel_bar_dip", fa: "دیپ پارالل", en: "Parallel Bar Dip", aliases: ["دیپ", "پارالل", "dips", "dip"],
    category: "chest", equipKey: "bodyweight", equip: { kind: "none" }, view: "side",
    props: [
      { kind: "bar", a: [0.27, 1.11, -0.4], b: [0.27, 1.11, 0.45], r: 0.022, tone: "metal" },
      { kind: "bar", a: [-0.27, 1.11, -0.4], b: [-0.27, 1.11, 0.45], r: 0.022, tone: "metal" },
      { kind: "bar", a: [0.27, 0, -0.32], b: [0.27, 1.11, -0.32], r: 0.03 },
      { kind: "bar", a: [-0.27, 0, -0.32], b: [-0.27, 1.11, -0.32], r: 0.03 },
      { kind: "bar", a: [0.27, 0, 0.38], b: [0.27, 1.11, 0.38], r: 0.03 },
      { kind: "bar", a: [-0.27, 0, 0.38], b: [-0.27, 1.11, 0.38], r: 0.03 },
    ],
    keys: [
      { p: { pelvis: [0, 1.22, -0.02], pitch: 8, hl: [0.27, 1.13, 0.05], elbow: [0.15, 0.2, -1], fl: [0.09, 0.62, -0.32], knee: [0.1, -0.2, 1], fpl: 30 }, t: 1.1, hold: 0.35, e: 0.25 },
      { p: { pelvis: [0, 0.93, -0.08], pitch: 22, head: -8, hl: [0.27, 1.13, 0.05], elbow: [0.15, 0.2, -1], fl: [0.09, 0.34, -0.42], knee: [0.1, -0.2, 1], fpl: 30 }, t: 1.7, hold: 0.25, e: 1 },
    ],
    primary: ["chest", "triceps"], secondary: ["frontDelts"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "روی میله‌های پارالل با دست‌های صاف، شانه‌ها پایین و زانوها کمی خم.", con: "با فشار کف دست‌ها بدن را تا صاف شدن آرنج بالا ببرید.", ecc: "با تمایل کمی تنه به جلو، تا زاویه 90 درجه آرنج پایین بروید.", rom: "تا زاویه حدود 90 درجه آرنج، بدون فشار دردناک به شانه.", mistakes: ["پایین رفتن بیش از حد و فشار به جلوی شانه", "بالا آمدن شانه‌ها به سمت گوش"] },
      en: { start: "Support on the bars with straight arms, shoulders down, knees slightly bent.", con: "Press through the palms until the elbows are straight.", ecc: "Lean slightly forward and lower to about 90° at the elbows.", rom: "To roughly 90° of elbow flexion without shoulder pain.", mistakes: ["Dropping too deep and stressing the shoulders", "Shrugging the shoulders toward the ears"] },
    },
  },

  /* ------------------------------- BACK ------------------------------- */
  {
    id: "pull_up", libId: "ex-pullup", fa: "بارفیکس", en: "Pull-Up", aliases: ["بارفیکس دست باز", "pull up", "pullup", "chin up", "بارفیکس دست جمع"],
    category: "back", equipKey: "bodyweight", equip: { kind: "none" }, view: "threeQuarter",
    props: [
      { kind: "bar", a: [-0.78, 2.33, 0], b: [0.78, 2.33, 0], r: 0.016, tone: "metal" },
      { kind: "bar", a: [0.78, 0, 0], b: [0.78, 2.42, 0], r: 0.035 },
      { kind: "bar", a: [-0.78, 0, 0], b: [-0.78, 2.42, 0], r: 0.035 },
    ],
    keys: [
      { p: { pelvis: [0, 1.28, -0.03], pitch: -3, hl: [0.4, 2.27, 0], elbow: [0.6, -1, -0.25], fl: [0.08, 0.44, -0.15], knee: [0.1, 0, 1], fpl: 35 }, t: 2.0, hold: 0.4, e: 0.25 },
      { p: { pelvis: [0, 1.78, -0.07], pitch: -7, head: -12, hl: [0.4, 2.27, 0], elbow: [0.6, -1, -0.25], fl: [0.08, 0.94, -0.17], knee: [0.1, 0, 1], fpl: 35 }, t: 1.2, hold: 0.4, e: 1 },
    ],
    primary: ["lats"], secondary: ["biceps", "upperBack", "rearDelts", "forearms"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "آویزان از میله با دست‌های کمی بازتر از شانه و دست‌های کاملاً صاف.", con: "کتف‌ها را پایین بکشید و بدن را تا بالا رفتن چانه از میله بالا ببرید.", ecc: "به‌آرامی تا صاف شدن کامل دست‌ها پایین بیایید.", rom: "از آویزان کامل تا عبور چانه از روی میله.", mistakes: ["تاب دادن بدن و استفاده از پا", "نیمه‌کاره ماندن دامنه حرکت"] },
      en: { start: "Dead hang with hands slightly wider than shoulders and straight arms.", con: "Pull the shoulder blades down and pull until the chin clears the bar.", ecc: "Lower slowly to a full hang.", rom: "From a full hang to the chin above the bar.", mistakes: ["Kipping or swinging the legs", "Partial repetitions"] },
    },
  },
  {
    id: "lat_pulldown", libId: "ex-lat", fa: "زیربغل سیم‌کش از جلو", en: "Lat Pulldown", aliases: ["زیربغل سیم‌کش", "سیم‌کش زیربغل", "lat pulldown", "pulldown"],
    category: "back", equipKey: "cable", equip: { kind: "cable", pulley: [0, 2.36, 0.12], handle: "longbar" }, view: "threeQuarter",
    props: [
      { kind: "box", pos: [0, 0.25, 0.02], size: [0.42, 0.5, 0.42], tone: "pad" },
      { kind: "bar", a: [-0.26, 0.74, 0.3], b: [0.26, 0.74, 0.3], r: 0.045, tone: "pad" },
      { kind: "box", pos: [0, 1.2, -0.48], size: [0.12, 2.4, 0.12], tone: "frame" },
      { kind: "bar", a: [0, 2.4, -0.48], b: [0, 2.4, 0.14], r: 0.035 },
      { kind: "pulley", pos: [0, 2.36, 0.12] },
      { kind: "box", pos: [0, 0.45, -0.6], size: [0.32, 0.6, 0.14], tone: "plate" },
    ],
    keys: [
      { p: { pelvis: [0, 0.61, 0], pitch: -10, hl: [0.55, 1.85, 0.07], elbow: [0.5, -1, -0.6], fl: [0.15, 0.07, 0.42], knee: [0.1, 0.2, 1] }, t: 1.8, hold: 0.35, e: 0.25 },
      { p: { pelvis: [0, 0.61, 0], pitch: -16, head: -8, hl: [0.47, 1.18, 0.06], elbow: [0.5, -1, -0.6], fl: [0.15, 0.07, 0.42], knee: [0.1, 0.2, 1] }, t: 1.1, hold: 0.4, e: 1 },
    ],
    primary: ["lats"], secondary: ["biceps", "upperBack", "rearDelts"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "نشسته، ران‌ها زیر پد، میله با دست باز و دست‌های کاملاً بالا.", con: "کتف‌ها را پایین و عقب بکشید و میله را تا بالای سینه بیاورید.", ecc: "میله را کنترل‌شده بالا ببرید تا زیربغل کاملاً کشیده شود.", rom: "از دست‌های صاف در بالا تا رسیدن میله به بالای سینه.", mistakes: ["عقب رفتن زیاد تنه", "کشیدن میله پشت گردن"] },
      en: { start: "Seated, thighs under the pad, wide grip with arms fully extended.", con: "Depress and retract the shoulder blades, pulling the bar to the upper chest.", ecc: "Let the bar rise under control to a full lat stretch.", rom: "From straight arms overhead to the bar at the upper chest.", mistakes: ["Leaning back excessively", "Pulling behind the neck"] },
    },
  },
  {
    id: "bent_over_dumbbell_row", libId: "ex-row", fa: "زیربغل دمبل خم", en: "Bent-Over Dumbbell Row", aliases: ["زیربغل خم دمبل", "پارویی دمبل", "dumbbell row", "bent over row"],
    category: "back", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "z" }, view: "side",
    keys: [
      { p: st({ pelvis: [0, 0.84, -0.22], pitch: 62, head: -28, hl: [0.22, 0.48, 0.21], elbow: [0.25, 1, -0.6], fl: [0.15, 0.07, 0.04], knee: [0.2, 0, 1] }), t: 1.6, hold: 0.3, e: 0.2 },
      { p: st({ pelvis: [0, 0.84, -0.22], pitch: 62, head: -28, hl: [0.22, 0.86, 0.02], elbow: [0.25, 1, -0.6], fl: [0.15, 0.07, 0.04], knee: [0.2, 0, 1] }), t: 1.0, hold: 0.5, e: 1 },
    ],
    primary: ["lats", "upperBack"], secondary: ["rearDelts", "biceps", "lowerBack"], joints: ["shoulder", "elbow", "scapula", "hip"],
    info: {
      fa: { start: "تنه حدود 60 درجه خم، کمر صاف، زانوها کمی خم و دمبل‌ها آویزان.", con: "آرنج‌ها را به عقب و بالا بکشید تا دمبل‌ها به کنار کمر برسند.", ecc: "دمبل‌ها را آرام تا صاف شدن دست‌ها پایین بیاورید.", rom: "از دست‌های صاف تا رسیدن دمبل به کنار شکم.", mistakes: ["گرد شدن کمر", "بالا آمدن تنه برای کمک به حرکت"] },
      en: { start: "Hinge to about 60°, flat back, soft knees, dumbbells hanging.", con: "Drive the elbows back and up until the dumbbells reach the waist.", ecc: "Lower slowly until the arms are straight.", rom: "From straight arms to the dumbbells at the sides of the torso.", mistakes: ["Rounding the back", "Lifting the torso to cheat the weight"] },
    },
  },
  {
    id: "seated_cable_row", fa: "قایقی سیم‌کش", en: "Seated Cable Row", aliases: ["قایقی", "روئینگ سیم‌کش", "seated row", "cable row"],
    category: "back", equipKey: "cable", equip: { kind: "cable", pulley: [0, 0.42, 0.86], handle: "v" }, view: "side",
    props: [
      { kind: "box", pos: [0, 0.2, -0.1], size: [0.32, 0.4, 1.0], tone: "pad" },
      { kind: "box", pos: [0, 0.3, 0.77], size: [0.42, 0.36, 0.05], rot: [-15, 0, 0], tone: "frame" },
      { kind: "box", pos: [0, 0.55, 0.98], size: [0.3, 1.1, 0.12], tone: "frame" },
      { kind: "pulley", pos: [0, 0.42, 0.86] },
    ],
    keys: [
      { p: { pelvis: [0, 0.52, 0], pitch: 16, head: -6, hl: [0.06, 0.66, 0.6], elbow: [0.3, -0.4, -1], fl: [0.13, 0.33, 0.69], knee: [0.15, 1, 0.2], fpl: -62 }, t: 1.7, hold: 0.3, e: 0.25 },
      { p: { pelvis: [0, 0.52, 0], pitch: -4, hl: [0.07, 0.8, 0.18], elbow: [0.3, -0.4, -1], fl: [0.13, 0.33, 0.69], knee: [0.15, 1, 0.2], fpl: -62 }, t: 1.0, hold: 0.5, e: 1 },
    ],
    primary: ["upperBack", "lats"], secondary: ["biceps", "rearDelts", "lowerBack"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "نشسته، پاها روی صفحه با زانوی کمی خم و دست‌ها به جلو کشیده.", con: "دستگیره را به سمت شکم بکشید و کتف‌ها را به هم نزدیک کنید.", ecc: "دست‌ها را آرام به جلو ببرید تا کتف‌ها باز شوند.", rom: "از کشش کامل پشت تا رسیدن دستگیره به شکم.", mistakes: ["حرکت تاب‌دار تنه به عقب و جلو", "بالا آمدن شانه‌ها"] },
      en: { start: "Seated, feet on the platform with soft knees, arms extended forward.", con: "Pull the handle to the stomach and squeeze the shoulder blades together.", ecc: "Return the arms forward slowly letting the shoulder blades spread.", rom: "From a full back stretch to the handle touching the stomach.", mistakes: ["Rocking the torso back and forth", "Shrugging the shoulders"] },
    },
  },

  /* ------------------------------- SHOULDERS ------------------------------- */
  {
    id: "overhead_press", libId: "ex-ohp", fa: "پرس سرشانه هالتر", en: "Barbell Overhead Press", aliases: ["پرس سرشانه", "پرس نظامی", "overhead press", "military press", "ohp"],
    category: "shoulders", equipKey: "barbell", equip: { kind: "barbell" }, view: "threeQuarter",
    keys: [
      { p: st({ head: -6, hl: [0.26, 1.43, 0.15], elbow: [0.25, -0.5, 1], fl: [0.15, 0.07, 0.02] }), t: 0.8, hold: 0.4, e: 0.25 },
      { p: st({ pitch: -4, head: -14, hl: [0.26, 1.7, 0.17], elbow: [0.4, -0.5, 0.6], fl: [0.15, 0.07, 0.02] }), t: 0.5, e: 0.7, pass: true },
      { p: st({ head: 4, hl: [0.26, 2.02, 0.03], elbow: [0.6, -0.3, 0], fl: [0.15, 0.07, 0.02] }), t: 0.6, hold: 0.4, e: 1 },
      { p: st({ pitch: -4, head: -14, hl: [0.26, 1.7, 0.17], elbow: [0.4, -0.5, 0.6], fl: [0.15, 0.07, 0.02] }), t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["frontDelts"], secondary: ["sideDelts", "triceps", "upperChest", "abs"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "ایستاده، هالتر روی جلوی شانه‌ها، آرنج‌ها کمی جلوتر از میله و شکم سفت.", con: "هالتر را عمودی بالای سر برانید و سر را از زیر میله به جلو بیاورید.", ecc: "هالتر را کنترل‌شده تا جلوی شانه‌ها پایین بیاورید.", rom: "از جلوی ترقوه تا صاف شدن کامل دست‌ها بالای سر.", mistakes: ["قوس دادن زیاد کمر", "دور شدن مسیر هالتر از صورت به جلو"] },
      en: { start: "Standing, bar on the front delts, elbows slightly ahead of the bar, core braced.", con: "Press straight overhead, moving the head through once the bar passes.", ecc: "Lower the bar under control to the front of the shoulders.", rom: "From the collarbone to fully straight arms overhead.", mistakes: ["Excessive lower-back arch", "Pressing the bar forward away from the face"] },
    },
  },
  {
    id: "dumbbell_shoulder_press", fa: "پرس سرشانه دمبل", en: "Dumbbell Shoulder Press", aliases: ["سرشانه دمبل", "dumbbell shoulder press", "db shoulder press"],
    category: "shoulders", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "x" }, view: "front",
    keys: [
      { p: st({ hl: [0.37, 1.48, 0.05], elbow: [1, -1, 0.1], fl: [0.15, 0.07, 0.02] }), t: 1.6, hold: 0.3, e: 0.25 },
      { p: st({ hl: [0.17, 2.0, 0.04], elbow: [1, -1, 0.1], fl: [0.15, 0.07, 0.02] }), t: 1.1, hold: 0.4, e: 1 },
    ],
    primary: ["frontDelts", "sideDelts"], secondary: ["triceps", "traps"], joints: ["shoulder", "elbow", "scapula"],
    info: {
      fa: { start: "دمبل‌ها هم‌سطح شانه، آرنج‌ها زیر مچ و کف دست‌ها رو به جلو.", con: "دمبل‌ها را بالای سر پرس کنید تا دست‌ها صاف و نزدیک هم شوند.", ecc: "دمبل‌ها را آرام تا هم‌سطح شانه پایین بیاورید.", rom: "از هم‌سطح گوش تا صاف شدن دست‌ها.", mistakes: ["قوس دادن کمر", "پایین آوردن ناکافی دمبل‌ها"] },
      en: { start: "Dumbbells at shoulder height, elbows under the wrists, palms forward.", con: "Press overhead until the arms are straight and the dumbbells close.", ecc: "Lower slowly back to shoulder height.", rom: "From ear level to straight arms.", mistakes: ["Arching the lower back", "Not lowering far enough"] },
    },
  },
  {
    id: "dumbbell_lateral_raise", libId: "ex-latraise", fa: "نشر جانب دمبل", en: "Dumbbell Lateral Raise", aliases: ["نشر جانب", "نشر از جانب", "lateral raise", "side raise"],
    category: "shoulders", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "z" }, view: "front",
    keys: [
      { p: st({ pitch: 4, hl: [0.24, 0.87, 0.06], elbow: [0.2, 0.3, -1], fl: [0.14, 0.07, 0.02] }), t: 0.9, hold: 0.3, e: 0.15 },
      { p: st({ pitch: 4, hl: [0.58, 1.06, 0.07], elbow: [0.1, 1, -0.5], fl: [0.14, 0.07, 0.02] }), t: 0.6, e: 0.6, pass: true },
      { p: st({ pitch: 4, hl: [0.73, 1.38, 0.08], elbow: [0.1, 1, -0.5], fl: [0.14, 0.07, 0.02] }), t: 0.55, hold: 0.35, e: 1 },
      { p: st({ pitch: 4, hl: [0.58, 1.06, 0.07], elbow: [0.1, 1, -0.5], fl: [0.14, 0.07, 0.02] }), t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["sideDelts"], secondary: ["traps", "frontDelts"], joints: ["shoulder", "scapula"],
    info: {
      fa: { start: "ایستاده، دمبل‌ها کنار ران، تنه کمی متمایل به جلو و آرنج‌ها کمی خم.", con: "دست‌ها را از طرفین تا هم‌سطح شانه بالا ببرید.", ecc: "دمبل‌ها را آرام و کنترل‌شده پایین بیاورید.", rom: "تا هم‌سطح شدن آرنج و شانه؛ نه بالاتر.", mistakes: ["تاب دادن بدن برای بالا آوردن وزنه", "بالا رفتن شانه‌ها به سمت گوش"] },
      en: { start: "Standing, dumbbells by the thighs, slight forward lean, soft elbows.", con: "Raise the arms out to the sides to shoulder height.", ecc: "Lower the dumbbells slowly and under control.", rom: "Until the elbows reach shoulder height, not higher.", mistakes: ["Swinging the body", "Shrugging toward the ears"] },
    },
  },
  {
    id: "dumbbell_front_raise", fa: "نشر از جلو دمبل", en: "Dumbbell Front Raise", aliases: ["نشر جلو", "front raise"],
    category: "shoulders", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "x" }, view: "side",
    keys: [
      { p: st({ hl: [0.2, 0.88, 0.09], elbow: [0.5, -0.2, -0.4] }), t: 0.9, hold: 0.3, e: 0.15 },
      { p: st({ hl: [0.2, 1.06, 0.42], elbow: [0.5, -0.2, -0.4] }), t: 0.6, e: 0.6, pass: true },
      { p: st({ hl: [0.2, 1.43, 0.55], elbow: [0.5, -0.2, -0.4] }), t: 0.55, hold: 0.35, e: 1 },
      { p: st({ hl: [0.2, 1.06, 0.42], elbow: [0.5, -0.2, -0.4] }), t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["frontDelts"], secondary: ["upperChest", "sideDelts"], joints: ["shoulder"],
    info: {
      fa: { start: "ایستاده، دمبل‌ها جلوی ران با کف دست‌های رو به بدن.", con: "دست‌ها را با آرنج کمی خم از جلو تا هم‌سطح شانه بالا ببرید.", ecc: "دمبل‌ها را آرام به جلوی ران برگردانید.", rom: "تا هم‌سطح شانه.", mistakes: ["عقب رفتن تنه و تاب دادن", "بالا بردن بیش از حد"] },
      en: { start: "Standing, dumbbells in front of the thighs, palms facing the body.", con: "Raise the arms forward with soft elbows to shoulder height.", ecc: "Lower slowly back to the thighs.", rom: "Up to shoulder height.", mistakes: ["Leaning back and swinging", "Raising too high"] },
    },
  },
  {
    id: "bent_over_reverse_fly", fa: "نشر خم دمبل", en: "Bent-Over Reverse Fly", aliases: ["نشر خم", "نشر از پشت", "reverse fly", "rear delt fly"],
    category: "shoulders", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "z" }, view: "rear",
    keys: [
      { p: st({ pelvis: [0, 0.86, -0.22], pitch: 70, head: -30, hl: [0.14, 0.5, 0.24], elbow: [0.2, 1, 0], fl: [0.15, 0.07, 0.04], knee: [0.2, 0, 1] }), t: 0.9, hold: 0.3, e: 0.15 },
      { p: st({ pelvis: [0, 0.86, -0.22], pitch: 70, head: -30, hl: [0.54, 0.64, 0.24], elbow: [0.2, 1, 0], fl: [0.15, 0.07, 0.04], knee: [0.2, 0, 1] }), t: 0.6, e: 0.6, pass: true },
      { p: st({ pelvis: [0, 0.86, -0.22], pitch: 70, head: -30, hl: [0.72, 0.96, 0.24], elbow: [0.2, 1, 0], fl: [0.15, 0.07, 0.04], knee: [0.2, 0, 1] }), t: 0.55, hold: 0.4, e: 1 },
      { p: st({ pelvis: [0, 0.86, -0.22], pitch: 70, head: -30, hl: [0.54, 0.64, 0.24], elbow: [0.2, 1, 0], fl: [0.15, 0.07, 0.04], knee: [0.2, 0, 1] }), t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["rearDelts"], secondary: ["upperBack", "traps"], joints: ["shoulder", "scapula"],
    info: {
      fa: { start: "تنه خم و کمر صاف، دمبل‌ها زیر سینه با کف دست‌های رو به هم.", con: "دست‌ها را با آرنج کمی خم به طرفین تا هم‌سطح تنه باز کنید.", ecc: "دمبل‌ها را آرام زیر سینه برگردانید.", rom: "تا هم‌سطح شدن دست‌ها با تنه.", mistakes: ["استفاده از کتف به‌جای سرشانه پشت", "بالا آوردن تنه حین حرکت"] },
      en: { start: "Hinged with a flat back, dumbbells under the chest, palms facing.", con: "Open the arms to the sides with soft elbows until level with the torso.", ecc: "Return slowly under the chest.", rom: "Until the arms are level with the torso.", mistakes: ["Pulling with the traps instead of the rear delts", "Lifting the torso during the rep"] },
    },
  },

  /* ------------------------------- ARMS ------------------------------- */
  {
    id: "barbell_curl", libId: "ex-curl", fa: "جلو بازو هالتر", en: "Barbell Curl", aliases: ["جلوبازو هالتر", "barbell curl", "bicep curl barbell"],
    category: "arms", equipKey: "barbell", equip: { kind: "barbell", length: 1.3, plateScale: 0.5 }, view: "threeQuarter", keys: curlKeys(0.21),
    primary: ["biceps"], secondary: ["brachialis", "forearms"], joints: ["elbow"],
    info: {
      fa: { start: "ایستاده، هالتر با کف دست‌های رو به جلو و دست‌های صاف جلوی ران.", con: "با ثابت نگه داشتن آرنج‌ها کنار بدن، هالتر را تا جلوی شانه بالا بیاورید.", ecc: "هالتر را آرام تا صاف شدن دست‌ها پایین بیاورید.", rom: "از دست‌های صاف تا انقباض کامل جلو بازو.", mistakes: ["جلو آمدن آرنج‌ها", "تاب دادن تنه"] },
      en: { start: "Standing, underhand grip, straight arms in front of the thighs.", con: "Keep the elbows pinned and curl the bar to the shoulders.", ecc: "Lower slowly to straight arms.", rom: "From straight arms to a full biceps contraction.", mistakes: ["Elbows drifting forward", "Swinging the torso"] },
    },
  },
  {
    id: "dumbbell_biceps_curl", fa: "جلو بازو دمبل", en: "Dumbbell Biceps Curl", aliases: ["جلوبازو دمبل", "dumbbell curl", "biceps curl", "bicep curl"],
    category: "arms", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "x" }, view: "side", keys: curlKeys(0.24),
    primary: ["biceps"], secondary: ["brachialis", "forearms"], joints: ["elbow"],
    info: {
      fa: { start: "ایستاده، دمبل‌ها در کنار بدن با کف دست‌های رو به جلو.", con: "آرنج‌ها را ثابت نگه دارید و دمبل‌ها را تا جلوی شانه بالا بیاورید.", ecc: "دمبل‌ها را آرام تا صاف شدن دست پایین بیاورید.", rom: "از دست‌های صاف تا انقباض کامل.", mistakes: ["جلو رفتن آرنج‌ها", "استفاده از تاب بدن"] },
      en: { start: "Standing, dumbbells at the sides with palms forward.", con: "Keep the elbows still and curl to the shoulders.", ecc: "Lower slowly to straight arms.", rom: "From straight arms to a full contraction.", mistakes: ["Elbows moving forward", "Using body swing"] },
    },
  },
  {
    id: "hammer_curl", fa: "جلو بازو چکشی", en: "Hammer Curl", aliases: ["چکشی", "hammer curl"],
    category: "arms", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "hammer" }, view: "side", keys: curlKeys(0.24),
    primary: ["brachialis", "biceps"], secondary: ["forearms"], joints: ["elbow"],
    info: {
      fa: { start: "ایستاده، دمبل‌ها کنار بدن با کف دست‌های رو به هم.", con: "با حفظ حالت چکشی، دمبل‌ها را تا جلوی شانه بالا بیاورید.", ecc: "دمبل‌ها را کنترل‌شده پایین بیاورید.", rom: "از دست‌های صاف تا انقباض کامل.", mistakes: ["چرخاندن مچ", "حرکت دادن شانه‌ها"] },
      en: { start: "Standing, dumbbells at the sides with palms facing each other.", con: "Keep the neutral grip and curl to the shoulders.", ecc: "Lower under control.", rom: "From straight arms to a full contraction.", mistakes: ["Rotating the wrists", "Moving the shoulders"] },
    },
  },
  {
    id: "triceps_pushdown", libId: "ex-pushdown", fa: "پشت بازو سیم‌کش", en: "Cable Triceps Pushdown", aliases: ["پشت بازو سیمکش", "triceps pushdown", "pushdown", "tricep pushdown"],
    category: "arms", equipKey: "cable", equip: { kind: "cable", pulley: [0, 2.05, 0.43], handle: "bar" }, view: "side",
    props: [
      { kind: "box", pos: [0, 1.12, 0.56], size: [0.26, 2.24, 0.12], tone: "frame" },
      { kind: "pulley", pos: [0, 2.05, 0.43] },
      { kind: "box", pos: [0, 0.45, 0.66], size: [0.3, 0.6, 0.12], tone: "plate" },
    ],
    keys: [
      { p: st({ pelvis: [0, 0.98, -0.02], pitch: 10, hl: [0.13, 1.21, 0.32], elbow: [0.1, -0.1, -1] }), t: 0.9, hold: 0.3, e: 0.2 },
      { p: st({ pelvis: [0, 0.98, -0.02], pitch: 10, hl: [0.13, 1.0, 0.29], elbow: [0.1, -0.1, -1] }), t: 0.5, e: 0.7, pass: true },
      { p: st({ pelvis: [0, 0.98, -0.02], pitch: 10, hl: [0.13, 0.87, 0.11], elbow: [0.1, -0.1, -1] }), t: 0.5, hold: 0.45, e: 1 },
      { p: st({ pelvis: [0, 0.98, -0.02], pitch: 10, hl: [0.13, 1.0, 0.29], elbow: [0.1, -0.1, -1] }), t: 0.9, e: 0.6, pass: true },
    ],
    primary: ["triceps"], secondary: ["forearms"], joints: ["elbow"],
    info: {
      fa: { start: "روبه‌روی سیم‌کش، تنه کمی خم، آرنج‌ها چسبیده به بدن و ساعدها موازی زمین.", con: "دستگیره را تا صاف شدن کامل آرنج به پایین فشار دهید.", ecc: "اجازه دهید ساعدها آرام تا موازی زمین بالا بیایند.", rom: "از ساعد موازی زمین تا صاف شدن کامل آرنج.", mistakes: ["جدا شدن آرنج‌ها از بدن", "خم شدن زیاد تنه روی دستگیره"] },
      en: { start: "Facing the cable, slight forward lean, elbows pinned, forearms parallel to the floor.", con: "Press down until the elbows are fully straight.", ecc: "Let the forearms rise slowly back to parallel.", rom: "From forearms parallel to full elbow extension.", mistakes: ["Elbows drifting away from the body", "Leaning over the handle"] },
    },
  },
  {
    id: "overhead_triceps_extension", fa: "پشت بازو دمبل بالای سر", en: "Overhead Dumbbell Triceps Extension", aliases: ["پشت بازو بالای سر", "پشت بازو دمبل", "overhead triceps extension", "overhead extension"],
    category: "arms", equipKey: "dumbbell", equip: { kind: "dumbbells", axis: "along", single: "mid" }, frame: "chest", view: "side",
    keys: [
      { p: st({ hl: [0.05, 0.6, 0.02], elbow: [0.1, 1, 0.3], fl: [0.15, 0.07, 0.02] }), t: 1.0, hold: 0.4, e: 0.25 },
      { p: st({ hl: [0.06, 0.12, -0.2], elbow: [0.1, 1, 0.3], fl: [0.15, 0.07, 0.02] }), t: 1.7, hold: 0.3, e: 1 },
    ],
    primary: ["triceps"], secondary: ["abs"], joints: ["elbow", "shoulder"],
    info: {
      fa: { start: "ایستاده، یک دمبل با دو دست بالای سر و دست‌های صاف.", con: "با ثابت نگه داشتن بازوها، آرنج‌ها را تا صاف شدن کامل باز کنید.", ecc: "دمبل را آرام پشت سر پایین ببرید تا پشت بازو کشیده شود.", rom: "از کشش کامل پشت بازو تا صاف شدن آرنج.", mistakes: ["باز شدن آرنج‌ها به طرفین", "قوس دادن کمر"] },
      en: { start: "Standing, one dumbbell held overhead with both hands, arms straight.", con: "Keep the upper arms still and extend the elbows fully.", ecc: "Lower the dumbbell behind the head for a deep triceps stretch.", rom: "From a full triceps stretch to straight elbows.", mistakes: ["Elbows flaring out", "Arching the lower back"] },
    },
  },

  /* ------------------------------- CORE ------------------------------- */
  {
    id: "crunch", libId: "ex-crunch", fa: "کرانچ شکم", en: "Crunch", aliases: ["کرانچ", "crunch", "ab crunch", "دراز و نشست"],
    category: "core", equipKey: "bodyweight", equip: { kind: "none" }, frame: "chest", view: "side", props: MAT,
    keys: [
      { p: sup({ head: 10, hl: [0.09, 0.15, -0.07], elbow: [1, 0.1, 0.2] }), t: 1.4, hold: 0.3, e: 0.15 },
      { p: sup({ spine: 38, head: 20, hl: [0.09, 0.15, -0.07], elbow: [1, 0.1, 0.2] }), t: 0.9, hold: 0.5, e: 1 },
    ],
    primary: ["abs"], secondary: ["obliques"], joints: ["spine"],
    info: {
      fa: { start: "به پشت بخوابید، زانوها خم، کف پاها روی زمین و دست‌ها کنار سر.", con: "با انقباض شکم، کتف‌ها را از زمین جدا کنید.", ecc: "به‌آرامی شانه‌ها را روی زمین برگردانید.", rom: "تا جدا شدن کامل کتف‌ها؛ کمر روی زمین می‌ماند.", mistakes: ["کشیدن گردن با دست", "بلند شدن کامل کمر از زمین"] },
      en: { start: "Lie on your back, knees bent, feet flat, hands beside the head.", con: "Contract the abs to lift the shoulder blades off the floor.", ecc: "Lower the shoulders back slowly.", rom: "Until the shoulder blades clear the floor; the lower back stays down.", mistakes: ["Pulling on the neck", "Lifting the whole back off the floor"] },
    },
  },
  {
    id: "lying_leg_raise", fa: "بالا آوردن پا خوابیده", en: "Lying Leg Raise", aliases: ["زیرشکم خوابیده", "لگ ریز", "leg raise", "lying leg raise"],
    category: "core", equipKey: "bodyweight", equip: { kind: "none" }, view: "side", props: MAT,
    keys: [
      { p: sup({ hl: [0.25, 0.04, 0.05], fl: [0.1, 0.14, 0.97], knee: [0, 0.3, 1], fpl: 25 }), t: 0.9, hold: 0.3, e: 0.3 },
      { p: sup({ hl: [0.25, 0.04, 0.05], fl: [0.1, 0.73, 0.72], knee: [0, 0.3, 1], fpl: 25 }), t: 0.7, e: 0.8, pass: true },
      { p: sup({ hl: [0.25, 0.04, 0.05], fl: [0.1, 0.98, 0.14], knee: [0, 0.3, 1], fpl: 25 }), t: 0.7, hold: 0.35, e: 1 },
      { p: sup({ hl: [0.25, 0.04, 0.05], fl: [0.1, 0.73, 0.72], knee: [0, 0.3, 1], fpl: 25 }), t: 1.0, e: 0.7, pass: true },
    ],
    primary: ["abs", "hipFlexors"], secondary: ["obliques"], joints: ["hip", "spine"],
    info: {
      fa: { start: "به پشت بخوابید، پاها صاف و دست‌ها کنار بدن روی زمین.", con: "پاها را با زانوی صاف تا عمود شدن بالا بیاورید.", ecc: "پاها را آرام تا نزدیک زمین پایین ببرید بدون اینکه کمر قوس بگیرد.", rom: "از نزدیک زمین تا عمود بر زمین.", mistakes: ["قوس گرفتن کمر هنگام پایین آوردن پا", "تاب دادن پاها"] },
      en: { start: "Lie on your back, legs straight, hands by the sides.", con: "Raise the straight legs to vertical.", ecc: "Lower the legs slowly toward the floor without arching the back.", rom: "From just above the floor to vertical.", mistakes: ["Arching the lower back on the way down", "Swinging the legs"] },
    },
  },
  {
    id: "plank", libId: "ex-plank", fa: "پلانک", en: "Forearm Plank", aliases: ["پلانک ساعد", "plank", "forearm plank"],
    category: "core", equipKey: "bodyweight", equip: { kind: "none" }, view: "side", props: MAT, isometric: true,
    keys: [
      { p: { pelvis: [0, 0.31, 0.05], pitch: 83, hl: [0.14, 0.05, 0.8], elbow: [0.1, -1, 0], fl: [0.1, 0.13, -0.85], knee: [0, -1, 0], fpl: 72 }, t: 1.8, hold: 0.4, e: 0.75 },
      { p: { pelvis: [0, 0.318, 0.05], pitch: 82.5, head: -2, hl: [0.14, 0.05, 0.8], elbow: [0.1, -1, 0], fl: [0.1, 0.13, -0.85], knee: [0, -1, 0], fpl: 72 }, t: 1.8, hold: 0.4, e: 0.9 },
    ],
    primary: ["abs"], secondary: ["obliques", "lowerBack", "frontDelts", "glutes"], joints: ["spine", "shoulder", "hip"],
    info: {
      fa: { start: "ساعدها روی زمین، آرنج‌ها زیر شانه و بدن روی پنجه پاها در یک خط صاف.", con: "حرکت ایستاست؛ شکم و باسن را منقبض نگه دارید.", ecc: "حرکت ایستاست؛ تنفس آرام و منظم را حفظ کنید.", rom: "نگه داشتن بدن در یک خط صاف از سر تا پاشنه.", mistakes: ["افتادن لگن به سمت زمین", "بالا بردن بیش از حد باسن"] },
      en: { start: "Forearms on the floor, elbows under the shoulders, body on the toes in a straight line.", con: "Isometric hold — keep the abs and glutes braced.", ecc: "Isometric hold — keep breathing slowly and steadily.", rom: "Hold a straight line from head to heels.", mistakes: ["Hips sagging toward the floor", "Hips piking too high"] },
    },
  },

  /* ------------------------------- FULL BODY ------------------------------- */
  {
    id: "burpee", libId: "ex-burpee", fa: "بورپی", en: "Burpee", aliases: ["burpee", "burpees"],
    category: "fullBody", equipKey: "bodyweight", equip: { kind: "none" }, view: "side",
    keys: (() => {
      const stand = st({ hl: [0.24, 0.88, 0.05], fl: [0.15, 0.07, 0.02] });
      const crouch: Pose = { pelvis: [0, 0.46, -0.13], pitch: 68, head: -25, hl: [0.23, 0.06, 0.46], elbow: [0.6, 0, -1], fl: [0.15, 0.07, 0.02], knee: [0.25, 0, 1] };
      const air: Pose = { ...crouch, pelvis: [0, 0.5, -0.02], pitch: 74, fl: [0.12, 0.3, -0.45], fpl: 40, knee: [0.1, -0.5, 1] };
      const plank: Pose = { ...crouch, pelvis: [0, 0.47, -0.03], pitch: 74, head: -5, fl: [0.11, 0.1, -0.86], fpl: 65, knee: [0, -1, 0.2] };
      const jump = st({ pelvis: [0, 1.22, 0.02], pitch: -2, hl: [0.25, 2.16, 0.06], elbow: [0.4, -0.2, -1], fl: [0.14, 0.3, 0.02], fpl: 40, knee: [0.15, 0, 1] });
      return [
        { p: stand, t: 0.42, hold: 0.25, e: 0.2 },
        { p: crouch, t: 0.45, e: 0.6 },
        { p: air, t: 0.2, e: 0.7, pass: true },
        { p: plank, t: 0.2, hold: 0.15, e: 0.8 },
        { p: air, t: 0.22, e: 0.7, pass: true },
        { p: crouch, t: 0.2, e: 0.8 },
        { p: jump, t: 0.38, e: 1 },
      ] as Key[];
    })(),
    reps: 3,
    primary: ["quads", "chest", "glutes"], secondary: ["frontDelts", "triceps", "abs", "calves"], joints: ["hip", "knee", "ankle", "shoulder", "elbow"],
    info: {
      fa: { start: "ایستاده با پاهای به عرض شانه.", con: "از حالت نشسته با قدرت پاها به بالا بپرید و دست‌ها را بالای سر ببرید.", ecc: "بنشینید، دست‌ها را روی زمین بگذارید و پاها را به حالت پلانک به عقب بپرید.", rom: "از ایستاده تا پلانک کامل و پرش عمودی.", mistakes: ["افتادن لگن در حالت پلانک", "فرود سخت با زانوی صاف"] },
      en: { start: "Stand with feet shoulder-width apart.", con: "Drive up from the squat into a vertical jump with arms overhead.", ecc: "Squat, place the hands down and jump the feet back into a plank.", rom: "From standing to a full plank and a vertical jump.", mistakes: ["Hips sagging in the plank", "Landing stiff-legged"] },
    },
  },
  {
    id: "kettlebell_swing", fa: "سوئینگ کتل‌بل", en: "Kettlebell Swing", aliases: ["کتل بل سوئینگ", "سوینگ کتل بل", "kettlebell swing", "kb swing"],
    category: "fullBody", equipKey: "kettlebell", equip: { kind: "kettlebell" }, view: "side",
    keys: [
      { p: st({ pelvis: [0, 0.84, -0.22], pitch: 58, head: -25, hl: [0.05, 0.64, -0.03], elbow: [0.2, 0, -1], fl: [0.18, 0.07, 0.03], knee: [0.3, 0, 1] }), t: 0.42, hold: 0.05, e: 0.6 },
      { p: st({ pelvis: [0, 0.93, -0.08], pitch: 24, head: -10, hl: [0.05, 0.88, 0.3], elbow: [0.2, 0, -1], fl: [0.18, 0.07, 0.03], knee: [0.3, 0, 1] }), t: 0.3, e: 1, pass: true },
      { p: st({ pelvis: [0, 0.99, 0.02], pitch: -3, hl: [0.05, 1.3, 0.52], elbow: [0.2, -1, 0], fl: [0.18, 0.07, 0.03] }), t: 0.3, hold: 0.1, e: 0.7 },
      { p: st({ pelvis: [0, 0.93, -0.08], pitch: 24, head: -10, hl: [0.05, 0.88, 0.3], elbow: [0.2, 0, -1], fl: [0.18, 0.07, 0.03], knee: [0.3, 0, 1] }), t: 0.35, e: 0.5, pass: true },
    ],
    reps: 4,
    primary: ["glutes", "hamstrings"], secondary: ["lowerBack", "abs", "frontDelts", "forearms"], joints: ["hip", "knee", "spine", "shoulder"],
    info: {
      fa: { start: "ایستاده، پاها کمی بازتر از شانه و کتل‌بل با دو دست بین پاها.", con: "لگن را با انفجار به جلو برانید تا کتل‌بل تا هم‌سطح سینه بالا بیاید.", ecc: "همراه با پایین آمدن کتل‌بل، لگن را به عقب ببرید و آن را بین پاها هدایت کنید.", rom: "از خم شدن کامل لگن تا ایستادن کامل؛ دست‌ها هم‌سطح شانه.", mistakes: ["اسکوات کردن به‌جای خم شدن از لگن", "بالا کشیدن کتل‌بل با قدرت دست‌ها"] },
      en: { start: "Feet slightly wider than shoulders, kettlebell held with both hands between the legs.", con: "Snap the hips forward so the bell floats to chest height.", ecc: "As the bell falls, hinge the hips back and guide it between the legs.", rom: "From a deep hip hinge to full extension; arms reach shoulder height.", mistakes: ["Squatting instead of hinging", "Lifting the bell with the arms"] },
    },
  },
  {
    id: "jumping_jack", fa: "جامپینگ جک", en: "Jumping Jack", aliases: ["جامپینگ جک", "jumping jacks", "jumping jack", "star jump"],
    category: "fullBody", equipKey: "bodyweight", equip: { kind: "none" }, view: "front",
    keys: [
      { p: st({ fl: [0.1, 0.07, 0.01], hl: [0.22, 0.88, 0.04] }), t: 0.28, hold: 0.06, e: 0.3 },
      { p: st({ pelvis: [0, 1.04, 0], fl: [0.24, 0.17, 0.01], fpl: 30, hl: [0.62, 1.7, 0.04], elbow: [0.3, -0.2, -1] }), t: 0.22, e: 0.8, pass: true },
      { p: st({ pelvis: [0, 0.96, 0], fl: [0.37, 0.07, 0.01], hl: [0.25, 2.1, 0.04], elbow: [0.3, -0.2, -1], knee: [0.25, 0, 1] }), t: 0.22, hold: 0.06, e: 1 },
      { p: st({ pelvis: [0, 1.04, 0], fl: [0.24, 0.17, 0.01], fpl: 30, hl: [0.62, 1.7, 0.04], elbow: [0.3, -0.2, -1] }), t: 0.22, e: 0.8, pass: true },
    ],
    reps: 6,
    primary: ["calves", "sideDelts"], secondary: ["glutes", "adductors", "quads"], joints: ["shoulder", "hip", "knee", "ankle"],
    info: {
      fa: { start: "ایستاده، پاها جفت و دست‌ها کنار بدن.", con: "بپرید و هم‌زمان پاها را باز و دست‌ها را بالای سر ببرید.", ecc: "با پرش دوباره به حالت اول برگردید.", rom: "پاها کمی بازتر از شانه و دست‌ها کاملاً بالای سر.", mistakes: ["فرود روی پاشنه", "خم شدن تنه"] },
      en: { start: "Stand with feet together and arms by the sides.", con: "Jump while opening the legs and raising the arms overhead.", ecc: "Jump back to the starting position.", rom: "Feet slightly wider than shoulders, arms fully overhead.", mistakes: ["Landing on the heels", "Hunching the torso"] },
    },
  },
  {
    id: "mountain_climber", fa: "کوهنورد", en: "Mountain Climber", aliases: ["مانتین کلایمبر", "mountain climber", "mountain climbers"],
    category: "core", equipKey: "bodyweight", equip: { kind: "none" }, view: "side", mirrorRep: true,
    keys: [
      { p: { pelvis: [0, 0.45, 0], pitch: 72, hl: [0.25, 0.05, 0.47], elbow: [0.6, 0.3, -1], fl: [0.1, 0.1, -0.86], knee: [0, -0.6, 1], fpl: 62 }, t: 0.28, hold: 0.04, e: 0.4 },
      { p: { pelvis: [0, 0.47, 0.01], pitch: 70, hl: [0.25, 0.05, 0.47], elbow: [0.6, 0.3, -1], fl: [0.12, 0.17, -0.06], fr: [-0.1, 0.1, -0.86], knee: [0, -0.6, 1], fpl: 40, fpr: 62 }, t: 0.28, hold: 0.04, e: 1 },
    ],
    reps: 8,
    primary: ["abs", "hipFlexors"], secondary: ["frontDelts", "quads", "obliques"], joints: ["hip", "knee", "shoulder"],
    info: {
      fa: { start: "حالت پلانک بلند با دست‌های زیر شانه.", con: "زانو را با سرعت به سمت سینه بیاورید.", ecc: "پا را به عقب برگردانید و پای دیگر را جلو بیاورید.", rom: "زانو تا زیر لگن و بازگشت به پلانک کامل.", mistakes: ["بالا و پایین رفتن زیاد لگن", "جلوتر رفتن شانه‌ها از مچ دست"] },
      en: { start: "High plank with hands under the shoulders.", con: "Drive one knee quickly toward the chest.", ecc: "Return it back and switch legs.", rom: "Knee under the hips and back to a full plank.", mistakes: ["Bouncing the hips up and down", "Shoulders drifting past the wrists"] },
    },
  },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((def) => [def.id, def]));
