export type Muscle =
  | "سینه"
  | "پشت"
  | "شانه"
  | "جلو بازو"
  | "پشت بازو"
  | "پا"
  | "باسن"
  | "شکم"
  | "ساق"
  | "تمام بدن";

export interface Exercise {
  id: string;
  name: string;
  en: string;
  muscle: Muscle;
  equipment: string;
  level: "مبتدی" | "متوسط" | "پیشرفته";
  image: string;
  video: string;
  how: string;
  steps: string[];
  mistakes: string[];
  tips: string;
  alternatives: string[];
}

export interface Food {
  id: string;
  name: string;
  unit: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  image: string;
}

export const MUSCLES: Muscle[] = [
  "سینه",
  "پشت",
  "شانه",
  "جلو بازو",
  "پشت بازو",
  "پا",
  "باسن",
  "شکم",
  "ساق",
  "تمام بدن",
];

export const EQUIPMENT = ["هالتر", "دمبل", "دستگاه", "کابل", "وزن بدن", "کتل‌بل", "کش"];

const V = "https://videos.pexels.com/video-files/4753996/4753996-hd_1920_1080_30fps.mp4";
const V2 = "https://videos.pexels.com/video-files/5319066/5319066-uhd_2560_1440_25fps.mp4";
const V3 = "https://videos.pexels.com/video-files/2795750/2795750-hd_1920_1080_25fps.mp4";

