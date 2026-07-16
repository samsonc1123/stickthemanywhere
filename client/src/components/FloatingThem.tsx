import { useState, useEffect, useRef } from "react";

interface StickerState {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  size: number;
}

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function pickPosition(): StickerState {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Grid exclusion zone: avoid the center area where sticker boxes live
  // Roughly: x between 8%-92% AND y between 195px-bottom
  const isSafe = (x: number, y: number) => {
    const inHCenter = x > vw * 0.08 && x < vw * 0.92;
    const belowHeader = y > 195;
    return !(inHCenter && belowHeader);
  };

  let x = 0;
  let y = 0;
  let attempts = 0;

  while (attempts < 30) {
    const zone = Math.floor(Math.random() * 5);
    switch (zone) {
      case 0: // top strip — over the title / subtitle / pills
        x = Math.random() * (vw - 60) + 10;
        y = Math.random() * 190 + 8;
        break;
      case 1: // left gutter
        x = Math.random() * Math.max(vw * 0.1, 40) + 4;
        y = Math.random() * (vh - 60) + 30;
        break;
      case 2: // right gutter
        x = vw * 0.88 + Math.random() * (vw * 0.1);
        y = Math.random() * (vh - 60) + 30;
        break;
      case 3: // bottom strip
        x = Math.random() * (vw - 60) + 10;
        y = vh * 0.84 + Math.random() * (vh * 0.14);
        break;
      case 4: // random anywhere — keep if safe
        x = Math.random() * (vw - 60) + 10;
        y = Math.random() * (vh - 60) + 10;
        break;
    }
    if (isSafe(x, y)) break;
    attempts++;
  }

  // Random rotation: full 360, often diagonal/inverted
  const rotate = Math.random() * 360 - 180;
  // Occasional mirror flip
  const scaleX = Math.random() < 0.35 ? -1 : 1;
  const scaleY = Math.random() < 0.25 ? -1 : 1;
  // Slight size variation so it feels hand-applied
  const size = 20 + Math.floor(Math.random() * 10);

  return { x, y, rotate, scaleX, scaleY, size };
}

export function FloatingThem() {
  const [sticker, setSticker] = useState<StickerState | null>(null);
  const [phase, setPhase] = useState<"hidden" | "entering" | "stuck" | "exiting">("hidden");
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    const run = async () => {
      await delay(1800); // initial pause before first appearance

      while (!cancelRef.current) {
        // Pick new spot while hidden
        setSticker(pickPosition());
        setPhase("entering");

        await delay(650); // slide-in animation completes
        if (cancelRef.current) break;

        setPhase("stuck");

        await delay(3000); // dwell time stuck to canvas
        if (cancelRef.current) break;

        setPhase("exiting");

        await delay(480); // slide-out animation completes
        if (cancelRef.current) break;

        setPhase("hidden");

        await delay(120); // tiny gap before picking next spot
      }
    };

    run();
    return () => { cancelRef.current = true; };
  }, []);

  if (!sticker || phase === "hidden") return null;

  const visible = phase === "entering" || phase === "stuck";

  const transform = [
    visible ? "translateY(0px)" : "translateY(-130vh)",
    `rotate(${sticker.rotate}deg)`,
    `scaleX(${sticker.scaleX}) scaleY(${sticker.scaleY})`,
  ].join(" ");

  const transition = visible
    ? "transform 0.60s cubic-bezier(0.34, 1.56, 0.64, 1)" // bouncy stick
    : "transform 0.45s cubic-bezier(0.55, 0, 1, 0.45)";    // snappy peel-off

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
        textShadow:
          "0 2px 6px rgba(244,114,182,0.8), 0 0 18px rgba(244,114,182,0.4)",
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
