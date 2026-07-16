import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import "../styles/HomePage.css";

export default function DragonsPage() {
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const subcategories = useQuery(
    api.subcategories.getSubcategoriesByCategory,
    { categoryCode: "DRAGONS" }
  ) ?? [];

  const stickersByCode = useQuery(
    api.stickers.getStickersByCategory,
    { categoryCode: "DRAGONS" }
  ) ?? {};

  const isLoading = subcategories === undefined || stickersByCode === undefined;

  const sorted = [...(subcategories as any[])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const displayed = activeCode
    ? sorted.filter((s) => s.code === activeCode)
    : sorted;

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">
      {/* Title */}
      <div className="text-center mb-2 landscape:mb-1">
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

      {/* Category label */}
      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="font-bold text-yellow-400 animate-categoriesFlicker font-audiowide text-lg">Dragons</h1>
      </div>

      {/* Subcategory pill buttons */}
      <div
        className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth", touchAction: "pan-x" }}
      >
        <div className="inline-flex space-x-2">
          <Link href="/">
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
              {activeCode && (
                <button
                  onClick={() => setActiveCode(null)}
                  className="inline-block rounded-full bg-gray-700 border border-gray-500 px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform text-sm text-white"
                >
                  All
                </button>
              )}
              {sorted.map((sub) => (
                <button
                  key={sub.code}
                  onClick={() => setActiveCode(activeCode === sub.code ? null : sub.code)}
                  className="inline-block rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform text-white"
                  style={{
                    backgroundColor: activeCode === sub.code ? "#facc15" : "#dc2626",
                    color: activeCode === sub.code ? "black" : "white",
                    fontWeight: activeCode === sub.code ? 700 : 400,
                  }}
                >
                  {sub.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Sticker grid */}
      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
            {isLoading ? (
              <div className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 border-red-600 flex items-center justify-center">
                <span className="text-red-400 animate-pulse text-sm">Loading…</span>
              </div>
            ) : displayed.length === 0 ? (
              <div className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 border-red-600 flex items-center justify-center">
                <span className="text-gray-500 text-sm text-center px-2">No subcategories yet</span>
              </div>
            ) : (
              displayed.map((sub) => {
                const stickers: any[] = (stickersByCode as any)[sub.code] ?? [];
                return (
                  <div
                    key={sub.code}
                    className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 border-red-600 flex items-center justify-center overflow-hidden relative"
                  >
                    {stickers.length > 0 ? (
                      <div
                        className="flex h-full gap-2 overflow-x-auto w-full items-center px-2"
                        style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}
                      >
                        {stickers.map((sticker, j) => (
                          <div key={j} className="flex-shrink-0 h-full flex items-center justify-center">
                            <img
                              src={sticker.imageUrl ?? ""}
                              alt={sticker.name ?? sticker.code}
                              className="max-h-full max-w-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
                        <span className="text-red-400 text-xs font-montserrat font-bold">{sub.name}</span>
                        <span className="text-gray-600 text-[9px] font-mono uppercase tracking-wider">{sub.code}</span>
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