export const EXERCISES: Exercise[] = [
  {
    id: "ex-bench",
    name: "پرس سینه هالتر",
    en: "Barbell Bench Press",
    muscle: "سینه",
    equipment: "هالتر",
    level: "متوسط",
    image: "https://images.pexels.com/photos/3916768/pexels-photo-3916768.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V,
    how: "حرکت اصلی حجم سینه. هالتر را کنترل‌شده پایین بیاور و با فشار پا و سینه بالا بفرست.",
    steps: ["روی نیمکت دراز بکش، پاها محکم روی زمین.", "هالتر را کمی پهن‌تر از شانه بگیر.", "میله را تا میانه سینه پایین بیاور.", "بدون قوس کمر بیش‌ازحد، هالتر را بالا بفرست."],
    mistakes: ["بالا آمدن باسن از نیمکت", "باز شدن بیش از حد آرنج", "ضربه زدن هالتر به سینه"],
    tips: "کتف‌ها را جمع کن و قفسه سینه را بالا نگه دار. Tempo پیشنهادی ۳-۰-۱.",
    alternatives: ["پرس دمبل", "پرس دستگاه سینه"],
  },
  {
    id: "ex-incline-db",
    name: "پرس بالا سینه دمبل",
    en: "Incline Dumbbell Press",
    muscle: "سینه",
    equipment: "دمبل",
    level: "متوسط",
    image: "https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V2,
    how: "زاویه نیمکت ۳۰ تا ۴۵ درجه. تمرکز روی بخش بالایی سینه.",
    steps: ["نیمکت را ۳۰–۴۵ درجه تنظیم کن.", "دمبل‌ها را هم‌سطح شانه نگه دار.", "بالا بفرست تا دست‌ها صاف اما قفل نشوند.", "کنترل‌شده پایین بیاور."],
    mistakes: ["زاویه خیلی تند نیمکت", "به‌هم خوردن دمبل‌ها در بالا"],
    tips: "کف دست کمی به داخل بچرخد تا فشار از سرشانه کم شود.",
    alternatives: ["پرس بالا سینه هالتر", "فلای کابل بالا"],
  },
  {
    id: "ex-pullup",
    name: "بارفیکس",
    en: "Pull-Up",
    muscle: "پشت",
    equipment: "وزن بدن",
    level: "پیشرفته",
    image: "https://images.pexels.com/photos/34791493/pexels-photo-34791493.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    video: V3,
    how: "کشش عمودی برای عرض پشت. چانه را بالای میله ببر.",
    steps: ["میله را کمی پهن‌تر از شانه بگیر.", "بدن را ثابت نگه دار.", "سینه را به سمت میله بکش.", "آهسته پایین بیا."],
    mistakes: ["تاب خوردن بدن", "نرفتن کامل تا بالا"],
    tips: "اگر سخت است از کش کمکی یا دستگاه کمک‌دار استفاده کن.",
    alternatives: ["زیربغل سیم‌کش", "بارفیکس کمکی"],
  },
  {
    id: "ex-lat",
    name: "زیربغل سیم‌کش",
    en: "Lat Pulldown",
    muscle: "پشت",
    equipment: "کابل",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/19025671/pexels-photo-19025671.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V,
    how: "جایگزین عالی بارفیکس برای ساختن عرض پشت.",
    steps: ["دستگیره را پهن بگیر.", "تنه کمی به عقب.", "میله را تا استخوان ترقوه پایین بکش.", "آرنج‌ها را به سمت پهلو ببر."],
    mistakes: ["کشیدن با دست به‌جای پشت", "عقب دادن بیش از حد تنه"],
    tips: "قبل از شروع کتف را پایین و عقب بده.",
    alternatives: ["بارفیکس", "زیربغل دمبل تک‌دست"],
  },
  {
    id: "ex-ohp",
    name: "پرس سرشانه هالتر",
    en: "Overhead Press",
    muscle: "شانه",
    equipment: "هالتر",
    level: "متوسط",
    image: "https://images.pexels.com/photos/4720776/pexels-photo-4720776.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V2,
    how: "حرکت ترکیبی قدرت شانه و هسته بدن.",
    steps: ["هالتر را روی ترقوه نگه دار.", "باسن را کمی جمع کن.", "میله را بالای سر بفرست.", "در بالا گوش‌ها از بین بازوها دیده شوند."],
    mistakes: ["قوس کمر زیاد", "هل دادن با پا (پوش‌پرس ناخواسته)"],
    tips: "شکم را سفت کن مثل اینکه ضربه‌ای در راه است.",
    alternatives: ["پرس دمبل نشسته", "پرس آرنولدی"],
  },
  {
    id: "ex-latraise",
    name: "نشر جانب دمبل",
    en: "Dumbbell Lateral Raise",
    muscle: "شانه",
    equipment: "دمبل",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/4587365/pexels-photo-4587365.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    video: V,
    how: "ایزولیشن بخش میانی سرشانه برای پهنای شانه.",
    steps: ["دمبل‌ها کنار بدن.", "با آرنج کمی خم بالا ببر تا سطح شانه.", "۱ ثانیه مکث.", "آهسته پایین."],
    mistakes: ["تاب دادن بدن", "بالا بردن بالاتر از شانه با وزن زیاد"],
    tips: "انگار دمبل را از پهلو خالی می‌کنی، نه اینکه بالا پرتاب کنی.",
    alternatives: ["نشر جانب کابل", "نشر جانب دستگاه"],
  },
  {
    id: "ex-curl",
    name: "جلو بازو هالتر",
    en: "Barbell Curl",
    muscle: "جلو بازو",
    equipment: "هالتر",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/4164450/pexels-photo-4164450.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V3,
    how: "حرکت پایه حجم جلو بازو.",
    steps: ["ایستاده، آرنج چسبیده به پهلو.", "هالتر را تا شانه بالا بیاور.", "بدون تاب، پایین ببر."],
    mistakes: ["تاب کمر", "باز شدن آرنج از پهلو"],
    tips: "فاز منفی ۳ ثانیه باشد.",
    alternatives: ["جلو بازو دمبل", "جلو بازو لاری"],
  },
  {
    id: "ex-pushdown",
    name: "پشت بازو سیم‌کش",
    en: "Triceps Pushdown",
    muscle: "پشت بازو",
    equipment: "کابل",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/949131/pexels-photo-949131.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V,
    how: "ایزولیشن پشت بازو با فشار ثابت کابل.",
    steps: ["آرنج ثابت کنار بدن.", "دستگیره را تا پایین فشار بده.", "در پایین پشت بازو را منقبض کن.", "کنترل‌شده بالا بیاور."],
    mistakes: ["حرکت دادن شانه", "قفل کردن خشن آرنج"],
    tips: "بدن را کمی به جلو خم کن تا دامنه بهتر شود.",
    alternatives: ["پشت بازو دمبل پشت سر", "دیپ موازی"],
  },
  {
    id: "ex-squat",
    name: "اسکوات هالتر",
    en: "Back Squat",
    muscle: "پا",
    equipment: "هالتر",
    level: "متوسط",
    image: "https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V2,
    how: "پادشاه حرکات پایین‌تنه. چهارسر، باسن و مرکز بدن.",
    steps: ["هالتر روی ذوزنقه بالایی.", "پاها کمی بازتر از لگن.", "باسن را عقب و پایین بفرست.", "تا موازی یا پایین‌تر، سپس بالا بیا."],
    mistakes: ["جمع شدن زانو به داخل", "قوز کردن کمر", "پاشنه جدا از زمین"],
    tips: "نفس را قبل از پایین رفتن حبس کن (بریس). زانو در جهت پنجه.",
    alternatives: ["گابلت اسکوات", "پرس پا"],
  },
  {
    id: "ex-rdl",
    name: "ددلیفت رومانیایی",
    en: "Romanian Deadlift",
    muscle: "پا",
    equipment: "هالتر",
    level: "متوسط",
    image: "https://images.pexels.com/photos/27810159/pexels-photo-27810159.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V3,
    how: "تمرکز روی همسترینگ و باسن با لولا کردن لگن.",
    steps: ["هالتر نزدیک ران.", "باسن را عقب بفرست، زانو کمی خم.", "تا زیر زانو پایین برو.", "با فشار باسن بالا بیا."],
    mistakes: ["خم کردن کمر", "دور شدن هالتر از بدن"],
    tips: "تصور کن با باسن در را می‌بندی.",
    alternatives: ["هیپ‌تراست", "ددلیفت دمبل"],
  },
  {
    id: "ex-lunge",
    name: "لانج دمبل",
    en: "Dumbbell Lunge",
    muscle: "پا",
    equipment: "دمبل",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/4753888/pexels-photo-4753888.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    video: V,
    how: "تک‌پا برای تعادل، چهارسر و باسن.",
    steps: ["یک قدم بزرگ جلو.", "زانوی عقب به سمت زمین.", "زانوی جلو پشت پنجه بماند.", "هل بده بالا و عوض کن."],
    mistakes: ["زانوی جلو جلوتر از پنجه بیش از حد", "تنه خم به جلو"],
    tips: "گام را آن‌قدر بزرگ بردار که هر دو زانو حدود ۹۰ درجه شوند.",
    alternatives: ["اسپلیت اسکوات", "استپ‌آپ"],
  },
  {
    id: "ex-hip",
    name: "هیپ‌تراست",
    en: "Hip Thrust",
    muscle: "باسن",
    equipment: "هالتر",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/4587350/pexels-photo-4587350.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    video: V2,
    how: "بهترین حرکت فعال‌سازی و حجم باسن.",
    steps: ["کتف روی نیمکت.", "هالتر روی لگن با پد.", "باسن را تا خط تنه بالا بفرست.", "۱ ثانیه منقبض کن و پایین."],
    mistakes: ["قوس کمر به‌جای باسن", "چانه بالا"],
    tips: "چانه را به سینه نزدیک کن تا کمر درگیر نشود.",
    alternatives: ["پل باسن", "کیک‌بک کابل"],
  },
  {
    id: "ex-crunch",
    name: "کرانچ",
    en: "Crunch",
    muscle: "شکم",
    equipment: "وزن بدن",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/3930994/pexels-photo-3930994.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    video: V,
    how: "حرکت پایه شکم مستقیم. دامنه کوتاه و کنترل‌شده.",
    steps: ["به پشت، زانو خم.", "دست پشت سر بدون کشیدن گردن.", "شانه را از زمین جدا کن.", "آهسته پایین."],
    mistakes: ["کشیدن گردن", "دامنه خیلی بزرگ"],
    tips: "هوا را در بالا خالی کن و شکم را تو بده.",
    alternatives: ["کرانچ کابل", "لگ‌ریز"],
  },
  {
    id: "ex-plank",
    name: "پلانک",
    en: "Plank",
    muscle: "شکم",
    equipment: "وزن بدن",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/8769165/pexels-photo-8769165.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    video: V3,
    how: "استقامت مرکز بدن. بدن در یک خط.",
    steps: ["روی ساعد و پنجه.", "باسن نه بالا نه افتاده.", "نفس را نگه ندار.", "زمان را حفظ کن."],
    mistakes: ["افتادگی کمر", "بالا بردن باسن"],
    tips: "تصور کن یک سینی روی کمرت است و نباید بیفتد.",
    alternatives: ["پلانک زانو", "ددباگ"],
  },
  {
    id: "ex-calf",
    name: "ساق ایستاده",
    en: "Standing Calf Raise",
    muscle: "ساق",
    equipment: "دستگاه",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/36777945/pexels-photo-36777945.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    video: V,
    how: "دامنه کامل برای دوقلو. مکث در بالا و پایین.",
    steps: ["روی لبه پله بایست.", "تا حداکثر پایین برو.", "تا پنجه بالا بیا.", "۱ ثانیه مکث."],
    mistakes: ["خم کردن زانو", "دامنه ناقص"],
    tips: "هر پا را جدا هم کار کن تا عدم‌تقارن رفع شود.",
    alternatives: ["ساق نشسته", "ساق دمبل"],
  },
  {
    id: "ex-burpee",
    name: "بورپی",
    en: "Burpee",
    muscle: "تمام بدن",
    equipment: "وزن بدن",
    level: "پیشرفته",
    image: "https://images.pexels.com/photos/17221279/pexels-photo-17221279.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    video: V2,
    how: "حرکت هوازی تمام‌بدن برای ظرفیت قلبی و چربی‌سوزی.",
    steps: ["اسکوات، دست روی زمین.", "پا را عقب پرتاب کن به پلانک.", "شنا اختیاری.", "پا جلو و بپر بالا."],
    mistakes: ["افت کمر در پلانک", "فرود خشن"],
    tips: "اگر زانو حساس است پرش را حذف کن (no-jump).",
    alternatives: ["اسکوات پرشی", "کوهنوردی"],
  },
  {
    id: "ex-row",
    name: "زیربغل دمبل خم",
    en: "Bent-Over Dumbbell Row",
    muscle: "پشت",
    equipment: "دمبل",
    level: "متوسط",
    image: "https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=200&w=200",
    video: V3,
    how: "ضخامت پشت و تعادل دو طرف بدن.",
    steps: ["یک زانو روی نیمکت.", "دمبل را تا لگن بالا بکش.", "آرنج نزدیک بدن.", "آهسته پایین."],
    mistakes: ["چرخش تنه", "بالا کشیدن شانه"],
    tips: "در بالا ۲ ثانیه مکث کن و کتف را جمع کن.",
    alternatives: ["زیربغل هالتر خم", "سیت‌رو"],
  },
  {
    id: "ex-pushup",
    name: "شنا سوئدی",
    en: "Push-Up",
    muscle: "سینه",
    equipment: "وزن بدن",
    level: "مبتدی",
    image: "https://images.pexels.com/photos/7900682/pexels-photo-7900682.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
    video: V,
    how: "حرکت پایه سینه، شانه و پشت بازو بدون وسیله.",
    steps: ["دست کمی پهن‌تر از شانه.", "بدن در خط پلانک.", "سینه نزدیک زمین.", "هل بده بالا."],
    mistakes: ["افتادگی کمر", "باز شدن آرنج ۹۰ درجه به بیرون"],
    tips: "اگر سخت است زانو بگذار؛ اگر آسان است وزنه روی کمر.",
    alternatives: ["شنا زانو", "شنا روی دمبل"],
  },
];

