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

  // Group ALL stickers by character name
  const stickersByCharacter: Record<string, any[]> = {};
  for (const sticker of stickers) {
    const prefix = `${franchiseName} - `;
    const charName = sticker.name?.startsWith(prefix)
      ? sticker.name.slice(prefix.length)
      : sticker.name ?? sticker.code;
    if (!stickersByCharacter[charName]) stickersByCharacter[charName] = [];
    stickersByCharacter[charName].push(sticker);
  }

  const roster: string[] = FRANCHISE_CHARACTERS[code]
    ? [...FRANCHISE_CHARACTERS[code]].sort((a, b) => a.localeCompare(b))
    : Object.keys(stickersByCharacter).sort((a, b) => a.localeCompare(b));

  // Spotlight cycles across all characters
  useEffect(() => {
    if (roster.length === 0) return;
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
    return () => { if (glowRef.current) clearInterval(glowRef.current); };
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
                const hasStickers = (stickersByCharacter[char]?.length ?? 0) > 0;
                return (
                  <button
                    key={char}
                    onClick={() => setActiveChar(isUserSelected ? null : char)}
                    className="inline-block rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-all text-sm flex-shrink-0 relative"
                    style={{
                      backgroundColor: isUserSelected || isGlowing ? CYAN : GREY,
                      color: isUserSelected || isGlowing ? "black" : hasStickers ? "#e5e7eb" : "#9ca3af",
                      fontWeight: isUserSelected || isGlowing ? 700 : hasStickers ? 600 : 400,
                      border: isGlowing ? `1px solid ${CYAN}` : GREY_BORDER,
                      boxShadow: isGlowing ? `0 0 10px ${CYAN}, 0 0 20px ${CYAN}44` : "none",
                      transition: "background-color 0.4s ease, color 0.4s ease, box-shadow 0.4s ease",
                    }}
                  >
                    {char}
                    {/* Badge showing count if more than 1 sticker */}
                    {hasStickers && (stickersByCharacter[char]?.length ?? 0) > 1 && (
                      <span
                        className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                        style={{ backgroundColor: CYAN, color: "black" }}
                      >
                        {stickersByCharacter[char].length}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Sticker display */}
      <div className="w-full px-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="text-gray-500 animate-pulse text-sm">Loading…</span>
          </div>
        ) : activeChar ? (
          /* ── Single-character view: horizontal scroll strip ── */
          <SingleCharacterStrip
            char={activeChar}
            stickers={stickersByCharacter[activeChar] ?? []}
            isGlowing={false}
            CYAN={CYAN}
            GREY={GREY}
          />
        ) : (
          /* ── All-characters view: one row per character ── */
          <div className="flex flex-col gap-4 pb-8">
            {displayed.map((char) => {
              const charStickers = stickersByCharacter[char] ?? [];
              const isGlowing = glowChar === char;
              return (
                <CharacterRow
                  key={char}
                  char={char}
                  stickers={charStickers}
                  isGlowing={isGlowing}
                  CYAN={CYAN}
                  GREY={GREY}
                  onCharClick={() => setActiveChar(char)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CharacterRow ─────────────────────────────────────────────────────────────
// One full-width row: character label on left, sticker boxes scroll right
function CharacterRow({
  char,
  stickers,
  isGlowing,
  CYAN,
  GREY,
  onCharClick,
}: {
  char: string;
  stickers: any[];
  isGlowing: boolean;
  CYAN: string;
  GREY: string;
  onCharClick: () => void;
}) {
  const hasStickers = stickers.length > 0;
  const borderColor = isGlowing ? CYAN : "#374151";
  const labelColor = isGlowing ? CYAN : hasStickers ? "#e5e7eb" : "#4b5563";

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${borderColor}`,
        boxShadow: isGlowing ? `0 0 8px ${CYAN}55` : "none",
        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
        backgroundColor: "rgba(0,0,0,0.25)",
      }}
    >
      {/* Character label row */}
      <div
        className="px-3 py-1.5 flex items-center justify-between cursor-pointer select-none"
        onClick={onCharClick}
        style={{ borderBottom: `1px solid ${borderColor}22` }}
      >
        <span
          className="font-montserrat text-xs font-semibold tracking-wide truncate"
          style={{ color: labelColor }}
        >
          {char}
        </span>
        {stickers.length > 1 && (
          <span
            className="text-[10px] font-bold font-mono ml-2 flex-shrink-0"
            style={{ color: CYAN }}
          >
            {stickers.length} stickers →
          </span>
        )}
        {!hasStickers && (
          <span className="text-[9px] font-mono text-gray-700 uppercase tracking-widest flex-shrink-0">
            Coming Soon
          </span>
        )}
      </div>

      {/* Sticker boxes — horizontal scroll (only shown when stickers exist) */}
      {hasStickers && (
        <div
          className="flex overflow-x-auto gap-3 p-3 auto-hide-scrollbar"
          style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", touchAction: "pan-x" }}
        >
          {stickers.map((sticker) => (
            <StickerBox key={sticker.code} sticker={sticker} isGlowing={isGlowing} CYAN={CYAN} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SingleCharacterStrip ────────────────────────────────────────────────────
// Full-width horizontal scroll of all stickers for one character
function SingleCharacterStrip({
  char,
  stickers,
  isGlowing,
  CYAN,
  GREY,
}: {
  char: string;
  stickers: any[];
  isGlowing: boolean;
  CYAN: string;
  GREY: string;
}) {
  return (
    <div className="w-full">
      <div
        className="flex overflow-x-auto gap-4 pb-4 pt-2 auto-hide-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", touchAction: "pan-x" }}
      >
        {stickers.length > 0 ? (
          stickers.map((sticker) => (
            <div key={sticker.code} className="flex-shrink-0 flex flex-col items-center gap-1">
              <StickerBox sticker={sticker} isGlowing={isGlowing} CYAN={CYAN} size="lg" />
              <span className="text-[9px] font-mono text-gray-500">{sticker.code}</span>
            </div>
          ))
        ) : (
          <div
            className="flex-shrink-0 w-52 h-52 flex flex-col items-center justify-center gap-2 mx-auto"
            style={{ border: `2px dashed #374151` }}
          >
            <span className="text-gray-400 text-sm font-montserrat">{char}</span>
            <span className="text-gray-700 text-[9px] font-mono uppercase tracking-widest">Coming Soon</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StickerBox ───────────────────────────────────────────────────────────────
function StickerBox({
  sticker,
  isGlowing,
  CYAN,
  size = "md",
}: {
  sticker: any;
  isGlowing: boolean;
  CYAN: string;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "w-52 h-52" : "w-40 h-40 landscape:w-36 landscape:h-36";
  const borderColor = isGlowing ? CYAN : "#374151";
  const boxShadow = isGlowing
    ? `0 0 12px ${CYAN}, 0 0 24px ${CYAN}55, inset 0 0 12px ${CYAN}22`
    : "none";

  return (
    <div
      className={`flex-shrink-0 ${dim} flex items-center justify-center overflow-hidden`}
      style={{
        border: `3px solid ${borderColor}`,
        boxShadow,
        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
      }}
    >
      {sticker.imageUrl ? (
        <img
          src={sticker.imageUrl}
          alt={sticker.name}
          className="max-h-full max-w-full object-contain p-2"
          loading="lazy"
        />
      ) : (
        <span className="text-gray-600 text-[9px] font-mono">{sticker.code}</span>
      )}
    </div>
  );
}
