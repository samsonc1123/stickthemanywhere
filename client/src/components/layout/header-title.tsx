import React from "react";

export default function Header() {
  return (
    <div className="text-center font-orbitron mt-6 mb-4">
      <h1 className="text-4xl font-bold text-white">Stick</h1>
      <h1 className="text-4xl font-bold text-neon-pink">Them</h1>
      <h1 className="text-4xl font-bold text-white relative inline-block">
        Anywhere
        <img
          src="/attached_assets/kitten.png"
          alt="kitten"
          className="absolute top-0 right-[-30px] h-8 w-8 animate-bounce"
        />
      </h1>
    </div>
  );
}