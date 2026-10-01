import { useEffect, useRef } from "react";

/* ---------- Easily tweakable configuration ---------- */
export const REEL_CONFIG = {
  items: [
    "RPG",
    "Co-op Games",
    "Third-Person Shooters",
    "Action Adventure",
    "Strategy",
    "Open World",
    "Racing",
    "Sports",
    "Fighting",
    "Board Games",
  ],
  leadWord: "Making",
  visibleRange: 5, // items above/below focus that stay visible
  maxBlur: 7, // px blur at the edge of the range
  minScale: 0.62, // scale at the edge of the range
  activeScale: 1.18,
  springStiffness: 0.085, // settle spring
  friction: 0.9, // momentum decay per frame
  idleDelay: 4000, // ms before auto-advance
  idleInterval: 2200, // ms between auto steps
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function GlassReel() {
  const { items } = REEL_CONFIG;
  const N = items.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const stage = stageRef.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const C = REEL_CONFIG;

    let pos = 4; // continuous index in focus
    let vel = 0;
    let target: number | null = Math.round(pos);
    let dragging = false;
    let lastY = 0;
    let lastInteract = performance.now();
    let lastAuto = 0;
    let raf = 0;

    const rowH = () => parseFloat(getComputedStyle(stage).getPropertyValue("--row-h")) || 64;

    const render = () => {
      const h = rowH();
      const speed = Math.min(Math.abs(vel) * 6, 1);
      for (let i = 0; i < N; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        let d = mod(i - pos + N / 2, N) - N / 2; // wrapped distance
        const a = Math.abs(d);
        const t = Math.min(a / C.visibleRange, 1);
        const ease = t * t * (3 - 2 * t);
        const scale = a < 1 ? C.activeScale - (C.activeScale - 1) * a : 1 - (1 - C.minScale) * ease;
        const opacity = a < 1 ? 1 - 0.35 * a : Math.max(0, 0.65 * (1 - ease));
        const blur = (a < 0.6 ? 0 : C.maxBlur * ease) + speed * 2.5 * Math.min(a, 1.5);
        const z = -a * 120;
        // compress spacing with depth for perspective feel
        const y = Math.sign(d) * (a < 1 ? a : 1 + (a - 1) * (0.92 - 0.12 * ease)) * h;
        el.style.transform = `translate3d(0, ${y}px, ${z}px) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "none";
        el.dataset.active = a < 0.5 ? "true" : "false";
        el.style.setProperty("--focus", String(Math.max(0, 1 - a)));
      }
    };

    const tick = (now: number) => {
      if (!dragging) {
        if (target !== null) {
          const diff = target - pos;
          vel += diff * C.springStiffness;
          vel *= 0.72;
          if (Math.abs(diff) < 0.0005 && Math.abs(vel) < 0.0005) {
            pos = target;
            vel = 0;
          }
        } else {
          vel *= C.friction;
          if (Math.abs(vel) < 0.02) target = Math.round(pos + vel * 4);
        }
        pos += vel;
        if (!reduce && now - lastInteract > C.idleDelay && now - lastAuto > C.idleInterval) {
          lastAuto = now;
          target = Math.round(pos) + 1;
        }
      }
      render();
      raf = requestAnimationFrame(tick);
    };

    const touch = () => (lastInteract = performance.now());

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touch();
      target = null;
      vel += e.deltaY * 0.0009;
      vel = Math.max(-0.6, Math.min(0.6, vel));
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastY = e.clientY;
      vel = 0;
      target = null;
      touch();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dy = (lastY - e.clientY) / rowH();
      lastY = e.clientY;
      pos += dy;
      vel = dy;
      touch();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(vel) < 0.02) target = Math.round(pos);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        touch();
        target = Math.round(target ?? pos) + (e.key === "ArrowDown" ? 1 : -1);
      }
    };

    const focusOn = (i: number) => {
      touch();
      let d = mod(i - pos + N / 2, N) - N / 2;
      target = Math.round(pos + d);
    };
    itemRefs.current.forEach((el, i) => {
      if (el) el.onclick = () => focusOn(i);
    });

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [N]);

  return (
    <div ref={stageRef} className="reel-stage" aria-label="Game categories, scroll or drag to explore">
      <div className="reel-light" aria-hidden />
      <div className="reel-light reel-light--b" aria-hidden />
      <div className="reel-grain" aria-hidden />

      <div className="reel-composition">
        <div className="reel-lead">
          <span className="glass-text glass-text--lead">{REEL_CONFIG.leadWord}</span>
        </div>
        <div className="reel-column">
          <div className="reel-focus-pane" aria-hidden />
          {items.map((label, i) => (
            <button
              key={label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className="reel-item"
              type="button"
            >
              <span className="glass-text" data-text={label}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="reel-hint">Scroll · Drag · Tap</p>
    </div>
  );
}
