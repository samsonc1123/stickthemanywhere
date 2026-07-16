import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FRANCHISE_CHARACTERS } from "../data/franchiseCharacters";
import "../styles/HomePage.css";

export default function MovieFranchisePage() {
  const { franchiseCode } = useParams<{ franchiseCode: string }>();
  const code = (franchiseCode ?? "").toUpperCase();
  const [activeChar, setActiveChar] = useState<string | null>(null);
  const [glowChar, setGlowChar] = useState<string>("");
  const glowRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const subcategory = useQuery(api.subcategories.getSubcategoryByCode, { code });
  const stickers = (useQuery(api.stickers.getStickersBySubcategory, { subcategoryCode: code }) ?? []) as any[];

  const franchiseName = subcategory?.name ?? code;
  const isLoading = subcategory === undefined || stickers === undefined;

  const stickerByCharacter: Record<string, any> = {};
  for (const sticker of stickers) {
    const prefix = `${franchiseName} - `;
    if (sticker.name && sticker.name.startsWith(prefix)) {
      const charName = sticker.name.slice(prefix.length);
      stickerByCharacter[charName] = sticker;
    }
  }

  const roster: string[] = FRANCHISE_CHARACTERS[code]
    ? [...FRANCHISE_CHARACTERS[code]].sort((a, b) => a.localeCompare(b))
    : stickers
        .map((s) => {
          const prefix = `${franchiseName} - `;
          return s.name?.startsWith(prefix) ? s.name.slice(prefix.length) : s.name ?? s.code;
        })
        .sort((a, b) => a.localeCompare(b));

  // Randomly cycle the cyan spotlight across all characters
  useEffect(() => {
    if (roster.length === 0) return;
    // Pick a random starting char
    setGlowChar(roster[Math.floor(Math.random() * roster.length)]);

    glowRef.current = setInterval(() => {
      setGlowChar((prev) => {
        let next: string;
        do {
          next = roster[Math.floor(Math.random() * roster.length)];
        } while (next === prev && roster.length > 1);
        return next;
      });
    }, 2200);

    return () => {
      if (glowRef.current) clearInterval(glowRef.current);
    };
  }, [roster.length, code]);

  const displayed = activeChar ? roster.filter((c) => c === activeChar) : roster;

  const GREY = "#374151";
  const GREY_BORDER = "1px solid #4b5563";
  const CYAN = "#00ffff";

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">

      {/* Title */}
      <div className="text-center mb-2 landscape:mb-1">
        <Link href="/movies">
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

      {/* Franchise subtitle */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">
          {isLoading ? "…" : franchiseName}
        </h1>
      </div>

      {/* Character pill nav */}
      <div
        className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", touchAction: "pan-x" }}
      >
        <div className="inline-flex space-x-2 items-center">
          <Link href="/movies">
            <button
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 mx-1 hover:scale-105 transition-transform flex-shrink-0"
              style={{ color: "white" }}
            >
              ←
            </button>
          </Link>

          {isLoading ? (
            <span className="text-gray-500 animate-pulse px-4 py-2 inline-block">Loading…</span>
          ) : (
            <>
              {activeChar && (
                <button
                  onClick={() => setActiveChar(null)}
                  className="inline-block rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform text-sm text-white flex-shrink-0"
                  style={{ backgroundColor: GREY, border: GREY_BORDER }}
                >
                  All
                </button>
              )}
              {roster.map((char) => {
                const isUserSelected = activeChar === char;
                const isGlowing = !activeChar && glowChar === char;
                return (
                  <button
                    key={char}
                    onClick={() => setActiveChar(isUserSelected ? null : char)}
                    className="inline-block rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-all text-sm flex-shrink-0"
                    style={{
                      backgroundColor: isUserSelected || isGlowing ? CYAN : GREY,
                      color: isUserSelected || isGlowing ? "black" : "#9ca3af",
                      fontWeight: isUserSelected || isGlowing ? 700 : 400,
                      border: isGlowing ? `1px solid ${CYAN}` : GREY_BORDER,
                      boxShadow: isGlowing ? `0 0 10px ${CYAN}, 0 0 20px ${CYAN}44` : "none",
                      transition: "background-color 0.4s ease, color 0.4s ease, box-shadow 0.4s ease",
                    }}
                  >
                    {char}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Character sticker grid */}
      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">

            {isLoading ? (
              <div
                className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 flex items-center justify-center"
                style={{ border: `3px solid ${GREY}` }}
              >
                <span className="text-gray-500 animate-pulse text-sm">Loading…</span>
              </div>
            ) : (
              displayed.map((char) => {
                const sticker = stickerByCharacter[char];
                const isGlowing = !activeChar && glowChar === char;
                const isUserSelected = activeChar === char;
                const borderColor = isUserSelected || isGlowing ? CYAN : GREY;
                const boxShadow = isGlowing
                  ? `0 0 12px ${CYAN}, 0 0 24px ${CYAN}55, inset 0 0 12px ${CYAN}22`
                  : "none";

                return (
                  <div
                    key={char}
                    className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 flex items-center justify-center overflow-hidden relative"
                    style={{
                      border: `3px solid ${borderColor}`,
                      boxShadow,
                      transition: "border-color 0.4s ease, box-shadow 0.4s ease",
                      backgroundColor: "#111",
                    }}
                  >
                    {sticker?.imageUrl ? (
                      <img
                        src={sticker.imageUrl}
                        alt={sticker.name}
                        className="max-h-full max-w-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 px-3 text-center">
                        <span
                          className="text-xs font-montserrat font-bold leading-tight"
                          style={{ color: isGlowing ? CYAN : "#4b5563" }}
                        >
                          {char}
                        </span>
                        <span className="text-gray-700 text-[9px] font-mono uppercase tracking-wider">
                          Coming Soon
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
