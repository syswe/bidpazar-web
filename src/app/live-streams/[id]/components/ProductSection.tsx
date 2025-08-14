import React, { useState, useEffect } from "react";
import { Timer, CircleDollarSign, X, Loader2, Clock, Package, ShoppingCart } from "lucide-react";
import { ProductBid } from "../hooks/useActiveBid";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAuth, getToken } from "@/lib/frontend-auth";
import AddProductSelector from "./AddProductSelector";
import BiddingInterface from "./BiddingInterface";
import StockSaleInterface from "./StockSaleInterface";

interface ProductSectionProps {
  streamId: string;
  isStreamer: boolean;
  activeProductBid: ProductBid | null;
  fetchActiveBid: () => void;
  user: any; // User object or null
  socket?: any; // Socket object for real-time communication
  startCountdown?: (duration?: number) => Promise<any>;
  pauseCountdown?: () => Promise<any>;
  endAuction?: () => Promise<any>;
}

const ProductSection: React.FC<ProductSectionProps> = ({
  streamId,
  isStreamer,
  activeProductBid,
  fetchActiveBid,
  user,
  socket,
  startCountdown: hookStartCountdown,
  pauseCountdown: hookPauseCountdown,
  endAuction: hookEndAuction,
}) => {
  const router = useRouter();
  const { token } = getAuth();
  const [showBidInterface, setShowBidInterface] = useState(false);
  const [showStockSaleInterface, setShowStockSaleInterface] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isEndingAuction, setIsEndingAuction] = useState(false);
  const [isStartingCountdown, setIsStartingCountdown] = useState(false);
  const [isPausingCountdown, setIsPausingCountdown] = useState(false);

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
    if (
      !activeProductBid ||
      !activeProductBid.countdownEnd ||
      activeProductBid.auctionStatus !== "ACTIVE"
    )
      return;

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

  // Handle starting countdown - Use hook function or fallback to local implementation
  const handleStartCountdown = async (duration: number = 60) => {
    if (hookStartCountdown) {
      setIsStartingCountdown(true);
      try {
        await hookStartCountdown(duration);
        toast.success("Geri sayım başlatıldı");
      } catch (error: any) {
        toast.error(error.message || "Geri sayım başlatılamadı");
      } finally {
        setIsStartingCountdown(false);
      }
      return;
    }

    // Fallback to local implementation
    if (!activeProductBid || !user) return;

    setIsStartingCountdown(true);
    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          productId: activeProductBid.id,
          action: "start_countdown",
          duration: duration,
        }),
      });

      if (response.ok) {
        toast.success("Geri sayım başlatıldı");

        // Emit socket event for real-time synchronization
        if (socket) {
          socket.emit("start-countdown", {
            streamId,
            productId: activeProductBid.id,
            duration: duration,
            startTime: new Date().toISOString(),
          });
        }

        // Refresh the active bid data
        fetchActiveBid();
      } else {
        const error = await response.json();
        toast.error(error.error || "Geri sayım başlatılamadı");
      }
    } catch (error) {
      console.error("Error starting countdown:", error);
      toast.error("Geri sayım başlatılırken hata oluştu");
    } finally {
      setIsStartingCountdown(false);
    }
  };

  // Handle pausing countdown - Use hook function or fallback to local implementation
  const handlePauseCountdown = async () => {
    if (hookPauseCountdown) {
      setIsPausingCountdown(true);
      try {
        await hookPauseCountdown();
        toast.success("Geri sayım durduruldu");
      } catch (error: any) {
        toast.error(error.message || "Geri sayım durdurulamadı");
      } finally {
        setIsPausingCountdown(false);
      }
      return;
    }

    // Fallback to local implementation
    if (!activeProductBid || !user) return;

    setIsPausingCountdown(true);
    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          productId: activeProductBid.id,
          action: "pause_countdown",
        }),
      });

      if (response.ok) {
        toast.success("Geri sayım durduruldu");

        // Emit socket event for real-time synchronization
        if (socket) {
          socket.emit("pause-countdown", {
            streamId,
            productId: activeProductBid.id,
          });
        }

        // Refresh the active bid data
        fetchActiveBid();
      } else {
        const error = await response.json();
        toast.error(error.error || "Geri sayım durdurulamadı");
      }
    } catch (error) {
      console.error("Error pausing countdown:", error);
      toast.error("Geri sayım durdurulurken hata oluştu");
    } finally {
      setIsPausingCountdown(false);
    }
  };

  // Handle ending the auction - Use hook function or fallback to local implementation
  const handleEndAuction = async () => {
    if (hookEndAuction) {
      setIsEndingAuction(true);
      try {
        await hookEndAuction();
        toast.success("Açık arttırma sonlandırıldı");
      } catch (error: any) {
        toast.error(error.message || "Açık arttırma sonlandırılamadı");
      } finally {
        setIsEndingAuction(false);
      }
      return;
    }

    // Fallback to local implementation
    if (!activeProductBid || !user) return;

    setIsEndingAuction(true);
    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          productId: activeProductBid.id,
          action: "end_auction",
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Show success message to streamer
        toast.success("Açık arttırma sonlandırıldı");

        // Emit socket event for all participants
        if (socket) {
          const auctionData = {
            streamId,
            productId: activeProductBid.id,
            productName: activeProductBid.product.name,
            sellerId: user.id,
            winnerId: result.winner?.id || null,
            winnerUsername: result.winner?.username || null,
            winningAmount:
              result.winningAmount || activeProductBid.product.currentPrice,
            timestamp: new Date().toISOString(),
          };

          socket.emit("auction-ended", auctionData);
          socket.emit("live-product-ended", auctionData);
        }

        // Refresh the active bid data
        fetchActiveBid();
      } else {
        const error = await response.json();
        toast.error(error.error || "Açık arttırma sonlandırılamadı");
      }
    } catch (error) {
      console.error("Error ending auction:", error);
      toast.error("Açık arttırma sonlandırılırken hata oluştu");
    } finally {
      setIsEndingAuction(false);
    }
  };

  // RENDERING LOGIC

  // If streamer with no active product, show the add product selector
  if (isStreamer && !activeProductBid) {
    return (
      <div className="streamer-product-controls">
        <AddProductSelector
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
        {/* Product card */}
        <div className="p-3 rounded-lg bg-black/50 backdrop-blur-sm shadow flex flex-col gap-2 max-w-[280px]">
          {/* Product type indicator */}
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                activeProductBid.productType === "FIXED_PRICE"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-green-500/20 text-green-300"
              }`}
            >
              {activeProductBid.productType === "FIXED_PRICE"
                ? "Sabit Fiyat"
                : "Açık Arttırma"}
            </span>
            {activeProductBid.productType === "AUCTION" ? (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  activeProductBid.auctionStatus === "ACTIVE"
                    ? "bg-red-500/20 text-red-300"
                    : activeProductBid.auctionStatus === "PENDING"
                    ? "bg-yellow-500/20 text-yellow-300"
                    : activeProductBid.auctionStatus === "PAUSED"
                    ? "bg-orange-500/20 text-orange-300"
                    : "bg-gray-500/20 text-gray-300"
                }`}
              >
                {activeProductBid.auctionStatus === "ACTIVE"
                  ? "Aktif"
                  : activeProductBid.auctionStatus === "PENDING"
                  ? "Bekliyor"
                  : activeProductBid.auctionStatus === "PAUSED"
                  ? "Durdu"
                  : "Bitti"}
              </span>
            ) : (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  activeProductBid.product.stock > 0
                    ? "bg-green-500/20 text-green-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {activeProductBid.product.stock > 0 ? "Stokta" : "Tükendi"}
              </span>
            )}
          </div>

          {/* Countdown timer - only for active auctions */}
          {activeProductBid.productType === "AUCTION" &&
            activeProductBid.auctionStatus === "ACTIVE" &&
            timeLeft !== null && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-white/80 text-xs">Kalan süre:</span>
                <span
                  className={`flex items-center font-mono text-sm ${
                    timeLeft < 10 ? "text-red-400 animate-pulse" : "text-white"
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

          {/* Stock info - only for stock sale products */}
          {activeProductBid.productType === "FIXED_PRICE" && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-white/80 text-xs">Stok:</span>
              <span
                className={`flex items-center text-sm ${
                  activeProductBid.product.stock <= 0
                    ? "text-red-400"
                    : activeProductBid.product.stock <= 3
                    ? "text-orange-400"
                    : "text-green-400"
                }`}
              >
                <Package className="w-3.5 h-3.5 mr-1" />
                {activeProductBid.product.stock} adet
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
                  {activeProductBid.productType === "AUCTION" ? (
                    <>
                      <Timer className="w-3 h-3 mr-0.5" />
                      {activeProductBid.bidCount || 0} teklif
                      {activeProductBid.auctionStatus === "PENDING" && (
                        <span className="ml-1 text-yellow-400">(Ön teklif)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Package className="w-3 h-3 mr-0.5" />
                      {product.stock} adet
                    </>
                  )}
                </span>
              </div>

              {/* Highest bidder info */}
              {activeProductBid.highestBidder && (
                <div className="text-white/60 text-xs mt-1">
                  En yüksek: @{activeProductBid.highestBidder}
                </div>
              )}
            </div>
          </div>

          {/* Buttons for authenticated non-streamers */}
          {user && !isStreamer && (
            <>
              {activeProductBid.productType === "AUCTION" ? (
                <button
                  onClick={() => setShowBidInterface(!showBidInterface)}
                  className="w-full py-2 text-sm bg-[var(--accent)] text-white rounded font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    activeProductBid.auctionStatus === "ENDED" ||
                    (activeProductBid.auctionStatus === "ACTIVE" && timeLeft === 0)
                  }
                >
                  {activeProductBid.auctionStatus === "ENDED"
                    ? "Arttırma Bitti"
                    : activeProductBid.auctionStatus === "ACTIVE" && timeLeft === 0
                    ? "Arttırma Bitti"
                    : activeProductBid.auctionStatus === "ACTIVE"
                    ? "Teklif Ver"
                    : "Teklif Ver (Ön Teklif)"}
                </button>
              ) : (
                <button
                  onClick={() => setShowStockSaleInterface(true)}
                  className="w-full py-2 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  disabled={activeProductBid.product.stock <= 0}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {activeProductBid.product.stock <= 0
                    ? "Stokta Yok"
                    : `Satın Al - ${formatPrice(activeProductBid.product.currentPrice)}`}
                </button>
              )}
            </>
          )}

          {/* Login prompt for anonymous users */}
          {!user && (
            <div className="text-center py-2">
              <p className="text-white/60 text-xs mb-2">
                Teklif vermek için giriş yapın
              </p>
              <button
                onClick={() => (window.location.href = "/login")}
                className="text-[var(--accent)] text-xs hover:underline"
              >
                Giriş Yap
              </button>
            </div>
          )}

          {/* Streamer controls */}
          {isStreamer && (
            <div className="flex flex-col gap-2 mt-1">
              {activeProductBid.productType === "AUCTION" ? (
                <>
                  {/* Countdown controls for auction products */}
                  {activeProductBid.auctionStatus === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartCountdown(60)}
                        disabled={isStartingCountdown}
                        className="flex-1 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {isStartingCountdown ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Başlatılıyor...
                          </div>
                        ) : (
                          `Açık Arttırma Başlat (60s) - ${activeProductBid.highestBidder ? `En yüksek: ${formatPrice(activeProductBid.product.currentPrice)}` : 'Henüz teklif yok'}`
                        )}
                      </button>
                    </div>
                  )}

                  {activeProductBid.auctionStatus === "ACTIVE" && (
                    <div className="flex gap-2">
                      <button
                        onClick={handlePauseCountdown}
                        disabled={isPausingCountdown}
                        className="flex-1 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        {isPausingCountdown ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Duruduruluyor...
                          </div>
                        ) : (
                          "Geri Sayımı Durdur"
                        )}
                      </button>
                      <button
                        onClick={handleEndAuction}
                        disabled={isEndingAuction}
                        className="flex-1 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isEndingAuction ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Sonlandırılıyor...
                          </div>
                        ) : (
                          "Arttırmayı Sonlandır"
                        )}
                      </button>
                    </div>
                  )}

                  {activeProductBid.auctionStatus === "PAUSED" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartCountdown(30)}
                        disabled={isStartingCountdown}
                        className="flex-1 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {isStartingCountdown ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Başlatılıyor...
                          </div>
                        ) : (
                          "Devam Et (30s)"
                        )}
                      </button>
                      <button
                        onClick={handleEndAuction}
                        disabled={isEndingAuction}
                        className="flex-1 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isEndingAuction ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            Sonlandırılıyor...
                          </div>
                        ) : (
                          "Arttırmayı Sonlandır"
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Stock sale controls */
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/live-streams/${streamId}/product`, {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${getToken()}`,
                          },
                          body: JSON.stringify({
                            productId: activeProductBid.id,
                            action: "remove_stock_sale",
                          }),
                        });

                        if (response.ok) {
                          toast.success("Ürün kaldırıldı");
                          fetchActiveBid();
                        } else {
                          const error = await response.json();
                          toast.error(error.error || "Ürün kaldırılamadı");
                        }
                      } catch (error) {
                        console.error("Error removing stock sale product:", error);
                        toast.error("Ürün kaldırılırken hata oluştu");
                      }
                    }}
                    className="flex-1 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                  >
                    Ürünü Kaldır
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bidding Interface Modal - Only for auction products */}
        {showBidInterface &&
          user &&
          !isStreamer &&
          activeProductBid.productType === "AUCTION" &&
          (activeProductBid.auctionStatus === "ACTIVE" || activeProductBid.auctionStatus === "PENDING") && (
            <BiddingInterface
              activeProductBid={activeProductBid}
              onClose={() => setShowBidInterface(false)}
              onBidSuccess={fetchActiveBid}
              streamId={streamId}
            />
          )}

        {/* Stock Sale Interface Modal - Only for stock sale products */}
        {showStockSaleInterface &&
          user &&
          !isStreamer &&
          activeProductBid.productType === "FIXED_PRICE" && (
            <StockSaleInterface
              streamId={streamId}
              activeProductBid={activeProductBid}
              onClose={() => setShowStockSaleInterface(false)}
              onPurchaseSuccess={fetchActiveBid}
            />
          )}
      </div>
    );
  }

  // No active product and not a streamer - show nothing or a simple message
  return (
    <div className="text-white/60 text-sm text-center py-4">
      Henüz açık arttırma ürünü yok
    </div>
  );
};

export default ProductSection;
