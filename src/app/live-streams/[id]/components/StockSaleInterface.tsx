"use client";

import React, { useState } from "react";
import { Package, Loader2, X, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { getAuth } from "@/lib/frontend-auth";
import { useRouter } from "next/navigation";
import { ProductBid } from "../hooks/useActiveBid";

interface StockSaleInterfaceProps {
  streamId: string;
  activeProductBid: ProductBid;
  onClose: () => void;
  onPurchaseSuccess: () => void;
}

const StockSaleInterface: React.FC<StockSaleInterfaceProps> = ({
  streamId,
  activeProductBid,
  onClose,
  onPurchaseSuccess,
}) => {
  const router = useRouter();
  const { token, user } = getAuth();
  const isAuthenticated = !!user && !!token;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format price with Turkish Lira
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Handle purchase
  const handlePurchase = async () => {
    if (!isAuthenticated) {
      toast.error("Satın almak için giriş yapmalısınız");
      router.push("/login");
      return;
    }

    if (activeProductBid.product.stock <= 0) {
      toast.error("Bu ürün stokta kalmamış");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/live-streams/${streamId}/product/${activeProductBid.id}/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quantity: 1, // For now, always purchase 1 item
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Satın alma işlemi başarısız");
      }

      const result = await response.json();

      // Show success message
      toast.success("Ürün başarıyla satın alındı!");

      // Emit socket event for real-time update
      if ((window as any).streamChatSocket) {
        (window as any).streamChatSocket.emit("purchase-stock-sale", {
          streamId,
          productId: activeProductBid.id,
          userId: user?.id,
          username: user?.username,
          quantity: 1,
          totalPrice: activeProductBid.product.currentPrice,
        });
      }

      onPurchaseSuccess();
      onClose();
    } catch (error) {
      console.error("Error purchasing product:", error);
      toast.error(error instanceof Error ? error.message : "Satın alma işlemi başarısız");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 backdrop-blur-md rounded-lg p-4 shadow-lg max-w-sm w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold text-lg">Satın Al</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Product info */}
          <div className="text-center">
            <h4 className="text-white font-medium text-sm mb-1">
              {activeProductBid.product.name}
            </h4>
            {activeProductBid.product.description && (
              <p className="text-white/70 text-xs">
                {activeProductBid.product.description}
              </p>
            )}
          </div>

          {/* Stock info */}
          <div className="flex justify-between items-center bg-black/30 rounded p-2">
            <span className="text-white/80 text-sm">Stok:</span>
            <span className="text-white font-semibold text-sm flex items-center">
              <Package className="w-4 h-4 mr-1 text-blue-400" />
              {activeProductBid.product.stock} adet
            </span>
          </div>

          {/* Price info */}
          <div className="flex justify-between items-center bg-black/30 rounded p-2">
            <span className="text-white/80 text-sm">Fiyat:</span>
            <span className="text-white font-semibold text-sm">
              {formatPrice(activeProductBid.product.currentPrice)}
            </span>
          </div>

          {/* Purchase button */}
          <button
            onClick={handlePurchase}
            disabled={
              isSubmitting ||
              activeProductBid.product.stock <= 0 ||
              !isAuthenticated
            }
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : activeProductBid.product.stock <= 0 ? (
              "Stokta Yok"
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                {formatPrice(activeProductBid.product.currentPrice)} Satın Al
              </>
            )}
          </button>

          {/* Info text */}
          <p className="text-white/60 text-xs text-center">
            {activeProductBid.product.stock > 0
              ? "Satın alma işlemi geri alınamaz"
              : "Bu ürün stokta kalmamış"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockSaleInterface; 