/* تصاویر حرفه‌ای و دقیق خود حرکت — مرد، نور باشگاهی، کیفیت بالا */
const pxPro = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1200`;

const MALE_IMAGES: Record<string, string> = {
  "ex-bench": pxPro(3837788),
  "ex-incline-db": pxPro(3917659),
  "ex-pullup": pxPro(14623673),
  "ex-lat": pxPro(3838697),
  "ex-ohp": pxPro(5327466),
  "ex-latraise": pxPro(6550844),
  "ex-curl": pxPro(5837271),
  "ex-pushdown": pxPro(5327505),
  "ex-squat": pxPro(5929236),
  "ex-rdl": pxPro(4853280),
  "ex-lunge": pxPro(38755290),
  "ex-hip": pxPro(3837757),
  "ex-crunch": pxPro(6496105),
  "ex-plank": pxPro(4944959),
  "ex-calf": pxPro(13315489),
  "ex-burpee": pxPro(4920426),
  "ex-row": pxPro(10754973),
  "ex-pushup": pxPro(4162491),
};

EXERCISES.forEach((e) => {
  if (MALE_IMAGES[e.id]) e.image = MALE_IMAGES[e.id];
  // ویدیوهای کتابخانه حذف شد — فقط تصویر حرفه‌ای دقیق حرکت نمایش داده می‌شود
  e.video = "";
});

export const FOODS: Food[] = [
  { id: "f1", name: "سینه مرغ گریل", unit: "۱۰۰ گرم", kcal: 165, p: 31, c: 0, f: 3.6, image: "https://images.pexels.com/photos/842545/pexels-photo-842545.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f2", name: "برنج سفید پخته", unit: "۱۰۰ گرم", kcal: 130, p: 2.7, c: 28, f: 0.3, image: "https://images.pexels.com/photos/32810337/pexels-photo-32810337.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f3", name: "تخم‌مرغ آب‌پز", unit: "۱ عدد", kcal: 78, p: 6.3, c: 0.6, f: 5.3, image: "https://images.pexels.com/photos/2116090/pexels-photo-2116090.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f4", name: "جو دوسر", unit: "۴۰ گرم", kcal: 150, p: 5, c: 27, f: 3, image: "https://images.pexels.com/photos/1591226/pexels-photo-1591226.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f5", name: "ماست یونانی", unit: "۱۵۰ گرم", kcal: 130, p: 16, c: 6, f: 4, image: "https://images.pexels.com/photos/27969847/pexels-photo-27969847.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f6", name: "موز", unit: "۱ عدد متوسط", kcal: 105, p: 1.3, c: 27, f: 0.4, image: "https://images.pexels.com/photos/2116090/pexels-photo-2116090.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f7", name: "نان سنگک", unit: "۱ برش", kcal: 140, p: 5, c: 28, f: 0.8, image: "https://images.pexels.com/photos/1591226/pexels-photo-1591226.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f8", name: "ماهی سالمون", unit: "۱۲۰ گرم", kcal: 250, p: 25, c: 0, f: 16, image: "https://images.pexels.com/photos/842545/pexels-photo-842545.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f9", name: "بادام", unit: "۳۰ گرم", kcal: 170, p: 6, c: 6, f: 15, image: "https://images.pexels.com/photos/1591226/pexels-photo-1591226.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f10", name: "سیب", unit: "۱ عدد", kcal: 95, p: 0.5, c: 25, f: 0.3, image: "https://images.pexels.com/photos/27969847/pexels-photo-27969847.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f11", name: "سیب‌زمینی پخته", unit: "۱۵۰ گرم", kcal: 140, p: 3, c: 32, f: 0.2, image: "https://images.pexels.com/photos/32810337/pexels-photo-32810337.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f12", name: "پنیر کم‌چرب", unit: "۳۰ گرم", kcal: 80, p: 7, c: 1, f: 5, image: "https://images.pexels.com/photos/1591226/pexels-photo-1591226.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f13", name: "کره بادام‌زمینی", unit: "۲۰ گرم", kcal: 120, p: 5, c: 4, f: 10, image: "https://images.pexels.com/photos/2116090/pexels-photo-2116090.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f14", name: "خیار و گوجه", unit: "۱ کاسه", kcal: 35, p: 1.5, c: 7, f: 0.2, image: "https://images.pexels.com/photos/27969847/pexels-photo-27969847.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { id: "f15", name: "پروتئین وی", unit: "۱ اسکوپ", kcal: 120, p: 24, c: 3, f: 1.5, image: "https://images.pexels.com/photos/32810337/pexels-photo-32810337.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
];

export function getExercise(id: string): Exercise {
  return EXERCISES.find((e) => e.id === id) ?? EXERCISES[0];
}

export function getFood(id: string): Food {
  return FOODS.find((f) => f.id === id) ?? FOODS[0];
}
