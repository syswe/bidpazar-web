"use client";

import React, { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  CircleDollarSign,
  ChevronUp,
  ChevronDown,
  Loader2,
  Clock,
  X,
} from "lucide-react";
import { getAuth } from "@/lib/frontend-auth";
import { useRouter } from "next/navigation";
import { ProductBid } from "../hooks/useActiveBid";

interface BiddingInterfaceProps {
  streamId: string;
  activeProductBid: ProductBid;
  onClose: () => void;
  onBidSuccess: () => void;
}

const BiddingInterface: React.FC<BiddingInterfaceProps> = ({
  streamId,
  activeProductBid,
  onClose,
  onBidSuccess,
}) => {
  const router = useRouter();
  const { token, user } = getAuth();
  const isAuthenticated = !!user && !!token;
  const [bidAmount, setBidAmount] = useState(
    activeProductBid.product.currentPrice + 10
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const isHighestBidder = activeProductBid.highestBidder === user?.username;

  // Format price with Turkish Lira
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Update time remaining
  useEffect(() => {
    if (!activeProductBid.countdownEnd) return;

    const endTime = new Date(activeProductBid.countdownEnd).getTime();

    const updateTimeLeft = () => {
      const now = new Date().getTime();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft(0);
        return;
      }

      setTimeLeft(Math.floor(diff / 1000));
    };

    // Update immediately
    updateTimeLeft();

    // Then update every second
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [activeProductBid.countdownEnd]);

  // Increment/decrement bid amount
  const adjustBid = useCallback(
    (amount: number) => {
      setBidAmount((prev) =>
        Math.max(activeProductBid.product.currentPrice + 1, prev + amount)
      );
    },
    [activeProductBid.product.currentPrice]
  );

  // Place bid
  const placeBid = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error("Teklif vermek için giriş yapmalısınız");
      router.push("/login");
      return;
    }

    if (bidAmount <= activeProductBid.product.currentPrice) {
      toast.error(
        `Teklif en az ${formatPrice(
          activeProductBid.product.currentPrice + 1
        )} olmalıdır`
      );
      setBidAmount(activeProductBid.product.currentPrice + 1);
      return;
    }

    if (timeLeft === 0) {
      toast.error("Açık arttırma süresi dolmuş");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/live-streams/${streamId}/product/${activeProductBid.id}/bid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: bidAmount,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Teklif verilemedi");
      }

      const result = await response.json();

      // Show success message
      toast.success("Teklif başarıyla verildi!");

      // Emit socket event for real-time bid update
      if ((window as any).streamChatSocket) {
        (window as any).streamChatSocket.emit("place-bid", {
          streamId,
          listingId: activeProductBid.id,
          amount: bidAmount,
          userId: user?.id,
          username: user?.username,
        });
      }

      onBidSuccess();
      onClose();
    } catch (error) {
      console.error("Error placing bid:", error);
      toast.error(error instanceof Error ? error.message : "Teklif verilemedi");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    bidAmount,
    activeProductBid.product.currentPrice,
    activeProductBid.id,
    isAuthenticated,
    onBidSuccess,
    onClose,
    router,
    streamId,
    token,
    timeLeft,
    user?.id,
    user?.username,
  ]);

  // Listen for auction end events
  useEffect(() => {
    const socket = (window as any).streamChatSocket;
    if (!socket) return;

    const handleAuctionEnd = (data: any) => {
      if (data.productId === activeProductBid.id) {
        const isWinner = data.winnerId === user?.id;
        // For seller check, we'll rely on the notification data from server
        const isSeller = data.sellerId === user?.id;

        if (isWinner) {
          toast.success(
            `🎉 Tebrikler! "${activeProductBid.product.name}" ürününü kazandınız!`,
            {
              duration: 8000,
              description: `Winning bid: ₺${data.winningAmount}`,
            }
          );
        } else if (isSeller && data.winnerId) {
          toast.success(`💰 "${activeProductBid.product.name}" satıldı!`, {
            duration: 8000,
            description: `Sold for: ₺${data.winningAmount} to @${data.winnerUsername}`,
          });
        } else if (data.winnerId && !isWinner) {
          toast.info(
            `"${activeProductBid.product.name}" başka bir kullanıcı tarafından kazanıldı.`,
            {
              duration: 5000,
              description: `Winner: @${data.winnerUsername}`,
            }
          );
        }

        // Close bidding interface
        onClose();
      }
    };

    socket.on("auction-ended", handleAuctionEnd);
    socket.on("live-product-ended", handleAuctionEnd);

    return () => {
      socket.off("auction-ended", handleAuctionEnd);
      socket.off("live-product-ended", handleAuctionEnd);
    };
  }, [activeProductBid.id, user?.id, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 backdrop-blur-md rounded-lg p-4 shadow-lg max-w-sm w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold text-lg">Teklif Ver</h3>
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

          {/* Timer */}
          {timeLeft !== null && (
            <div className="flex justify-between items-center bg-black/30 rounded p-2">
              <span className="text-white/80 text-sm">Kalan süre:</span>
              <span
                className={`flex items-center font-mono text-sm ${
                  timeLeft < 10 ? "text-red-400 animate-pulse" : "text-white"
                }`}
              >
                <Clock
                  className={`w-4 h-4 mr-1 ${
                    timeLeft < 10 ? "text-red-400" : "text-white/70"
                  }`}
                />
                {timeLeft} saniye
              </span>
            </div>
          )}

          {/* Current bid info */}
          <div className="flex justify-between items-center bg-black/30 rounded p-2">
            <span className="text-white/80 text-sm">Şu anki teklif:</span>
            <span className="text-white font-semibold text-sm flex items-center">
              <CircleDollarSign className="w-4 h-4 mr-1 text-[var(--accent)]" />
              {formatPrice(activeProductBid.product.currentPrice)}
            </span>
          </div>

          {/* Highest bidder info */}
          {activeProductBid.highestBidder && (
            <div className="flex justify-between items-center bg-black/30 rounded p-2">
              <span className="text-white/80 text-sm">
                En yüksek teklif veren:
              </span>
              <span className="text-white text-sm">
                {isHighestBidder ? "Siz" : `@${activeProductBid.highestBidder}`}
              </span>
            </div>
          )}

          {/* Bid amount controls */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) =>
                    setBidAmount(
                      Math.max(
                        activeProductBid.product.currentPrice + 1,
                        Number(e.target.value)
                      )
                    )
                  }
                  className="w-full p-3 pl-8 text-sm bg-black/60 border border-white/20 rounded text-white"
                  disabled={isSubmitting || timeLeft === 0}
                  min={activeProductBid.product.currentPrice + 1}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70">
                  ₺
                </span>
              </div>

              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => adjustBid(10)}
                  className="p-1 text-white/70 hover:text-white disabled:opacity-50"
                  disabled={isSubmitting || timeLeft === 0}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustBid(-10)}
                  className="p-1 text-white/70 hover:text-white disabled:opacity-50"
                  disabled={isSubmitting || timeLeft === 0}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick bid buttons */}
            <div className="flex gap-2">
              {[10, 25, 50].map((increment) => (
                <button
                  key={increment}
                  type="button"
                  onClick={() =>
                    setBidAmount(
                      activeProductBid.product.currentPrice + increment
                    )
                  }
                  className="flex-1 py-2 px-3 text-xs bg-black/40 border border-white/20 rounded text-white hover:bg-black/60 transition-colors disabled:opacity-50"
                  disabled={isSubmitting || timeLeft === 0}
                >
                  +{increment}₺
                </button>
              ))}
            </div>
          </div>

          {/* Place bid button */}
          <button
            onClick={placeBid}
            disabled={
              isSubmitting ||
              bidAmount <= activeProductBid.product.currentPrice ||
              timeLeft === 0
            }
            className="w-full py-3 bg-[var(--accent)] text-white rounded-lg font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CircleDollarSign className="w-4 h-4" />
            )}
            {isSubmitting
              ? "Teklif Veriliyor..."
              : timeLeft === 0
              ? "Süre Doldu"
              : `${formatPrice(bidAmount)} Teklif Ver`}
          </button>

          {/* Info text */}
          <p className="text-white/60 text-xs text-center">
            Teklifiniz {formatPrice(bidAmount)} tutarında olacak
          </p>
        </div>
      </div>
    </div>
  );
};

export default BiddingInterface;
