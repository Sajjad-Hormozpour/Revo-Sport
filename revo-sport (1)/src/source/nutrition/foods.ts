import type { FoodEntry } from "../data/types";

/* ------------------------------------------------------------------ */
/*  Revo sport food database                                           */
/*  Values are per 100 g of edible portion (cooked where stated).      */
/*  Household units follow common Iranian serving references.          */
/* ------------------------------------------------------------------ */

export type UnitKey =
  | "g" | "ml" | "piece" | "slice" | "palm" | "tbsp" | "tsp" | "cup" | "ladle" | "matchbox"
  | "handful" | "scoop" | "bowl" | "serving" | "skewer" | "can" | "plate" | "cube" | "portion";

export const UNIT_LABELS: Record<UnitKey, { fa: string; en: string }> = {
  g: { fa: "گرم", en: "g" },
  ml: { fa: "میلی‌لیتر", en: "ml" },
  piece: { fa: "عدد", en: "piece" },
  slice: { fa: "برش", en: "slice" },
  palm: { fa: "کف دست", en: "palm-size" },
  tbsp: { fa: "قاشق غذاخوری", en: "tbsp" },
  tsp: { fa: "قاشق مرباخوری", en: "tsp" },
  cup: { fa: "لیوان", en: "cup" },
  ladle: { fa: "کفگیر", en: "rice paddle" },
  matchbox: { fa: "قوطی کبریت", en: "matchbox-size" },
  handful: { fa: "مشت", en: "handful" },
  scoop: { fa: "اسکوپ", en: "scoop" },
  bowl: { fa: "کاسه", en: "bowl" },
  serving: { fa: "پرس", en: "serving" },
  skewer: { fa: "سیخ", en: "skewer" },
  can: { fa: "قوطی", en: "can" },
  plate: { fa: "بشقاب", en: "plate" },
  cube: { fa: "حبه", en: "cube" },
  portion: { fa: "واحد", en: "portion" },
};

export type FoodCategory =
  | "grains" | "protein" | "dairy" | "legumes" | "vegetables" | "fruits" | "fats" | "dishes" | "sweets" | "supplements" | "custom";

export const FOOD_CATEGORIES: { key: FoodCategory; fa: string; en: string }[] = [
  { key: "grains", fa: "نان و غلات", en: "Breads & grains" },
  { key: "protein", fa: "گوشت، مرغ، ماهی و تخم‌مرغ", en: "Meat, fish & eggs" },
  { key: "dairy", fa: "لبنیات", en: "Dairy" },
  { key: "legumes", fa: "حبوبات", en: "Legumes" },
  { key: "vegetables", fa: "سبزیجات", en: "Vegetables" },
  { key: "fruits", fa: "میوه‌ها", en: "Fruits" },
  { key: "fats", fa: "چربی‌ها و مغزها", en: "Fats, nuts & seeds" },
  { key: "dishes", fa: "غذاهای ایرانی", en: "Iranian dishes" },
  { key: "sweets", fa: "نوشیدنی و شیرین‌کننده", en: "Drinks & sweeteners" },
  { key: "supplements", fa: "مکمل‌های غذایی", en: "Supplements" },
  { key: "custom", fa: "غذاهای من", en: "My foods" },
];

export interface FoodUnit {
  key: UnitKey;
  grams: number;
  /** Custom label (used for coach-defined foods). */
  label?: string;
  labelEn?: string;
}

export interface NutriFood {
  id: string;
  fa: string;
  en: string;
  cat: FoodCategory;
  per100: { kcal: number; p: number; c: number; f: number; fiber: number };
  units: FoodUnit[];
  custom?: boolean;
}

function F(
  id: string, fa: string, en: string, cat: FoodCategory,
  kcal: number, p: number, c: number, f: number, fiber: number, units = "",
): NutriFood {
  const parsed: FoodUnit[] = units
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, grams] = part.split(":");
      return { key: key as UnitKey, grams: Number(grams) };
    });
  return { id: `rf_${id}`, fa, en, cat, per100: { kcal, p, c, f, fiber }, units: [{ key: "g", grams: 1 }, ...parsed] };
}

