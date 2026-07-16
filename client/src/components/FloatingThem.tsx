import { useState, useEffect, useRef } from "react";

interface StickerState {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
}

// Phase timeline:
//  title     → sitting over the title word, snapped in place
//  pre_peel  → gently tilting as the chosen edge starts to lift (0.82s)
//  peel_off  → flies off screen in the peel direction (0.88s)
//  offscreen → instantly teleported to next position, off-screen on opposite side (no transition)
//  entering  → slides from off-screen into the stuck position with a soft bounce (0.72s)
//  stuck     → resting for 5–8s, then the cycle restarts
type Phase = "title" | "pre_peel" | "peel_off" | "offscreen" | "entering" | "stuck";

const rAF2 = () =>
  new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function pickRandom(): StickerState {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isSafe = (x: number, y: number) => {
    if (y < 155) return false;
    if (x > vw * 0.08 && x < vw * 0.92) return false;
    return true;
  };
  let x = 0, y = 0, attempts = 0;
  while (attempts < 40) {
    const zone = Math.floor(Math.random() * 3);
    if (zone === 0) {
      x = Math.random() * Math.max(vw * 0.1, 36) + 4;
      y = 170 + Math.random() * (vh - 180);
    } else if (zone === 1) {
      x = vw * 0.88 + Math.random() * Math.max(vw * 0.1, 36);
      y = 170 + Math.random() * (vh - 180);
    } else {
      x = Math.random() * (vw - 60) + 10;
      y = vh * 0.83 + Math.random() * (vh * 0.14);
    }
    if (isSafe(x, y)) break;
    attempts++;
  }
  return {
    x, y,
    rotate: Math.random() * 360 - 180,
    scaleX: Math.random() < 0.35 ? -1 : 1,
    scaleY: Math.random() < 0.25 ? -1 : 1,
  };
}

interface Props {
  titleRef?: React.RefObject<HTMLSpanElement | null>;
}

export function FloatingThem({ titleRef }: Props) {
  const [sticker, setSticker] = useState<StickerState>({
    x: -999, y: -999, rotate: 12, scaleX: 1, scaleY: 1,
  });
  const [phase, setPhase] = useState<Phase>("offscreen");
  const cancelRef = useRef(false);

  // Peel direction — updated before every pre_peel phase
  const peelRef = useRef({ tilt: 15, dx: 1, dy: 0 });

  function choosePeel() {
    const θ = Math.random() * 360;
    const rad = (θ * Math.PI) / 180;
    const tiltMag = 18 + Math.random() * 18;
    const tiltSign = Math.cos(rad) >= 0 ? 1 : -1;
    peelRef.current = {
      tilt: tiltSign * tiltMag,
      dx: Math.cos(rad),
      dy: Math.sin(rad),
    };
  }

  useEffect(() => {
    cancelRef.current = false;

    const run = async () => {
      // Snap onto the title word
      await wait(200);
      const el = titleRef?.current ?? null;
      let tx = window.innerWidth / 2 - 28, ty = 22;
      if (el) {
        const r = el.getBoundingClientRect();
        tx = r.left; ty = r.top;
      }
      setSticker({ x: tx, y: ty, rotate: 12, scaleX: 1, scaleY: 1 });
      setPhase("title");

      await wait(1500);
      if (cancelRef.current) return;

      // Initial peel off the title
      choosePeel();
      setPhase("pre_peel");
      await wait(820);
      if (cancelRef.current) return;

      setPhase("peel_off");
      await wait(880);
      if (cancelRef.current) return;

      // Wander loop
      while (!cancelRef.current) {
        // Teleport to new position, arriving from the opposite of the peel direction
        setSticker(pickRandom());
        setPhase("offscreen");

        await rAF2();
        if (cancelRef.current) break;

        // Slide in and SLAP down with bounce
        setPhase("entering");
        await wait(720);
        if (cancelRef.current) break;

        setPhase("stuck");
        await wait(5000 + Math.random() * 3000);
        if (cancelRef.current) break;

        // Peel off this spot
        choosePeel();
        setPhase("pre_peel");
        await wait(820);
        if (cancelRef.current) break;

        setPhase("peel_off");
        await wait(880);
        if (cancelRef.current) break;
      }
    };

    run();
    return () => { cancelRef.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build transform per phase
  const { tilt, dx, dy } = peelRef.current;
  const OX = dx * 140; // vw — large enough to leave any screen
  const OY = dy * 140; // vh

  let transform: string;
  switch (phase) {
    case "title":
      transform = "rotate(12deg)";
      break;
    case "pre_peel":
      transform = `rotate(${tilt}deg) scale(0.97, 0.94)`;
      break;
    case "peel_off":
      transform = `rotate(${tilt * 2}deg) translate(${OX}vw, ${OY}vh)`;
      break;
    case "offscreen":
      // Placed at new (x,y) but pushed off-screen on the OPPOSITE side
      transform = `translate(${-OX}vw, ${-OY}vh) rotate(${sticker.rotate}deg) scaleX(${sticker.scaleX}) scaleY(${sticker.scaleY})`;
      break;
    case "entering":
    case "stuck":
      transform = `rotate(${sticker.rotate}deg) scaleX(${sticker.scaleX}) scaleY(${sticker.scaleY})`;
      break;
    default:
      transform = "none";
  }

  // Build transition per phase
  let transition: string;
  switch (phase) {
    case "title":
    case "offscreen":
    case "stuck":
      transition = "none";
      break;
    case "pre_peel":
      transition = "transform 0.82s ease-in-out";
      break;
    case "peel_off":
      transition = "transform 0.88s ease-in";
      break;
    case "entering":
      // The SLAP — overshoots and bounces into place
      transition = "transform 0.72s cubic-bezier(0.34, 1.56, 0.64, 1)";
      break;
    default:
      transition = "none";
  }

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
        fontSize: "24px",
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
