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

// Peel sequence (8 phases, big movements so each direction reads clearly):
//  P1  0–18%   T edge — tilts from T corner, rolls hard right toward HEM
//  P2 18–32%   HEM pops way up, drops heavy, sticks
//  P3 32–52%   Sweeps left-to-right across all four edges, rolls, sticks
//  P4 52–62%   Sharp pop straight up, drops, sticks
//  P5 62–78%   MEHT reverse — M side peels, rolls back left toward T
//  P6 78–87%   Pop up, drops, sticks
//  P7 87–98%   Diagonal rip — top corner tears to kitty-corner of M
//  P8 98–100%  Breaks free — full spin, launches straight up
const PEEL_CSS = `
@keyframes complexPeel {
  0%   { transform: rotate(12deg)   translate(0px,    0px);   }

  6%   { transform: rotate(35deg)   translate(60px,  -40px);  }
  12%  { transform: rotate(70deg)   translate(130px, -60px);  }
  18%  { transform: rotate(15deg)   translate(10px,  -4px);   }

  22%  { transform: rotate(5deg)    translate(4px,  -110px);  }
  28%  { transform: rotate(30deg)   translate(20px,   50px);  }
  32%  { transform: rotate(12deg)   translate(2px,    2px);   }

  38%  { transform: rotate(-30deg)  translate(-140px,-20px);  }
  46%  { transform: rotate(50deg)   translate(160px, -30px);  }
  52%  { transform: rotate(12deg)   translate(4px,    0px);   }

  56%  { transform: rotate(0deg)    translate(0px,  -120px);  }
  60%  { transform: rotate(20deg)   translate(10px,   14px);  }
  62%  { transform: rotate(12deg)   translate(2px,    0px);   }

  67%  { transform: rotate(55deg)   translate(120px, -50px);  }
  75%  { transform: rotate(-45deg)  translate(-150px,-40px);  }
  78%  { transform: rotate(8deg)    translate(-3px,   0px);   }

  82%  { transform: rotate(0deg)    translate(0px,  -100px);  }
  86%  { transform: rotate(14deg)   translate(6px,    8px);   }
  87%  { transform: rotate(12deg)   translate(1px,    0px);   }

  91%  { transform: rotate(-60deg)  translate(-80px, -90px);  }
  96%  { transform: rotate(-130deg) translate(90px,  120px);  }
  98%  { transform: rotate(-70deg)  translate(14px,   8px);   }

  100% { transform: rotate(-260deg) translateY(-200vh);       }
}
`;

export function FloatingThem({ titleRef }: Props) {
  const [sticker, setSticker] = useState<StickerState>({
    x: -999, y: -999, rotate: 12, scaleX: 1, scaleY: 1, size: 24,
  });
  const [phase, setPhase]       = useState<Phase>("offscreen");
  const [wandering, setWandering] = useState(false); // flips after peel to remount div
  const cancelRef               = useRef(false);

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

      // Sit on the title 1.5s
      await wait(1500);
      if (cancelRef.current) return;

      // Complex peel — inline transform is removed so @keyframes owns it fully
      setPhase("peeling");
      await wait(4200);
      if (cancelRef.current) return;

      // Flip the wandering flag — this remounts the div with a new key,
      // completely clearing any lingering CSS animation state from the peel.
      setWandering(true);

      // Brief pause so the remounted div paints at its off-screen transform
      // before we start sliding in.
      await wait(80);
      if (cancelRef.current) return;

      // Wander loop — smooth enter/stick/exit with staggered 5–8s stuck times
      while (!cancelRef.current) {
        setSticker(pickRandom());
        setPhase("offscreen");

        await rAF2();
        if (cancelRef.current) break;

        setPhase("entering");
        await wait(680);
        if (cancelRef.current) break;

        setPhase("stuck");
        // Staggered 5–8 seconds (matches original cadence user liked)
        await wait(5000 + Math.random() * 3000);
        if (cancelRef.current) break;

        setPhase("exiting");
        await wait(500);
        if (cancelRef.current) break;
      }
    };

    run();
    return () => { cancelRef.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isPeeling   = phase === "peeling";
  const isOffscreen = phase === "offscreen" || phase === "exiting";

  // Do NOT set transform while isPeeling — @keyframes owns it entirely.
  // Inline style.transform has higher CSS cascade priority than animations
  // and will silently suppress the keyframe if both are present.
  const styleTransform = isPeeling
    ? undefined
    : [
        isOffscreen ? "translateY(-140vh)" : "translateY(0px)",
        `rotate(${sticker.rotate}deg)`,
        `scaleX(${sticker.scaleX}) scaleY(${sticker.scaleY})`,
      ].join(" ");

  const styleTransition: string = isPeeling ? "none" : (() => {
    switch (phase) {
      case "title":     return "none";
      case "offscreen": return "none";
      case "entering":  return "transform 0.62s cubic-bezier(0.34, 1.56, 0.64, 1)";
      case "stuck":     return "none";
      case "exiting":   return "transform 0.46s cubic-bezier(0.55, 0, 1, 0.45)";
      default:          return "none";
    }
  })();

  // key="peel"    → the div used during the title-sit + peel animation
  // key="wander"  → remounted fresh div used for smooth wandering after peel
  // Different keys force React to unmount/remount, clearing all CSS animation state.
  const divKey = wandering ? "wander" : "peel";

  return (
    <>
      <style>{PEEL_CSS}</style>
      <div
        key={divKey}
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
          ...(styleTransform !== undefined && { transform: styleTransform }),
          transition: styleTransition,
          animation: isPeeling
            ? "complexPeel 4.2s ease-in-out forwards"
            : "none",
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
