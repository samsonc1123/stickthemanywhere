import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { StickerCard } from "@/components/products/sticker-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

export function FeaturedStickers() {
  const { data: stickers, isLoading } = useQuery({
    queryKey: ['/api/stickers/featured'],
  });

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-poppins font-bold text-white">
          <span className="text-glow-blue">Featured</span> Stickers
        </h2>
        <Link href="/products">
          <div className="text-neon-blue hover:underline text-sm flex items-center cursor-pointer">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </div>
        </Link>
      </div>
      
      {/* Grid of featured stickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          // Loading skeletons
          Array(4).fill(0).map((_, index) => (
            <div key={index} className="bg-dark-gray rounded-xl overflow-hidden">
              <Skeleton className="aspect-square w-full bg-light-gray" />
              <div className="p-4">
                <Skeleton className="h-4 w-20 mb-2 bg-light-gray" />
                <Skeleton className="h-5 w-32 mb-1 bg-light-gray" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-16 bg-light-gray" />
                  <Skeleton className="h-4 w-12 bg-light-gray" />
                </div>
              </div>
            </div>
          ))
        ) : (
          stickers?.map((sticker: any) => (
            <StickerCard key={sticker.id} sticker={sticker} />
          ))
        )}
      </div>
    </section>
  );
}
