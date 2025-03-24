import { Product } from '@/lib/api';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
}

export default function ProductGrid({ products, emptyMessage = 'Henüz ürün bulunmuyor.' }: ProductGridProps) {
  if (!products || products.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-[var(--secondary)] text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
} 