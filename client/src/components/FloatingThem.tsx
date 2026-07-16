import { useState, useEffect, useRef } from "react";

// ── TIMING ────────────────────────────────────────────────────────────────────
const STEP_MS   = 165;   // delay between each letter starting its peel
const LETTER_MS = 400;   // each letter's rotation duration
const WAVE_DONE = (n: number) => (n - 1) * STEP_MS + LETTER_MS + 30;

// ── POSITIONS ─────────────────────────────────────────────────────────────────
interface Pos { x: number; y: number; rot: number; }

function pick(): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Three landing zones: left gutter, right gutter, bottom strip
  const r = Math.random();
  if (r < 0.35) {
    return { x: 6 + Math.random() * Math.max(vw * 0.1, 30), y: 170 + Math.random() * (vh - 240), rot: Math.random() * 60 - 30 };
  } else if (r < 0.7) {
    return { x: vw * 0.87 + Math.random() * Math.max(vw * 0.1, 30), y: 170 + Math.random() * (vh - 240), rot: Math.random() * 60 - 30 };
  } else {
    return { x: 20 + Math.random() * (vw - 120), y: vh * 0.79 + Math.random() * (vh * 0.16), rot: Math.random() * 60 - 30 };
  }
}

// ── LETTERS ───────────────────────────────────────────────────────────────────
const L = ["T", "h", "e", "m"];

interface Props { titleRef?: React.RefObject<HTMLSpanElement | null>; }

export function FloatingThem({ titleRef }: Props) {
  // Per-letter rotateX in degrees (0 = flat face-up, -90 = standing edge, -180 = flat face-down)
  const [angles, setAngles] = useState([0, 0, 0, 0]);
  const [pos,    setPos]    = useState<Pos>({ x: -300, y: -300, rot: 12 });
  const [moving, setMoving] = useState(false);
  const cancel = useRef(false);

  // ── helpers ─────────────────────────────────────────────────────────────────
  const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // Animate a wave: letters given by `order` array each rotate to `deg`
  // staggered by STEP_MS.  Resolves when the last letter finishes.
  const wave = (order: number[], deg: number) =>
    new Promise<void>(res => {
      order.forEach((idx, i) =>
        setTimeout(() =>
          setAngles(prev => { const n = [...prev]; n[idx] = deg; return n; }),
          i * STEP_MS
        )
      );
      setTimeout(res, WAVE_DONE(order.length));
    });

  // Fly word to a new screen position
  const flyTo = async (p: Pos) => {
    setMoving(true);
    setPos(p);
    setAngles([0, 0, 0, 0]);       // reset letter angles while in flight
    await wait(600);
    setMoving(false);
  };

  // ── main sequence ────────────────────────────────────────────────────────────
  useEffect(() => {
    cancel.current = false;
    const chk = () => cancel.current;

    (async () => {
      // ── SNAP ONTO TITLE ──────────────────────────────────────────────────
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
      // PHASE 1 — Peel from T rolling to M, stand on M, fall flat
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Step A: T(0) → h(1) → e(2) → m(3) each peel to -90° (standing)
      //         By the time m reaches -90° the word is "standing on its M"
      await wave([0, 1, 2, 3], -90);
      if (chk()) return;

      // Dramatic pause — word balanced upright on M
      await wait(380);
      if (chk()) return;

      // Step B: Falls flat — M side drops first (3→0), letters return to 0°
      //         (they complete the arc and land flat on the other side)
      await wave([3, 2, 1, 0], -180);
      if (chk()) return;

      // Reset angles silently (face-down → face-up) as the eye moves on
      // The word is now visually flat.  We'll reset angles in next phase.
      await wait(120);
      setAngles([0, 0, 0, 0]);   // snap to face-up (invisible transition while still)

      // ── SIT 5 seconds ────────────────────────────────────────────────────
      await wait(5000);
      if (chk()) return;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 2 — Peel from M → hits E → H → T, flies up, lands new spot
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      await wave([3, 2, 1, 0], -90);
      if (chk()) return;

      await flyTo(pick());
      if (chk()) return;

      // ── SIT 8 seconds ────────────────────────────────────────────────────
      await wait(8000);
      if (chk()) return;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ONGOING LOOP — alternating peel directions
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let turn = 0;
      while (!chk()) {
        // Peels alternate: left→right, right→left, left→right, then diagonal
        const orders: number[][] = [
          [0, 1, 2, 3],   // left edge peels over to right edge
          [3, 2, 1, 0],   // right edge peels over to left edge
          [0, 1, 2, 3],   // left again
          [1, 0, 2, 3],   // diagonal — starts from inner T side
          [3, 2, 1, 0],   // right
          [2, 3, 1, 0],   // diagonal — starts from inner M side
        ];
        const order = orders[turn % orders.length];

        // Peel to -90° (lifting off), brief pop at standing, then fly
        await wave(order, -90);
        if (chk()) break;

        await wait(200);   // brief "pop" at standing edge
        if (chk()) break;

        await flyTo(pick());
        if (chk()) break;

        turn++;
        // Sit 5–8 s before next peel
        await wait(5000 + Math.random() * 3000);
      }
    })();

    return () => { cancel.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9500,
        pointerEvents: "none",
        // Perspective makes the 3-D letter fold look real
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
            textShadow:
              "0 2px 6px rgba(244,114,182,0.85), 0 0 18px rgba(244,114,182,0.45)",
            display: "inline-block",
            // Right edge is the hinge — left side of each letter peels toward viewer
            // This creates a horizontal roll T→h→e→m, not a vertical domino flip
            transformOrigin: "100% 50%",
            transform: `rotateY(${angles[idx]}deg)`,
            transition: `transform ${LETTER_MS}ms ease-in-out`,
            // Keep the letter visible even when it swings past 90° (face-down)
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
