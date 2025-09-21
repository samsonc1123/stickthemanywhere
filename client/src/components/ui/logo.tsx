import { Link } from "wouter";

interface LogoProps {
  size?: "sm" | "md" | "lg";
}

export function Logo({ size = "md" }: LogoProps) {
  const textSizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl"
  };

  return (
    <Link href="/">
      <div className={`flex items-center gap-3 font-bold font-poppins text-white ${textSizeClasses[size]} cursor-pointer`}>
        <div className="flex">
          <span className="text-glow-blue">Stick</span>
          <span className="text-neon-pink text-glow-pink">Them</span>
          <span className="text-glow-blue">Anywhere</span>
        </div>
      </div>
    </Link>
  );
}
