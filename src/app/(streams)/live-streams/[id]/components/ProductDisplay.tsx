"use client";

import { useEffect, useState } from "react";
import { ArrowUp, DollarSign, Clock, AlertCircle, Loader2, Info, Tag } from "lucide-react";

interface Product {
  id: string;
  streamId: string;
  name: string;
  description: string;
  imageUrl?: string;
  currentBid?: number;
  startingPrice: number;
  productId?: string;
  countdownEnd?: string;
}

interface ProductDisplayProps {
  streamId: string;
  className?: string;
  onBidClick?: () => void;
}

export default function ProductDisplay({ streamId, className = "", onBidClick }: ProductDisplayProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdownTime, setCountdownTime] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!product?.countdownEnd) return;
    
    const intervalId = setInterval(() => {
      const endTime = new Date(product.countdownEnd!).getTime();
      const now = new Date().getTime();
      const distance = endTime - now;
      
      if (distance <= 0) {
        clearInterval(intervalId);
        setCountdownTime(0);
      } else {
        setCountdownTime(Math.floor(distance / 1000));
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [product?.countdownEnd]);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/live-streams/${streamId}/product`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("No active product for this stream");
          } else {
            throw new Error(`Failed to fetch product (${response.status})`);
          }
          setLoading(false);
          return;
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

  const formatTimeLeft = (seconds: number): string => {
    if (!seconds || seconds <= 0) return "Ended";
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={`p-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg ${className}`}>
        <div className="flex justify-center items-center py-4">
          <Loader2 className="w-5 h-5 text-accent animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading product...</span>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if error message is about no active product
    if (error.includes("No active product")) {
      return (
        <div className={`p-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg ${className}`}>
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <Info className="w-4 h-4 mr-2" />
            <span>No active product for this auction</span>
          </div>
        </div>
      );
    }
    
    return (
      <div className={`p-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg ${className}`}>
        <div className="flex items-start text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`p-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg ${className}`}>
        <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
          <Info className="w-4 h-4 mr-2" />
          <span>No active product</span>
        </div>
      </div>
    );
  }

  const productName = product.name || "Product";

  return (
    <div className={`bg-background/90 backdrop-blur-sm border border-border rounded-lg overflow-hidden transition-all duration-300 ${className}`}>
      <div className="p-3">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-medium text-sm truncate">{productName}</h3>
          
          {countdownTime !== null && (
            <div className="flex items-center bg-muted px-2 py-1 rounded text-xs ml-2 flex-shrink-0">
              <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
              <span className={countdownTime < 60 ? 'text-red-500 font-medium' : ''}>
                {formatTimeLeft(countdownTime)}
              </span>
            </div>
          )}
        </div>
        
        {product.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Tag className="w-3 h-3 mr-1 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Current bid:</span>
          </div>
          <span className="font-bold text-accent text-sm">
            <DollarSign className="w-3 h-3 inline mr-0.5" />
            {product.currentBid || product.startingPrice}
          </span>
        </div>
      </div>
      
      {onBidClick && (
        <button 
          onClick={onBidClick}
          className="w-full py-2 bg-accent text-accent-foreground font-medium text-sm flex items-center justify-center"
        >
          <ArrowUp className="w-4 h-4 mr-1" /> Place a Bid
        </button>
      )}
    </div>
  );
} 