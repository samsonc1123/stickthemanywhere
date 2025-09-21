import kittenImage from "@assets/generated_images/Cute_neon_cat_sticker_b705b868.png";

export default function FloatingKitten() {
  return (
    <img 
      src={kittenImage} 
      alt="floating kitten" 
      style={{ 
        height: '2rem',
        position: 'absolute',
        top: '-0.8rem',
        right: '-2.2rem',
        filter: 'drop-shadow(0 0 6px white)'
      }} 
    />
  );
}