"use client";

import { useEffect, useState } from "react";

interface Product {
  id: string;
  liveStreamId: string;
  name: string;
  description: string;
  imageUrl?: string;
  currentBid?: number;
  startingBid: number;
}

interface ProductDisplayProps {
  streamId: string;
}

export default function ProductDisplay({ streamId }: ProductDisplayProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const response = await fetch(`/api/live-streams/${streamId}/product`);

        if (!response.ok) {
          throw new Error('Failed to fetch product');
        }

        const data = await response.json();
        setProduct(data);
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Failed to load product information');
      } finally {
        setLoading(false);
      }
    }

    if (streamId) {
      fetchProduct();
    }
  }, [streamId]);

  if (loading) {
    return <div className="animate-pulse p-4">Loading product...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!product) {
    return <div>No active product for this stream</div>;
  }

  return (
    <div className="flex flex-col">
      {product.imageUrl && (
        <div className="mb-3">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-40 object-cover rounded-md"
          />
        </div>
      )}

      <h3 className="font-semibold text-lg">{product.name}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{product.description}</p>

      <div className="flex justify-between items-center mt-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Current bid:</span>
        <span className="text-lg font-bold text-green-600 dark:text-green-400">
          ${product.currentBid || product.startingBid}
        </span>
      </div>
    </div>
  );
} 