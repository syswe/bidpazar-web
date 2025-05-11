import React, { useState } from 'react';
import ProductDisplay from './ProductDisplay';
import CreateProductForm from './CreateProductForm';
import { Timer } from 'lucide-react';
import { ActiveBid } from '../hooks/useActiveBid';
import { useRouter } from 'next/navigation';

interface ProductSectionProps {
  streamId: string;
  isStreamer: boolean;
  activeProductBid: ActiveBid | null;
  fetchActiveBid: () => Promise<void>;
  user: any; // User object or null
}

const ProductSection = ({ 
  streamId, 
  isStreamer, 
  activeProductBid,
  fetchActiveBid,
  user
}: ProductSectionProps) => {
  const [showCreateProduct, setShowCreateProduct] = useState<boolean>(false);
  const router = useRouter();

  const handleCreateProduct = () => {
    setShowCreateProduct(true);
  };

  if (isStreamer) {
    return (
      <div className="product-container">
        {showCreateProduct ? (
          <CreateProductForm
            streamId={streamId}
            onCancel={() => setShowCreateProduct(false)}
            onSuccess={() => {
              setShowCreateProduct(false);
              // Refresh active bids after creating a new product
              fetchActiveBid();
            }}
          />
        ) : (
          <div className="flex flex-col space-y-2">
            <ProductDisplay
              streamId={streamId}
              className="pointer-events-auto"
              onBidClick={() => {}}
            />
            <button
              onClick={handleCreateProduct}
              className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-md text-sm font-medium"
            >
              Create New Product Bid
            </button>
          </div>
        )}
      </div>
    );
  }

  // Viewer view - only show product when there's an active bid
  if (activeProductBid?.isActive) {
    return (
      <div className="product-container">
        <div className="relative">
          <ProductDisplay
            streamId={streamId}
            className="pointer-events-auto"
            onBidClick={() =>
              user
                ? null // Handle showing bidding interface
                : router.push("/login")
            }
          />
          {activeProductBid.timeRemaining > 0 && (
            <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center">
              <Timer className="h-3 w-3 mr-1" />
              {activeProductBid.timeRemaining}s
            </div>
          )}
        </div>
      </div>
    );
  }

  // No active product to show
  return null;
};

export default ProductSection; 