export const FOOD_DB: NutriFood[] = [
  /* ---------- breads & grains ---------- */
  F("sangak", "نان سنگک", "Sangak bread", "grains", 275, 9.6, 55, 1.4, 4.5, "palm:30"),
  F("barbari", "نان بربری", "Barbari bread", "grains", 266, 8.5, 53, 2, 2.4, "palm:30"),
  F("lavash", "نان لواش", "Lavash bread", "grains", 290, 9, 59, 1.5, 2.2, "palm:10"),
  F("taftoon", "نان تافتون", "Taftoon bread", "grains", 280, 9, 56, 2, 2.5, "palm:30"),
  F("barley_bread", "نان جو", "Barley bread", "grains", 250, 8.5, 48, 3.5, 6, "palm:30"),
  F("toast_white", "نان تست سفید", "White toast bread", "grains", 265, 9, 49, 3.2, 2.7, "slice:25"),
  F("toast_ww", "نان تست سبوس‌دار", "Whole-wheat toast", "grains", 250, 12.5, 43, 3.5, 6, "slice:28"),
  F("oats", "جو دوسر (پرک)", "Rolled oats", "grains", 389, 16.9, 66, 6.9, 10.6, "tbsp:8,cup:80"),
  F("rice_white", "برنج سفید پخته", "Cooked white rice", "grains", 130, 2.7, 28.2, 0.3, 0.4, "tbsp:15,ladle:90,cup:160"),
  F("rice_brown", "برنج قهوه‌ای پخته", "Cooked brown rice", "grains", 123, 2.7, 25.6, 1, 1.6, "tbsp:15,ladle:90,cup:160"),
  F("pasta", "ماکارونی پخته", "Cooked pasta", "grains", 158, 5.8, 31, 0.9, 1.8, "tbsp:15,cup:140"),
  F("pasta_ww", "ماکارونی سبوس‌دار پخته", "Cooked whole-wheat pasta", "grains", 124, 5.3, 26.5, 0.5, 4.5, "tbsp:15,cup:140"),
  F("bulgur", "بلغور گندم پخته", "Cooked bulgur", "grains", 83, 3.1, 18.6, 0.2, 4.5, "tbsp:15,cup:180"),
  F("quinoa", "کینوا پخته", "Cooked quinoa", "grains", 120, 4.4, 21.3, 1.9, 2.8, "tbsp:15,cup:185"),
  F("potato", "سیب‌زمینی آب‌پز", "Boiled potato", "grains", 87, 1.9, 20.1, 0.1, 1.8, "piece:170"),
  F("sweet_potato", "سیب‌زمینی شیرین پخته", "Baked sweet potato", "grains", 90, 2, 20.7, 0.2, 3.3, "piece:150"),
  F("corn", "ذرت پخته", "Cooked sweet corn", "grains", 96, 3.4, 21, 1.5, 2.4, "piece:90,cup:150"),
  F("cornflakes", "کورن‌فلکس", "Corn flakes", "grains", 357, 7.5, 84, 0.4, 3.3, "cup:28"),
  F("granola", "گرانولا", "Granola", "grains", 471, 10, 64, 20, 7, "tbsp:10,cup:120"),

  /* ---------- meat, fish & eggs ---------- */
  F("chicken_breast", "سینه مرغ گریل‌شده", "Grilled chicken breast", "protein", 165, 31, 0, 3.6, 0, "palm:100,piece:170"),
  F("chicken_thigh", "ران مرغ بدون پوست (پخته)", "Skinless chicken thigh, cooked", "protein", 209, 26, 0, 10.9, 0, "piece:90"),
  F("beef_lean", "گوشت گوساله لخم (پخته)", "Lean beef, cooked", "protein", 200, 29, 0, 9, 0, "palm:100"),
  F("beef_ground", "گوشت چرخ‌کرده کم‌چرب (پخته)", "Lean ground beef, cooked", "protein", 217, 26, 0, 12, 0, "tbsp:20,palm:100"),
  F("lamb_lean", "گوشت گوسفندی لخم (پخته)", "Lean lamb, cooked", "protein", 206, 28, 0, 9.5, 0, "palm:100"),
  F("turkey", "سینه بوقلمون (پخته)", "Turkey breast, cooked", "protein", 135, 30, 0, 1, 0, "palm:100"),
  F("trout", "ماهی قزل‌آلا (پخته)", "Rainbow trout, cooked", "protein", 168, 24, 0, 7.4, 0, "palm:100"),
  F("salmon", "ماهی سالمون (پخته)", "Salmon, cooked", "protein", 206, 22, 0, 12, 0, "palm:100"),
  F("tuna_water", "تن ماهی در آب (آبکش‌شده)", "Tuna in water, drained", "protein", 116, 26, 0, 0.8, 0, "tbsp:15,can:120"),
  F("tuna_oil", "تن ماهی در روغن (آبکش‌شده)", "Tuna in oil, drained", "protein", 198, 29, 0, 8, 0, "tbsp:15,can:120"),
  F("shrimp", "میگو (پخته)", "Shrimp, cooked", "protein", 99, 24, 0.2, 0.3, 0, "piece:7,palm:100"),
  F("egg", "تخم‌مرغ کامل (آب‌پز)", "Whole egg, boiled", "protein", 155, 12.6, 1.1, 10.6, 0, "piece:50"),
  F("egg_white", "سفیده تخم‌مرغ", "Egg white", "protein", 52, 10.9, 0.7, 0.2, 0, "piece:33"),
  F("beef_liver", "جگر گوساله (پخته)", "Beef liver, cooked", "protein", 175, 26.5, 5.2, 4.7, 0, "palm:100"),
  F("koobideh", "کباب کوبیده", "Koobideh kebab", "protein", 270, 19, 3, 20.5, 0.3, "skewer:90"),
  F("joojeh", "جوجه‌کباب (سینه)", "Joojeh kebab (breast)", "protein", 175, 28, 2, 6, 0.2, "skewer:150"),

  /* ---------- dairy ---------- */
  F("milk_low", "شیر کم‌چرب (1.5%)", "Low-fat milk (1.5%)", "dairy", 45, 3.3, 4.8, 1.5, 0, "ml:1,cup:240"),
  F("milk_full", "شیر پرچرب (3%)", "Whole milk (3%)", "dairy", 60, 3.2, 4.7, 3.2, 0, "ml:1,cup:240"),
  F("yogurt_low", "ماست کم‌چرب", "Low-fat yogurt", "dairy", 56, 3.8, 5.5, 1.5, 0, "tbsp:15,cup:240"),
  F("yogurt_greek", "ماست یونانی کم‌چرب", "Low-fat Greek yogurt", "dairy", 73, 10, 3.9, 1.9, 0, "tbsp:15,cup:240"),
  F("cheese_white", "پنیر سفید ایرانی", "Iranian white cheese", "dairy", 250, 15, 2.5, 20, 0, "matchbox:30"),
  F("cheese_low", "پنیر کم‌چرب", "Low-fat cheese", "dairy", 170, 18, 3, 9, 0, "matchbox:30"),
  F("cottage", "پنیر کاتیج", "Cottage cheese", "dairy", 98, 11, 3.4, 4.3, 0, "tbsp:20,cup:225"),
  F("mozzarella", "پنیر پیتزا (موتزارلا)", "Mozzarella", "dairy", 280, 28, 3, 17, 0, "matchbox:30"),
  F("labneh", "پنیر لبنه", "Labneh", "dairy", 230, 6, 5, 21, 0, "tbsp:20"),
  F("doogh", "دوغ کم‌نمک", "Doogh (yogurt drink)", "dairy", 28, 1.7, 2.3, 1.3, 0, "ml:1,cup:250"),
  F("kefir", "کفیر", "Kefir", "dairy", 41, 3.8, 4.5, 1, 0, "ml:1,cup:240"),

  /* ---------- legumes ---------- */
  F("lentils", "عدس پخته", "Cooked lentils", "legumes", 116, 9, 20, 0.4, 7.9, "tbsp:15,cup:200"),
  F("chickpeas", "نخود پخته", "Cooked chickpeas", "legumes", 164, 8.9, 27.4, 2.6, 7.6, "tbsp:15,cup:165"),
  F("kidney", "لوبیا قرمز پخته", "Cooked kidney beans", "legumes", 127, 8.7, 22.8, 0.5, 6.4, "tbsp:15,cup:180"),
  F("pinto", "لوبیا چیتی پخته", "Cooked pinto beans", "legumes", 143, 9, 26, 0.7, 9, "tbsp:15,cup:170"),
  F("mung", "ماش پخته", "Cooked mung beans", "legumes", 105, 7, 19, 0.4, 7.6, "tbsp:15,cup:200"),
  F("split_peas", "لپه پخته", "Cooked split peas", "legumes", 118, 8.3, 21, 0.4, 8.3, "tbsp:15,cup:195"),
  F("soy", "سویا (پروتئین گیاهی خشک)", "Textured soy protein (dry)", "legumes", 333, 52, 33, 1.2, 18, "tbsp:7,cup:50"),

  /* ---------- vegetables ---------- */
  F("lettuce", "کاهو", "Lettuce", "vegetables", 15, 1.4, 2.9, 0.2, 1.3, "cup:50"),
  F("cucumber", "خیار", "Cucumber", "vegetables", 15, 0.7, 3.6, 0.1, 0.5, "piece:100"),
  F("tomato", "گوجه‌فرنگی", "Tomato", "vegetables", 18, 0.9, 3.9, 0.2, 1.2, "piece:120"),
  F("carrot", "هویج", "Carrot", "vegetables", 41, 0.9, 9.6, 0.2, 2.8, "piece:70"),
  F("broccoli", "کلم بروکلی (پخته)", "Broccoli, cooked", "vegetables", 35, 2.4, 7.2, 0.4, 3.3, "cup:90"),
  F("cauliflower", "گل‌کلم (پخته)", "Cauliflower, cooked", "vegetables", 23, 1.8, 4.1, 0.5, 2.3, "cup:125"),
  F("spinach", "اسفناج (پخته)", "Spinach, cooked", "vegetables", 23, 3, 3.8, 0.3, 2.4, "cup:180"),
  F("zucchini", "کدو سبز (پخته)", "Zucchini, cooked", "vegetables", 15, 1.1, 2.7, 0.4, 1, "cup:180"),
  F("eggplant", "بادمجان کبابی (بدون روغن)", "Grilled eggplant (no oil)", "vegetables", 35, 0.8, 8.7, 0.2, 2.5, "piece:250"),
  F("bell_pepper", "فلفل دلمه‌ای", "Bell pepper", "vegetables", 26, 1, 6, 0.2, 2, "piece:120"),
  F("mushroom", "قارچ (پخته)", "Mushrooms, cooked", "vegetables", 28, 2.2, 5.3, 0.5, 2.2, "cup:155"),
  F("green_beans", "لوبیا سبز (پخته)", "Green beans, cooked", "vegetables", 35, 1.9, 7.9, 0.3, 3.2, "cup:125"),
  F("onion", "پیاز", "Onion", "vegetables", 40, 1.1, 9.3, 0.1, 1.7, "piece:110"),
  F("cabbage", "کلم پیچ", "Cabbage", "vegetables", 25, 1.3, 5.8, 0.1, 2.5, "cup:90"),
  F("celery", "کرفس", "Celery", "vegetables", 16, 0.7, 3, 0.2, 1.6, "piece:40"),
  F("beet", "لبو (چغندر پخته)", "Cooked beetroot", "vegetables", 44, 1.7, 10, 0.2, 2, "piece:100"),
  F("herbs", "سبزی خوردن", "Fresh herbs", "vegetables", 25, 2.5, 4, 0.5, 2.5, "handful:30"),
  F("shirazi", "سالاد شیرازی (بدون روغن)", "Shirazi salad (no oil)", "vegetables", 20, 0.9, 4, 0.2, 1, "bowl:150"),

  /* ---------- fruits ---------- */
  F("apple", "سیب", "Apple", "fruits", 52, 0.3, 13.8, 0.2, 2.4, "piece:180"),
  F("banana", "موز", "Banana", "fruits", 89, 1.1, 22.8, 0.3, 2.6, "piece:118"),
  F("orange", "پرتقال", "Orange", "fruits", 47, 0.9, 11.8, 0.1, 2.4, "piece:130"),
  F("tangerine", "نارنگی", "Tangerine", "fruits", 53, 0.8, 13.3, 0.3, 1.8, "piece:75"),
  F("kiwi", "کیوی", "Kiwi", "fruits", 61, 1.1, 14.7, 0.5, 3, "piece:70"),
  F("pomegranate", "انار (دانه)", "Pomegranate arils", "fruits", 83, 1.7, 18.7, 1.2, 4, "cup:170"),
  F("grapes", "انگور", "Grapes", "fruits", 69, 0.7, 18.1, 0.2, 0.9, "cup:150"),
  F("watermelon", "هندوانه", "Watermelon", "fruits", 30, 0.6, 7.6, 0.2, 0.4, "cup:150,slice:280"),
  F("melon", "خربزه و طالبی", "Melon", "fruits", 34, 0.8, 8.2, 0.2, 0.9, "cup:160,slice:150"),
  F("strawberry", "توت‌فرنگی", "Strawberries", "fruits", 32, 0.7, 7.7, 0.3, 2, "piece:12,cup:150"),
  F("pear", "گلابی", "Pear", "fruits", 57, 0.4, 15, 0.1, 3.1, "piece:178"),
  F("peach", "هلو", "Peach", "fruits", 39, 0.9, 9.5, 0.3, 1.5, "piece:150"),
  F("apricot", "زردآلو", "Apricot", "fruits", 48, 1.4, 11, 0.4, 2, "piece:35"),
  F("cherries", "گیلاس", "Cherries", "fruits", 63, 1.1, 16, 0.2, 2.1, "piece:8,cup:140"),
  F("fig", "انجیر تازه", "Fresh fig", "fruits", 74, 0.8, 19, 0.3, 2.9, "piece:50"),
  F("persimmon", "خرمالو", "Persimmon", "fruits", 70, 0.6, 18.6, 0.2, 3.6, "piece:170"),
  F("dates", "خرما", "Dates", "fruits", 282, 2.5, 75, 0.4, 8, "piece:10"),
  F("raisins", "کشمش", "Raisins", "fruits", 299, 3.1, 79, 0.5, 3.7, "tbsp:10"),
  F("dried_fig", "انجیر خشک", "Dried figs", "fruits", 249, 3.3, 64, 0.9, 9.8, "piece:7"),

  /* ---------- fats, nuts & seeds ---------- */
  F("olive_oil", "روغن زیتون", "Olive oil", "fats", 884, 0, 0, 100, 0, "tsp:4.5,tbsp:13.5"),
  F("veg_oil", "روغن مایع گیاهی", "Vegetable oil", "fats", 884, 0, 0, 100, 0, "tsp:4.5,tbsp:13.5"),
  F("butter", "کره حیوانی", "Butter", "fats", 717, 0.9, 0.1, 81, 0, "tsp:5,tbsp:14"),
  F("peanut_butter", "کره بادام‌زمینی", "Peanut butter", "fats", 588, 25, 20, 50, 6, "tbsp:16"),
  F("tahini", "ارده", "Tahini", "fats", 595, 17, 21, 54, 9.3, "tbsp:15"),
  F("almonds", "بادام", "Almonds", "fats", 579, 21.2, 21.6, 49.9, 12.5, "piece:1.2,handful:28"),
  F("walnuts", "گردو", "Walnuts", "fats", 654, 15.2, 13.7, 65.2, 6.7, "piece:5,handful:28"),
  F("pistachio", "پسته", "Pistachios", "fats", 560, 20.2, 27.2, 45.3, 10.6, "piece:0.7,handful:28"),
  F("hazelnut", "فندق", "Hazelnuts", "fats", 628, 15, 16.7, 60.8, 9.7, "handful:28"),
  F("peanuts", "بادام‌زمینی", "Peanuts", "fats", 567, 25.8, 16.1, 49.2, 8.5, "handful:28"),
  F("cashew", "بادام هندی", "Cashews", "fats", 553, 18.2, 30.2, 43.9, 3.3, "handful:28"),
  F("sunflower", "مغز تخمه آفتابگردان", "Sunflower seeds", "fats", 584, 20.8, 20, 51.5, 8.6, "tbsp:9"),
  F("sesame", "کنجد", "Sesame seeds", "fats", 573, 17.7, 23.5, 49.7, 11.8, "tbsp:9"),
  F("flaxseed", "تخم کتان", "Flaxseed", "fats", 534, 18.3, 28.9, 42.2, 27.3, "tbsp:10"),
  F("chia", "تخم چیا", "Chia seeds", "fats", 486, 16.5, 42, 30.7, 34.4, "tbsp:12"),
  F("avocado", "آووکادو", "Avocado", "fats", 160, 2, 8.5, 14.7, 6.7, "piece:150"),
  F("olives", "زیتون سبز", "Green olives", "fats", 145, 1, 3.8, 15.3, 3.3, "piece:4"),

  /* ---------- Iranian dishes ---------- */
  F("ghormeh", "قورمه‌سبزی (بدون برنج)", "Ghormeh sabzi (no rice)", "dishes", 120, 7.5, 5.5, 7.5, 2.5, "serving:250"),
  F("gheymeh", "قیمه (بدون برنج و سیب‌زمینی)", "Gheymeh stew (no rice or fries)", "dishes", 120, 7.5, 8, 6.5, 2.5, "serving:250"),
  F("bademjan", "خورش بادمجان (بدون برنج)", "Eggplant stew (no rice)", "dishes", 115, 6, 7, 7.5, 2.2, "serving:250"),
  F("karafs", "خورش کرفس (بدون برنج)", "Celery stew (no rice)", "dishes", 85, 6, 4, 5, 1.5, "serving:250"),
  F("loobia_polo", "لوبیاپلو", "Loobia polo", "dishes", 160, 6.5, 23, 4.8, 2, "plate:300"),
  F("adas_polo", "عدس‌پلو", "Adas polo (lentil rice)", "dishes", 155, 4.5, 27, 3.5, 2.5, "plate:300"),
  F("zereshk_polo", "زرشک‌پلو با مرغ", "Zereshk polo with chicken", "dishes", 150, 10, 18, 4.5, 0.8, "plate:350"),
  F("tahchin", "ته‌چین مرغ", "Tahchin with chicken", "dishes", 190, 10, 22, 7, 0.5, "slice:200"),
  F("macaroni_iran", "ماکارونی با گوشت", "Persian macaroni with meat", "dishes", 170, 7, 22, 6, 1.5, "plate:300"),
  F("ash_reshteh", "آش رشته", "Ash reshteh", "dishes", 95, 4, 14, 2.5, 3, "bowl:300"),
  F("adasi", "عدسی", "Adasi (lentil stew)", "dishes", 95, 6, 15, 1.2, 4, "bowl:250"),
  F("soup_jo", "سوپ جو", "Barley soup", "dishes", 65, 3, 9, 2, 1.5, "bowl:250"),
  F("haleem", "حلیم (بدون شکر و کره)", "Haleem (no sugar or butter)", "dishes", 120, 6, 18, 2.5, 2, "bowl:250"),
  F("abgoosht", "آبگوشت (دیزی)", "Abgoosht (dizi)", "dishes", 120, 7, 9, 6, 2, "bowl:350"),
  F("omelette", "املت گوجه‌فرنگی", "Tomato omelette", "dishes", 130, 7, 3.5, 10, 0.8, "serving:200"),
  F("kuku_sabzi", "کوکو سبزی", "Kuku sabzi", "dishes", 190, 8, 6, 15, 2, "slice:80"),
  F("kashk_bademjan", "کشک بادمجان", "Kashk-e bademjan", "dishes", 140, 4, 9, 10, 2.5, "bowl:150"),
  F("kotlet", "کتلت", "Kotlet (meat patty)", "dishes", 240, 11, 15, 15, 1.5, "piece:70"),
  F("olivieh", "سالاد الویه", "Olivieh salad", "dishes", 210, 8, 12, 15, 1.5, "serving:150"),
  F("falafel", "فلافل", "Falafel", "dishes", 333, 13.3, 31.8, 17.8, 4.9, "piece:17"),
  F("pizza", "پیتزا مخلوط", "Mixed pizza", "dishes", 270, 11, 30, 12, 2, "slice:110"),

  /* ---------- drinks & sweeteners ---------- */
  F("honey", "عسل", "Honey", "sweets", 304, 0.3, 82.4, 0, 0.2, "tsp:7,tbsp:21"),
  F("jam", "مربا", "Jam", "sweets", 278, 0.4, 69, 0.1, 1, "tbsp:20"),
  F("sugar", "شکر و قند", "Sugar", "sweets", 387, 0, 100, 0, 0, "tsp:4,cube:4"),
  F("molasses", "شیره انگور", "Grape molasses", "sweets", 293, 0.5, 73, 0.2, 0, "tbsp:20"),
  F("dark_choc", "شکلات تلخ (70%)", "Dark chocolate (70%)", "sweets", 598, 7.8, 46, 43, 11, "piece:10"),
  F("oj", "آب پرتقال طبیعی", "Fresh orange juice", "sweets", 45, 0.7, 10.4, 0.2, 0.2, "ml:1,cup:240"),
  F("almond_milk", "شیر بادام بدون شکر", "Unsweetened almond milk", "sweets", 15, 0.6, 0.6, 1.1, 0.2, "ml:1,cup:240"),
  F("tea", "چای یا قهوه بدون شکر", "Tea or black coffee", "sweets", 1, 0.1, 0.2, 0, 0, "cup:240"),

  /* ---------- supplements ---------- */
  F("whey", "پودر وی پروتئین", "Whey protein powder", "supplements", 400, 80, 8, 6, 0, "scoop:30"),
  F("casein", "پودر کازئین", "Casein protein powder", "supplements", 360, 80, 6, 1.5, 0, "scoop:33"),
  F("gainer", "پودر گینر", "Mass gainer powder", "supplements", 380, 15, 75, 3, 1, "scoop:75"),
  F("protein_bar", "پروتئین بار", "Protein bar", "supplements", 350, 33, 35, 12, 6, "piece:60"),
];

