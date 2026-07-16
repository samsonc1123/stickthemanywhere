import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FRANCHISE_CHARACTERS } from "../data/franchiseCharacters";
import "../styles/HomePage.css";

export default function MovieFranchisePage() {
  const { franchiseCode } = useParams<{ franchiseCode: string }>();
  const code = (franchiseCode ?? "").toUpperCase();
  const [activeChar, setActiveChar] = useState<string | null>(null);

  const subcategory = useQuery(api.subcategories.getSubcategoryByCode, { code });
  const stickers = (useQuery(api.stickers.getStickersBySubcategory, { subcategoryCode: code }) ?? []) as any[];

  const franchiseName = subcategory?.name ?? code;
  const isLoading = subcategory === undefined || stickers === undefined;

  // Build a map: character name → sticker (matched by "Franchise - Character" naming)
  const stickerByCharacter: Record<string, any> = {};
  for (const sticker of stickers) {
    const prefix = `${franchiseName} - `;
    if (sticker.name && sticker.name.startsWith(prefix)) {
      const charName = sticker.name.slice(prefix.length);
      stickerByCharacter[charName] = sticker;
    }
  }

  // Use predefined character list if available, otherwise fall back to uploaded sticker names
  const roster: string[] = FRANCHISE_CHARACTERS[code]
    ? [...FRANCHISE_CHARACTERS[code]].sort((a, b) => a.localeCompare(b))
    : stickers
        .map((s) => {
          const prefix = `${franchiseName} - `;
          return s.name?.startsWith(prefix) ? s.name.slice(prefix.length) : s.name ?? s.code;
        })
        .sort((a, b) => a.localeCompare(b));

  const displayed = activeChar ? roster.filter((c) => c === activeChar) : roster;

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

      {/* Franchise name */}
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
        <div className="inline-flex space-x-2">
          <Link href="/movies">
            <button
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 mx-1 hover:scale-105 transition-transform"
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
                  className="inline-block rounded-full bg-gray-700 border border-gray-500 px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform text-sm text-white"
                >
                  All
                </button>
              )}
              {roster.map((char) => {
                const hasSticker = !!stickerByCharacter[char];
                const isActive = activeChar === char;
                return (
                  <button
                    key={char}
                    onClick={() => setActiveChar(isActive ? null : char)}
                    className="inline-block rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform text-sm"
                    style={{
                      backgroundColor: isActive
                        ? "#facc15"
                        : hasSticker
                        ? "#00ffff"
                        : "#374151",
                      color: isActive || hasSticker ? "black" : "#9ca3af",
                      fontWeight: isActive ? 700 : 400,
                      border: hasSticker && !isActive ? "none" : isActive ? "none" : "1px solid #4b5563",
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
              <div className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 animate-pulse text-sm">Loading…</span>
              </div>
            ) : (
              displayed.map((char) => {
                const sticker = stickerByCharacter[char];
                return (
                  <div
                    key={char}
                    className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 neon-border-cyan flex items-center justify-center overflow-hidden relative"
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
                        <span className="text-cyan-400 text-xs font-montserrat font-bold leading-tight">{char}</span>
                        <span className="text-gray-600 text-[9px] font-mono uppercase tracking-wider">Coming Soon</span>
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
