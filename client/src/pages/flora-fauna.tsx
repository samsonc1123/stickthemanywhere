import React from 'react';
import './FloraFaunaPage.css';

const subcategories = [
  { name: 'Roses', className: 'pink' },
  { name: 'Orchids', className: 'yellow' },
  { name: 'Lilies', className: 'green' },
  { name: 'Daisies', className: 'blue' },
  { name: 'Hydrangeas', className: 'purple' },
];

const stickers = [
  { id: 1, image: '/assets/stickers/flora/sticker1.png' },
  { id: 2, image: '/assets/stickers/flora/sticker2.png' },
  { id: 3, image: '/assets/stickers/flora/sticker3.png' },
  { id: 4, image: '/assets/stickers/flora/sticker4.png' },
  { id: 5, image: '/assets/stickers/flora/sticker5.png' },
];

export default function FloraFaunaPage() {
  console.log('FloraFaunaPage component loaded!'); // Debug log
  return (
    <div className="flora-fauna-page">
      <div className="starfield"></div>

      <h1 className="main-header">
        <span className="white-neon">Stick</span>
        <span className="pink-neon">Them</span>
        <span className="white-neon anywhere-word">
          Anywhere
          <img src="/assets/kitten-floating.png" className="kitten-icon" alt="Kitten" />
        </span>
      </h1>

      <h2 className="subcategory-header">Floral</h2>

      <div className="subcategory-bar">
        {subcategories.map((sub, i) => (
          <button key={i} className={`category-btn ${sub.className}`}>
            {sub.name}
          </button>
        ))}
      </div>

      <div className="sticker-grid">
        {[...Array(10)].map((_, i) => (
          <div className="sticker-box" key={i + 1}>
            <span>Sticker {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}