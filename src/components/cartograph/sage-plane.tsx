import { useEffect, useRef, useState } from "react";
import { SAGE_CSS, SAGE_RANGE, SAGE_SECTOR_COUNT, SAGE_STARS, type SageCss, type SageStar } from "@/data/sage-plane";
import { FACTION_TONE } from "@/data/systems";

const KIND_COLOR = ["#e7e4dc", "#e15b4a", "#e6c15a", "#7eb6ff", "#ff8a4a"];

type Pick = { kind: "star"; star: SageStar } | { kind: "css"; css: SageCss };

type Cam = { x: number; y: number; k: number };

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function SagePlane({
  focus,
  onAim,
  onOpen,
}: {
  focus: "ONI" | "MUD" | "Ustur" | null;
  onAim: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Cam>({ x: 0, y: 0, k: 4 });
  const drag = useRef<{ px: number; py: number; cx: number; cy: number; moved: boolean } | null>(null);
  const picked = useRef<Pick | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const fitted = useRef(false);
  const [card, setCard] = useState<Pick | null>(null);

  function sizeOf() {
    const wrap = wrapRef.current;
    return { w: wrap?.clientWidth || 1, h: wrap?.clientHeight || 1 };
  }

  function toScreen(x: number, y: number, w: number, h: number) {
    const c = cam.current;
    return { sx: (x - c.x) * c.k + w / 2, sy: (c.y - y) * c.k + h / 2 };
  }

  function toWorld(sx: number, sy: number, w: number, h: number) {
    const c = cam.current;
    return { x: (sx - w / 2) / c.k + c.x, y: c.y - (sy - h / 2) / c.k };
  }

  drawRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = sizeOf();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#070b12";
    ctx.fillRect(0, 0, w, h);

    const { min, max } = SAGE_RANGE;
    const k = cam.current.k;
    if (k >= 7) {
      const a = toWorld(0, 0, w, h);
      const b = toWorld(w, h, w, h);
      const x0 = Math.max(min, Math.floor(Math.min(a.x, b.x)) - 1);
      const x1 = Math.min(max, Math.ceil(Math.max(a.x, b.x)) + 1);
      const y0 = Math.max(min, Math.floor(Math.min(a.y, b.y)) - 1);
      const y1 = Math.min(max, Math.ceil(Math.max(a.y, b.y)) + 1);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (((x + y) & 1) === 0) continue;
          const p = toScreen(x - 0.5, y + 0.5, w, h);
          ctx.fillRect(p.sx, p.sy, k, k);
        }
      }
    }

    ctx.strokeStyle = "rgba(180, 190, 210, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = min; g <= max; g += 10) {
      const top = toScreen(g, max, w, h);
      const bot = toScreen(g, min, w, h);
      ctx.moveTo(top.sx, top.sy);
      ctx.lineTo(bot.sx, bot.sy);
      const left = toScreen(min, g, w, h);
      const right = toScreen(max, g, w, h);
      ctx.moveTo(left.sx, left.sy);
      ctx.lineTo(right.sx, right.sy);
    }
    ctx.stroke();

    const origin = toScreen(0, 0, w, h);
    ctx.strokeStyle = "rgba(196, 163, 90, 0.35)";
    ctx.beginPath();
    ctx.moveTo(origin.sx - 8, origin.sy);
    ctx.lineTo(origin.sx + 8, origin.sy);
    ctx.moveTo(origin.sx, origin.sy - 8);
    ctx.lineTo(origin.sx, origin.sy + 8);
    ctx.stroke();

    const frameA = toScreen(min - 0.5, max + 0.5, w, h);
    const frameB = toScreen(max + 0.5, min - 0.5, w, h);
    ctx.strokeStyle = "rgba(196, 163, 90, 0.55)";
    ctx.strokeRect(frameA.sx, frameA.sy, frameB.sx - frameA.sx, frameB.sy - frameA.sy);

    const active = picked.current;
    for (const star of SAGE_STARS) {
      const p = toScreen(star.x, star.y, w, h);
      const r = Math.max(2.5, Math.min(8, (star.size / 5000) * Math.max(1, k / 8)));
      ctx.beginPath();
      ctx.fillStyle = KIND_COLOR[star.kind] ?? "#fff";
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();
      if (active?.kind === "star" && active.star.x === star.x && active.star.y === star.y) {
        ctx.strokeStyle = "#f4efe4";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const css of SAGE_CSS) {
      const p = toScreen(css.x, css.y, w, h);
      const tone = FACTION_TONE[css.faction];
      hexPath(ctx, p.sx, p.sy, 11);
      ctx.fillStyle = tone;
      ctx.fill();
      ctx.lineWidth = active?.kind === "css" && active.css.id === css.id ? 2 : 1;
      ctx.strokeStyle = "#f4efe4";
      ctx.stroke();
      ctx.font = "600 13px Rajdhani, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = tone;
      ctx.fillText(css.faction, p.sx + 16, p.sy);
    }
  };

  function fit(next: "ONI" | "MUD" | "Ustur" | null) {
    const { w, h } = sizeOf();
    if (w < 20 || h < 20) return;
    fitted.current = true;
    const span = SAGE_RANGE.max - SAGE_RANGE.min + 6;
    if (next) {
      const css = SAGE_CSS.find((row) => row.faction === next);
      if (css) {
        cam.current = { x: css.x, y: css.y, k: Math.max(8, Math.min(w, h) / 36) };
        drawRef.current();
        return;
      }
    }
    cam.current = { x: 0, y: 0, k: Math.max(2, Math.min(w, h) / span) };
    drawRef.current();
  }

  useEffect(() => {
    fit(focus);
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      if (!fitted.current) fit(focus);
      else drawRef.current();
    });
    ro.observe(wrap);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const { w, h } = sizeOf();
      const before = toWorld(sx, sy, w, h);
      const factor = Math.exp(-event.deltaY * 0.0011);
      cam.current.k = Math.min(42, Math.max(1.6, cam.current.k * factor));
      const after = toWorld(sx, sy, w, h);
      cam.current.x += before.x - after.x;
      cam.current.y += before.y - after.y;
      drawRef.current();
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      wrap.removeEventListener("wheel", onWheel);
    };
    // Fit once for this wallet focus. Later pans stay put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  function pickAt(sx: number, sy: number): Pick | null {
    const { w, h } = sizeOf();
    for (const css of SAGE_CSS) {
      const p = toScreen(css.x, css.y, w, h);
      if (Math.hypot(sx - p.sx, sy - p.sy) <= 16) return { kind: "css", css };
    }
    let best: { star: SageStar; d: number } | null = null;
    for (const star of SAGE_STARS) {
      const p = toScreen(star.x, star.y, w, h);
      const d = Math.hypot(sx - p.sx, sy - p.sy);
      if (d <= 12 && (!best || d < best.d)) best = { star, d };
    }
    return best ? { kind: "star", star: best.star } : null;
  }

  return (
    <div ref={wrapRef} className="absolute inset-0 bg-[#070b12]">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        onPointerDown={(event) => {
          drag.current = {
            px: event.clientX,
            py: event.clientY,
            cx: cam.current.x,
            cy: cam.current.y,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const held = drag.current;
          if (!held) return;
          const dx = event.clientX - held.px;
          const dy = event.clientY - held.py;
          if (Math.hypot(dx, dy) > 4) held.moved = true;
          cam.current.x = held.cx - dx / cam.current.k;
          cam.current.y = held.cy + dy / cam.current.k;
          drawRef.current();
        }}
        onPointerUp={(event) => {
          const held = drag.current;
          drag.current = null;
          if (!held || held.moved) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const hit = pickAt(event.clientX - rect.left, event.clientY - rect.top);
          picked.current = hit;
          setCard(hit);
          drawRef.current();
          if (hit?.kind === "css") onAim(hit.css.id);
        }}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const hit = pickAt(event.clientX - rect.left, event.clientY - rect.top);
          if (hit?.kind === "css") onOpen(hit.css.id);
        }}
      />
      <div className="pointer-events-none absolute bottom-24 left-3 z-20 max-w-[18rem] md:bottom-4">
        <p className="font-display text-[10px] tracking-[0.18em] text-brass uppercase">SAGE · плоскость</p>
        <p className="text-sm text-muted">
          {SAGE_STARS.length} звезды, {SAGE_SECTOR_COUNT} секторов в цепи. Сетка −50…50. Имена систем не выдуманы.
        </p>
        {card ? (
          <div className="pointer-events-auto mt-2 rounded-lg border border-line bg-surface/95 p-2">
            {card.kind === "css" ? (
              <>
                <p className="font-display text-sm" style={{ color: FACTION_TONE[card.css.faction] }}>
                  {card.css.name}
                </p>
                <p className="font-mono text-xs text-muted">
                  {card.css.x}, {card.css.y}
                </p>
                <button
                  type="button"
                  onClick={() => onOpen(card.css.id)}
                  className="mt-2 h-11 w-full rounded-lg border border-line font-display text-sm"
                >
                  3D · CSS
                </button>
              </>
            ) : (
              <>
                <p className="font-display text-sm text-fg">{card.star.name}</p>
                <p className="font-mono text-xs text-muted">
                  {card.star.x}, {card.star.y}
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
