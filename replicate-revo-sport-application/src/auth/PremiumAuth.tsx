import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./auth.css";
import {
  checkPhoneOtp,
  clearSignupDraft,
  checkSignupIdentity,
  sendPhoneOtp,
  type CoachPublic,
  createPayment,
  type OtpChallenge,
  type SubPlan,
  currentCoachNeedsProfile,
  currentUserSummary,
  getStats,
  isCoachCodeValid,
  PAYMENT_CONFIGURED,
  verifyPayment,
  lookupCoachByCode,
  isValidEmail,
  isValidPhone,
  loginLocal,
  logoutLocal,
  normalizePhone,
  registerLocal,
  saveCurrentTrainerProfile,
  type AuthStats,
  type SignupInput,
  type TrainerProfile,
} from "./handoff";

type CoachStep =
  | "coachPhoto"
  | "coachAge"
  | "coachSpecialty"
  | "coachCert"
  | "coachExperience"
  | "coachFormat"
  | "coachBio"
  | "coachReview";
type Step = "intro" | "login" | "signup" | "welcome" | "goal" | "level" | "age" | "weight" | "time" | "success" | "otp" | "profile" | "coachLink" | "plan" | CoachStep;
type Level = "Beginner" | "Intermediate" | "Advanced";
type LoginField = "identifier" | "password";
type SignupField = "name" | "email" | "phone" | "password" | "confirm" | "coachCode" | "terms";
type CoachField = "avatar" | "specialties" | "certBody" | "certification" | "experience" | "submit";
type CoachErrors = Partial<Record<CoachField, string>>;

type Draft = {
  step: Step;
  role: "trainer" | "trainee";
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  acceptTerms: boolean;
  coachCode: string;
  goal: string;
  level: Level;
  age: number;
  weight: number;
  hour: number;
  minute: number;
  period: "AM" | "PM";
  avatar: string;
  trainerAge: number;
  specialties: string[];
  certificationBody: string;
  certificationLevel: string;
  certification: string;
  experienceYears: number;
  coachingFormat: TrainerProfile["coachingFormat"];
  bio: string;
  phoneVerified: boolean;
  coachId: string;
  coachName: string;
  planId: string;
  planTitle: string;
  planSessions: number;
  planDays: number;
  planPrice: number;
  planPerks: string[];
};

const DRAFT_KEY = "revo-onboarding-v5";
const BASE: Draft = {
  step: "intro",
  role: "trainee",
  name: "",
  email: "",
  phone: "",
  password: "",
  confirm: "",
  acceptTerms: false,
  coachCode: "",
  goal: "Building Muscles",
  level: "Intermediate",
  age: 25,
  weight: 68,
  hour: 8,
  minute: 0,
  period: "PM",
  avatar: "",
  trainerAge: 30,
  specialties: [],
  certificationBody: "",
  certificationLevel: "Level 3",
  certification: "",
  experienceYears: 3,
  coachingFormat: "hybrid",
  bio: "",
  phoneVerified: false,
  coachId: "",
  coachName: "",
  planId: "",
  planTitle: "",
  planSessions: 0,
  planDays: 0,
  planPrice: 0,
  planPerks: [],
};

const ATHLETE_FLOW: Step[] = ["signup", "otp", "goal", "level", "age", "weight", "time", "profile", "coachLink", "plan"];
const ATHLETE_PROGRESS: Step[] = ["signup", "otp", "goal", "level", "age", "weight", "time", "profile", "coachLink", "plan"];
const COACH_STEPS: CoachStep[] = [
  "coachPhoto",
  "coachAge",
  "coachSpecialty",
  "coachCert",
  "coachExperience",
  "coachFormat",
  "coachBio",
  "coachReview",
];
const TRAINER_FLOW: Step[] = ["signup", "otp", ...COACH_STEPS];
const VIDEO_STEPS = new Set<Step>(["intro", "login", "welcome", "success"]);

/* Background reel — 20 short, lightweight clips of male athletes training only.
   Remote CDN files keep the build small; two <video> slots preload one clip ahead only. */
const V = "https://videos.pexels.com/video-files/";
const REEL_CLIPS: string[] = [
  `${V}35585588/15079435_1080_1920_30fps.mp4`, // man • focused lifting
  `${V}6455340/6455340-hd_1080_1920_24fps.mp4`, // man • push-ups
  `${V}35585647/15079835_1080_1920_30fps.mp4`, // man • dumbbell session
  `${V}6547801/6547801-hd_1080_1920_24fps.mp4`, // man • dumbbell curls
  `${V}35585586/15079425_1080_1920_30fps.mp4`, // man • barbell squats
  `${V}6455343/6455343-hd_1080_1920_24fps.mp4`, // man • dumbbell training
  `${V}35585574/15079385_1080_1920_30fps.mp4`, // man • squats in gym
  `${V}5320015/5320015-hd_1080_1920_25fps.mp4`, // male bodybuilder • loading plates
  `${V}4921644/4921644-hd_1066_1920_25fps.mp4`, // man • gym session
  `${V}5319761/5319761-hd_1080_1920_25fps.mp4`, // man • inside the gym
  `${V}7986115/7986115-hd_1080_1920_30fps.mp4`, // man • battle ropes
  `${V}5319433/5319433-hd_1080_1920_25fps.mp4`, // man • strength training
  `${V}35585836/15079925_1080_1920_30fps.mp4`, // man • arm machine
  `${V}4921647/4921647-hd_1066_1920_25fps.mp4`, // man • bench press machine
  `${V}4921648/4921648-hd_1066_1920_25fps.mp4`, // man • workout
  `${V}13981945/13981945-hd_1080_1920_30fps.mp4`, // man • gym exercise
  `${V}35585592/15079414_1080_1920_30fps.mp4`, // man • dumbbell squats
  `${V}4921646/4921646-hd_1066_1920_25fps.mp4`, // man • gym session
  `${V}5319090/5319090-hd_1080_1920_25fps.mp4`, // man • dumbbell workout
  `${V}4761416/4761416-hd_1080_2048_25fps.mp4`, // men • skip rope conditioning
];

/** 3.2s per clip on capable links, slightly faster on mobile data. */
const reelTiming = () => {
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return {
    slice: 3200,
    fade: 850,
    saveData: Boolean(connection?.saveData),
    slow: connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g",
    metered: connection?.effectiveType === "3g",
  };
};

const GOALS = [
  { value: "Lose Weight", label: "Lose weight" },
  { value: "Building Muscles", label: "Build muscle" },
  { value: "Get Fitter", label: "Get fit" },
];
const LEVELS: { value: Level; label: string; hint: string }[] = [
  { value: "Beginner", label: "Beginner", hint: "تازه شروع کرده‌ام و برنامه ساده و قابل‌اجرا می‌خواهم." },
  { value: "Intermediate", label: "Intermediate", hint: "منظم تمرین می‌کنم و آماده‌ی پیشرفت جدی هستم." },
  { value: "Advanced", label: "Advanced", hint: "تجربه‌ی بالایی دارم و دنبال چالش سخت‌تر هستم." },
];

type IconName =
  | "back" | "mail" | "lock" | "phone" | "user" | "eye" | "eyeOff" | "check" | "arrow" | "doc"
  | "camera" | "dumbbell" | "flame" | "activity" | "trophy" | "heart" | "wifi" | "users" | "layers"
  | "award" | "edit" | "trash" | "rotate" | "zoom" | "chat" | "shield" | "crown";

const SPECIALTIES: { value: string; hint: string; icon: IconName }[] = [
  { value: "Bodybuilding", hint: "حجم، تفکیک عضلات و آماده‌سازی مسابقه", icon: "dumbbell" },
  { value: "Strength Training", hint: "قدرت، پاورلیفتینگ و رکوردزنی", icon: "trophy" },
  { value: "Weight Loss", hint: "چربی‌سوزی و اصلاح ترکیب بدن", icon: "flame" },
  { value: "Functional Training", hint: "حرکات کاربردی و آمادگی روزمره", icon: "activity" },
  { value: "Sports Performance", hint: "آمادگی جسمانی ورزشکاران رشته‌ای", icon: "award" },
  { value: "Rehab & Mobility", hint: "حرکات اصلاحی و پیشگیری از آسیب", icon: "heart" },
];
const MAX_SPECIALTIES = 3;
const CERT_BODIES = ["Federation", "IFBB", "NASM", "ACE", "ISSA", "Other"];
const CERT_LEVELS = ["Level 3", "Level 2", "Level 1", "International"];
const FORMATS: { value: TrainerProfile["coachingFormat"]; title: string; hint: string; icon: IconName }[] = [
  { value: "online", title: "Online coaching", hint: "برنامه، چت و پیگیری کامل از راه دور", icon: "wifi" },
  { value: "in-person", title: "In-person coaching", hint: "جلسات حضوری در باشگاه یا محل تمرین", icon: "users" },
  { value: "hybrid", title: "Hybrid coaching", hint: "ترکیب جلسات حضوری با پیگیری آنلاین", icon: "layers" },
];
const COACH_COPY: Record<CoachStep, { eyebrow: string; title: string; desc: string }> = {
  coachPhoto: { eyebrow: "Coach profile", title: "Add your profile photo", desc: "ورزشکارها اول تصویر تو را می‌بینند؛ یک عکس واضح و حرفه‌ای انتخاب کن." },
  coachAge: { eyebrow: "About you", title: "How old are you?", desc: "سن تو در پروفایل حرفه‌ای‌ات نمایش داده می‌شود؛ بعداً هم قابل تغییر است." },
  coachSpecialty: { eyebrow: "Expertise", title: "What's your specialty?", desc: "حداکثر 3 رشته تخصصی را انتخاب کن تا ورزشکارهای مناسب، تو را پیدا کنند." },
  coachCert: { eyebrow: "Credentials", title: "Your certification", desc: "مدرک مربیگری‌ات را ثبت کن تا اعتماد ورزشکارها به تو بیشتر شود." },
  coachExperience: { eyebrow: "Experience", title: "Coaching experience", desc: "چند سال است که به‌صورت حرفه‌ای مربیگری می‌کنی؟" },
  coachFormat: { eyebrow: "Services", title: "How do you coach?", desc: "روش ارائه خدمات مربیگری‌ات را انتخاب کن." },
  coachBio: { eyebrow: "Optional", title: "Introduce yourself", desc: "چند جمله درباره سبک مربیگری و افتخاراتت بنویس؛ این بخش اختیاری است." },
  coachReview: { eyebrow: "Final step", title: "Review your profile", desc: "اطلاعات را بررسی کن؛ با زدن Edit هر بخش را اصلاح کن." },
};

