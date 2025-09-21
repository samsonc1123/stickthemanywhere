import React from 'react';

interface SubcategoriesBarProps {
  selectedSubcategory: string | null;
  onSubcategorySelect: (subcategory: string | null) => void;
}

const subcategories = [
  { id: 'flowers', name: 'Flowers' },
  { id: 'scripture', name: 'Scripture' },
  { id: 'god', name: 'God' },
  { id: 'one-liners', name: 'One-liners' }
  // Removed: { id: 'all-christian', name: 'All Christian' }
];

const SubcategoriesBar: React.FC<SubcategoriesBarProps> = ({ selectedSubcategory, onSubcategorySelect }) => {
  const handleSubcategorySelect = (subcategoryId: string) => {
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    onSubcategorySelect(subcategory ? subcategory.name : null);
  };

  return (
    <div className="subcategory-scroll">
      {subcategories.map((subcategory) => (
        <button
          key={subcategory.id}
          className="neon-subcategory-button"
          onClick={() => handleSubcategorySelect(subcategory.id)}
        >
          {subcategory.name}
        </button>
      ))}
    </div>
  );
};

export default SubcategoriesBar;