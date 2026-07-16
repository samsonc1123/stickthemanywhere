import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const SUBCATEGORIES = [
  { name: "Bathing Ape", code: "FSH-BAP" },
  { name: "Supreme",     code: "FSH-SUP" },
  { name: "DC",          code: "FSH-DC"  },
  { name: "Spitfire",    code: "FSH-SPI" },
  { name: "Toy Machine", code: "FSH-TOY" },
  { name: "Jordan",      code: "FSH-JOR" },
  { name: "Gucci",       code: "FSH-GUC" },
  { name: "Louis Vuitton", code: "FSH-LV" },
  { name: "Nike",        code: "FSH-NIK" },
  { name: "Adidas",      code: "FSH-ADI" },
  { name: "Palace",      code: "FSH-PAL" },
];

const GOLD = "#c3a343";

export default function FashionPage() {
  const [glowCode, setGlowCode] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const stickersBySubcat = useQuery(api.stickers.getStickersByCategory, { categoryCode: "FASHION" }) ?? {};
  const isLoading = stickersBySubcat === undefined;

  const displayed = activeCode
    ? SUBCATEGORIES.filter((s) => s.code === activeCode)
    : SUBCATEGORIES;

  useEffect(() => {
    if (activeCode) return;
    let idx = 0;
    const cycle = () => {
      const subcatsWithStickers = SUBCATEGORIES.filter(s => (stickersBySubcat[s.code] ?? []).length > 0);
      const pool = subcatsWithStickers.length > 0 ? subcatsWithStickers : SUBCATEGORIES;
      setGlowCode(pool[idx % pool.length].code);
      idx++;
    };
    cycle();
    const id = setInterval(cycle, 2200);
    return () => clearInterval(id);
  }, [activeCode, stickersBySubcat]);

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">

      {/* Section 1 — Title */}
      <div className="text-center mb-3 lg:mb-2">
        <Link href="/">
          <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
            <div className="flex flex-col items-center landscape:hidden">
              <div className="flex items-center">
                <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
                <span className="text-pink-400 text-2xl transform rotate-12 inline-block mx-2" style={{ fontFamily: "Pacifico, cursive" }}>Them</span>
              </div>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
            <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
              <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
              <span className="text-pink-400 text-xl transform rotate-12 inline-block" style={{ fontFamily: "Pacifico, cursive" }}>Them</span>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Section 2 — Category title */}
      <div className="text-center mb-4 lg:mb-1">
        <h1 className="font-bold animate-categoriesFlicker font-audiowide text-lg" style={{ color: GOLD }}>
          Fashion
        </h1>
      </div>

      {/* Section 3 — Subcategory pills */}
      <div className="flex justify-start mb-3 lg:mb-2 w-full">
        <div
          className="overflow-x-auto overflow-y-hidden whitespace-nowrap px-4 py-2 w-full auto-hide-scrollbar"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
        >
          <div className="flex">
            <Link href="/">
              <button
                className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 mx-1 hover:scale-105 transition-transform"
                style={{ color: "white" }}
              >←</button>
            </Link>
            {SUBCATEGORIES.map((sub) => {
              const count = (stickersBySubcat[sub.code] ?? []).length;
              const isActive = activeCode === sub.code;
              const isGlowing = !activeCode && glowCode === sub.code;
              const lit = isActive || isGlowing;
              return (
                <button
                  key={sub.code}
                  onClick={() => setActiveCode(isActive ? null : sub.code)}
                  className="relative flex-shrink-0 rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: lit ? "#00ffff" : GOLD,
                    color: "black",
                    boxShadow: lit ? "0 0 8px #00ffff, 0 0 16px #00ffff55" : "none",
                    transition: "background-color 0.4s ease, box-shadow 0.4s ease",
                  }}
                >
                  {sub.name}
                  {count > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: "#ff00ff", color: "white" }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 4 — Sticker boxes */}
      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
            {isLoading
              ? [...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 border-4 flex items-center justify-center"
                    style={{ borderColor: "#374151" }}
                  >
                    <span className="text-gray-600 animate-pulse text-xs">Loading…</span>
                  </div>
                ))
              : displayed.map((sub) => {
                  const stickers = stickersBySubcat[sub.code] ?? [];
                  const isGlowing = !activeCode && glowCode === sub.code;
                  const isSelected = activeCode === sub.code;
                  const lit = isGlowing || isSelected;
                  return (
                    <div
                      key={sub.code}
                      className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 overflow-hidden relative"
                      style={{
                        borderColor: lit ? "#00ffff" : "#374151",
                        boxShadow: lit ? "0 0 10px #00ffff, 0 0 20px #00ffff55, inset 0 0 10px #00ffff22" : "none",
                        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
                      }}
                    >
                      {stickers.length > 0 ? (
                        <div
                          className="flex h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory auto-hide-scrollbar"
                          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x", overscrollBehaviorX: "contain" }}
                        >
                          {stickers.map((s: any, idx: number) => (
                            <div
                              key={s._id ?? idx}
                              className="flex-shrink-0 w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 snap-start relative"
                            >
                              <img
                                src={s.imageUrl}
                                alt={s.name}
                                style={{
                                  position: "absolute",
                                  inset: "10px",
                                  width: "calc(100% - 20px)",
                                  height: "calc(100% - 20px)",
                                  objectFit: "contain",
                                }}
                                loading="lazy"
                              />
                              {stickers.length > 1 && (
                                <span
                                  className="absolute bottom-1 right-2 text-[8px] font-mono"
                                  style={{ color: lit ? "#00ffff88" : "#37415188" }}
                                >
                                  {idx + 1}/{stickers.length}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 w-full h-full px-3 text-center">
                          <span
                            className="text-xs font-montserrat font-bold leading-tight"
                            style={{ color: lit ? "#00ffff" : "#4b5563" }}
                          >
                            {sub.name}
                          </span>
                          <span className="text-gray-700 text-[9px] font-mono uppercase tracking-wider">
                            Coming Soon
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>
        </div>
      </div>
    </div>
  );
}
