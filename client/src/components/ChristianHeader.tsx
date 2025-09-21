import React from 'react';
import kitten from '@assets/new-cat-sticker.png';

const ChristianHeader = () => {
  return (
    <div className="header-container">
      <h1 className="title">
        <span className="neon-white">Stick</span>
        <span className="neon-pink">Them</span>
        <span className="neon-white anywhere-word">Anywhere</span>
        <img src={kitten} alt="bouncing kitten" className="kitten" />
      </h1>
    </div>
  );
};

export default ChristianHeader;