import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Cross, Heart, Star, Gamepad2, TreePine, Sparkles, Zap } from "lucide-react";
import { Helmet } from "react-helmet";
import { useEffect, useRef } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string;
  subcategories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

const SCROLL_KEY = "home_scroll_y";
const STRIP_SCROLL_KEY = "home_strip_scroll_x";

const getCategoryIcon = (categorySlug: string) => {
  switch (categorySlug) {
    case 'christian':
      return <Cross className="h-5 w-5" />;
    case 'animals':
      return <Heart className="h-5 w-5" />;
    case 'nature':
      return <TreePine className="h-5 w-5" />;
    case 'gaming':
      return <Gamepad2 className="h-5 w-5" />;
    case 'abstract':
      return <Sparkles className="h-5 w-5" />;
    case 'pokemon':
      return <Zap className="h-5 w-5" />;
    default:
      return <Star className="h-5 w-5" />;
  }
};

const neonColors = [
  'neon-pink',
  'neon-blue',
  'neon-yellow',
  'neon-green',
  'neon-purple',
  'neon-red'
];

export default function Home() {
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedY = sessionStorage.getItem(SCROLL_KEY);
    const savedX = sessionStorage.getItem(STRIP_SCROLL_KEY);

    if (savedY !== null) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: parseInt(savedY, 10), behavior: 'instant' });
      });
    }

    if (savedX !== null && stripRef.current) {
      requestAnimationFrame(() => {
        if (stripRef.current) {
          stripRef.current.scrollLeft = parseInt(savedX, 10);
        }
      });
    }

    const handleWindowScroll = () => {
      sessionStorage.setItem(SCROLL_KEY, String(Math.round(window.scrollY)));
    };

    const handleStripScroll = () => {
      if (stripRef.current) {
        sessionStorage.setItem(STRIP_SCROLL_KEY, String(Math.round(stripRef.current.scrollLeft)));
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    const strip = stripRef.current;
    if (strip) {
      strip.addEventListener('scroll', handleStripScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      if (strip) {
        strip.removeEventListener('scroll', handleStripScroll);
      }
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>StickThemAnywhere - Neon Sticker Shop</title>
        <meta name="description" content="Unique, vibrant neon stickers that make a statement anywhere you stick them. Browse our collection of high-quality vinyl stickers." />
        <meta property="og:title" content="StickThemAnywhere - Neon Sticker Shop" />
        <meta property="og:description" content="Express yourself with our premium neon stickers. Waterproof, UV resistant and perfect for laptops, water bottles, and more." />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Inter:wght@300;400;500&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
      </Helmet>

      <div className="home-container">
        <div className="starfield"></div>

        <h1 className="title">
          <span style={{ color: 'white', textShadow: '0 0 8px white' }}>Stick </span>
          <span style={{ color: 'deeppink', textShadow: '0 0 8px deeppink' }}>Them </span>
          <span className="white-neon anywhere-word">
            Anywhere
          </span>
        </h1>

        <h2 className="browse-text">Browse Categories</h2>

        {/* Horizontal scrolling category buttons with different neon colors */}
        <div className="category-strip" ref={stripRef}>
          {categories.map((category, index) => {
            const isChristian = category.id === 'CHR';
            return (
              <Link key={category.id} href={isChristian ? '/christian' : category.slug === 'pokemon' ? '/pokemon' : `/category/${category.slug}`}>
                <button
                  className={`category-btn ${isChristian ? 'category-btn-gold' : neonColors[index % neonColors.length]}`}
                >
                  {getCategoryIcon(category.slug)}
                  <span className="ml-2">{category.name}</span>
                </button>
              </Link>
            );
          })}
        </div>

        {/* Square sticker display boxes with blue neon outlines */}
        <div className="sticker-gallery">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="sticker-box">
              <div className="text-gray-400 text-center">
                <div className="text-4xl mb-2 text-blue-400">🔷</div>
                <p className="text-sm">Sticker {index + 1}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center text-gray-400 py-8">
            Loading categories...
          </div>
        )}

      </div>
    </>
  );
}
