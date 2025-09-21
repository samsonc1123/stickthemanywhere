import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setEmail("");
      toast({
        title: "Subscribed successfully!",
        description: "You'll receive exclusive discounts and monthly free stickers!",
      });
    }, 1000);
  };

  return (
    <section className="mb-16">
      <div className="relative rounded-xl overflow-hidden">
        <div className="bg-dark-gray p-8 md:p-12 rounded-xl relative z-10 flex flex-col md:flex-row items-center justify-between">
          <div className="max-w-md mb-6 md:mb-0">
            <h2 className="text-2xl md:text-3xl font-bold font-poppins mb-3">
              <span className="text-white">Join Our </span>
              <span className="text-neon-blue text-glow-blue">Sticker Club</span>
            </h2>
            <p className="text-gray-300">
              Subscribe to get exclusive discounts, early access to new releases, and monthly free stickers!
            </p>
          </div>
          <form onSubmit={handleSubscribe} className="w-full md:w-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input 
                type="email" 
                placeholder="Your email address" 
                className="bg-light-gray text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-neon-blue min-w-[240px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button 
                type="submit"
                className="bg-neon-blue hover:bg-opacity-80 text-black font-bold px-6 py-3 rounded-lg neon-button shadow-neon-blue"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Subscribing..." : "Subscribe"}
              </Button>
            </div>
          </form>
        </div>
        
        {/* Background glow effects */}
        <div className="absolute -bottom-10 left-10 w-64 h-64 bg-neon-blue rounded-full opacity-20 blur-3xl"></div>
      </div>
    </section>
  );
}
