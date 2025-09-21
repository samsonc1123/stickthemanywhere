import { useParams } from "wouter";
import { useEffect } from "react";
import { StickerDetail } from "@/components/products/sticker-detail";
import { useQuery } from "@tanstack/react-query";
import { FeaturedStickers } from "@/components/home/featured-stickers";
import { Helmet } from "react-helmet";

export default function ProductDetail() {
  const { id } = useParams();
  
  const { data: sticker } = useQuery({
    queryKey: [`/api/stickers/${id}`],
  });

  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  return (
    <>
      {sticker && (
        <Helmet>
          <title>{sticker.name} - StickThemAnywhere</title>
          <meta name="description" content={`${sticker.description} High-quality vinyl, waterproof and UV resistant.`} />
          <meta property="og:title" content={`${sticker.name} - StickThemAnywhere`} />
          <meta property="og:description" content={sticker.description} />
          <meta property="og:image" content={sticker.image} />
        </Helmet>
      )}
      
      <div className="container mx-auto p-4 pt-8">
        <StickerDetail stickerId={id!} />
        
        <div className="mt-16">
          <h2 className="text-2xl font-poppins font-bold mb-6 text-white">
            <span className="text-glow-purple">You May Also</span> Like
          </h2>
          <FeaturedStickers />
        </div>
      </div>
    </>
  );
}
