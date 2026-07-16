import { useState, useEffect, useRef } from "react";

interface StickerState {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  size: number;
}

type Phase =
  | "title"      // sitting over the title, no transition
  | "peeling"    // slow peel upward off the title
  | "offscreen"  // off-screen, position being updated, no transition
  | "entering"   // sliding down to new spot, bounce transition
  | "stuck"      // resting, no transition
  | "exiting";   // quick peel upward, fast transition

const rAF2 = () =>
  new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function pickRandom(): StickerState {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Exclusion zones:
  //   Title strip: y < 155  (never land here again after peeling)
  //   Grid center: x 8%-92% AND y > 155
  const isSafe = (x: number, y: number) => {
    if (y < 155) return false;                          // title area
    if (x > vw * 0.08 && x < vw * 0.92) return false; // grid center
    return true;
  };

  let x = 0, y = 0, attempts = 0;
  while (attempts < 40) {
    const zone = Math.floor(Math.random() * 3);
    if (zone === 0) {
      // left gutter
      x = Math.random() * Math.max(vw * 0.1, 36) + 4;
      y = 170 + Math.random() * (vh - 180);
    } else if (zone === 1) {
      // right gutter
      x = vw * 0.88 + Math.random() * Math.max(vw * 0.1, 36);
      y = 170 + Math.random() * (vh - 180);
    } else {
      // bottom strip
      x = Math.random() * (vw - 60) + 10;
      y = vh * 0.83 + Math.random() * (vh * 0.14);
    }
    if (isSafe(x, y)) break;
    attempts++;
  }

  return {
    x,
    y,
    rotate: Math.random() * 360 - 180,
    scaleX: Math.random() < 0.35 ? -1 : 1,
    scaleY: Math.random() < 0.25 ? -1 : 1,
    size: 20 + Math.floor(Math.random() * 10),
  };
}

interface Props {
  titleRef?: React.RefObject<HTMLSpanElement | null>;
}

export function FloatingThem({ titleRef }: Props) {
  const [sticker, setSticker] = useState<StickerState>({ x: -999, y: -999, rotate: 12, scaleX: 1, scaleY: 1, size: 24 });
  const [phase, setPhase] = useState<Phase>("offscreen");
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    const run = async () => {
      // ── Step 1: Measure title "Them" and snap FloatingThem on top of it ──
      await wait(200); // let layout paint
      const el = titleRef?.current ?? null;
      let tx = window.innerWidth / 2 - 28;
      let ty = 22;
      let tSize = 24;
      if (el) {
        const r = el.getBoundingClientRect();
        tx = r.left;
        ty = r.top;
        tSize = Math.round(r.height * 0.9) || 24;
      }

      setSticker({ x: tx, y: ty, rotate: 12, scaleX: 1, scaleY: 1, size: tSize });
      setPhase("title");   // snap onto title instantly — no transition fires

      // ── Step 2: Sit in title for 1.5s ──
      await wait(1500);
      if (cancelRef.current) return;

      // ── Step 3: Slow peel off the title ──
      setPhase("peeling"); // uses 1.5s ease-in transition → goes off-screen upward

      await wait(1550);
      if (cancelRef.current) return;

      // ── Step 4: Wander forever ──
      while (!cancelRef.current) {
        // Update position while off-screen (no transition active in "offscreen")
        setSticker(pickRandom());
        setPhase("offscreen");

        // Give browser 2 frames to commit the new left/top + offscreen transform
        await rAF2();
        if (cancelRef.current) break;

        // Now animate slide-in
        setPhase("entering");
        await wait(680);
        if (cancelRef.current) break;

        setPhase("stuck");
        await wait(3000);
        if (cancelRef.current) break;

        setPhase("exiting");
        await wait(500);
        if (cancelRef.current) break;
      }
    };

    run();
    return () => { cancelRef.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const offscreen = phase === "offscreen" || phase === "peeling" || phase === "exiting";
  const transform = [
    offscreen ? "translateY(-140vh)" : "translateY(0px)",
    `rotate(${sticker.rotate}deg)`,
    `scaleX(${sticker.scaleX}) scaleY(${sticker.scaleY})`,
  ].join(" ");

  const transition: string = (() => {
    switch (phase) {
      case "title":    return "none";
      case "peeling":  return "transform 1.5s ease-in";
      case "offscreen":return "none";
      case "entering": return "transform 0.62s cubic-bezier(0.34, 1.56, 0.64, 1)";
      case "stuck":    return "none";
      case "exiting":  return "transform 0.46s cubic-bezier(0.55, 0, 1, 0.45)";
    }
  })();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: sticker.x,
        top: sticker.y,
        zIndex: 9500,
        pointerEvents: "none",
        fontFamily: "Pacifico, cursive",
        fontSize: `${sticker.size}px`,
        color: "#f472b6",
        textShadow: "0 2px 6px rgba(244,114,182,0.8), 0 0 18px rgba(244,114,182,0.4)",
        transform,
        transition,
        userSelect: "none",
        willChange: "transform",
        whiteSpace: "nowrap",
      }}
    >
      Them
    </div>
  );
}
