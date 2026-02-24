import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import '../styles/HomePage.css';

const LEGENDARY_GROUPS = [
  { code: 'LEGENDARY', name: 'Legendary', key: 'legendary' },
  { code: 'MYTHICAL', name: 'Mythical', key: 'mythical' },
  { code: 'ULTRA-BEAST', name: 'Ultra Beast', key: 'ultra-beast' },
];

const GROUP_CODES = LEGENDARY_GROUPS.map(g => g.code);

export default function PokemonLegendaryStickersPage() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const legendaryStickers = useQuery(
    api.stickers.getStickersByGroupCode,
    { groupCode: 'LEGENDARY' }
  ) ?? [];

  const mythicalStickers = useQuery(
    api.stickers.getStickersByGroupCode,
    { groupCode: 'MYTHICAL' }
  ) ?? [];

  const ultraBeastStickers = useQuery(
    api.stickers.getStickersByGroupCode,
    { groupCode: 'ULTRA-BEAST' }
  ) ?? [];

  const allStickers = useMemo(() => {
    const tagged = [
      ...(legendaryStickers as any[]).map(s => ({ ...s, _groupCode: 'LEGENDARY' })),
      ...(mythicalStickers as any[]).map(s => ({ ...s, _groupCode: 'MYTHICAL' })),
      ...(ultraBeastStickers as any[]).map(s => ({ ...s, _groupCode: 'ULTRA-BEAST' })),
    ];
    return tagged;
  }, [legendaryStickers, mythicalStickers, ultraBeastStickers]);

  const filteredStickers = selectedGroup
    ? allStickers.filter(s => s._groupCode === selectedGroup)
    : allStickers;

  const isLoading = legendaryStickers === undefined || mythicalStickers === undefined || ultraBeastStickers === undefined;

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
          Legendary Pokémon
        </h1>
      </div>

      <div className="w-full mb-4 px-4 flex flex-wrap items-center justify-center gap-2">
        <Link href="/pokemon">
          <button
            className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-gray-600 hover:scale-105 transition-transform font-montserrat text-sm"
            style={{ color: 'white' }}
          >
            ← Back
          </button>
        </Link>
        
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setSelectedGroup(null)}
            className={`px-4 py-2 rounded-full text-xs font-montserrat transition-all ${!selectedGroup ? 'bg-neon-yellow text-black ring-2 ring-white scale-105' : 'bg-gray-800 text-white opacity-70'}`}
          >
            All
          </button>
          {LEGENDARY_GROUPS.map(group => (
            <button
              key={group.code}
              onClick={() => setSelectedGroup(group.code === selectedGroup ? null : group.code)}
              className={`px-4 py-2 rounded-full text-xs font-montserrat transition-all ${selectedGroup === group.code ? 'bg-neon-yellow text-black ring-2 ring-white scale-105' : 'bg-gray-800 text-white opacity-70'}`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
            {isLoading ? (
              <div className="w-40 h-40 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 animate-pulse">Loading...</span>
              </div>
            ) : filteredStickers.length === 0 ? (
              <div className="w-40 h-40 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 text-sm text-center px-2">No stickers found</span>
              </div>
            ) : (
              filteredStickers.map((sticker, i) => (
                <div key={i} className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 neon-border-cyan overflow-hidden flex flex-col items-center justify-center hover:scale-105 transition-transform relative group">
                  <img 
                    src={sticker.imageUrl ?? sticker.url ?? ''} 
                    alt={sticker.title ?? sticker.name ?? sticker.code ?? 'sticker'}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />

                  <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1 rounded">
                    {sticker.primary_type && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-bold text-white" 
                        style={{ backgroundColor: '#888' }}>
                        {sticker.primary_type}
                      </span>
                    )}
                    {sticker.secondary_type && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-bold text-white"
                        style={{ backgroundColor: '#888' }}>
                        {sticker.secondary_type}
                      </span>
                    )}
                    {sticker.generation && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-gray-700 text-white">
                        {sticker.generation}
                      </span>
                    )}
                    {sticker._groupCode && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-bold bg-neon-yellow text-black">
                        {LEGENDARY_GROUPS.find(g => g.code === sticker._groupCode)?.name || sticker._groupCode}
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
