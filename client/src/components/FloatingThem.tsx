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
  | "title"
  | "peeling"
  | "offscreen"
  | "entering"
  | "stuck"
  | "exiting";

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

// Multi-phase peel keyframes:
//  Phase 1 (0–17%):  T edge curls — sticker tilts from the T side and rolls toward HEM
//  Phase 2 (17–31%): HEM pops up, falls heavy, sticks back down
//  Phase 3 (31–50%): Full sweep left-to-right along all four edges
//  Phase 4 (50–60%): Quick pop, lands and sticks
//  Phase 5 (60–77%): MEHT reverse — M side lifts, rolls back the other way toward T
//  Phase 6 (77–86%): Pop, lands and sticks again
//  Phase 7 (86–98%): Diagonal rip — top corner through to kitty-corner of the M
//  Phase 8 (98–100%): Final peel — flies straight up and away
const PEEL_KEYFRAMES = `
@keyframes complexPeel {
  0%   { transform: rotate(12deg) translate(0px,   0px);   }

  /* Phase 1: T edge curls/rolls rightward toward HEM */
  5%   { transform: rotate(18deg) translate(10px,  -10px); }
  11%  { transform: rotate(30deg) translate(26px,  -20px); }
  17%  { transform: rotate(13deg) translate(7px,   -3px);  }

  /* Phase 2: HEM pops up sharply, drops, sticks */
  21%  { transform: rotate(6deg)  translate(3px,   -36px); }
  27%  { transform: rotate(24deg) translate(14px,   20px); }
  31%  { transform: rotate(12deg) translate(2px,    1px);  }

  /* Phase 3: sweeps left-to-right across all four edges */
  37%  { transform: rotate(-14deg) translate(-22px, -12px); }
  44%  { transform: rotate(26deg)  translate(36px,  -18px); }
  50%  { transform: rotate(12deg)  translate(4px,    0px);  }

  /* Phase 4: quick pop, lands, sticks */
  54%  { transform: rotate(3deg)  translate(2px,   -30px); }
  58%  { transform: rotate(16deg) translate(6px,    5px);  }
  60%  { transform: rotate(12deg) translate(2px,    0px);  }

  /* Phase 5: MEHT reverse — M side peels, rolls back toward T */
  65%  { transform: rotate(34deg)  translate(30px,  -16px); }
  73%  { transform: rotate(-20deg) translate(-26px, -24px); }
  77%  { transform: rotate(8deg)   translate(-2px,   0px);  }

  /* Phase 6: pop, lands and sticks */
  81%  { transform: rotate(0deg)  translate(0px,  -32px); }
  84%  { transform: rotate(11deg) translate(4px,   4px);  }
  86%  { transform: rotate(12deg) translate(1px,   0px);  }

  /* Phase 7: diagonal rip — top corner sweeps to kitty-corner of M */
  90%  { transform: rotate(-40deg) translate(-20px, -26px); }
  96%  { transform: rotate(-80deg) translate(26px,   36px); }
  98%  { transform: rotate(-55deg) translate(10px,   8px);  }

  /* Phase 8: breaks free — flies straight up and out */
  100% { transform: rotate(-200deg) translateY(-170vh); }
}
`;

export function FloatingThem({ titleRef }: Props) {
  const [sticker, setSticker] = useState<StickerState>({ x: -999, y: -999, rotate: 12, scaleX: 1, scaleY: 1, size: 24 });
  const [phase, setPhase] = useState<Phase>("offscreen");
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    const run = async () => {
      await wait(200);
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
      setPhase("title");

      // Sit on the title for 1.5s
      await wait(1500);
      if (cancelRef.current) return;

      // Trigger the complex multi-phase peel (4s total)
      setPhase("peeling");
      await wait(4100);
      if (cancelRef.current) return;

      // Wander forever
      while (!cancelRef.current) {
        setSticker(pickRandom());
        setPhase("offscreen");

        await rAF2();
        if (cancelRef.current) break;

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

  const isPeeling = phase === "peeling";
  const offscreen = phase === "offscreen" || phase === "exiting";

  const transform = isPeeling
    ? "rotate(12deg) translate(0px, 0px)"
    : [
        offscreen ? "translateY(-140vh)" : "translateY(0px)",
        `rotate(${sticker.rotate}deg)`,
        `scaleX(${sticker.scaleX}) scaleY(${sticker.scaleY})`,
      ].join(" ");

  const animation = isPeeling ? "complexPeel 4s cubic-bezier(0.4, 0, 0.6, 1) forwards" : "none";

  const transition: string = isPeeling ? "none" : (() => {
    switch (phase) {
      case "title":     return "none";
      case "offscreen": return "none";
      case "entering":  return "transform 0.62s cubic-bezier(0.34, 1.56, 0.64, 1)";
      case "stuck":     return "none";
      case "exiting":   return "transform 0.46s cubic-bezier(0.55, 0, 1, 0.45)";
      default:          return "none";
    }
  })();

  return (
    <>
      <style>{PEEL_KEYFRAMES}</style>
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
          animation,
          userSelect: "none",
          willChange: "transform",
          whiteSpace: "nowrap",
        }}
      >
        Them
      </div>
    </>
  );
}
