import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type CountdownTime = {
  hours: number;
  minutes: number;
  seconds: number;
};

export function BannerPromo() {
  const [time, setTime] = useState<CountdownTime>({
    hours: 24,
    minutes: 36,
    seconds: 59
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prevTime => {
        let { hours, minutes, seconds } = prevTime;
        
        if (seconds > 0) {
          seconds--;
        } else {
          seconds = 59;
          if (minutes > 0) {
            minutes--;
          } else {
            minutes = 59;
            if (hours > 0) {
              hours--;
            } else {
              // Reset to 24 hours when countdown reaches zero
              hours = 24;
            }
          }
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="mb-16">
      <div className="relative rounded-xl overflow-hidden">
        <div className="bg-dark-gray p-8 md:p-12 rounded-xl relative z-10">
          <div className="md:max-w-xl">
            <h2 className="text-3xl md:text-4xl font-bold font-poppins mb-4">
              <span className="text-neon-blue text-glow-blue">FLASH SALE</span>
              <span className="block text-white">30% OFF All Animal Stickers</span>
            </h2>
            <p className="text-gray-300 mb-6">
              Limited time offer! Add some furry friends to your collection with our premium animal stickers.
            </p>
            <div className="flex gap-4 flex-wrap">
              <div className="bg-dark p-3 rounded-lg flex items-center justify-center min-w-[60px]">
                <div className="text-center">
                  <span className="block text-2xl font-bold text-white">{time.hours.toString().padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">Hours</span>
                </div>
              </div>
              <div className="bg-dark p-3 rounded-lg flex items-center justify-center min-w-[60px]">
                <div className="text-center">
                  <span className="block text-2xl font-bold text-white">{time.minutes.toString().padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">Minutes</span>
                </div>
              </div>
              <div className="bg-dark p-3 rounded-lg flex items-center justify-center min-w-[60px]">
                <div className="text-center">
                  <span className="block text-2xl font-bold text-white">{time.seconds.toString().padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">Seconds</span>
                </div>
              </div>
              <Link href="/products/animals">
                <Button className="bg-neon-purple hover:bg-opacity-80 text-white font-bold px-6 py-3 rounded-lg ml-auto md:ml-4 neon-button shadow-neon-purple">
                  Shop Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Background glow effects */}
        <div className="absolute -bottom-10 right-10 w-64 h-64 bg-neon-yellow rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-neon-purple rounded-full opacity-20 blur-3xl"></div>
      </div>
    </section>
  );
}
