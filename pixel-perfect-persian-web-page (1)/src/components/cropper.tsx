import { useEffect, useRef, useState } from "react";
import { RotateCw, FlipHorizontal, ZoomIn, ZoomOut, Sun, Contrast, RefreshCcw, Check, Move } from "lucide-react";
import { fa } from "../lib/core";

const V = 280; // اندازه پنجره برش روی صفحه
const OUT = 480; // اندازه خروجی عکس

interface Props {
  src: string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

export default function ImageCropper({ src, onCancel, onSave }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [flip, setFlip] = useState(false);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [bright, setBright] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; ox: number; oy: number; dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.onerror = () => setFailed(true);
    i.src = src;
  }, [src]);

  const scaleFor = (z: number, r: number) => {
    if (!img) return 1;
    const rw = r % 180 ? img.naturalHeight : img.naturalWidth;
    const rh = r % 180 ? img.naturalWidth : img.naturalHeight;
    return Math.max(V / rw, V / rh) * z;
  };

  const clamp = (x: number, y: number, z = zoom, r = rot) => {
    if (!img) return { x, y };
    const rw = r % 180 ? img.naturalHeight : img.naturalWidth;
    const rh = r % 180 ? img.naturalWidth : img.naturalHeight;
    const s = scaleFor(z, r);
    const mx = Math.max(0, (rw * s - V) / 2);
    const my = Math.max(0, (rh * s - V) / 2);
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };

  const setZoomSafe = (z: number) => {
    const nz = Math.min(4, Math.max(1, z));
    setZoom(nz);
    setOff((o) => clamp(o.x, o.y, nz));
  };

  const begin = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { x: pts[0].x, y: pts[0].y, ox: off.x, oy: off.y, dist: 0, zoom };
    } else if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      gesture.current = { x: 0, y: 0, ox: off.x, oy: off.y, dist: d || 1, zoom };
    } else {
      gesture.current = null;
    }
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    begin();
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setZoomSafe(g.zoom * (d / g.dist));
    } else {
      setOff(clamp(g.ox + (e.clientX - g.x), g.oy + (e.clientY - g.y)));
    }
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    begin();
  };

  const rotate = () => {
    const r = (rot + 90) % 360;
    setRot(r);
    setOff((o) => clamp(o.x, o.y, zoom, r));
  };

  const reset = () => {
    setZoom(1);
    setRot(0);
    setFlip(false);
    setOff({ x: 0, y: 0 });
    setBright(100);
    setContrast(100);
  };

  const save = () => {
    if (!img) return;
    setBusy(true);
    try {
      const k = OUT / V;
      const s = scaleFor(zoom, rot);
      const c = document.createElement("canvas");
      c.width = OUT;
      c.height = OUT;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("ctx");
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.translate(OUT / 2 + off.x * k, OUT / 2 + off.y * k);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale((flip ? -1 : 1) * s * k, s * k);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      if (bright !== 100 || contrast !== 100) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const d = ctx.getImageData(0, 0, OUT, OUT);
        const b = bright / 100;
        const cf = contrast / 100;
        for (let i = 0; i < d.data.length; i += 4) {
          for (let j = 0; j < 3; j++) {
            const v = (d.data[i + j] * b - 128) * cf + 128;
            d.data[i + j] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
        }
        ctx.putImageData(d, 0, 0);
      }
      onSave(c.toDataURL("image/jpeg", 0.88));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const s = scaleFor(zoom, rot);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div
          dir="ltr"
          className="relative cursor-grab overflow-hidden rounded-3xl bg-black active:cursor-grabbing"
          style={{ width: V, height: V, touchAction: "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => setZoomSafe(zoom * (e.deltaY < 0 ? 1.08 : 0.93))}
        >
          {img && !failed && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: img.naturalWidth,
                height: img.naturalHeight,
                maxWidth: "none",
                transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) rotate(${rot}deg) scale(${(flip ? -1 : 1) * s}, ${s})`,
                filter: `brightness(${bright}%) contrast(${contrast}%)`,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          )}
          {!img && !failed && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-white/60">در حال بارگذاری…</div>}
          {failed && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[12px] text-red-300">این عکس قابل ویرایش نیست؛ یک عکس دیگر از گالری انتخاب کن.</div>}
          {/* ماسک دایره‌ای */}
          <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 999px rgba(0,0,0,0.55)" }} />
          <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/20" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/20" />
            <div className="absolute left-0 top-1/3 h-px w-full bg-white/20" />
            <div className="absolute left-0 top-2/3 h-px w-full bg-white/20" />
          </div>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[var(--color-mute)]">
        <Move size={13} /> برای تنظیم کادر عکس را بکش • با دو انگشت یا اسلایدر زوم کن
      </p>

      <div className="rounded-2xl bg-[var(--color-bg)] p-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setZoomSafe(zoom - 0.2)} className="press text-[var(--color-mute)]" aria-label="کوچک‌نمایی"><ZoomOut size={17} /></button>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomSafe(Number(e.target.value))} className="flex-1" aria-label="زوم" />
          <button onClick={() => setZoomSafe(zoom + 0.2)} className="press text-[var(--color-mute)]" aria-label="بزرگ‌نمایی"><ZoomIn size={17} /></button>
          <span className="tnum w-10 text-left text-[11px] font-bold text-[var(--color-mute)]">{fa(zoom.toFixed(1))}×</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Sun size={16} className="shrink-0 text-[var(--color-mute)]" />
          <span className="w-14 shrink-0 text-[11.5px] font-bold">روشنایی</span>
          <input type="range" min={50} max={150} value={bright} onChange={(e) => setBright(Number(e.target.value))} className="flex-1" aria-label="روشنایی" />
          <span className="tnum w-10 text-left text-[11px] text-[var(--color-mute)]">{fa(bright)}٪</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Contrast size={16} className="shrink-0 text-[var(--color-mute)]" />
          <span className="w-14 shrink-0 text-[11.5px] font-bold">کنتراست</span>
          <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="flex-1" aria-label="کنتراست" />
          <span className="tnum w-10 text-left text-[11px] text-[var(--color-mute)]">{fa(contrast)}٪</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={rotate} className="press flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-line)] text-[12px] font-bold">
          <RotateCw size={15} /> چرخش
        </button>
        <button onClick={() => setFlip((f) => !f)} className={`press flex h-11 items-center justify-center gap-1.5 rounded-xl border text-[12px] font-bold ${flip ? "border-[#e9e400] bg-[#e9e400]/10" : "border-[var(--color-line)]"}`}>
          <FlipHorizontal size={15} /> آینه
        </button>
        <button onClick={reset} className="press flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-line)] text-[12px] font-bold">
          <RefreshCcw size={15} /> بازنشانی
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="press h-12 flex-1 rounded-2xl border border-[var(--color-line)] text-[13px] font-bold">انصراف</button>
        <button
          onClick={save}
          disabled={!img || failed || busy}
          className="press flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-[#e9e400] text-[14px] font-black text-black disabled:opacity-50"
        >
          <Check size={17} strokeWidth={3} /> برش و ذخیره عکس
        </button>
      </div>
    </div>
  );
}
