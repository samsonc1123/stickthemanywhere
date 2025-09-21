import { Link } from "wouter";
import CategoryPageTemplate from '../components/CategoryPageTemplate';
import { gamingCategory } from '../stickers/categories';

export default function GamingPage() {
  const handleSubcategoryClick = (subcategory: string) => {
    if (subcategory === 'Mario') {
      // Navigation handled by Link in subcategory buttons
      window.location.href = '/mario';
    }
  };

  return (
    <CategoryPageTemplate 
      categoryData={gamingCategory}
      onSubcategoryClick={handleSubcategoryClick}
    />
  );
}