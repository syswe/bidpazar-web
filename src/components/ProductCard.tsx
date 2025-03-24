import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/lib/api';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  // Ürün resmi varsa ilkini al, yoksa placeholder kullan
  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].url
    : '/images/product-placeholder.jpg';

  // Fiyatı Türk Lirası formatında göster
  const formattedPrice = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  }).format(product.price);

  return (
    <div className="card hover:shadow-lg rounded-lg overflow-hidden">
      <Link href={`/products/${product.id}`}>
        <div className="relative h-48 w-full">
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
              {product.title}
            </h3>
            <span className="text-xs bg-[var(--secondary)] text-[var(--foreground)] px-2 py-1 rounded-full whitespace-nowrap ml-1">
              {product.category?.name || 'Kategori Yok'}
            </span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mb-3 line-clamp-2">
            {product.description}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-[var(--primary)]">
              {formattedPrice}
            </span>
            {product.user && (
              <span className="text-xs text-[var(--muted-foreground)]">
                {product.user.username}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
} 