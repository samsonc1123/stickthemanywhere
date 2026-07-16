import { useState, useEffect, useRef, useCallback } from "react";

// ── POSITIONS ──────────────────────────────────────────────────────────────────
interface Pos { x: number; y: number; rot: number; }

function pick(): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = Math.random();
  if (r < 0.35) {
    return { x: 6  + Math.random() * Math.max(vw * 0.1, 30), y: 170 + Math.random() * (vh - 240), rot: Math.random() * 60 - 30 };
  } else if (r < 0.7) {
    return { x: vw * 0.87 + Math.random() * Math.max(vw * 0.1, 30), y: 170 + Math.random() * (vh - 240), rot: Math.random() * 60 - 30 };
  } else {
    return { x: 20 + Math.random() * (vw - 120), y: vh * 0.79 + Math.random() * (vh * 0.16), rot: Math.random() * 60 - 30 };
  }
}

// ── EASING ─────────────────────────────────────────────────────────────────────
// Slow start (corner barely lifts), builds, slows as it settles — natural curl
function ease(t: number): number {
  // cubic ease-in-out
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const L = ["T", "h", "e", "m"];

interface Props { titleRef?: React.RefObject<HTMLSpanElement | null>; }

export function FloatingThem({ titleRef }: Props) {
  // angles[i] is the rotateY for letter i — updated every rAF frame, NO css transition
  const [angles, setAngles] = useState([0, 0, 0, 0]);
  const [pos,    setPos]    = useState<Pos>({ x: -300, y: -300, rot: 12 });
  const [moving, setMoving] = useState(false);
  const cancel = useRef(false);

  const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // ── rAF-driven wave ─────────────────────────────────────────────────────────
  // Animates a rolling wave across `order` from `fromDeg` to `toDeg`.
  // `duration` is total wall-clock ms for the wave to cross ALL letters.
  // The wave position P moves 0 → order.length linearly.
  // Each letter i is active while P is in [i, i+1], eased within that window.
  const animateWave = useCallback(
    (order: number[], fromDeg: number, toDeg: number, duration: number): Promise<void> =>
      new Promise(resolve => {
        if (cancel.current) { resolve(); return; }
        const startTs = performance.now();

        const tick = (now: number) => {
          if (cancel.current) { resolve(); return; }

          const elapsed = now - startTs;
          const totalProg = Math.min(elapsed / duration, 1);
          // P sweeps from 0 to order.length
          const P = totalProg * order.length;

          setAngles(prev => {
            const next = [...prev];
            order.forEach((letterIdx, pos) => {
              // Each letter's own progress within its slice of the wave
              const t = Math.max(0, Math.min(1, P - pos));
              next[letterIdx] = fromDeg + ease(t) * (toDeg - fromDeg);
            });
            return next;
          });

          if (totalProg < 1) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(tick);
      }),
    []
  );

  // Fly word to a new position
  const flyTo = async (p: Pos) => {
    setMoving(true);
    setPos(p);
    setAngles([0, 0, 0, 0]);
    await wait(600);
    setMoving(false);
  };

  // ── main sequence ────────────────────────────────────────────────────────────
  useEffect(() => {
    cancel.current = false;
    const chk = () => cancel.current;

    (async () => {
      // Snap onto title
      await wait(350);
      if (chk()) return;
      const el = titleRef?.current;
      let tx = window.innerWidth / 2 - 32, ty = 20;
      if (el) { const r = el.getBoundingClientRect(); tx = r.left; ty = r.top; }
      setPos({ x: tx, y: ty, rot: 12 });
      setAngles([0, 0, 0, 0]);
      await wait(700);
      if (chk()) return;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 1 — Roll T→M, stand on M, fall flat
      //
      // Single rAF wave: P moves 0→4 continuously.
      // At P≈3.5, T/h/e are flat, m is still at ~90° (standing on M).
      // No discrete steps — pure gradient math.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      await animateWave([0, 1, 2, 3], 0, -180, 2400);
      if (chk()) return;

      await wait(280);
      setAngles([0, 0, 0, 0]);   // invisible reset while flat/still

      // Sit 5 seconds
      await wait(5000);
      if (chk()) return;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 2 — Roll M→T, peel off, fly to new spot
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      await animateWave([3, 2, 1, 0], 0, -90, 1400);
      if (chk()) return;

      await flyTo(pick());
      if (chk()) return;

      // Sit 8 seconds
      await wait(8000);
      if (chk()) return;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ONGOING — alternating roll directions
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const orders = [
        [0, 1, 2, 3],
        [3, 2, 1, 0],
        [0, 1, 2, 3],
        [1, 0, 2, 3],  // diagonal variant
        [3, 2, 1, 0],
        [2, 3, 1, 0],  // diagonal variant
      ];
      let turn = 0;
      while (!chk()) {
        await animateWave(orders[turn % orders.length], 0, -90, 1200);
        if (chk()) break;
        await wait(180);
        await flyTo(pick());
        if (chk()) break;
        turn++;
        await wait(5000 + Math.random() * 3000);
      }
    })();

    return () => { cancel.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9500,
        pointerEvents: "none",
        perspective: "300px",
        perspectiveOrigin: "50% 50%",
        transform: `rotate(${pos.rot}deg)`,
        transition: moving
          ? "left 0.55s cubic-bezier(0.34,1.5,0.64,1), top 0.55s cubic-bezier(0.34,1.5,0.64,1)"
          : "none",
        userSelect: "none",
        willChange: "transform, left, top",
        display: "flex",
        gap: "1px",
      }}
    >
      {L.map((letter, idx) => (
        <span
          key={idx}
          style={{
            fontFamily: "Pacifico, cursive",
            fontSize: "24px",
            color: "#f472b6",
            textShadow: "0 2px 6px rgba(244,114,182,0.85), 0 0 18px rgba(244,114,182,0.45)",
            display: "inline-block",
            // Right edge is hinge — left side peels up toward viewer (horizontal roll)
            transformOrigin: "100% 50%",
            transform: `rotateY(${angles[idx]}deg)`,
            // NO css transition — rAF drives every frame directly
            transition: "none",
            backfaceVisibility: "visible",
            WebkitBackfaceVisibility: "visible",
          }}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