function isCoachStep(step: Step): step is CoachStep {
  return (COACH_STEPS as Step[]).includes(step);
}

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { ...BASE };
    return { ...BASE, ...(JSON.parse(raw) as Partial<Draft>), step: "intro" };
  } catch {
    return { ...BASE };
  }
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "back": return <svg {...props}><path d="m15 5-7 7 7 7" /></svg>;
    case "arrow": return <svg {...props} strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "mail": return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
    case "lock": return <svg {...props}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case "phone": return <svg {...props}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>;
    case "user": return <svg {...props}><circle cx="12" cy="8" r="3.2" /><path d="M5 20c1.3-3.5 3.7-5.2 7-5.2s5.7 1.7 7 5.2" /></svg>;
    case "doc": return <svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;
    case "eye": return <svg {...props}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case "eyeOff": return <svg {...props}><path d="m3 3 18 18M10.5 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.7M6.2 6.7C3.6 8.5 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.5-.6" /></svg>;
    case "camera": return <svg {...props}><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></svg>;
    case "dumbbell": return <svg {...props}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></svg>;
    case "flame": return <svg {...props}><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.5 2 3 0-3 .5-5.5.5-8Z" /></svg>;
    case "activity": return <svg {...props}><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>;
    case "trophy": return <svg {...props}><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1M12 13v4M8 20h8M9.5 17h5" /></svg>;
    case "heart": return <svg {...props}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>;
    case "wifi": return <svg {...props}><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>;
    case "users": return <svg {...props}><circle cx="9" cy="8" r="3" /><path d="M3 20c.8-3.4 3-5.2 6-5.2s5.2 1.8 6 5.2M16 5.5a3 3 0 0 1 0 5.6M18.5 14.8c1.4.7 2.3 2.4 2.7 4.7" /></svg>;
    case "layers": return <svg {...props}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>;
    case "award": return <svg {...props}><circle cx="12" cy="9" r="5" /><path d="m9 13.5-1.5 7.5 4.5-2.5 4.5 2.5-1.5-7.5" /></svg>;
    case "edit": return <svg {...props}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
    case "trash": return <svg {...props}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
    case "crown": return <svg {...props}><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8Z" /></svg>;
    case "chat": return <svg {...props}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" /></svg>;
    case "shield": return <svg {...props}><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "rotate": return <svg {...props}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>;
    case "zoom": return <svg {...props}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5M11 9v4M9 11h4" /></svg>;
    default: return <svg {...props} strokeWidth={2.8}><path d="m5 12 4 4L19 6" /></svg>;
  }
}

function BrandGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="currentColor">
      <path d="M18 34h8v28h-8a4 4 0 0 1-4-4V38a4 4 0 0 1 4-4Z" />
      <path d="M70 34h8a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4h-8V34Z" />
      <path d="M28 40h8v16h-8V40Z" />
      <path d="M60 40h8v16h-8V40Z" />
      <path d="M36 45h24v6H36v-6Z" />
      <path d="M8 38h8v20H8a2 2 0 0 1-2-2V40a2 2 0 0 1 2-2Z" opacity=".85" />
      <path d="M80 38h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-8V38Z" opacity=".85" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="brand-row">
      <span className="brand-mark" aria-hidden="true"><BrandGlyph /></span>
      <span className="brand-name">REVO <i>SPORT</i></span>
    </div>
  );
}

function ProgressHeader({ progress, onBack, count }: { progress: number; onBack: () => void; count?: string }) {
  return (
    <header className="steps-header">
      <button type="button" className="back-btn" onClick={onBack} aria-label="بازگشت"><Icon name="back" size={19} /></button>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {count && <span className="step-count" aria-label={`Step ${count}`}>{count}</span>}
    </header>
  );
}

/* ---------------- avatar editor: free crop box chosen by the user ---------------- */
type CropBox = { x: number; y: number; w: number; h: number };
type CropHandle = "nw" | "ne" | "sw" | "se" | "move";

