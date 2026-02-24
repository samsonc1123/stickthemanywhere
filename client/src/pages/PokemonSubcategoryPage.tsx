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
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 md:landscape:grid-cols-4 gap-3 landscape:gap-4 md:gap-5 max-w-lg landscape:max-w-4xl md:max-w-2xl md:landscape:max-w-6xl px-4">
            {isLoading ? (
              <div className="w-40 h-40 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 animate-pulse">Loading...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="w-40 h-40 border-4 neon-border-cyan flex items-center justify-center">
                <span className="text-gray-500 text-sm text-center px-2">No items found</span>
              </div>
            ) : (
              groups.map((group: any) => (
                <Link key={group.code} href={getLinkHref(group)}>
                  <div className="w-52 h-52 landscape:w-52 landscape:h-52 md:w-56 md:h-56 md:landscape:w-56 md:landscape:h-56 border-4 neon-border-cyan flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                    style={{ borderColor: getBackgroundColor(group.name) }}
                  >
                    <span className="text-gray-400 text-lg font-montserrat">{group.name}</span>
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