export const FOOD_BY_ID = new Map(FOOD_DB.map((food) => [food.id, food]));

/* ---------------- coach-defined foods (stored in the existing foods table) ---------------- */

/** Builds the serving label stored on a custom food, e.g. "100 گرم" or "1 عدد (60 گرم)". */
export function customServing(unitLabel: string, grams: number): string {
  const label = unitLabel.trim() || "گرم";
  if (label === "گرم" || label.toLowerCase() === "g") return `${grams} گرم`;
  return `1 ${label} (${grams} گرم)`;
}

/** Reads the grams and unit label back from a custom food serving label. */
export function parseServing(serving: string): { grams: number; label: string } {
  const gramsMatch = serving.match(/(\d+(?:\.\d+)?)\s*(?:گرم|g\b)/i);
  const grams = gramsMatch ? Number(gramsMatch[1]) : 100;
  const unitMatch = serving.match(/^\s*1\s+(.+?)\s*\(/);
  return { grams: grams > 0 ? grams : 100, label: unitMatch ? unitMatch[1] : "گرم" };
}

export function customToFood(entry: FoodEntry): NutriFood {
  const { grams, label } = parseServing(entry.serving || "100 گرم");
  const factor = 100 / grams;
  const units: FoodUnit[] = [{ key: "g", grams: 1 }];
  if (label !== "گرم") units.push({ key: "portion", grams, label, labelEn: label });
  return {
    id: entry.id,
    fa: entry.name,
    en: entry.name,
    cat: "custom",
    custom: true,
    per100: {
      kcal: entry.kcal * factor,
      p: entry.p * factor,
      c: entry.c * factor,
      f: entry.f * factor,
      fiber: (entry.fiber || 0) * factor,
    },
    units,
  };
}

/** Persian-aware normalisation for search (Arabic letters, ZWNJ, case). */
export function normalizeSearch(value: string): string {
  return value
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
