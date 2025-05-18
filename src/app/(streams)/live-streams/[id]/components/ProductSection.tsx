import React, { useState, useEffect } from "react";
import { Timer, CircleDollarSign, X, Loader2, Clock } from "lucide-react";
import { ProductBid } from "../hooks/useActiveBid";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAuth } from "@/lib/frontend-auth";
import AddProductAuction from "./AddProductAuction";
import BiddingInterface from "./BiddingInterface";

interface ProductSectionProps {
  streamId: string;
  isStreamer: boolean;
  activeProductBid: ProductBid | null;
  fetchActiveBid: () => void;
  user: any; // User object or null
  socket?: any; // Socket object for real-time communication
}

const ProductSection: React.FC<ProductSectionProps> = ({
  streamId,
  isStreamer,
  activeProductBid,
  fetchActiveBid,
  user,
  socket,
}) => {
  const router = useRouter();
  const { token } = getAuth();
  const [showBidInterface, setShowBidInterface] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Format price with Turkish Lira
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Update countdown timer
  useEffect(() => {
    if (!activeProductBid || !activeProductBid.countdownEnd) return;

    const endTime = new Date(activeProductBid.countdownEnd).getTime();

    const updateTimeLeft = () => {
      const now = new Date().getTime();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft(0);
        // If auction is still active and time has expired, end it automatically
        if (isStreamer && activeProductBid && diff <= -1000 && diff >= -5000) {
          handleEndAuction();
        }
        return;
      }

      setTimeLeft(Math.floor(diff / 1000));
    };

    // Update immediately
    updateTimeLeft();

    // Then update every second
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [activeProductBid, isStreamer]);

  // Handle ending the auction
  const handleEndAuction = async () => {
    if (!activeProductBid || !token) return;

    try {
      const response = await fetch(
        `/api/live-streams/${streamId}/auction-end`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            listingId: activeProductBid.id,
          }),
        }
      );

      if (response.ok) {
        // Notify via socket if available
        if (socket) {
          socket.emit("countdown-ended", {
            streamId,
            listingId: activeProductBid.id,
          });
        }

        toast.success("Açık arttırma sonlandırıldı");
        fetchActiveBid();
      }
    } catch (error) {
      console.error("Error ending auction:", error);
    }
  };

  // RENDERING LOGIC

  // If streamer with no active product auction, show the add auction button/form
  if (isStreamer && !activeProductBid) {
    return (
      <div className="streamer-product-controls">
        <AddProductAuction
          streamId={streamId}
          onSuccess={fetchActiveBid}
          socket={socket}
        />
      </div>
    );
  }

  // If there's an active product auction, show it to everyone (even non-authenticated users)
  if (activeProductBid) {
    const { product } = activeProductBid;

    return (
      <div className="flex flex-col gap-3">
        {/* Auction product card */}
        <div className="p-3 rounded-lg bg-black/50 backdrop-blur-sm shadow flex flex-col gap-2 max-w-[240px]">
          {/* Countdown timer - visible to everyone */}
          {timeLeft !== null && (
            <div className="flex justify-between items-center mb-1">
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

          {/* Product info */}
          <div className="flex items-center gap-3">
            {product.imageUrl && (
              <div className="w-12 h-12 rounded bg-black/30 overflow-hidden flex-shrink-0">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium text-sm truncate">
                {product.name}
              </h4>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center text-[var(--accent)] text-xs font-bold">
                  <CircleDollarSign className="w-3 h-3 mr-0.5" />
                  {formatPrice(product.currentPrice)}
                </div>
                <span className="text-white/70 text-xs flex items-center">
                  <Timer className="w-3 h-3 mr-0.5" />
                  {activeProductBid.bidCount || 0} teklif
                </span>
              </div>
            </div>
          </div>

          {/* Place bid button for authenticated non-streamers */}
          {user && !isStreamer && (
            <button
              onClick={() => setShowBidInterface(!showBidInterface)}
              className="w-full py-1.5 text-xs bg-[var(--accent)] text-white rounded font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Teklif Ver
            </button>
          )}

          {/* Streamer controls for active auctions */}
          {isStreamer && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleEndAuction}
                className="flex-1 py-1.5 bg-red-500/70 text-white text-xs rounded hover:bg-red-500/90 transition-colors"
              >
                Arttırmayı Sonlandır
              </button>
            </div>
          )}

          {/* Login reminder for unauthenticated users */}
          {!user && (
            <button
              onClick={() => router.push("/login")}
              className="w-full py-1.5 text-xs bg-black/50 text-white/90 border border-white/20 rounded font-medium hover:bg-black/70 transition-colors"
            >
              Teklif vermek için giriş yapın
            </button>
          )}
        </div>

        {/* Bidding interface when active */}
        {showBidInterface && user && !isStreamer && (
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-white text-xs font-medium">Teklif Ver</h4>
              <button
                onClick={() => setShowBidInterface(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <BiddingInterface
              streamId={streamId}
              auctionId={activeProductBid.id}
              currentPrice={product.currentPrice}
              highestBidder={activeProductBid.highestBidder}
              currentUsername={user?.username}
              onBidPlaced={() => {
                fetchActiveBid();
                setShowBidInterface(false);
              }}
              countdownEnd={activeProductBid.countdownEnd}
            />
          </div>
        )}
      </div>
    );
  }

  // If no active auction and user is not a streamer, don't show anything
  return null;
};

export default ProductSection;
