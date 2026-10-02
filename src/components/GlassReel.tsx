import { useEffect, useRef, useState } from "react";

/* ---------- Editable configuration (also live-editable in the panel) ---------- */
export const ITEMS = [
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
];
export const LEAD_WORD = "Making";

export const DEFAULTS = {
  stiffness: 140, // spring pull toward the target word
  damping: 1, // 1 = no overshoot, <1 = bouncy
  friction: 0.94, // momentum kept per 60fps frame after a flick
  wheelSensitivity: 1,
  dragSensitivity: 1,
  motionBlur: 1, // directional streak strength
  depthBlur: 6, // px blur at the edge of the range
  visibleRange: 5,
  minScale: 0.6,
  activeScale: 1.18,
  spacing: 1,
  glow: 1,
  autoplay: 1,
  idleDelay: 3.5, // seconds
  idleInterval: 2, // seconds per item while continuously auto-scrolling
  lightSpeed: 1,
};
export type ReelConfig = typeof DEFAULTS;

const CONTROLS: { key: keyof ReelConfig; label: string; min: number; max: number; step: number }[] = [
  { key: "stiffness", label: "Spring stiffness", min: 20, max: 400, step: 1 },
  { key: "damping", label: "Damping", min: 0.3, max: 2, step: 0.01 },
  { key: "friction", label: "Momentum", min: 0.8, max: 0.99, step: 0.001 },
  { key: "wheelSensitivity", label: "Wheel sensitivity", min: 0.2, max: 3, step: 0.05 },
  { key: "dragSensitivity", label: "Drag sensitivity", min: 0.2, max: 3, step: 0.05 },
  { key: "motionBlur", label: "Motion blur", min: 0, max: 3, step: 0.05 },
  { key: "depthBlur", label: "Depth blur", min: 0, max: 16, step: 0.1 },
  { key: "visibleRange", label: "Visible range", min: 2, max: 6, step: 0.1 },
  { key: "minScale", label: "Distant scale", min: 0.3, max: 1, step: 0.01 },
  { key: "activeScale", label: "Active scale", min: 1, max: 1.6, step: 0.01 },
  { key: "spacing", label: "Line spacing", min: 0.7, max: 1.6, step: 0.01 },
  { key: "glow", label: "Glow", min: 0, max: 2, step: 0.05 },
  { key: "autoplay", label: "Autoplay (0/1)", min: 0, max: 1, step: 1 },
  { key: "idleDelay", label: "Idle delay (s)", min: 1, max: 15, step: 0.5 },
  { key: "idleInterval", label: "Auto speed (s/item)", min: 0.6, max: 6, step: 0.1 },
  { key: "lightSpeed", label: "Light speed", min: 0, max: 3, step: 0.05 },
];

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function GlassReel() {
  const N = ITEMS.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cfgRef = useRef<ReelConfig>({ ...DEFAULTS });
  const [cfg, setCfg] = useState<ReelConfig>(DEFAULTS);
  const [panel, setPanel] = useState(false);
  const [panePos, setPanePos] = useState({ x: 0, y: 0 });
  const paneDrag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const update = (k: keyof ReelConfig, v: number) => {
    cfgRef.current = { ...cfgRef.current, [k]: v };
    setCfg(cfgRef.current);
  };

  useEffect(() => {
    stageRef.current?.style.setProperty("--light-speed", String(cfg.lightSpeed || 0.0001));
    stageRef.current?.style.setProperty("--glow", String(cfg.glow));
  }, [cfg.lightSpeed, cfg.glow]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let pos = 4;
    let vel = 0; // items per second
    let target: number | null = 4;
    let dragging = false;
    let lastY = 0;
    let lastMoveT = 0;
    let lastInteract = performance.now();
    let lastT = performance.now();
    let raf = 0;
    let rowH = 64;
    let previousMotionEnergy = "";
    const prev = ITEMS.map(() => ({ t: "", o: "", f: "", s: "", a: "" }));

    const measure = () => {
      rowH = parseFloat(getComputedStyle(stage).getPropertyValue("--row-h")) || 64;
    };
    measure();
    window.addEventListener("resize", measure);

    const render = () => {
      const C = cfgRef.current;
      const h = rowH * C.spacing;
      const v = Math.abs(vel);
      const streak = Math.min(v * 0.9, 14) * C.motionBlur; // px
      const motionEnergy = Math.min(v / 4.5, 1);
      const motionEnergyValue = motionEnergy.toFixed(3);
      if (previousMotionEnergy !== motionEnergyValue) {
        previousMotionEnergy = motionEnergyValue;
        stage.style.setProperty("--motion-energy", motionEnergyValue);
        stage.style.setProperty("--active-glow-radius", `${(22 + motionEnergy * 34).toFixed(1)}px`);
      }
      const dir = Math.sign(vel);
      for (let i = 0; i < N; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const d = mod(i - pos + N / 2, N) - N / 2;
        const a = Math.abs(d);
        const t = Math.min(a / C.visibleRange, 1);
        const e = t * t * (3 - 2 * t);
        const scale = a < 1 ? C.activeScale - (C.activeScale - 1) * a : 1 - (1 - C.minScale) * e;
        const opacity = a < 1 ? 1 - 0.3 * a : Math.max(0, 0.7 * (1 - e));
        const y = Math.sign(d) * (a < 1 ? a : 1 + (a - 1) * (0.94 - 0.14 * e)) * h;
        const blur = a < 0.5 ? 0 : C.depthBlur * e;

        const tr = `translate3d(0,${y.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
        const op = opacity.toFixed(3);
        const fb = Math.round(blur * 4) / 4;
        const f = fb > 0 ? `blur(${fb}px)` : "none";
        // directional motion blur: stacked translucent copies along velocity
        const shadows: string[] = [];
        if (motionEnergy > 0.015 && opacity > 0.02) {
          const glowRadius = (7 + motionEnergy * 25) * C.glow;
          shadows.push(`0 0 ${glowRadius.toFixed(1)}px var(--reel-motion-glow)`);
        }
        if (streak > 0.4 && opacity > 0.02) {
          const s = streak.toFixed(1);
          const s2 = (streak * 0.5).toFixed(1);
          shadows.push(
            `0 ${dir * -s2}px ${s2}px var(--reel-motion-streak-strong)`,
            `0 ${dir * -s}px ${s}px var(--reel-motion-streak-soft)`,
            `0 ${dir * +s2}px ${s2}px var(--reel-motion-streak-medium)`,
          );
        }
        const sh = shadows.length > 0 ? shadows.join(", ") : "none";
        const act = a < 0.5 ? "true" : "false";
        const p = prev[i]!;
        if (p.t !== tr) el.style.transform = p.t = tr;
        if (p.o !== op) el.style.opacity = p.o = op;
        if (p.f !== f) el.style.filter = p.f = f;
        if (p.s !== sh) el.style.textShadow = p.s = sh;
        if (p.a !== act) el.dataset["active"] = p.a = act;
      }
    };

    const step = (dt: number, now: number) => {
      const C = cfgRef.current;
      if (dragging) return;
      const autoScrolling = !reduce && C.autoplay >= 1 && now - lastInteract > C.idleDelay * 1000;
      if (autoScrolling) {
        target = null;
        const cruiseVelocity = 1 / C.idleInterval;
        const acceleration = 1 - Math.exp(-dt * 2.8);
        vel += (cruiseVelocity - vel) * acceleration;
        pos += vel * dt;
        return;
      }
      if (target !== null) {
        const k = C.stiffness;
        const c = 2 * Math.sqrt(k) * C.damping;
        const acc = k * (target - pos) - c * vel;
        vel += acc * dt;
        pos += vel * dt;
        if (Math.abs(target - pos) < 0.0003 && Math.abs(vel) < 0.003) {
          pos = target;
          vel = 0;
        }
      } else {
        vel *= Math.pow(C.friction, dt * 60);
        pos += vel * dt;
        if (Math.abs(vel) < 1.5) target = Math.round(pos + vel * 0.08);
      }
    };

    const tick = (now: number) => {
      let dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      // fixed sub-steps keep the spring stable at any refresh rate (60/90/120/144Hz)
      const sub = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / sub;
      for (let s = 0; s < sub; s++) step(h, now);
      render();
      raf = requestAnimationFrame(tick);
    };

    const touch = () => (lastInteract = performance.now());

    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest(".reel-panel")) return;
      e.preventDefault();
      touch();
      target = null;
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      vel += (px / rowH) * 2.2 * cfgRef.current.wheelSensitivity;
      vel = Math.max(-40, Math.min(40, vel));
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(".reel-panel, .reel-panel-toggle")) return;
      dragging = true;
      lastY = e.clientY;
      lastMoveT = performance.now();
      vel = 0;
      target = null;
      touch();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max((now - lastMoveT) / 1000, 0.001);
      const dy = ((lastY - e.clientY) / rowH) * cfgRef.current.dragSensitivity;
      lastY = e.clientY;
      lastMoveT = now;
      pos += dy;
      vel = vel * 0.6 + (dy / dt) * 0.4;
      touch();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (performance.now() - lastMoveT > 80) vel = 0;
      if (Math.abs(vel) < 1.5) target = Math.round(pos);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        touch();
        target = Math.round(target ?? pos) + (e.key === "ArrowDown" ? 1 : -1);
      }
    };
    itemRefs.current.forEach((el, i) => {
      if (el)
        el.onclick = () => {
          touch();
          const d = mod(i - pos + N / 2, N) - N / 2;
          target = Math.round(pos + d);
        };
    });

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
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
          <span className="glass-text glass-text--lead">{LEAD_WORD}</span>
        </div>
        <div className="reel-column">
          <div
            className="reel-focus-pane"
            aria-hidden
            style={{ transform: `translate(${panePos.x}px, ${panePos.y}px)` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              paneDrag.current = { px: e.clientX, py: e.clientY, ox: panePos.x, oy: panePos.y };
            }}
            onPointerMove={(e) => {
              const d = paneDrag.current;
              if (!d) return;
              setPanePos({ x: d.ox + e.clientX - d.px, y: d.oy + e.clientY - d.py });
            }}
            onPointerUp={() => {
              paneDrag.current = null;
            }}
          />
          {ITEMS.map((label, i) => (
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

      <button className="reel-panel-toggle" type="button" onClick={() => setPanel((p) => !p)}>
        {panel ? "Close" : "Settings"}
      </button>
      {panel && (
        <div className="reel-panel">
          {CONTROLS.map((c) => (
            <label key={c.key} className="reel-control">
              <span>
                {c.label}
                <em>{cfg[c.key]}</em>
              </span>
              <input
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={cfg[c.key]}
                onChange={(e) => update(c.key, parseFloat(e.target.value))}
              />
            </label>
          ))}
          <button
            type="button"
            className="reel-reset"
            onClick={() => {
              cfgRef.current = { ...DEFAULTS };
              setCfg(cfgRef.current);
            }}
          >
            Reset
          </button>
        </div>
      )}

      <p className="reel-hint">Scroll · Drag · Tap</p>
    </div>
  );
}
