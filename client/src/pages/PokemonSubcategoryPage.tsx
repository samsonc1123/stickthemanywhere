import { useMemo } from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import '../styles/HomePage.css';

const SUBCATEGORY_CONFIG: Record<string, { title: string; parentCode: string }> = {
  'types': { title: 'Pokémon Types', parentCode: 'POK-TYP' },
  'generations': { title: 'Generations', parentCode: 'POK-GEN' },
  'legendaries': { title: 'Legendaries', parentCode: 'POK-LGD' },
};

const PLACEHOLDER_ITEMS: Record<string, Array<{ name: string; color: string; code: string }>> = {
  'POK-GEN': [
    { name: 'Gen 1', color: '#facc15', code: 'GEN-01' },
    { name: 'Gen 2', color: '#facc15', code: 'GEN-02' },
    { name: 'Gen 3', color: '#facc15', code: 'GEN-03' },
    { name: 'Gen 4', color: '#facc15', code: 'GEN-04' },
    { name: 'Gen 5', color: '#facc15', code: 'GEN-05' },
    { name: 'Gen 6', color: '#facc15', code: 'GEN-06' },
    { name: 'Gen 7', color: '#facc15', code: 'GEN-07' },
    { name: 'Gen 8', color: '#facc15', code: 'GEN-08' },
    { name: 'Gen 9', color: '#facc15', code: 'GEN-09' },
  ],
  'POK-LGD': [
    { name: 'Legendary', color: '#facc15', code: 'LEGENDARY' },
    { name: 'Mythical', color: '#c084fc', code: 'MYTHICAL' },
    { name: 'Ultra Beast', color: '#67e8f9', code: 'ULTRA-BEAST' },
  ],
  'POK-TYP': [],
};

export default function PokemonSubcategoryPage() {
  const params = useParams<{ subcategory: string }>();
  const subcategoryKey = params.subcategory?.toLowerCase() || '';
  const config = SUBCATEGORY_CONFIG[subcategoryKey];

  const rawGroups = useQuery(
    api.groups.getGroupsBySubcategory,
    config ? { subcategoryCode: config.parentCode, onlyActive: true } : "skip"
  );

  const groups = useMemo(() => {
    if (!rawGroups) return [];
    // Deduplicate by canonical code (UPPERCASE + HYPHENS) to handle DB collisions like ULTRA_BEAST vs ULTRA-BEAST
    const seen = new Map<string, any>();
    for (const g of rawGroups as any[]) {
      const canonical = g.code.toUpperCase().replace(/_/g, '-');
      if (!seen.has(canonical)) {
        seen.set(canonical, { ...g, code: canonical });
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      const ao = a.sortOrder ?? 0;
      const bo = b.sortOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
  }, [rawGroups]);

  const isLoading = rawGroups === undefined;

  const getBackgroundColor = (name: string) => {
    const typeColors: Record<string, string> = {
      'Normal': '#A8A77A',
      'Fire': '#EE8130',
      'Water': '#6390F0',
      'Electric': '#F7D02C',
      'Grass': '#7AC74C',
      'Ice': '#96D9D6',
      'Fighting': '#C22E28',
      'Poison': '#A33EA1',
      'Ground': '#E2BF65',
      'Flying': '#A98FF3',
      'Psychic': '#F95587',
      'Bug': '#A6B91A',
      'Rock': '#B6A136',
      'Ghost': '#735797',
      'Dragon': '#6F35FC',
      'Dark': '#705746',
      'Steel': '#B7B7CE',
      'Fairy': '#D685AD'
    };
    return typeColors[name] || '#facc15';
  };

  const getLinkHref = (group: any) => {
    if (config.parentCode === 'POK-TYP') return `/pokemon/types`;
    if (config.parentCode === 'POK-GEN') {
      const genNum = group.code.replace('GEN-0', '').replace('GEN-', '');
      return `/pokemon/generation/${genNum}`;
    }
    if (config.parentCode === 'POK-LGD') {
      const tierMap: Record<string, string> = {
        'LEGENDARY': 'legendary',
        'MYTHICAL': 'mythical',
        'ULTRA-BEAST': 'ultra-beast',
      };
      return `/pokemon/legendaries/${tierMap[group.code] || group.code.toLowerCase()}`;
    }
    return '#';
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-perforated text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Subcategory not found</p>
          <Link href="/pokemon">
            <button className="bg-yellow-400 text-black px-4 py-2 rounded-full">Back to Pokemon</button>
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
          {config.title}
        </h1>
      </div>

      <div className="overflow-x-scroll overflow-y-hidden whitespace-nowrap px-4 py-2 w-full mb-2 landscape:mb-1 auto-hide-scrollbar" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-x'
        }}
      >
        <Link href="/pokemon">
          <button
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 mx-1 hover:scale-105 transition-transform"
            style={{ color: 'white' }}
          >
            ←
          </button>
        </Link>
        {isLoading ? (
          <span className="text-gray-500 animate-pulse">Loading...</span>
        ) : (
          groups.map((group: any) => (
            <Link key={group.code} href={getLinkHref(group)}>
              <button
                className="inline-block rounded-full px-4 py-2 mx-1 font-montserrat hover:scale-105 transition-transform"
                style={{ 
                  backgroundColor: getBackgroundColor(group.name),
                  color: group.name === 'Electric' || group.name === 'Ice' ? 'black' : 'white'
                }}
              >
                {group.name}
              </button>
            </Link>
          ))
        )}
      </div>

      <div className="w-full">
        <div className="flex justify-center pb-4 landscape:pb-16">
          <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3 landscape:gap-4 max-w-lg landscape:max-w-4xl px-4">
            {isLoading ? (
              <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 animate-pulse">Loading...</span>
              </div>
            ) : groups.length === 0 ? (
              (PLACEHOLDER_ITEMS[config.parentCode] ?? []).length > 0 ? (
                (PLACEHOLDER_ITEMS[config.parentCode]).map((item) => (
                  <div
                    key={item.code}
                    className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 flex flex-col items-center justify-center"
                    style={{ borderColor: item.color }}
                  >
                    <span className="text-xs font-audiowide uppercase tracking-widest" style={{ color: item.color }}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-gray-600 mt-1 uppercase font-bold">
                      {item.code}
                    </span>
                  </div>
                ))
              ) : (
                <div className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center">
                  <span className="text-gray-500 text-sm text-center px-2">No items found</span>
                </div>
              )
            ) : (
              groups.map((group: any) => (
                <Link key={group.code} href={getLinkHref(group)}>
                  <div
                    className="w-40 h-40 landscape:w-36 landscape:h-36 border-4 neon-border-cyan flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                    style={{ borderColor: getBackgroundColor(group.name) }}
                  >
                    <span className="text-gray-400 text-sm font-montserrat text-center px-2">{group.name}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
