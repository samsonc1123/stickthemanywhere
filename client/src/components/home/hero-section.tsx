import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative mb-16 overflow-hidden rounded-xl">
      <div className="bg-dark-gray rounded-xl p-8 md:p-12 relative z-10">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-poppins mb-4">
            <span className="text-white">Express Yourself with </span>
            <span className="text-neon-blue text-glow-blue">Stickers</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl mb-8">
            Unique, vibrant stickers that make a statement anywhere you stick them.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/products">
              <div>
                <Button className="bg-white hover:bg-opacity-80 text-black px-8 py-6 rounded-full font-bold neon-button shadow-white">
                  Shop Now
                </Button>
              </div>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Background glow effects */}
      <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-neon-blue rounded-full opacity-20 blur-3xl"></div>
      <div className="absolute -top-10 -left-10 w-72 h-72 bg-neon-pink rounded-full opacity-20 blur-3xl"></div>
    </section>
  );
}