function AvatarEditor({
  source,
  rotation,
  crop,
  onRotate,
  onCrop,
  onStageSize,
  onCancel,
  onSave,
}: {
  source: string;
  rotation: number;
  crop: CropBox | null;
  onRotate: () => void;
  onCrop: (value: CropBox) => void;
  onStageSize: (size: number) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: CropHandle; x: number; y: number; box: CropBox } | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  // Track the rendered image box so the crop rectangle can be clamped to it.
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setFrame({ width: rect.width, height: rect.height });
      onStageSize(rect.width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onStageSize]);

  // Start with a generous selection; the user is free to resize it however they like.
  useEffect(() => {
    if (crop || frame.width === 0 || frame.height === 0) return;
    const size = Math.min(frame.width, frame.height) * 0.8;
    onCrop({
      x: (frame.width - size) / 2,
      y: (frame.height - size) / 2,
      w: size,
      h: size,
    });
  }, [crop, frame, onCrop]);

  const MIN = 48;

  const applyDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag || frame.width === 0) return;
    const dx = clientX - drag.x;
    const dy = clientY - drag.y;
    const base = drag.box;
    let next: CropBox;

    if (drag.handle === "move") {
      next = {
        x: Math.min(Math.max(0, base.x + dx), frame.width - base.w),
        y: Math.min(Math.max(0, base.y + dy), frame.height - base.h),
        w: base.w,
        h: base.h,
      };
    } else {
      let { x, y, w, h } = base;
      if (drag.handle === "se") {
        w = Math.min(Math.max(MIN, base.w + dx), frame.width - base.x);
        h = Math.min(Math.max(MIN, base.h + dy), frame.height - base.y);
      } else if (drag.handle === "sw") {
        const right = base.x + base.w;
        x = Math.min(Math.max(0, base.x + dx), right - MIN);
        w = right - x;
        h = Math.min(Math.max(MIN, base.h + dy), frame.height - base.y);
      } else if (drag.handle === "ne") {
        const bottom = base.y + base.h;
        y = Math.min(Math.max(0, base.y + dy), bottom - MIN);
        h = bottom - y;
        w = Math.min(Math.max(MIN, base.w + dx), frame.width - base.x);
      } else {
        const right = base.x + base.w;
        const bottom = base.y + base.h;
        x = Math.min(Math.max(0, base.x + dx), right - MIN);
        y = Math.min(Math.max(0, base.y + dy), bottom - MIN);
        w = right - x;
        h = bottom - y;
      }
      next = { x, y, w, h };
    }
    onCrop(next);
  };

  const beginDrag = (handle: CropHandle) => (event: React.PointerEvent) => {
    if (!crop) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { handle, x: event.clientX, y: event.clientY, box: crop };
  };

  const endDrag = () => { dragRef.current = null; };

  const resetCrop = () => {
    if (frame.width === 0) return;
    onCrop({ x: 0, y: 0, w: frame.width, h: frame.height });
  };

  return (
    <div className="editor-overlay" role="dialog" aria-modal="true" aria-label="Edit profile photo">
      <div className="editor-card">
        <header className="editor-head">
          <b>Crop photo</b>
          <button type="button" className="editor-close" onClick={onCancel} aria-label="Close editor">×</button>
        </header>

        <div
          ref={frameRef}
          className="editor-stage"
          onPointerMove={(event) => applyDrag(event.clientX, event.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            className="editor-image"
            src={source}
            alt="Editing preview"
            style={{ transform: `rotate(${rotation}deg)` }}
            draggable={false}
          />
          {crop && (
            <>
              <div className="crop-shade" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${crop.x}px ${crop.y}px, ${crop.x}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y + crop.h}px, ${crop.x + crop.w}px ${crop.y}px, ${crop.x}px ${crop.y}px)` }} aria-hidden="true" />
              <div
                className="crop-box"
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                onPointerDown={beginDrag("move")}
                role="group"
                aria-label="Crop area"
              >
                <span className="crop-grid" aria-hidden="true" />
                <span className="crop-handle nw" onPointerDown={beginDrag("nw")} />
                <span className="crop-handle ne" onPointerDown={beginDrag("ne")} />
                <span className="crop-handle sw" onPointerDown={beginDrag("sw")} />
                <span className="crop-handle se" onPointerDown={beginDrag("se")} />
                <span className="crop-size">{Math.round(crop.w)} × {Math.round(crop.h)}</span>
              </div>
            </>
          )}
        </div>

        <div className="editor-tools">
          <button type="button" className="editor-tool-btn" onClick={onRotate}>
            <Icon name="rotate" size={14} /> Rotate
          </button>
          <button type="button" className="editor-tool-btn" onClick={resetCrop}>
            <Icon name="zoom" size={14} /> Full image
          </button>
        </div>

        <p className="editor-hint" dir="rtl">کادر را از گوشه‌ها به هر اندازه‌ای که می‌خواهی تغییر بده و با کشیدن، محل آن را جابه‌جا کن. عکس دقیقاً به همان اندازه‌ای که انتخاب می‌کنی بریده می‌شود.</p>

        <div className="editor-actions">
          <button type="button" className="btn btn-glass" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave}>Apply</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- background: back-to-back professional video reel (videos only) ---------------- */
type ReelTone = "intro" | "hero" | "form";

function VideoReel({ tone }: { tone: ReelTone }) {
  const motionOk = useMemo(() => !(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false), []);
  const timing = useMemo(reelTiming, []);
  const videos = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const failed = useRef<Set<number>>(new Set());
  const [active, setActive] = useState(0);
  const [clips, setClips] = useState<[number, number]>([0, 1]);
  const activeRef = useRef(active);
  const clipsRef = useRef(clips);
  const [, repaint] = useState(0);
  activeRef.current = active;
  clipsRef.current = clips;

  const live = () => REEL_CLIPS.map((_, index) => index).filter((index) => !failed.current.has(index));
  const allowVideo = motionOk && !timing.saveData && !timing.slow && live().length > 0;
  const slice = timing.metered ? 4200 : timing.slice;
  const fade = timing.fade;

  const after = (clip: number, avoid: number) => {
    const list = live();
    if (list.length === 0) return clip;
    const start = list.indexOf(clip);
    for (let step = 1; step <= list.length; step += 1) {
      const candidate = list[(start + step + list.length) % list.length];
      if (candidate !== avoid || list.length === 1) return candidate;
    }
    return list[0];
  };

  // Crossfade on a fixed beat, but never cut to a clip that has not buffered yet.
  useEffect(() => {
    if (!allowVideo) return;
    let timer = 0;
    let swapTimer = 0;
    let waited = 0;
    const tick = () => {
      if (document.hidden) {
        timer = window.setTimeout(tick, 1200);
        return;
      }
      if (live().length < 2) {
        timer = window.setTimeout(tick, slice);
        return;
      }
      const incoming = 1 - activeRef.current;
      const element = videos.current[incoming];
      if ((!element || element.readyState < 3) && waited < Math.max(4200, slice)) {
        waited += 300;
        timer = window.setTimeout(tick, 300);
        return;
      }
      waited = 0;
      setActive(incoming);
      swapTimer = window.setTimeout(() => {
        const current = clipsRef.current;
        const outgoing = 1 - incoming;
        const next = after(current[incoming], current[incoming]);
        setClips(outgoing === 0 ? [next, current[1]] : [current[0], next]);
      }, fade + 220);
      timer = window.setTimeout(tick, slice);
    };
    timer = window.setTimeout(tick, slice);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(swapTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowVideo]);

  // Play the visible clip from its start; park the hidden one after the crossfade.
  useEffect(() => {
    const show = videos.current[active];
    const hide = videos.current[1 - active];
    if (show) {
      try { show.currentTime = 0; } catch { /* ignore */ }
      const playing = show.play();
      if (playing) playing.catch(() => { /* ignore */ });
    }
    const timer = window.setTimeout(() => {
      try { hide?.pause(); } catch { /* ignore */ }
    }, fade + 120);
    return () => window.clearTimeout(timer);
  }, [active, fade]);

  // Battery / bandwidth: stop decoding while the tab is in the background.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        videos.current.forEach((video) => { try { video?.pause(); } catch { /* ignore */ } });
        return;
      }
      const show = videos.current[activeRef.current];
      if (show) {
        const playing = show.play();
        if (playing) playing.catch(() => { /* ignore */ });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const onError = (slot: number) => {
    const bad = clipsRef.current[slot];
    failed.current.add(bad);
    if (live().length === 0) {
      repaint((value) => value + 1);
      return;
    }
    const other = clipsRef.current[1 - slot];
    const replacement = after(bad, other);
    setClips(slot === 0 ? [replacement, other] : [other, replacement]);
    if (slot === activeRef.current) setActive(1 - slot);
  };

  return (
    <div className={`bg-stage tone-${tone}`} aria-hidden="true">
      <div className="bg-fallback" />
      {allowVideo && [0, 1].map((slot) => (
        <video
          key={slot}
          ref={(node) => { videos.current[slot] = node; }}
          className={`reel-video${active === slot ? " is-on" : ""}`}
          src={REEL_CLIPS[clips[slot]]}
          muted
          loop
          autoPlay={slot === 0}
          playsInline
          preload={slot === active || !timing.metered ? "auto" : "metadata"}
          disablePictureInPicture
          disableRemotePlayback
          onError={() => onError(slot)}
        />
      ))}
      <div className="bg-vignette" />
      <div className="neo-scrim" />
    </div>
  );
}

function Ruler({ min, max, value, unit, label, onChange }: { min: number; max: number; value: number; unit: string; label: string; onChange: (value: number) => void }) {
  const ITEM = 24;
  const scrollRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const values = useMemo(() => Array.from({ length: max - min + 1 }, (_, index) => min + index), [min, max]);

  const scrollTo = (next: number, behavior: ScrollBehavior) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ left: (next - min) * ITEM, behavior });
  };

  useLayoutEffect(() => {
    scrollTo(value, "auto");
    return () => window.cancelAnimationFrame(frame.current);
    // align once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (!element) return;
      const next = Math.min(max, Math.max(min, min + Math.round(element.scrollLeft / ITEM)));
      if (next !== value) onChange(next);
    });
  };

  return (
    <div className="ruler">
      <div className="picker-value" aria-live="polite"><strong>{value}</strong><span>{unit}</span></div>
      <div
        className="ruler-area"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unit}`}
        onKeyDown={(event) => {
          const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
          if (!delta) return;
          event.preventDefault();
          const next = Math.min(max, Math.max(min, value + delta));
          onChange(next);
          scrollTo(next, "smooth");
        }}
      >
        <span className="ruler-marker" aria-hidden="true" />
        <div ref={scrollRef} className="ruler-scroll" onScroll={handleScroll}>
          {values.map((number) => (
            <button
              key={number}
              type="button"
              tabIndex={-1}
              className={`ruler-item${number === value ? " is-current" : ""}${number % 5 === 0 ? " is-major" : ""}`}
              onClick={() => { onChange(number); scrollTo(number, "smooth"); }}
            >
              <span className="ruler-num">{Math.abs(number - value) <= 4 && number !== value ? number : ""}</span>
              <span className="ruler-tick" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WheelColumn<T extends string | number>({ values, value, onChange, label, format }: { values: readonly T[]; value: T; onChange: (value: T) => void; label: string; format?: (value: T) => string }) {
  const ITEM = 52;
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = Math.max(0, values.indexOf(value)) * ITEM;
    // align once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wheel-col" role="listbox" aria-label={label}>
      <div
        ref={scrollRef}
        className="wheel-scroll"
        onScroll={() => {
          const element = scrollRef.current;
          if (!element) return;
          const index = Math.min(values.length - 1, Math.max(0, Math.round(element.scrollTop / ITEM)));
          const next = values[index];
          if (next !== value) onChange(next);
        }}
      >
        {values.map((item) => (
          <button
            key={String(item)}
            type="button"
            role="option"
            aria-selected={item === value}
            className={item === value ? "wheel-item on" : "wheel-item"}
            onClick={() => {
              onChange(item);
              scrollRef.current?.scrollTo({ top: values.indexOf(item) * ITEM, behavior: "smooth" });
            }}
          >
            {format ? format(item) : item}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimePicker({ draft, patch }: { draft: Draft; patch: (value: Partial<Draft>) => void }) {
  const hours = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, index) => index * 5), []);
  return (
    <div className="time-wheel">
      <span className="time-highlight" aria-hidden="true" />
      <WheelColumn values={hours} value={draft.hour} onChange={(hour) => patch({ hour })} label="Hour" format={(hour) => String(hour)} />
      <WheelColumn values={minutes} value={draft.minute} onChange={(minute) => patch({ minute })} label="Minute" format={(minute) => String(minute).padStart(2, "0")} />
      <WheelColumn values={["AM", "PM"] as const} value={draft.period} onChange={(period) => patch({ period })} label="AM or PM" />
    </div>
  );
}

const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_RESENDS = 2;
const OTP_RESEND_COOLDOWN_MS = 60000;

function maskPhone(value: string): string {
  return value.length === 11 ? `${value.slice(0, 4)} *** ${value.slice(-4)}` : value;
}

function mmss(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatCount(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value);
}

function formatLabel(value: TrainerProfile["coachingFormat"]): string {
  return FORMATS.find((item) => item.value === value)?.title ?? value;
}

export default function PremiumAuth({ onEnter }: { onEnter: () => void }) {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [loginId, setLoginId] = useState(() => {
    try { return localStorage.getItem("revo-remembered-identifier") || ""; } catch { return ""; }
  });
  const [loginPassword, setLoginPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loginErrors, setLoginErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [signupErrors, setSignupErrors] = useState<Partial<Record<SignupField, string>>>({});
  const [coachErrors, setCoachErrors] = useState<CoachErrors>({});
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<AuthStats>(() => getStats());
  const [tick, setTick] = useState(0);
  const [remember, setRemember] = useState(() => {
    try { return localStorage.getItem("revo-remember-id") === "1"; } catch { return false; }
  });
  const [notice, setNotice] = useState("");
  const [completingExistingTrainer, setCompletingExistingTrainer] = useState(false);
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null);
  const [otpCells, setOtpCells] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpResends, setOtpResends] = useState(0);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImage, setEditorImage] = useState<string>("");
  const [editorRotation, setEditorRotation] = useState(0);
  const [editorCrop, setEditorCrop] = useState<CropBox | null>(null);
  const editorStageSize = useRef<number>(0);
  const otpCode = otpCells.join("");
  const expiresIn = otpChallenge ? Math.max(0, Math.ceil((otpChallenge.expiresAt - clock) / 1000)) : 0;
  const cooldownIn = Math.max(0, Math.ceil((otpCooldownUntil - clock) / 1000));
  const resendAllowed = cooldownIn === 0 && otpResends < OTP_MAX_RESENDS && !otpSending;
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [coachLookup, setCoachLookup] = useState<CoachPublic | null>(null);
  const [coachLookupBusy, setCoachLookupBusy] = useState(false);
  const [coachLookupError, setCoachLookupError] = useState("");
  const [coachCodeInput, setCoachCodeInput] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const selectedPlan: SubPlan | null = coachLookup?.plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const [payError, setPayError] = useState("");
  const [payResult, setPayResult] = useState<"idle" | "checking" | "success" | "failed">("idle");
  const [planPaid, setPlanPaid] = useState(false);
  const [gatewayBusy, setGatewayBusy] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const patch = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }));
  const go = (step: Step) => {
    setNotice("");
    setLoginErrors({});
    setSignupErrors({});
    setCoachErrors({});
    patch({ step });
  };

  /** Starts a clean registration: no photo, code or professional data from anyone else. */
  const freshSignup = () => {
    clearSignupDraft();
    setOtpChallenge(null);
    setOtpCells(Array.from({ length: 6 }, () => ""));
    setOtpError("");
    setCoachLookup(null);
    setCoachCodeInput("");
    setSelectedPlanId("");
    setCoachLookupError("");
    setCompletingExistingTrainer(false);
    setEditingFromReview(false);
    setDraft({ ...BASE, step: "signup" });
  };

  /** Keeps the account fields but drops everything that belongs to the other role. */
  const switchRole = (role: "trainer" | "trainee") => {
    if (role === draft.role) return;
    setDraft((current) => ({
      ...current,
      role,
      avatar: "",
      specialties: [],
      certificationBody: "",
      certification: "",
      bio: "",
      experienceYears: 3,
      coachingFormat: "hybrid",
      coachId: "",
      coachName: "",
      planId: "",
      planTitle: "",
      planSessions: 0,
      planDays: 0,
      planPrice: 0,
      planPerks: [],
      coachCode: "",
      phoneVerified: false,
    }));
    setOtpChallenge(null);
    setOtpCells(Array.from({ length: 6 }, () => ""));
    setCoachLookup(null);
    setCoachCodeInput("");
    setSelectedPlanId("");
    setCoachLookupError("");
    setCoachErrors({});
    setSignupErrors({});
  };

  const findCoach = () => {
    setCoachLookupError("");
    const code = coachCodeInput.trim().toUpperCase();
    if (code.length < 4) {
      setCoachLookupError("کد مربی را کامل وارد کن");
      return;
    }
    setCoachLookupBusy(true);
    window.setTimeout(() => {
      const coach = lookupCoachByCode(code);
      setCoachLookupBusy(false);
      if (!coach) {
        setCoachLookup(null);
        setCoachLookupError("مربی‌ای با این کد پیدا نشد؛ کد را بررسی کن");
        return;
      }
      setCoachLookup(coach);
      setCoachCodeInput(coach.code);
      setDraft((current) => ({ ...current, coachCode: coach.code, coachId: coach.id, coachName: coach.name }));
    }, 260);
  };

  const choosePlan = (plan: SubPlan | null) => {
    setSelectedPlanId(plan?.id ?? "");
    setDraft((current) => plan ? {
      ...current,
      planId: plan.id,
      planTitle: plan.title,
      planSessions: plan.sessions,
      planDays: plan.days,
      planPrice: plan.price,
      planPerks: plan.perks,
    } : {
      ...current,
      planId: "",
      planTitle: "",
      planSessions: 0,
      planDays: 0,
      planPrice: 0,
      planPerks: [],
    });
  };

  const finishCoachLink = (skip: boolean) => {
    if (!skip && !coachLookup) {
      if (coachCodeInput.trim()) {
        setCoachLookupError("اول کد مربی را تأیید کن یا گزینهٔ Skip را بزن");
        return;
      }
    }
    if (skip) {
      setDraft((current) => ({
        ...current,
        coachCode: "",
        coachId: "",
        coachName: "",
        planId: "",
        planTitle: "",
        planSessions: 0,
        planDays: 0,
        planPrice: 0,
        planPerks: [],
      }));
    }
    go("plan");
  };

  const flow = useMemo<Step[]>(
    () => (draft.role === "trainer" ? (completingExistingTrainer ? COACH_STEPS : TRAINER_FLOW) : ATHLETE_FLOW),
    [draft.role, completingExistingTrainer],
  );
  const progressSteps = draft.role === "trainer" ? flow : ATHLETE_PROGRESS;
  const progressIndex = progressSteps.indexOf(draft.step);
  const progress = progressIndex < 0 ? 0 : ((progressIndex + 1) / progressSteps.length) * 100;
  const stepCount = progressIndex < 0 ? undefined : `${progressIndex + 1}/${progressSteps.length}`;

  const strength = useMemo(() => {
    const value = draft.password;
    let score = 0;
    if (value.length >= 6) score += 1;
    if (value.length >= 10) score += 1;
    if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
    return Math.min(3, score);
  }, [draft.password]);

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
  }, [draft]);

  // Logo intro: animated loader, then auto-advance into sign in.
  useEffect(() => {
    if (draft.step !== "intro") return;
    setTick(0);
    const frame = window.setInterval(() => setTick((value) => Math.min(100, value + 4)), 28);
    const done = window.setTimeout(() => go("login"), 2300);
    return () => {
      window.clearInterval(frame);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.step]);

  useEffect(() => {
    if (draft.step === "login") setStats(getStats());
  }, [draft.step]);

  // Live countdown for the SMS code screen.
  useEffect(() => {
    if (draft.step !== "otp") return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [draft.step]);

  const next = () => {
    if (editingFromReview && draft.step !== "coachReview") {
      setEditingFromReview(false);
      go("coachReview");
      return;
    }
    const index = flow.indexOf(draft.step);
    if (index >= 0 && index < flow.length - 1) go(flow[index + 1]);
  };

  const back = () => {
    if (draft.step === "success") return;
    if ((draft.step === "coachPhoto") && !completingExistingTrainer && !editingFromReview) {
      patch({ phoneVerified: false });
      go("signup");
      return;
    }
    if (draft.step === "goal" && !completingExistingTrainer) {
      patch({ phoneVerified: false });
      go("signup");
      return;
    }
    if (editingFromReview) {
      setEditingFromReview(false);
      go("coachReview");
      return;
    }
    const index = flow.indexOf(draft.step);
    if (completingExistingTrainer && index <= 0) {
      logoutLocal();
      setCompletingExistingTrainer(false);
      patch({ role: "trainee" });
      go("login");
      return;
    }
    if (index <= 0) {
      go("login");
      return;
    }
    go(flow[index - 1]);
  };

  /* ---------------- sign in ---------------- */
  const submitLogin = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    const nextErrors: Partial<Record<LoginField, string>> = {};
    if (!loginId.trim()) nextErrors.identifier = "ایمیل یا شماره موبایل را وارد کن";
    if (!loginPassword) nextErrors.password = "رمز عبور را وارد کن";
    if (Object.keys(nextErrors).length) {
      setLoginErrors(nextErrors);
      return;
    }
    setLoginErrors({});
    try {
      if (remember) {
        localStorage.setItem("revo-remember-id", "1");
        localStorage.setItem("revo-remembered-identifier", loginId.trim());
      } else {
        localStorage.removeItem("revo-remember-id");
        localStorage.removeItem("revo-remembered-identifier");
      }
    } catch { /* ignore */ }
    setBusy(true);
    window.setTimeout(() => {
      const message = loginLocal(loginId, loginPassword);
      setBusy(false);
      if (message) {
        setStats(getStats());
        setLoginErrors({ password: message });
        return;
      }
      if (currentCoachNeedsProfile()) {
        const summary = currentUserSummary();
        setCompletingExistingTrainer(true);
        setEditingFromReview(false);
        setNotice("");
        setCoachErrors({});
        patch({ role: "trainer", name: summary?.name ?? draft.name, step: "coachPhoto" });
        return;
      }
      onEnter();
    }, 320);
  };

  /* ---------------- create account ---------------- */
  /* ---------------- SMS verification ---------------- */
  const startOtp = async (resend = false) => {
    if (otpSending) return;
    if (resend && otpResends >= OTP_MAX_RESENDS) {
      setOtpError("تعداد ارسال مجدد تمام شد");
      return;
    }
    setOtpSending(true);
    setOtpError("");
    const result = await sendPhoneOtp(draft.phone);
    setOtpSending(false);
    if (!result.challenge) {
      if (resend) setOtpError(result.error ?? "ارسال کد ناموفق بود");
      else setSignupErrors({ phone: result.error ?? "ارسال کد ناموفق بود" });
      return;
    }
    setOtpChallenge(result.challenge);
    setOtpCells(Array.from({ length: 6 }, () => ""));
    setOtpAttempts(0);
    setOtpCooldownUntil(Date.now() + OTP_RESEND_COOLDOWN_MS);
    setClock(Date.now());
    if (resend) {
      setOtpResends((count) => count + 1);
    } else {
      setOtpResends(0);
      go("otp");
    }
  };

  const setOtpAt = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setOtpCells((current) => {
      const next = [...current];
      if (!digits) {
        next[index] = "";
        return next;
      }
      for (let offset = 0; offset < digits.length && index + offset < 6; offset += 1) {
        next[index + offset] = digits[offset];
      }
      return next;
    });
    if (digits) otpInputs.current[Math.min(5, index + digits.length)]?.focus();
  };

  const verifyOtp = async () => {
    if (!otpChallenge) {
      setOtpError("کد را دوباره درخواست کن");
      return;
    }
    if (Date.now() > otpChallenge.expiresAt) {
      setOtpError("کد منقضی شد؛ کد جدید بگیر");
      return;
    }
    if (otpCode.length < 6) {
      setOtpError("کد ۶ رقمی را کامل وارد کن");
      return;
    }
    if (otpAttempts >= OTP_MAX_ATTEMPTS) {
      setOtpError("تعداد تلاش‌ها تمام شد؛ کد جدید بگیر");
      return;
    }
    setOtpSending(true);
    const result = await checkPhoneOtp(otpChallenge, otpCode);
    setOtpSending(false);
    if (!result.ok) {
      const attempts = otpAttempts + 1;
      setOtpAttempts(attempts);
      setOtpCells(Array.from({ length: 6 }, () => ""));
      otpInputs.current[0]?.focus();
      setOtpError(
        attempts >= OTP_MAX_ATTEMPTS
          ? "تعداد تلاش‌ها تمام شد؛ کد جدید بگیر"
          : (result.error ?? `کد اشتباه است؛ ${OTP_MAX_ATTEMPTS - attempts} تلاش باقی مانده`),
      );
      return;
    }
    setOtpChallenge(null);
    setOtpError("");
    patch({ phoneVerified: true, step: draft.role === "trainer" ? "coachPhoto" : "goal" });
  };

  const validateSignup = async () => {
    const nextErrors: Partial<Record<SignupField, string>> = {};
    if (!draft.name.trim()) nextErrors.name = "نام کامل را وارد کن";
    if (!isValidEmail(draft.email)) nextErrors.email = "ایمیل معتبر وارد کن";
    if (!isValidPhone(draft.phone)) nextErrors.phone = "شماره موبایل 11 رقمی با 09 وارد کن";
    if (draft.password.length < 6) nextErrors.password = "رمز عبور حداقل 6 کاراکتر باشد";
    if (draft.password !== draft.confirm) nextErrors.confirm = "تکرار رمز عبور با رمز یکی نیست";
    if (draft.role === "trainee" && draft.coachCode.trim() && !isCoachCodeValid(draft.coachCode)) {
      nextErrors.coachCode = "کد مربی معتبر نیست";
    }
    if (!draft.acceptTerms) nextErrors.terms = "برای ادامه، قوانین و شرایط را بپذیر";
    if (!nextErrors.email && !nextErrors.phone) {
      const identity = checkSignupIdentity(draft.email, draft.phone);
      if (identity) nextErrors[identity.field] = identity.message;
    }
    if (Object.keys(nextErrors).length) {
      setSignupErrors(nextErrors);
      return;
    }
    setSignupErrors({});
    await startOtp();
  };

  /* ---------------- coach wizard ---------------- */
  const coachErrorsFor = (step: CoachStep): CoachErrors => {
    const errors: CoachErrors = {};
    if (step === "coachPhoto" && !draft.avatar) errors.avatar = "برای ادامه، یک تصویر پروفایل انتخاب کن";
    if (step === "coachSpecialty" && draft.specialties.length === 0) errors.specialties = "حداقل یک رشته تخصصی انتخاب کن";
    if (step === "coachCert") {
      if (!draft.certificationBody) errors.certBody = "نهاد صادرکننده مدرک را انتخاب کن";
      if (draft.certification.trim().length < 2) errors.certification = "عنوان یا شماره مدرک را وارد کن";
    }
    if (step === "coachExperience" && draft.experienceYears > Math.max(0, draft.trainerAge - 15)) {
      errors.experience = "سابقه مربیگری با سن وارد‌شده همخوانی ندارد";
    }
    return errors;
  };

  const coachNext = () => {
    if (!isCoachStep(draft.step)) return;
    const errors = coachErrorsFor(draft.step);
    if (Object.keys(errors).length) {
      setCoachErrors(errors);
      return;
    }
    next();
  };

  const editCoachStep = (step: CoachStep) => {
    setEditingFromReview(true);
    go(step);
  };

  const buildTrainerProfile = (): TrainerProfile => ({
    age: draft.trainerAge,
    specialization: draft.specialties[0] ?? "",
    specialties: draft.specialties,
    certificationBody: draft.certificationBody,
    certificationLevel: draft.certificationLevel,
    certification: draft.certification.trim(),
    experienceYears: draft.experienceYears,
    coachingFormat: draft.coachingFormat,
    bio: draft.bio.trim(),
  });

  // Returning from the gateway: #/payment/callback?Authority=...&Status=OK
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("/payment/callback")) return;
    const params = new URLSearchParams(hash.split("?")[1] ?? "");
    const authority = params.get("Authority") ?? params.get("authority") ?? "";
    const status = params.get("Status") ?? params.get("status") ?? "";
    window.location.hash = "/signup";
    patch({ step: "plan" });
    if (!authority) {
      setPayResult("failed");
      setPayError("تراکنش پیدا نشد؛ دوباره تلاش کن");
      return;
    }
    setPayResult("checking");
    void verifyPayment(authority, status).then((result) => {
      if (!result.ok) {
        setPayResult("failed");
        setPayError(result.error ?? "تراکنش تأیید نشد؛ مبلغ به‌صورت خودکار برگردانده می‌شود");
        return;
      }
      const saved = (() => {
        try { return JSON.parse(sessionStorage.getItem("revo-payment-pending") ?? "null"); } catch { return null; }
      })() as { planId?: string; planTitle?: string; planSessions?: number; planDays?: number; planPrice?: number; planPerks?: string[] } | null;
      if (saved?.planId) {
        setDraft((current) => ({
          ...current,
          planId: saved.planId ?? "",
          planTitle: saved.planTitle ?? "",
          planSessions: saved.planSessions ?? 0,
          planDays: saved.planDays ?? 0,
          planPrice: saved.planPrice ?? 0,
          planPerks: saved.planPerks ?? [],
        }));
      }
      setPlanPaid(true);
      setPayResult("success");
      try { sessionStorage.removeItem("revo-payment-pending"); } catch { /* ignore */ }
      createAccount(undefined, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /**
   * Hands the user over to the real gateway. The account is created only after the
   * backend verifies the transaction and the user returns to #/payment/callback.
   */
  const runPayment = () => {
    if (!selectedPlan) return;
    if (!PAYMENT_CONFIGURED) {
      setPayError("درگاه پرداخت واقعی تنظیم نشده است؛ متغیر VITE_PAY_API_URL را تنظیم کن.");
      return;
    }
    setGatewayBusy(true);
    setPayError("");
    void createPayment({
      amount: selectedPlan.price,
      planId: selectedPlan.id,
      planTitle: selectedPlan.title,
      email: draft.email,
      phone: draft.phone,
    }).then((result) => {
      setGatewayBusy(false);
      if (!result.intent) {
        setPayError(result.error ?? "ساخت تراکنش ناموفق بود");
        return;
      }
      try {
        sessionStorage.setItem("revo-payment-pending", JSON.stringify({
          planId: selectedPlan.id,
          planTitle: selectedPlan.title,
          planSessions: selectedPlan.sessions,
          planDays: selectedPlan.days,
          planPrice: selectedPlan.price,
          planPerks: selectedPlan.perks,
          savedAt: Date.now(),
        }));
      } catch { /* ignore */ }
      window.location.href = result.intent.redirectUrl;
    });
  };

  const createAccount = (trainerProfile?: TrainerProfile, paid = false) => {
    if (!draft.phoneVerified && !completingExistingTrainer) {
      void startOtp();
      return;
    }
    setBusy(true);
    const input: SignupInput = {
      role: draft.role,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      password: draft.password,
      age: draft.role === "trainer" ? draft.trainerAge : draft.age,
      gender: "male",
      height: 175,
      weight: draft.weight,
      goals: [draft.goal],
      activity: draft.level,
      coachCode: draft.coachId ? draft.coachCode : "",
      plan: draft.planId ? {
        id: draft.planId,
        title: draft.planTitle,
        sessions: draft.planSessions + 0,
        days: draft.planDays,
        price: draft.planPrice,
        perks: draft.planPerks,
        paid,
      } : null,
      avatar: draft.avatar,
      trainerProfile,
    };
    window.setTimeout(() => {
      const message = registerLocal(input);
      setBusy(false);
      if (message) {
        setEditingFromReview(false);
        if (message.includes("ایمیل")) setSignupErrors({ email: message });
        else if (message.includes("موبایل")) setSignupErrors({ phone: message });
        else if (message.includes("کد مربی")) setSignupErrors({ coachCode: message });
        else setSignupErrors({ name: message });
        setCoachErrors({});
        setNotice("");
        patch({ step: "signup" });
        return;
      }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      go("success");
    }, 380);
  };

  const finalizeCoach = () => {
    for (const step of COACH_STEPS) {
      const errors = coachErrorsFor(step);
      if (Object.keys(errors).length) {
        setEditingFromReview(true);
        go(step);
        setCoachErrors(errors);
        return;
      }
    }
    const profile = buildTrainerProfile();
    if (completingExistingTrainer) {
      setBusy(true);
      window.setTimeout(() => {
        const message = saveCurrentTrainerProfile(profile, draft.avatar);
        setBusy(false);
        if (message) {
          setCoachErrors({ submit: message });
          return;
        }
        try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        setCompletingExistingTrainer(false);
        go("success");
      }, 360);
      return;
    }
    createAccount(profile);
  };

  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoachErrors((current) => ({ ...current, avatar: "فقط فایل تصویر قابل قبول است" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result || "");
      const image = new Image();
      image.onload = () => {
        setEditorImage(source);
        setEditorRotation(0);
        setEditorCrop(null);
        setEditorOpen(true);
      };
      image.onerror = () => setCoachErrors((current) => ({ ...current, avatar: "این تصویر قابل خواندن نیست؛ تصویر دیگری انتخاب کن" }));
      image.src = source;
    };
    reader.readAsDataURL(file);
  };

  /** Exports exactly the region the user selected, at its own aspect ratio and size. */
  const applyEditedAvatar = () => {
    const image = new Image();
    image.onload = () => {
      const rotated = editorRotation % 180 !== 0;
      const displayW = rotated ? image.height : image.width;
      const displayH = rotated ? image.width : image.height;

      // The preview renders the image with object-fit: cover inside a square stage.
      const stage = editorStageSize.current;
      if (!stage) return;
      const coverScale = Math.max(stage / displayW, stage / displayH);
      const shownW = displayW * coverScale;
      const shownH = displayH * coverScale;
      const originX = (stage - shownW) / 2;
      const originY = (stage - shownH) / 2;

      const box = editorCrop ?? { x: 0, y: 0, w: stage, h: stage };
      // Convert the on-screen selection back into source-image pixels.
      const sx = (box.x - originX) / coverScale;
      const sy = (box.y - originY) / coverScale;
      const sw = box.w / coverScale;
      const sh = box.h / coverScale;

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const context = canvas.getContext("2d");
      if (!context) return;

      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((editorRotation * Math.PI) / 180);
      const halfW = (rotated ? canvas.height : canvas.width) / 2;
      const halfH = (rotated ? canvas.width : canvas.height) / 2;
      context.drawImage(
        image,
        rotated ? sy : sx,
        rotated ? sx : sy,
        rotated ? sh : sw,
        rotated ? sw : sh,
        -halfW,
        -halfH,
        halfW * 2,
        halfH * 2,
      );
      context.restore();

      patch({ avatar: canvas.toDataURL("image/jpeg", 0.9) });
      setCoachErrors((current) => ({ ...current, avatar: undefined }));
      setEditorOpen(false);
    };
    image.src = editorImage;
  };

  const toggleSpecialty = (value: string) => {
    const selected = draft.specialties.includes(value);
    if (!selected && draft.specialties.length >= MAX_SPECIALTIES) {
      setCoachErrors((current) => ({ ...current, specialties: "حداکثر 3 رشته تخصصی قابل انتخاب است" }));
      return;
    }
    patch({ specialties: selected ? draft.specialties.filter((item) => item !== value) : [...draft.specialties, value] });
    setCoachErrors((current) => ({ ...current, specialties: undefined }));
  };

  const field = (icon: IconName, node: ReactNode, message?: string) => (
    <div className={`field-group${message ? " has-error" : ""}`}>
      <label className="field"><Icon name={icon} size={18} />{node}</label>
      {message && <p className="field-error" dir="rtl">{message}</p>}
    </div>
  );

  const coachScreen = (step: CoachStep, body: ReactNode, footer: ReactNode, className = "") => {
    const copy = COACH_COPY[step];
    return (
      <div className={`screen coach-screen ${className}`} key={step}>
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p className="fa-desc" dir="rtl">{copy.desc}</p>
        </div>
        <div className="q-body coach-body">{body}</div>
        <div className="q-foot">{footer}</div>
      </div>
    );
  };

  const coachNextButton = (label = "Next") => (
    <button type="button" className="btn btn-primary" onClick={coachNext}>
      {editingFromReview ? "Save changes" : label} {!editingFromReview && <Icon name="arrow" size={17} />}
    </button>
  );

  let content: ReactNode;

  if (draft.step === "intro") {
    const loaded = Math.min(100, tick);
    content = (
      <div className="screen intro-screen">
        <div className="intro-halo" aria-hidden="true" />
        <div className="intro-center">
          <span className="intro-logo" aria-hidden="true"><BrandGlyph size={52} /></span>
          <span className="intro-word" dir="ltr">REVO <i>SPORT</i></span>
          <p className="intro-tag" dir="rtl">پلتفرم حرفه‌ای مربی‌گری و تناسب اندام</p>
        </div>
        <div className="intro-foot">
          <div className="intro-bar" aria-hidden="true"><span style={{ width: `${loaded}%` }} /></div>
          <p className="intro-meta" dir="rtl">{loaded < 45 ? "در حال آماده‌سازی…" : loaded < 80 ? "بارگذاری اطلاعات…" : "تقریباً آماده"}</p>
        </div>
      </div>
    );
  } else if (draft.step === "login") {
    content = (
      <div className="screen login-screen">
        <div className="login-hero-col">
        <Brand />
        <div className="login-copy">
          <h1 className="hero-h1">Energize<br />your life<span className="brand-dot">.</span></h1>
          <p className="fa-desc" dir="rtl">وارد حساب خودت شو و مسیر تمرینت را از همان‌جایی که بودی ادامه بده.</p>
        </div>

        <div className="stat-strip" role="list" aria-label="Community stats">
          <div className="stat" role="listitem"><b>{formatCount(stats.members)}</b><span dir="rtl">کاربر</span></div>
          <i aria-hidden="true" />
          <div className="stat" role="listitem"><b>{formatCount(stats.coaches)}</b><span dir="rtl">مربی</span></div>
          <i aria-hidden="true" />
          <div className="stat" role="listitem"><b>{formatCount(stats.athletes)}</b><span dir="rtl">ورزشکار</span></div>
        </div>
        </div>

        <div className="login-panel">
        <form className="auth-form" onSubmit={submitLogin} noValidate>
          {field("mail", <input value={loginId} onChange={(event) => { setLoginId(event.target.value); setLoginErrors((current) => ({ ...current, identifier: undefined })); }} placeholder="Email or mobile number" autoComplete="username" dir="ltr" />, loginErrors.identifier)}
          {field("lock", <><input value={loginPassword} onChange={(event) => { setLoginPassword(event.target.value); setLoginErrors((current) => ({ ...current, password: undefined })); }} placeholder="Password" type={show ? "text" : "password"} autoComplete="current-password" dir="ltr" /><button type="button" className="eye" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"}><Icon name={show ? "eyeOff" : "eye"} size={18} /></button></>, loginErrors.password)}
          <div className="row-between">
            <button type="button" className="check-line" onClick={() => setRemember((value) => !value)} aria-pressed={remember}>
              <span className={`tiny-box${remember ? " on" : ""}`}>{remember && <Icon name="check" size={10} />}</span>
              <span dir="rtl">مرا به خاطر بسپار</span>
            </button>
            <button type="button" className="ghost-link" onClick={() => setNotice("بازیابی رمز از پروفایل برنامه در دسترس است.")}>
              <span dir="rtl">رمز را فراموش کردی؟</span>
            </button>
          </div>
          {notice && <p className="form-notice" dir="rtl">{notice}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button>
        </form>

        <div className="switch-card">
          <p dir="rtl">حساب کاربری نداری؟</p>
          <button type="button" onClick={freshSignup}>Create Account</button>
        </div>
        </div>
      </div>
    );
  } else if (draft.step === "signup") {
    content = (
      <div className="screen form-screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head">
          <h1>Create account</h1>
          <p className="fa-desc" dir="rtl">اطلاعات اولیه را وارد کن تا حساب کاربری‌ات ساخته شود.</p>
        </div>
        <div className="role-toggle" role="group" aria-label="Account role">
          <button type="button" className={draft.role === "trainer" ? "on" : ""} onClick={() => switchRole("trainer")}>مربی هستم</button>
          <button type="button" className={draft.role === "trainee" ? "on" : ""} onClick={() => switchRole("trainee")}>شاگرد هستم</button>
        </div>
        <p className="fa-hint" dir="rtl">
          {draft.role === "trainer"
            ? "بعد از این مرحله، پروفایل حرفه‌ای مربی را مرحله‌به‌مرحله تکمیل می‌کنی."
            : "بعد از این مرحله، هدف و اطلاعات بدنی‌ات را برای ساخت برنامه وارد می‌کنی."}
        </p>
        <div className="auth-form signup-form">
          {field("user", <input value={draft.name} onChange={(event) => { patch({ name: event.target.value }); setSignupErrors((current) => ({ ...current, name: undefined })); }} placeholder="Full name" autoComplete="name" />, signupErrors.name)}
          {field("mail", <input value={draft.email} onChange={(event) => { patch({ email: event.target.value }); setSignupErrors((current) => ({ ...current, email: undefined })); }} placeholder="Email" inputMode="email" autoComplete="email" dir="ltr" />, signupErrors.email)}
          {field("phone", <input value={draft.phone} onChange={(event) => { patch({ phone: normalizePhone(event.target.value) }); setSignupErrors((current) => ({ ...current, phone: undefined })); }} placeholder="Mobile number" inputMode="tel" autoComplete="tel" dir="ltr" />, signupErrors.phone)}
          {field("lock", <><input value={draft.password} onChange={(event) => { patch({ password: event.target.value }); setSignupErrors((current) => ({ ...current, password: undefined })); }} placeholder="Password" type={show ? "text" : "password"} autoComplete="new-password" dir="ltr" /><button type="button" className="eye" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"}><Icon name={show ? "eyeOff" : "eye"} size={18} /></button></>, signupErrors.password)}
          {field("lock", <input value={draft.confirm} onChange={(event) => { patch({ confirm: event.target.value }); setSignupErrors((current) => ({ ...current, confirm: undefined })); }} placeholder="Confirm password" type={show ? "text" : "password"} autoComplete="new-password" dir="ltr" />, signupErrors.confirm)}
          <div className="strength" aria-hidden="true">
            <span className={`seg${strength > 0 ? " on" : ""}`} />
            <span className={`seg${strength > 1 ? " on" : ""}`} />
            <span className={`seg${strength > 2 ? " on" : ""}`} />
            <span className="strength-label" dir="rtl">{["خیلی ضعیف", "ضعیف", "متوسط", "قوی"][strength]}</span>
          </div>
          <button type="button" className={`check-line terms-line${signupErrors.terms ? " has-error" : ""}`} onClick={() => { patch({ acceptTerms: !draft.acceptTerms }); setSignupErrors((current) => ({ ...current, terms: undefined })); }} aria-pressed={draft.acceptTerms}>
            <span className={`tiny-box${draft.acceptTerms ? " on" : ""}`}>{draft.acceptTerms && <Icon name="check" size={10} />}</span>
            <span dir="rtl"><Icon name="doc" size={13} /> قوانین و شرایط را می‌پذیرم</span>
          </button>
          {signupErrors.terms && <p className="field-error terms-error" dir="rtl">{signupErrors.terms}</p>}
          <button type="button" className="btn btn-primary" onClick={validateSignup}>Continue <Icon name="arrow" size={17} /></button>
        </div>
      </div>
    );
  } else if (draft.step === "coachPhoto") {
    content = coachScreen(
      "coachPhoto",
      <div className="photo-stage">
        <label className={`photo-ring${coachErrors.avatar ? " has-error" : ""}${draft.avatar ? " has-photo" : ""}`}>
          <span className="photo-inner">
            {draft.avatar ? <img src={draft.avatar} alt="Coach profile preview" /> : <Icon name="user" size={52} />}
          </span>
          <span className="photo-badge"><Icon name="camera" size={18} /></span>
          <input type="file" accept="image/*" hidden onChange={(event) => { pickAvatar(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        {coachErrors.avatar && <p className="field-error center-error" dir="rtl">{coachErrors.avatar}</p>}
        <div className="photo-actions">
          <label className="pill-btn">
            <Icon name="camera" size={16} /> {draft.avatar ? "Change photo" : "Choose photo"}
            <input type="file" accept="image/*" hidden onChange={(event) => { pickAvatar(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {draft.avatar && (
            <button type="button" className="pill-btn ghost" onClick={() => { setEditorImage(draft.avatar); setEditorRotation(0); setEditorCrop(null); setEditorOpen(true); }}>
              <Icon name="edit" size={15} /> Edit
            </button>
          )}
          {draft.avatar && (
            <button type="button" className="pill-btn ghost" onClick={() => patch({ avatar: "" })}>
              <Icon name="trash" size={15} /> Remove
            </button>
          )}
        </div>
        <ul className="photo-tips" dir="rtl">
          <li><Icon name="check" size={12} /> صورت واضح با نور مناسب</li>
          <li><Icon name="check" size={12} /> پس‌زمینه ساده و بدون شلوغی</li>
          <li><Icon name="check" size={12} /> ترجیحاً تصویر ورزشی و جدید</li>
        </ul>
      </div>,
      coachNextButton(),
    );
  } else if (draft.step === "coachAge") {
    content = coachScreen(
      "coachAge",
      <Ruler min={18} max={80} value={draft.trainerAge} unit="years" label="Coach age in years" onChange={(trainerAge) => patch({ trainerAge })} />,
      coachNextButton(),
    );
  } else if (draft.step === "coachSpecialty") {
    content = coachScreen(
      "coachSpecialty",
      <>
        <div className="spec-grid">
          {SPECIALTIES.map((item) => {
            const on = draft.specialties.includes(item.value);
            return (
              <button key={item.value} type="button" className={`spec-card${on ? " on" : ""}`} onClick={() => toggleSpecialty(item.value)} aria-pressed={on}>
                <span className="spec-icon"><Icon name={item.icon} size={18} /></span>
                <b>{item.value}</b>
                <small dir="rtl">{item.hint}</small>
                <span className="spec-check">{on && <Icon name="check" size={11} />}</span>
              </button>
            );
          })}
        </div>
        <div className="spec-meta">
          <span>{draft.specialties.length} of {MAX_SPECIALTIES} selected</span>
        </div>
        {coachErrors.specialties && <p className="field-error" dir="rtl">{coachErrors.specialties}</p>}
      </>,
      coachNextButton(),
      "is-top",
    );
  } else if (draft.step === "coachCert") {
    content = coachScreen(
      "coachCert",
      <>
        <div className="block-label"><span>Issued by</span></div>
        <div className={`chip-grid${coachErrors.certBody ? " has-error" : ""}`}>
          {CERT_BODIES.map((body) => (
            <button key={body} type="button" className={`chip${draft.certificationBody === body ? " on" : ""}`} onClick={() => { patch({ certificationBody: body }); setCoachErrors((current) => ({ ...current, certBody: undefined })); }}>
              {body}
            </button>
          ))}
        </div>
        {coachErrors.certBody && <p className="field-error" dir="rtl">{coachErrors.certBody}</p>}
        <p className="fa-hint" dir="rtl">Federation یعنی کارت مربیگری فدراسیون بدنسازی و پرورش اندام.</p>

        <div className="block-label"><span>Coaching grade</span></div>
        <div className="seg-control" role="group" aria-label="Coaching grade">
          {CERT_LEVELS.map((level) => (
            <button key={level} type="button" className={draft.certificationLevel === level ? "on" : ""} onClick={() => patch({ certificationLevel: level })}>{level}</button>
          ))}
        </div>

        <div className="block-label"><span>Certificate title or ID</span></div>
        {field("award", <input value={draft.certification} onChange={(event) => { patch({ certification: event.target.value }); setCoachErrors((current) => ({ ...current, certification: undefined })); }} placeholder="e.g. Bodybuilding Coach Card #1024" dir="auto" />, coachErrors.certification)}
      </>,
      coachNextButton(),
      "is-top",
    );
  } else if (draft.step === "coachExperience") {
    content = coachScreen(
      "coachExperience",
      <>
        <Ruler min={0} max={40} value={draft.experienceYears} unit="years" label="Years of coaching experience" onChange={(experienceYears) => { patch({ experienceYears }); setCoachErrors((current) => ({ ...current, experience: undefined })); }} />
        <div className="exp-badge">
          <Icon name="award" size={15} />
          <span>{draft.experienceYears === 0 ? "New coach" : draft.experienceYears < 3 ? "Rising coach" : draft.experienceYears < 8 ? "Experienced coach" : "Expert coach"}</span>
        </div>
        {coachErrors.experience && <p className="field-error center-error" dir="rtl">{coachErrors.experience}</p>}
      </>,
      coachNextButton(),
    );
  } else if (draft.step === "coachFormat") {
    content = coachScreen(
      "coachFormat",
      <div className="format-list" role="radiogroup" aria-label="Coaching format">
        {FORMATS.map((item) => {
          const on = draft.coachingFormat === item.value;
          return (
            <button key={item.value} type="button" role="radio" aria-checked={on} className={`format-card${on ? " on" : ""}`} onClick={() => patch({ coachingFormat: item.value })}>
              <span className="format-icon"><Icon name={item.icon} size={21} /></span>
              <span className="format-copy">
                <b>{item.title}</b>
                <small dir="rtl">{item.hint}</small>
              </span>
              <span className="radio-dot" />
            </button>
          );
        })}
      </div>,
      coachNextButton(),
    );
  } else if (draft.step === "coachBio") {
    content = coachScreen(
      "coachBio",
      <div className="bio-box">
        <textarea
          value={draft.bio}
          onChange={(event) => patch({ bio: event.target.value.slice(0, 300) })}
          placeholder="Tell athletes about your coaching style, achievements and approach…"
          dir="auto"
          rows={6}
        />
        <span className="bio-counter">{draft.bio.length}/300</span>
      </div>,
      <div className="dual-actions">
        {!editingFromReview && <button type="button" className="btn btn-glass" onClick={() => { patch({ bio: "" }); next(); }}>Skip</button>}
        {coachNextButton()}
      </div>,
      "is-top",
    );
  } else if (draft.step === "coachReview") {
    content = coachScreen(
      "coachReview",
      <div className="review-card">
        <div className="review-head">
          {draft.avatar ? <img className="review-avatar" src={draft.avatar} alt="" /> : <span className="review-avatar empty"><Icon name="user" size={28} /></span>}
          <div className="review-id">
            <span className="review-role">Coach</span>
            <b className="review-name" dir="auto">{draft.name || "Coach"}</b>
            <span className="review-sub">{draft.specialties[0] ?? "—"}</span>
          </div>
          <button type="button" className="review-edit" onClick={() => editCoachStep("coachPhoto")}><Icon name="edit" size={14} /> Edit</button>
        </div>
        <div className="review-row">
          <span className="k">Age</span><span className="v">{draft.trainerAge} years</span>
          <button type="button" className="review-edit" onClick={() => editCoachStep("coachAge")}><Icon name="edit" size={14} /></button>
        </div>
        <div className="review-row">
          <span className="k">Specialty</span>
          <span className="v chips">{draft.specialties.length ? draft.specialties.map((item) => <i key={item} className="mini-chip">{item}</i>) : "—"}</span>
          <button type="button" className="review-edit" onClick={() => editCoachStep("coachSpecialty")}><Icon name="edit" size={14} /></button>
        </div>
        <div className="review-row">
          <span className="k">Certificate</span>
          <span className="v" dir="auto">{[draft.certificationBody, draft.certificationLevel, draft.certification.trim()].filter(Boolean).join(" • ") || "—"}</span>
          <button type="button" className="review-edit" onClick={() => editCoachStep("coachCert")}><Icon name="edit" size={14} /></button>
        </div>
        <div className="review-row">
          <span className="k">Experience</span><span className="v">{draft.experienceYears} years</span>
          <button type="button" className="review-edit" onClick={() => editCoachStep("coachExperience")}><Icon name="edit" size={14} /></button>
        </div>
        <div className="review-row">
          <span className="k">Format</span><span className="v">{formatLabel(draft.coachingFormat)}</span>
          <button type="button" className="review-edit" onClick={() => editCoachStep("coachFormat")}><Icon name="edit" size={14} /></button>
        </div>
        <div className="review-row">
          <span className="k">Bio</span><span className="v bio-preview" dir="auto">{draft.bio.trim() || "—"}</span>
          <button type="button" className="review-edit" onClick={() => editCoachStep("coachBio")}><Icon name="edit" size={14} /></button>
        </div>
      </div>,
      <>
        {coachErrors.submit && <p className="field-error" dir="rtl">{coachErrors.submit}</p>}
        <button type="button" className="btn btn-primary" onClick={finalizeCoach} disabled={busy}>
          {busy ? "Creating profile…" : completingExistingTrainer ? "Save Profile" : "Complete Profile"}
        </button>
      </>,
      "is-top",
    );
  } else if (draft.step === "otp") {
    content = (
      <div className="screen otp-screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head">
          <span className="eyebrow">Phone verification</span>
          <h1>Enter the code</h1>
          <p className="fa-desc" dir="rtl">
            کد ۶ رقمی به شماره <bdi className="otp-phone">{otpChallenge ? maskPhone(otpChallenge.phone) : ""}</bdi> پیامک شد. برای تأیید حساب، کد را وارد کن.
          </p>
        </div>
        <div className="otp-body">
          {otpChallenge?.mode === "preview" && (
            <div className="otp-preview" role="note">
              <span className="otp-preview-tag">PREVIEW</span>
              <span dir="rtl">سرویس پیامک هنوز متصل نیست؛ پیامکی واقعاً ارسال نشده. کد آزمایشی:</span>
              <b>{otpChallenge.previewCode}</b>
            </div>
          )}
          <div className={`otp-cells${otpError ? " has-error" : ""}`} role="group" aria-label="Verification code">
            {otpCells.map((cell, index) => (
              <input
                key={index}
                ref={(node) => { otpInputs.current[index] = node; }}
                className={`otp-cell${cell ? " filled" : ""}`}
                value={cell}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={6}
                aria-label={`Digit ${index + 1}`}
                onChange={(event) => {
                  const typed = event.target.value.replace(/\D/g, "");
                  setOtpAt(index, typed.length > 1 && !otpCells[index] ? typed : typed.slice(-1));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !otpCells[index] && index > 0) {
                    setOtpAt(index - 1, "");
                    otpInputs.current[index - 1]?.focus();
                  }
                }}
                onPaste={(event) => {
                  event.preventDefault();
                  setOtpAt(index, event.clipboardData.getData("text"));
                }}
              />
            ))}
          </div>
          {otpError && <p className="form-error otp-error" dir="rtl">{otpError}</p>}
          <div className="otp-meta">
            <span className={`otp-timer${expiresIn === 0 ? " is-expired" : ""}`}>
              {expiresIn > 0 ? `Code expires in ${mmss(expiresIn)}` : "Code expired"}
            </span>
            <span>{Math.max(0, OTP_MAX_ATTEMPTS - otpAttempts)} attempts left</span>
          </div>
          <button type="button" className="otp-resend" onClick={() => startOtp(true)} disabled={!resendAllowed}>
            {cooldownIn > 0
              ? `Resend in ${mmss(cooldownIn)}`
              : otpResends >= OTP_MAX_RESENDS
                ? "Resend limit reached"
                : "Resend code"}
          </button>
          <button type="button" className="ghost-link otp-edit" onClick={back}>Edit phone number</button>
        </div>
        <div className="q-foot">
          <button type="button" className="btn btn-primary" onClick={verifyOtp} disabled={otpCode.length < 6 || otpSending}>
            {otpSending ? "Verifying…" : "Verify & Continue"}
          </button>
        </div>
      </div>
    );
  } else if (draft.step === "profile") {
    const summaryRows = [
      ["Goal", GOALS.find((item) => item.value === draft.goal)?.label ?? draft.goal],
      ["Level", LEVELS.find((item) => item.value === draft.level)?.label ?? draft.level],
      ["Age", `${draft.age} years`],
      ["Weight", `${draft.weight} kg`],
      ["Workout time", `${draft.hour}:${String(draft.minute).padStart(2, "0")} ${draft.period}`],
    ];
    content = (
      <div className="screen trainee-profile-screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head">
          <span className="eyebrow">Your profile</span>
          <h1>Make it yours</h1>
          <p className="fa-desc" dir="rtl">عکس پروفایل و نام نمایشی‌ات را انتخاب کن تا مربی و برنامه‌هایت را بهتر بشناسی.</p>
        </div>
        <div className="trainee-profile-body">
          <div className="trainee-avatar-block">
            <button
              type="button"
              className={`trainee-avatar${draft.avatar ? " has-photo" : ""}`}
              onClick={() => {
                if (draft.avatar) {
                  setEditorImage(draft.avatar);
                } else {
                  document.getElementById("trainee-avatar-input")?.click();
                }
                setEditorRotation(0);
                setEditorCrop(null);
                if (draft.avatar) setEditorOpen(true);
              }}
              aria-label={draft.avatar ? "Edit profile photo" : "Upload profile photo"}
            >
              {draft.avatar ? <img src={draft.avatar} alt="Athlete profile preview" /> : <Icon name="camera" size={26} />}
              <span className="trainee-avatar-badge">{draft.avatar ? <Icon name="edit" size={13} /> : "+"}</span>
            </button>
            <input
              id="trainee-avatar-input"
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => { pickAvatar(event.target.files?.[0]); event.target.value = ""; }}
            />
            <div className="trainee-avatar-copy">
              <b>{draft.avatar ? "Photo added" : "Add a profile photo"}</b>
              <small dir="rtl">اختیاری • با هر اندازه و برش دلخواه</small>
              <div className="trainee-avatar-actions">
                <button type="button" className="pill-btn" onClick={() => document.getElementById("trainee-avatar-input")?.click()}>
                  <Icon name="camera" size={14} /> {draft.avatar ? "Change" : "Upload"}
                </button>
                {draft.avatar && (
                  <>
                    <button type="button" className="pill-btn ghost" onClick={() => { setEditorImage(draft.avatar); setEditorRotation(0); setEditorCrop(null); setEditorOpen(true); }}>
                      <Icon name="edit" size={14} /> Edit
                    </button>
                    <button type="button" className="pill-btn ghost" onClick={() => patch({ avatar: "" })}>
                      <Icon name="trash" size={14} /> Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <label className="trainee-name-field">
            <span>Display name</span>
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Your name" autoComplete="name" />
          </label>

          <div className="trainee-summary" aria-label="Your answers">
            <div className="trainee-summary-head"><b>Quick summary</b><span dir="rtl">قابل ویرایش در مراحل قبل</span></div>
            {summaryRows.map(([key, value]) => (
              <div className="trainee-summary-row" key={key}><span>{key}</span><b>{value}</b></div>
            ))}
          </div>
        </div>
        <div className="q-foot">
          <button type="button" className="btn btn-primary" onClick={() => go("coachLink")}>Continue <Icon name="arrow" size={17} /></button>
        </div>
      </div>
    );
  } else if (draft.step === "coachLink") {
    const coach = coachLookup;
    content = (
      <div className="screen coach-link-screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head">
          <span className="eyebrow">Connect a coach</span>
          <h1>Got a coach code?</h1>
          <p className="fa-desc" dir="rtl">
            اگر مربی‌ات کد اختصاصی دارد، آن را وارد کن تا پروفایل و پلن‌هایش را ببینی و به او وصل شوی. اگر فعلاً نمی‌خواهی، می‌توانی این مرحله را رد کنی و بعداً از بخش «اشتراک» مربی و پلن بخری.
          </p>
        </div>

        <div className="coach-link-body">
          <div className={`coach-code-field${coachLookupError ? " has-error" : ""}`}>
            <input
              value={coachCodeInput}
              onChange={(event) => {
                setCoachCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
                setCoachLookupError("");
                if (coachLookup) setCoachLookup(null);
              }}
              onKeyDown={(event) => { if (event.key === "Enter") findCoach(); }}
              placeholder="COACH CODE"
              inputMode="text"
              autoCapitalize="characters"
              dir="ltr"
              maxLength={8}
              aria-label="Coach invite code"
            />
            <button type="button" className="coach-find" onClick={findCoach} disabled={coachLookupBusy || coachCodeInput.trim().length < 4}>
              {coachLookupBusy ? "Searching…" : coach ? "Change" : "Find coach"}
            </button>
          </div>
          {coachLookupError && <p className="form-error" dir="rtl">{coachLookupError}</p>}

          {coach && (
            <div className="coach-found">
              <div className="coach-hero">
                <img className="coach-hero-avatar" src={coach.avatar} alt="" />
                <div className="coach-hero-copy">
                  <span className="coach-kicker">Your personal coach</span>
                  <b className="coach-hero-name">{coach.name}</b>
                  <span className="coach-hero-code">#{coach.code}</span>
                </div>
                <span className="coach-verified"><Icon name="check" size={11} /> Verified</span>
              </div>

              <div className="coach-spec-grid">
                <div><span>Specialty</span><b>{coach.specialties.slice(0, 2).join(" • ") || "Personal coaching"}</b></div>
                <div><span>Experience</span><b>{coach.experienceYears > 0 ? `${coach.experienceYears} years` : "—"}</b></div>
                <div><span>Certification</span><b>{[coach.certificationBody, coach.certification].filter(Boolean).join(" • ") || "—"}</b></div>
                <div><span>Coaching style</span><b>{coach.coachingFormat === "online" ? "Online" : coach.coachingFormat === "in-person" ? "In person" : "Hybrid"}</b></div>
              </div>

              {coach.bio && <p className="coach-bio" dir="auto">{coach.bio}</p>}

              <div className="coach-points" dir="rtl">
                <span><Icon name="check" size={13} /> برنامه تمرینی اختصاصی از طرف مربی</span>
                <span><Icon name="check" size={13} /> بازبینی تمرین‌ها و پیگیری پیشرفت</span>
                <span><Icon name="check" size={13} /> ارتباط مستقیم و گزارش هفتگی</span>
                <span><Icon name="shield" size={13} /> دسترسی شما فقط به اطلاعات خودتان</span>
              </div>

              <p className="plan-note" dir="rtl">
                با زدن «Next» وارد مرحلهٔ اشتراک می‌شوی و همهٔ جزئیات همان‌جا برایت نمایش داده می‌شود.
              </p>
            </div>
          )}

          <div className="coach-divider"><span>or</span></div>
          <button type="button" className="coach-skip" onClick={() => finishCoachLink(true)}>
            Skip for now — choose a coach later
          </button>
          <p className="coach-skip-note" dir="rtl">می‌توانی بدون مربی وارد شوی و هر وقت خواستی از بخش اشتراک، مربی و پلن انتخاب کنی.</p>
        </div>

        <div className="q-foot">
          <button type="button" className="btn btn-primary" onClick={() => finishCoachLink(false)} disabled={Boolean(coachCodeInput.trim()) && !coachLookup}>
            {coach ? "Confirm coach & see plans" : "Continue to plans"} <Icon name="arrow" size={17} />
          </button>
        </div>
      </div>
    );
  } else if (draft.step === "welcome") {
    content = (
      <div className="screen hero-screen">
        <Brand />
        <div className="hero-copy">
          <span className="eyebrow">Welcome to</span>
          <h1 className="hero-h1">Revo<br /><span className="brand-text">Sport.</span></h1>
          <p className="fa-desc" dir="rtl">به جمع ما خوش آمدی؛ برنامه‌ی تمرینی اختصاصی و همراهی همیشگی، دقیقاً برای هدف تو.</p>
          <button type="button" className="btn btn-primary hero-cta" onClick={() => go("goal")}>Start Now <Icon name="arrow" size={18} /></button>
          <div className="hero-dots" aria-hidden="true"><i className="on" /><i /><i /></div>
        </div>
      </div>
    );
  } else if (draft.step === "goal") {
    content = (
      <div className="screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head"><h1>What&apos;s your main goal?</h1><p className="fa-desc" dir="rtl">هدف اصلی‌ات را انتخاب کن تا برنامه‌ی مناسب تو ساخته شود.</p></div>
        <div className="q-body">
          <div className="choices">
            {GOALS.map((goal) => (
              <button key={goal.value} type="button" className={`choice${draft.goal === goal.value ? " on" : ""}`} onClick={() => patch({ goal: goal.value })} aria-pressed={draft.goal === goal.value}>
                <span>{goal.label}</span>
                <span className="choice-mark">{draft.goal === goal.value && <Icon name="check" size={13} />}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="q-foot"><button type="button" className="btn btn-primary" onClick={() => go("level")}>Next</button></div>
      </div>
    );
  } else if (draft.step === "level") {
    const index = LEVELS.findIndex((item) => item.value === draft.level);
    content = (
      <div className="screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head"><h1>What&apos;s your fitness level?</h1><p className="fa-desc" dir="rtl">سطح فعلی‌ات را انتخاب کن؛ شدت و حجم برنامه بر همین اساس تنظیم می‌شود.</p></div>
        <div className="q-body">
          <div className="level-card">
            <span className="level-value">{LEVELS[index].label}</span>
            <div className="level-slider">
              <span className="level-line" />
              <span className="level-fill" style={{ width: `${(index / (LEVELS.length - 1)) * 100}%` }} />
              {LEVELS.map((item, dot) => (
                <span key={item.value} className={`level-dot${dot <= index ? " on" : ""}${dot === index ? " current" : ""}`} style={{ left: `${(dot / (LEVELS.length - 1)) * 100}%` }} />
              ))}
              <input className="level-input" type="range" min={0} max={LEVELS.length - 1} step={1} value={index} aria-label="Fitness level" onChange={(event) => patch({ level: LEVELS[Number(event.target.value)].value })} />
            </div>
            <div className="level-labels">{LEVELS.map((item, dot) => <span key={item.value} className={dot === index ? "on" : ""}>{item.label}</span>)}</div>
            <p className="level-hint fa-desc" dir="rtl">{LEVELS[index].hint}</p>
          </div>
        </div>
        <div className="q-foot"><button type="button" className="btn btn-primary" onClick={() => go("age")}>Next</button></div>
      </div>
    );
  } else if (draft.step === "age") {
    content = (
      <div className="screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head"><h1>How old are you?</h1><p className="fa-desc" dir="rtl">سن به ما کمک می‌کند برنامه‌ی دقیق‌تری برای تو بسازیم؛ بعداً هم قابل تغییر است.</p></div>
        <div className="q-body"><Ruler min={16} max={80} value={draft.age} unit="years" label="Age in years" onChange={(age) => patch({ age })} /></div>
        <div className="q-foot"><button type="button" className="btn btn-primary" onClick={() => go("weight")}>Next</button></div>
      </div>
    );
  } else if (draft.step === "weight") {
    content = (
      <div className="screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head"><h1>What&apos;s your weight?</h1><p className="fa-desc" dir="rtl">وزن فعلی‌ات را انتخاب کن؛ هر زمان بخواهی می‌توانی آن را تغییر بدهی.</p></div>
        <div className="q-body"><Ruler min={40} max={140} value={draft.weight} unit="kg" label="Weight in kilograms" onChange={(weight) => patch({ weight })} /></div>
        <div className="q-foot"><button type="button" className="btn btn-primary" onClick={() => go("time")}>Next</button></div>
      </div>
    );
  } else if (draft.step === "time") {
    content = (
      <div className="screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head"><h1>Set your workout time</h1><p className="fa-desc" dir="rtl">بهترین زمان تمرینت را انتخاب کن تا یادآوری‌ها و برنامه‌ات بر اساس آن تنظیم شود.</p></div>
        <div className="q-body"><TimePicker draft={draft} patch={patch} /></div>
        <div className="q-foot">
          <button type="button" className="btn btn-primary" onClick={() => go("profile")}>Next <Icon name="arrow" size={17} /></button>
        </div>
      </div>
    );
  } else if (draft.step === "plan") {
    const coach = coachLookup;
    const plans = coach?.plans ?? [];
    const chosen = plans.find((plan) => plan.id === selectedPlanId) ?? null;
    const skipBuy = () => {
      choosePlan(null);
      createAccount();
    };
    const confirmBuy = () => {
      if (!chosen) return;
      choosePlan(chosen);
      runPayment();
    };
    content = (
      <div className="screen plan-screen">
        <ProgressHeader progress={progress} onBack={back} count={stepCount} />
        <div className="q-head">
          <span className="eyebrow">Subscription</span>
          <h1>{coach ? "Choose your plan" : "Your membership"}</h1>
          <p className="fa-desc" dir="rtl">
            {coach
              ? `اشتراک‌های ${coach.name} را مقایسه کن. خرید فعلاً شبیه‌سازی‌شده است و بعداً از بخش «اشتراک» قابل پرداخت خواهد بود.`
              : "بدون مربی هم می‌توانی وارد شوی و بعداً از بخش اشتراک، مربی و پلن مناسب را انتخاب کنی."}
          </p>
        </div>

        <div className="plan-screen-body">
          {payResult === "success" && (
            <div className="pay-banner ok" role="status">
              <b>Payment verified</b>
              <span dir="rtl">تراکنش تأیید شد؛ حالا حسابت را می‌سازیم…</span>
            </div>
          )}
          {coach ? (
            <>
              <div className="plan-coach-strip">
                <img src={coach.avatar} alt="" />
                <div>
                  <b>{coach.name}</b>
                  <span>{coach.specialties.slice(0, 2).join(" • ") || "Personal coaching"}</span>
                </div>
                <span className="plan-coach-code">#{coach.code}</span>
              </div>

              <div className="plan-list-vertical" role="radiogroup" aria-label="Subscription plans">
                {plans.map((plan) => {
                  const on = plan.id === selectedPlanId;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`plan-row${on ? " on" : ""}`}
                      onClick={() => choosePlan(on ? null : plan)}
                    >
                      {(plan.popular || plan.best) && (
                        <span className="plan-row-flag">{plan.popular ? "Most popular" : "Best value"}</span>
                      )}
                      <span className="plan-row-main">
                        <span className="plan-row-sessions">
                          <b>{plan.sessions}</b>
                          <i>sessions</i>
                        </span>
                        <span className="plan-row-info">
                          <span className="plan-row-title">{plan.title} • {plan.days} days</span>
                          <span className="plan-row-perks">
                            {plan.perks.slice(0, 3).map((perk) => <em key={perk}>{perk}</em>)}
                          </span>
                        </span>
                        <span className="plan-row-price">
                          <b>{plan.price.toLocaleString("en-US")}</b>
                          <i>Toman</i>
                          <small>{plan.perSession.toLocaleString("en-US")} / session</small>
                        </span>
                        <span className="plan-row-check">{on && <Icon name="check" size={12} />}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="plan-summary">
                <div><span>Selected plan</span><b>{chosen ? `${chosen.sessions} sessions` : "None yet"}</b></div>
                <div><span>Valid for</span><b>{chosen ? `${chosen.days} days` : "—"}</b></div>
                <div><span>Total</span><b>{chosen ? `${chosen.price.toLocaleString("en-US")} Toman` : "—"}</b></div>
              </div>
              <p className="plan-note" dir="rtl">
با «Pay & activate» به درگاه پرداخت ایرانی منتقل می‌شوی؛ بعد از تکمیل تراکنش به‌صورت خودکار همین‌جا برمی‌گردی و اشتراکت فعال می‌شود. با «Start without payment» بدون پرداخت وارد می‌شوی.
              </p>
            </>
          ) : (
            <div className="plan-empty">
              <span className="plan-empty-icon"><Icon name="crown" size={26} /></span>
              <b>No coach selected yet</b>
              <p dir="rtl">می‌توانی همین حالا حساب بسازی؛ هر زمان خواستی از بخش «اشتراک» یک مربی و پلن انتخاب کنی.</p>
            </div>
          )}
          {payError && <p className="form-error" dir="rtl">{payError}</p>}
          {coachErrors.submit && <p className="form-error" dir="rtl">{coachErrors.submit}</p>}
        </div>

        <div className="q-foot plan-foot">
          <button type="button" className="btn btn-glass" onClick={skipBuy} disabled={busy}>Start without payment</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirmBuy}
            disabled={!chosen || busy || gatewayBusy || payResult === "checking"}
          >
            {payResult === "checking"
              ? "Verifying payment…"
              : gatewayBusy
                ? "Opening gateway…"
                : busy
                  ? "Creating account…"
                  : "Pay & activate"}
          </button>
        </div>
      </div>
    );
  } else {
    const coach = draft.role === "trainer";
    content = (
      <div className="screen success-screen">
        <span className="success-badge"><Icon name="check" size={38} /></span>
        <span className="eyebrow">{coach ? "Profile complete" : "You're all set"}</span>
        <h1 className="hero-h1 success-title">
          {coach ? <>Welcome,<br /><span className="brand-text">Coach.</span></> : <>Ready to<br /><span className="brand-text">train.</span></>}
        </h1>
        <p className="fa-desc success-desc" dir="rtl">
          {coach
            ? "پروفایل حرفه‌ای تو ساخته شد؛ حالا می‌توانی شاگردها، برنامه‌ها و اشتراک‌ها را مدیریت کنی."
            : draft.planId && planPaid
              ? `پرداخت انجام شد و پلن ${draft.planTitle} فعال است. حالا می‌توانی وارد شوی و تمرین را شروع کنی.`
              : draft.planId
                ? `حسابت ساخته شد و پلن ${draft.planTitle} برای مربی ثبت شد؛ برای فعال‌سازی، پرداخت را از بخش اشتراک کامل کن.`
                : "حسابت با موفقیت ساخته شد. هر زمان خواستی می‌توانی از بخش اشتراک، مربی و پلن انتخاب کنی."}
        </p>
        <button type="button" className="btn btn-primary" onClick={onEnter}>Go to Dashboard <Icon name="arrow" size={17} /></button>
      </div>
    );
  }

  const tone: ReelTone = draft.step === "intro" ? "intro" : VIDEO_STEPS.has(draft.step) ? "hero" : "form";

  return (
    <main className="neo-auth" dir="ltr">
      <section className="neo-stage" aria-label="Revo Sport account onboarding">
        <VideoReel tone={tone} />
        <div className="neo-view" key={draft.step}>
          {content}
          {editorOpen && (
            <AvatarEditor
              source={editorImage}
              rotation={editorRotation}
              crop={editorCrop}
              onRotate={() => setEditorRotation((value) => (value + 90) % 360)}
              onCrop={setEditorCrop}
              onStageSize={(size) => { editorStageSize.current = size; }}
              onCancel={() => setEditorOpen(false)}
              onSave={applyEditedAvatar}
            />
          )}
        </div>
      </section>
    </main>
  );
}
