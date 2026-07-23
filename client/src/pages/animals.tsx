import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const SUBCATEGORIES = [
  { name: "Axolotl",     code: "AXO" },
  { name: "Birds",       code: "BRD" },
  { name: "Butterflies", code: "BTF" },
  { name: "Cats",        code: "CAT" },
  { name: "Dogs",        code: "DOG" },
  { name: "Elephants",   code: "ELE" },
  { name: "Lions",       code: "LIO" },
  { name: "Pandas",      code: "PAN" },
  { name: "Shells",      code: "SHL" },
  { name: "Sharks",      code: "SHK" },
  { name: "Tigers",      code: "TIG" },
  { name: "Turtles",     code: "TUR" },
];

const DART_FROG_COLORS = [
  "#1a8cff",
  "#ff2200",
  "#f5e000",
  "#44dd00",
  "#ff6600",
  "#00ddcc",
  "#cc00ff",
  "#ffaa00",
  "#0055dd",
  "#ff3388",
  "#66ff00",
  "#ff4400",
];

const TITLE_COLOR = "#1a8cff";
const CAT = "ANIMALS";

export default function AnimalsPage() {
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const rawData = useQuery(api.stickers.getStickersByCategory, { categoryCode: CAT });
  const stickersBySubcat = rawData ?? {};
  const isLoading = rawData === undefined;
  const displayed = activeCode ? SUBCATEGORIES.filter(s => s.code === activeCode) : SUBCATEGORIES;

  const [frogPhase, setFrogPhase] = useState<'hidden' | 'inTitle' | 'hopping'>('hidden');
  const [frogPos, setFrogPos] = useState({ x: 50, y: 8 });
  const [hopKey, setHopKey] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setFrogPhase('inTitle'), 4000);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (frogPhase !== 'inTitle') return;
    const t2 = setTimeout(() => {
      setFrogPhase('hopping');
      setFrogPos({ x: 10 + Math.random() * 70, y: 20 + Math.random() * 55 });
      setHopKey(k => k + 1);
    }, 1200);
    return () => clearTimeout(t2);
  }, [frogPhase]);

  useEffect(() => {
    if (frogPhase !== 'hopping') return;
    const interval = setInterval(() => {
      setFrogPos({ x: 5 + Math.random() * 80, y: 5 + Math.random() * 75 });
      setHopKey(k => k + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, [frogPhase]);

  const ThemOrFrog = ({ size }: { size: 'normal' | 'small' }) => {
    if (frogPhase === 'hidden') {
      return (
        <span
          className={`text-pink-400 ${size === 'normal' ? 'text-2xl' : 'text-xl'} transform rotate-12 inline-block ${size === 'normal' ? 'mx-2' : ''}`}
          style={{ fontFamily: "Pacifico, cursive" }}
        >
          Them
        </span>
      );
    }
    return (
      <span
        className={`inline-block ${size === 'normal' ? 'mx-2' : ''}`}
        style={{
          fontSize: size === 'normal' ? '2rem' : '1.6rem',
          animation: frogPhase === 'inTitle' ? 'frog-appear 0.4s ease-out both' : 'frog-depart 0.5s ease-in both',
          filter: 'drop-shadow(0 0 8px #44dd00)',
          display: 'inline-block',
        }}
      >
        🐸
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">
      <style>{`
        @keyframes frog-hop {
          0%   { transform: scale(1, 1) translateY(0); }
          15%  { transform: scale(1.1, 0.85) translateY(4px); }
          35%  { transform: scale(0.9, 1.15) translateY(-55px); }
          65%  { transform: scale(0.95, 1.05) translateY(-25px); }
          80%  { transform: scale(1.05, 0.95) translateY(-6px); }
          100% { transform: scale(1, 1) translateY(0); }
        }
        @keyframes frog-appear {
          0%   { opacity: 0; transform: scale(0.3) rotate(-20deg); }
          60%  { transform: scale(1.2) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes frog-depart {
          0%   { opacity: 1; transform: scale(1) translateY(0); }
          40%  { transform: scale(0.8) translateY(-30px); }
          100% { opacity: 0; transform: scale(0.2) translateY(-80px); }
        }
        @keyframes frog-idle {
          0%, 100% { transform: scaleY(1); }
          50%       { transform: scaleY(0.92) scaleX(1.05); }
        }
      `}</style>

      <div className="text-center mb-3 lg:mb-2">
        <Link href="/">
          <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
            <div className="flex flex-col items-center landscape:hidden">
              <div className="flex items-center">
                <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
                <ThemOrFrog size="normal" />
              </div>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
            <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
              <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
              <ThemOrFrog size="small" />
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="text-center mb-4 lg:mb-1">
        <h1 className="font-bold animate-categoriesFlicker font-audiowide text-lg" style={{ color: TITLE_COLOR }}>Animals</h1>
      </div>

      <div className="flex justify-start mb-3 lg:mb-2 w-full">
        <div className="overflow-x-auto overflow-y-hidden whitespace-nowrap px-4 py-2 w-full auto-hide-scrollbar" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>
          <div className="flex">
            <Link href="/"><button className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 mx-1 hover:scale-105 transition-transform" style={{ color: "white" }}>←</button></Link>
            {SUBCATEGORIES.map((sub, idx) => {
              const color = DART_FROG_COLORS[idx % DART_FROG_COLORS.length];
              const lit = activeCode === sub.code;
              return (
                <button key={sub.code} onClick={() => setActiveCode(activeCode === sub.code ? null : sub.code)}
                  className="relative flex-shrink-0 rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform"
                  style={{ backgroundColor: color, color: "black", boxShadow: lit ? `0 0 8px ${color}, 0 0 16px ${color}88` : "none", transition: "box-shadow 0.4s" }}>
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full"><div className="flex justify-center pb-4 landscape:pb-16">
        <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
          {isLoading ? [...Array(4)].map((_, i) => (
            <div key={i} className="w-52 h-52 border-4 flex items-center justify-center" style={{ borderColor: "#374151" }}><span className="text-gray-600 animate-pulse text-xs">Loading…</span></div>
          )) : displayed.map((sub, idx) => {
            const color = DART_FROG_COLORS[
              activeCode
                ? SUBCATEGORIES.findIndex(s => s.code === sub.code) % DART_FROG_COLORS.length
                : idx % DART_FROG_COLORS.length
            ];
            const stickers: any[] = stickersBySubcat[sub.code] ?? [];
            const lit = activeCode === sub.code;
            return (
              <div key={sub.code} className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 overflow-hidden relative"
                style={{ borderColor: color, boxShadow: lit ? `0 0 12px ${color}, 0 0 24px ${color}55, inset 0 0 10px ${color}22` : `0 0 5px ${color}44`, transition: "box-shadow 0.4s" }}>
                {stickers.length > 0 ? (
                  <div className="flex h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory auto-hide-scrollbar" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
                    {stickers.map((s: any, sIdx: number) => (
                      <div key={s._id ?? sIdx} className="flex-shrink-0 w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 snap-start relative">
                        <img src={s.imageUrl} alt={s.name} style={{ position: "absolute", inset: "4%", width: "92%", height: "92%", objectFit: "contain" }} loading="lazy" />
                        {stickers.length > 1 && <span className="absolute bottom-1 right-2 text-[8px] font-mono" style={{ color: `${color}88` }}>{sIdx + 1}/{stickers.length}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 w-full h-full px-3 text-center">
                    <span className="text-xs font-montserrat font-bold leading-tight" style={{ color }}>{sub.name}</span>
                    <span className="text-gray-700 text-[9px] font-mono uppercase tracking-wider">Coming Soon</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div></div>

      {frogPhase === 'hopping' && (
        <div
          style={{
            position: 'fixed',
            left: `${frogPos.x}%`,
            top: `${frogPos.y}%`,
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'left 0.55s ease-in-out, top 0.55s ease-in-out',
          }}
        >
          <span
            key={hopKey}
            style={{
              display: 'block',
              fontSize: '2.4rem',
              animation: 'frog-hop 0.65s cubic-bezier(0.36, 0.07, 0.19, 0.97) both',
              filter: 'drop-shadow(0 0 10px #44dd00) drop-shadow(0 0 4px #00ffaa)',
            }}
          >
            🐸
          </span>
        </div>
      )}
    </div>
  );
}
