import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

interface StickerPreviewProps {
  sticker: {
    id: number;
    name: string;
    price: number;
    image: string;
    brandLogo: string;
  };
}

function StickerPreview({ sticker }: StickerPreviewProps) {
  return (
    <Link href={`/product/${sticker.id}`}>
      <div className="block">
        <div className="sticker-card card-3d-effect bg-dark-gray rounded-xl overflow-hidden">
          <div className="relative aspect-square group">
            <img 
              src={sticker.image} 
              alt={sticker.name} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute bottom-3 right-3 w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <img 
                src={sticker.brandLogo} 
                alt="Brand Logo" 
                className="w-4 h-4 object-contain" 
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <h3 className="font-medium text-white text-sm text-shadow">{sticker.name}</h3>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function NewArrivals() {
  const { data: stickers, isLoading } = useQuery({
    queryKey: ['/api/stickers/new-arrivals'],
  });

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-poppins font-bold text-white">
          <span className="text-glow-purple">New</span> Arrivals
        </h2>
        <Link href="/products/new-arrivals">
          <a className="text-neon-purple hover:underline text-sm flex items-center">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </Link>
      </div>
      
      {/* Grid of new arrival stickers */}
      <div className="masonry-gallery grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {isLoading ? (
          // Loading skeletons
          Array(5).fill(0).map((_, index) => (
            <div key={index} className="bg-dark-gray rounded-xl overflow-hidden masonry-item">
              <Skeleton className="aspect-square w-full bg-light-gray" />
              <div className="p-3">
                <Skeleton className="h-4 w-24 mb-1 bg-light-gray" />
                <Skeleton className="h-4 w-12 bg-light-gray" />
              </div>
            </div>
          ))
        ) : stickers && Array.isArray(stickers) && stickers.length > 0 ? (
          stickers.map((sticker: any) => (
            <div key={sticker.id} className="masonry-item transform transition-all duration-300 hover:scale-105">
              <StickerPreview sticker={sticker} />
            </div>
          ))
        ) : (
          <div className="col-span-full text-center">
            <p className="text-gray-400">No new arrivals available at the moment</p>
          </div>
        )}
      </div>
    </section>
  );
}
