import { useState, useEffect } from 'react';
import { Category, getCategories } from '@/lib/api';

interface CategoryFilterProps {
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}

export default function CategoryFilter({ selectedCategoryId, onCategoryChange }: CategoryFilterProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const data = await getCategories();
        setCategories(data);
        setError(null);
      } catch (err) {
        setError('Kategoriler yüklenirken bir hata oluştu.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (isLoading) {
    return <div className="animate-pulse h-10 bg-[var(--secondary)] rounded-md w-full"></div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm">{error}</div>;
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-[var(--foreground)]">Kategoriler</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategoryId === null
            ? 'bg-[var(--primary)] text-white'
            : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--highlight)]'
            }`}
        >
          Tümü
        </button>

        {Array.isArray(categories) && categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${selectedCategoryId === category.id
              ? 'bg-[var(--primary)] text-white'
              : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--highlight)]'
              }`}
          >
            {category.emoji && <span className="text-base">{category.emoji}</span>}
            <span>{category.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
} 