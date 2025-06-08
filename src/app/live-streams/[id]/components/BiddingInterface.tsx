"use client";

import React, { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  CircleDollarSign,
  ChevronUp,
  ChevronDown,
  Loader2,
  Clock,
} from "lucide-react";
import { getAuth } from "@/lib/frontend-auth";
import { useRouter } from "next/navigation";

interface BiddingInterfaceProps {
  streamId: string;
  auctionId: string;
  currentPrice: number;
  highestBidder?: string | null;
  currentUsername?: string;
  onBidPlaced: () => void;
  countdownEnd?: string | null;
}

const BiddingInterface: React.FC<BiddingInterfaceProps> = ({
  streamId,
  auctionId,
  currentPrice,
  highestBidder,
  currentUsername,
  onBidPlaced,
  countdownEnd,
}) => {
  const router = useRouter();
  const { token, user } = getAuth();
  const isAuthenticated = !!user && !!token;
  const [bidAmount, setBidAmount] = useState(currentPrice + 10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const isHighestBidder = highestBidder === currentUsername;

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
    if (!countdownEnd) return;

    const endTime = new Date(countdownEnd).getTime();

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
  }, [countdownEnd]);

  // Increment/decrement bid amount
  const adjustBid = useCallback(
    (amount: number) => {
      setBidAmount((prev) => Math.max(currentPrice + 1, prev + amount));
    },
    [currentPrice]
  );

  // Place bid
  const placeBid = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error("Teklif vermek için giriş yapmalısınız");
      router.push("/login");
      return;
    }

    if (bidAmount <= currentPrice) {
      toast.error(`Teklif en az ${formatPrice(currentPrice + 1)} olmalıdır`);
      setBidAmount(currentPrice + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/live-streams/${streamId}/active-bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: bidAmount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Teklif verilemedi");
      }

      toast.success("Teklif başarıyla verildi!");
      onBidPlaced();
    } catch (error) {
      console.error("Error placing bid:", error);
      toast.error(error instanceof Error ? error.message : "Teklif verilemedi");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    bidAmount,
    currentPrice,
    isAuthenticated,
    onBidPlaced,
    router,
    streamId,
    token,
  ]);

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-lg p-3 shadow-lg">
      <div className="flex flex-col gap-2">
        {/* Timer */}
        {timeLeft !== null && (
          <div className="flex justify-between items-center">
            <span className="text-white/80 text-xs">Kalan süre:</span>
            <span
              className={`flex items-center font-mono text-sm ${
                timeLeft < 10 ? "text-red-400" : "text-white"
              }`}
            >
              <Clock
                className={`w-3.5 h-3.5 mr-1 ${
                  timeLeft < 10 ? "text-red-400" : "text-white/70"
                }`}
              />
              {timeLeft} saniye
            </span>
          </div>
        )}

        {/* Current bid info */}
        <div className="flex justify-between items-center">
          <span className="text-white/80 text-xs">Şu anki teklif:</span>
          <span className="text-white font-semibold text-sm flex items-center">
            <CircleDollarSign className="w-3.5 h-3.5 mr-1 text-[var(--accent)]" />
            {formatPrice(currentPrice)}
          </span>
        </div>

        {/* Highest bidder info */}
        {highestBidder && (
          <div className="flex justify-between items-center">
            <span className="text-white/80 text-xs">
              En yüksek teklif veren:
            </span>
            <span className="text-white text-xs">
              {isHighestBidder ? "Siz" : highestBidder}
            </span>
          </div>
        )}

        {/* Bid amount controls */}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 relative">
            <input
              type="number"
              value={bidAmount}
              onChange={(e) =>
                setBidAmount(Math.max(currentPrice + 1, Number(e.target.value)))
              }
              className="w-full p-2 pl-6 text-sm bg-black/60 border border-white/20 rounded text-white"
              disabled={isSubmitting}
              min={currentPrice + 1}
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70">
              ₺
            </span>
          </div>

          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => adjustBid(10)}
              className="bg-black/40 text-white p-1 rounded-t border border-white/20"
              disabled={isSubmitting}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustBid(-10)}
              className="bg-black/40 text-white p-1 rounded-b border-t-0 border border-white/20"
              disabled={isSubmitting || bidAmount <= currentPrice + 10}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Place bid button */}
        <button
          onClick={placeBid}
          disabled={isSubmitting || isHighestBidder}
          className={`w-full py-2 rounded text-sm font-medium mt-2 flex justify-center items-center
            ${
              isHighestBidder
                ? "bg-green-500/30 text-green-300 cursor-not-allowed"
                : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
            }`}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isHighestBidder ? (
            "En yüksek teklif sizde"
          ) : (
            "Teklif Ver"
          )}
        </button>
      </div>
    </div>
  );
};

export default BiddingInterface;
