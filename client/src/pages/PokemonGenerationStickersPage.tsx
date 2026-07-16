import { useMemo } from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import '../styles/HomePage.css';

const GEN_NAME_MAP: Record<string, string> = {
  '1': 'Gen 1',
  '2': 'Gen 2',
  '3': 'Gen 3',
  '4': 'Gen 4',
  '5': 'Gen 5',
  '6': 'Gen 6',
  '7': 'Gen 7',
  '8': 'Gen 8',
  '9': 'Gen 9'
};

const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C",
  grass: "#7AC74C", ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1",
  ground: "#E2BF65", flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
  rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC", dark: "#705746",
  steel: "#B7B7CE", fairy: "#D685AD",
};

export default function PokemonGenerationStickersPage() {
  const params = useParams<{ gen: string }>();
  const genKey = params.gen || '';
  const genName = GEN_NAME_MAP[genKey];
  const groupCode = `GEN-0${genKey}`;

  const stickers = useQuery(
    api.stickers.getStickersByGroupCode,
    genName ? { groupCode } : "skip"
  ) ?? [];

  const isLoading = stickers === undefined;

  if (!genName) {
    return (
      <div className="min-h-screen bg-perforated text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Generation not found</p>
          <Link href="/pokemon/generations">
            <button className="bg-yellow-400 text-black px-4 py-2 rounded-full">Back to Generations</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-perforated text-white font-orbitron flex flex-col items-center p-4 pt-4 landscape:pt-2 pb-16">
      <div className="text-center mb-2 landscape:mb-1">
        <Link href="/">
          <div className="text-5xl font-cursive font-bold mb-2 cursor-pointer">
            <div className="flex flex-col items-center landscape:hidden">
              <div className="flex items-center">
                <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
                <span className="text-pink-400 text-2xl transform rotate-12 inline-block mx-2" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              </div>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
            
            <div className="hidden landscape:flex landscape:items-center landscape:justify-center landscape:gap-2 landscape:text-4xl">
              <span className="glow-yellow animate-flicker-extremely-slow-single">Stick</span>
              <span className="text-pink-400 text-xl transform rotate-12 inline-block" style={{ fontFamily: 'Pacifico, cursive' }}>Them</span>
              <span className="glow-yellow animate-flicker-extremely-slow-single">Anywhere</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="text-center mb-2 landscape:mb-1">
        <h1 className="text-lg font-audiowide text-neon-yellow animate-categoriesFlicker">
          {genName} Stickers
        </h1>
      </div>

      <div className="w-full mb-4 px-4 flex justify-start">
        <Link href="/pokemon/generations">
          <button
            className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-gray-600 hover:scale-105 transition-transform font-montserrat"
            style={{ color: 'white' }}
          >
            ← Back to Generations
          </button>
        </Link>
      </div>

      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            {isLoading ? (
              <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 animate-pulse">Loading...</span>
              </div>
            ) : (stickers as any[]).length === 0 ? (
              <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 text-sm text-center px-2">No {genName} stickers found</span>
              </div>
            ) : (
              (stickers as any[]).map((sticker, i) => (
                <div key={i} className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan overflow-hidden flex flex-col items-center justify-center hover:scale-105 transition-transform relative group"
                  style={{ borderColor: '#facc15' }}
                >
                  <img 
                    src={sticker.imageUrl ?? sticker.url ?? ''} 
                    alt={sticker.title ?? sticker.name ?? sticker.code ?? 'sticker'}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />

                  <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1 rounded">
                    {sticker.primary_type && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-bold text-white" 
                        style={{ backgroundColor: TYPE_COLORS[String(sticker.primary_type).toLowerCase()] || '#888' }}>
                        {sticker.primary_type}
                      </span>
                    )}
                    {sticker.secondary_type && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-bold text-white"
                        style={{ backgroundColor: TYPE_COLORS[String(sticker.secondary_type).toLowerCase()] || '#888' }}>
                        {sticker.secondary_type}
                      </span>
                    )}
                    {sticker.generation && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-gray-700 text-white">
                        {sticker.generation}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
