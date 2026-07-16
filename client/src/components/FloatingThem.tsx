import { useState, useEffect, useRef } from "react";

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

interface Props { titleRef?: React.RefObject<HTMLSpanElement | null>; }

export function FloatingThem({ titleRef }: Props) {
  const [pos, setPos] = useState<Pos>({ x: -300, y: -300, rot: 12 });
  const cancel = useRef(false);

  useEffect(() => {
    cancel.current = false;
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    (async () => {
      // Snap onto the title word first
      await wait(350);
      if (cancel.current) return;
      const el = titleRef?.current;
      let tx = window.innerWidth / 2 - 32, ty = 20;
      if (el) { const r = el.getBoundingClientRect(); tx = r.left; ty = r.top; }
      setPos({ x: tx, y: ty, rot: 12 });

      // Wait a beat, then start popping around
      await wait(1800);
      if (cancel.current) return;

      while (!cancel.current) {
        setPos(pick());
        await wait(5000 + Math.random() * 3000);
      }
    })();

    return () => { cancel.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9500,
        pointerEvents: "none",
        fontFamily: "Pacifico, cursive",
        fontSize: "24px",
        color: "#f472b6",
        textShadow: "0 2px 6px rgba(244,114,182,0.8), 0 0 18px rgba(244,114,182,0.4)",
        transform: `rotate(${pos.rot}deg)`,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      Them
    </div>
  );
}
