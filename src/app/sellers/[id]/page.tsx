'use client';

import { use, useEffect, useState } from 'react';
import SellerProfileHeader from '@/components/sellers/SellerProfileHeader';
import ProductCard from '@/components/ProductCard';
import { Package, Search } from 'lucide-react';
import { getToken } from '@/lib/frontend-auth';

interface Seller {
  id: string;
  username: string;
  name?: string | null;
  isVerified: boolean;
  isPopularStreamer?: boolean;
  isFavoriteSeller?: boolean;
  profileImageUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  _count?: {
    products: number;
  };
}

interface Product {
  id: string;
  title: string;
  price: number;
  buyNowPrice?: number;
  images: { url: string }[];
  category: { name: string };
  user: {
    username: string;
    userType: string;
  };
  createdAt: string;
}

export default function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Get token using the proper function from frontend-auth
        const token = getToken();

        // Fetch seller details
        const sellerRes = await fetch(`/api/users/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!sellerRes.ok) {
          if (sellerRes.status === 404) throw new Error('Satıcı bulunamadı');
          throw new Error('Satıcı bilgileri alınamadı');
        }

        const sellerData = await sellerRes.json();
        setSeller(sellerData);

        // If the API returned isFollowing field (even if false), user is authenticated
        if (sellerData.isFollowing !== undefined) {
          setCurrentUser({ id: 'authenticated' });
        }

        // Fetch seller products (only active)
        const productsRes = await fetch(`/api/products?userId=${id}`);
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(productsData);
        }

      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Bir hata oluştu');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Hata</h1>
        <p className="text-[var(--foreground)] opacity-70">{error || 'Satıcı bulunamadı'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-16">
      <SellerProfileHeader seller={seller} currentUser={currentUser} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Package className="w-5 h-5" />
            Satıcının Ürünleri
            <span className="text-sm font-normal text-[var(--foreground)] opacity-50 ml-2">
              ({products.length})
            </span>
          </h2>

          {/* Filter/Sort could go here */}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 bg-[var(--secondary)] rounded-2xl border border-[var(--border)]">
            <div className="bg-[var(--background)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Search className="w-8 h-8 text-[var(--foreground)] opacity-30" />
            </div>
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-1">Ürün Bulunamadı</h3>
            <p className="text-[var(--foreground)] opacity-60">Bu satıcının henüz aktif bir ürünü bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product as any} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
