import { useState, useEffect, useCallback } from "react";

// Define the ActiveBid interface
export interface ActiveBid {
  id: string;
  productId: string;
  streamId: string;
  timeRemaining: number; // in seconds
  isActive: boolean;
}

// Define the ProductBid interface
export interface ProductBid {
  id: string;
  product: {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    basePrice: number;
    currentPrice: number;
    stock: number; // Stock quantity for stock sale products
  };
  bidCount: number;
  highestBidder: string | null;
  countdownEnd: string | null;
  productType: "AUCTION" | "FIXED_PRICE"; // İki tür ürün
  auctionStatus: "PENDING" | "ACTIVE" | "PAUSED" | "ENDED"; // Açık arttırma durumu
  countdownDuration?: number; // Geri sayım süresi (saniye)
  countdownStartTime?: string; // Geri sayım başlangıç zamanı
}

interface UseActiveBidProps {
  streamId: string;
  token?: string;
  isStreamer: boolean;
  logMessage?: (message: string, data?: any) => void;
  socket?: any;
}

// Check if debug logging is enabled via environment variable
const isDebugEnabled = () => {
  return process.env.NEXT_PUBLIC_DEBUG_ACTIVE_BID === "true" || false;
};

export function useActiveBid({
  streamId,
  token,
  isStreamer,
  logMessage = () => {}, // Default to no-op instead of console.log
  socket,
}: UseActiveBidProps) {
  // Enhanced logging function that respects debug flag
  const debugLog = (message: string, data?: any) => {
    if (isDebugEnabled()) {
      console.log(`[useActiveBid] ${message}`, data);
      logMessage(message, data);
    }
  };
  const [activeProductBid, setActiveProductBid] = useState<ProductBid | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active live stream product
  const fetchActiveBid = useCallback(async () => {
    if (!streamId || isLoading) {
      return;
    }

    try {
      // Don't set loading state for background refreshes
      // Only set loading on initial fetch
      if (!activeProductBid) {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.products && data.products.length > 0) {
          // Find the active product
          const activeProduct = data.products.find(
            (product: any) => product.isActive
          );

          if (activeProduct) {
            const currentPrice =
              activeProduct.bids && activeProduct.bids.length > 0
                ? activeProduct.bids[0].amount
                : activeProduct.currentPrice;

            // Calculate auction status based on database fields
            let auctionStatus: "PENDING" | "ACTIVE" | "PAUSED" | "ENDED" =
              "PENDING";

            if (activeProduct.isAuctionMode) {
              if (!activeProduct.isActive) {
                auctionStatus = "ENDED";
              } else if (
                activeProduct.endTime &&
                new Date() > activeProduct.endTime
              ) {
                auctionStatus = "ENDED";
              } else if (activeProduct.endTime && activeProduct.startTime) {
                auctionStatus = "ACTIVE";
              } else {
                auctionStatus = "PENDING"; // Product is created but countdown hasn't started yet
              }
            }

            const productBid: ProductBid = {
              id: activeProduct.id,
              product: {
                id: activeProduct.id,
                name: activeProduct.title,
                description: activeProduct.description || "",
                imageUrl: activeProduct.imageUrl,
                basePrice: activeProduct.basePrice,
                currentPrice: currentPrice,
                stock: activeProduct.stock || 1,
              },
              bidCount: activeProduct.bids ? activeProduct.bids.length : 0,
              highestBidder:
                activeProduct.bids && activeProduct.bids.length > 0
                  ? activeProduct.bids[0].user?.username || null
                  : null,
              countdownEnd: activeProduct.endTime,
              productType: activeProduct.isAuctionMode
                ? "AUCTION"
                : "FIXED_PRICE",
              auctionStatus: auctionStatus,
              countdownDuration: activeProduct.auctionDuration || 60,
              countdownStartTime: activeProduct.startTime,
            };

            setActiveProductBid(productBid);

            // Only log significant changes or on initial load
            if (
              !activeProductBid ||
              activeProductBid.id !== productBid.id ||
              activeProductBid.product.currentPrice !==
                productBid.product.currentPrice
            ) {
              debugLog("Active product updated", productBid);
            }
          } else {
            if (activeProductBid !== null) {
              setActiveProductBid(null);
              debugLog("No active product found");
            }
          }
        } else {
          if (activeProductBid !== null) {
            setActiveProductBid(null);
            debugLog("No products in stream");
          }
        }
      } else if (response.status === 404) {
        // No active products - this is normal, don't log repeatedly
        if (activeProductBid !== null) {
          setActiveProductBid(null);
          debugLog("No active products in stream");
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      debugLog("Error fetching active product", err);
    } finally {
      setIsLoading(false);
    }
  }, [streamId, token, logMessage, isLoading, activeProductBid]);

  // Initial fetch - only once when component mounts
  useEffect(() => {
    if (streamId) {
      const timer = setTimeout(() => {
        fetchActiveBid();
      }, 500); // Small delay to ensure socket is ready
      return () => clearTimeout(timer);
    }
  }, [streamId]); // Remove fetchActiveBid dependency to prevent loops

  // Socket event listeners
  useEffect(() => {
    if (!socket || !streamId) return;

    const handleNewBid = (data: any) => {
      if (
        data.streamId === streamId ||
        data.productId === activeProductBid?.id
      ) {
        debugLog("New bid received via socket, refreshing");
        fetchActiveBid();
      }
    };

    const handleNewLiveProduct = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("New live product created, refreshing");
        fetchActiveBid();
      }
    };

    const handleNewStockSale = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("New stock sale created, refreshing");
        fetchActiveBid();
      }
    };

    const handleLiveProductEnded = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Live product ended via socket, refreshing");
        fetchActiveBid();
      }
    };

    const handleCountdownStarted = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Countdown started via socket", data);
        fetchActiveBid();
      }
    };

    const handleCountdownPaused = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Countdown paused via socket", data);
        fetchActiveBid();
      }
    };

    const handleCountdownEnded = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Countdown ended via socket", data);
        fetchActiveBid();
      }
    };

    const handleProductAdded = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Product added via socket", data);
        fetchActiveBid();
      }
    };

    const handleProductStatusChanged = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Product status changed via socket", data);
        fetchActiveBid();
      }
    };

    const handleAuctionEnded = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Auction ended via socket", data);
        fetchActiveBid();
      }
    };

    const handleStockPurchased = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Stock purchased via socket", data);
        fetchActiveBid();
      }
    };

    const handleStockSaleRemoved = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Stock sale removed via socket", data);
        fetchActiveBid();
      }
    };

    const handleAuctionCancelled = (data: any) => {
      if (data.streamId === streamId) {
        debugLog("Auction cancelled via socket", data);
        fetchActiveBid();
      }
    };

    // Register listeners
    socket.on("new-bid", handleNewBid);
    socket.on("new-live-product", handleNewLiveProduct);
    socket.on("new-stock-sale", handleNewStockSale);
    socket.on("live-product-ended", handleLiveProductEnded);
    socket.on("countdown-started", handleCountdownStarted);
    socket.on("countdown-paused", handleCountdownPaused);
    socket.on("countdown-ended", handleCountdownEnded);
    socket.on("product-added", handleProductAdded);
    socket.on("product-status-changed", handleProductStatusChanged);
    socket.on("auction-ended", handleAuctionEnded);
    socket.on("stock-purchased", handleStockPurchased);
    socket.on("stock-sale-removed", handleStockSaleRemoved);
    socket.on("auction-cancelled", handleAuctionCancelled);

    // Cleanup
    return () => {
      socket.off("new-bid", handleNewBid);
      socket.off("new-live-product", handleNewLiveProduct);
      socket.off("new-stock-sale", handleNewStockSale);
      socket.off("live-product-ended", handleLiveProductEnded);
      socket.off("countdown-started", handleCountdownStarted);
      socket.off("countdown-paused", handleCountdownPaused);
      socket.off("countdown-ended", handleCountdownEnded);
      socket.off("product-added", handleProductAdded);
      socket.off("product-status-changed", handleProductStatusChanged);
      socket.off("auction-ended", handleAuctionEnded);
      socket.off("stock-purchased", handleStockPurchased);
      socket.off("stock-sale-removed", handleStockSaleRemoved);
      socket.off("auction-cancelled", handleAuctionCancelled);
    };
  }, [socket, streamId, fetchActiveBid, activeProductBid?.id]);

  // Refresh interval - 5 minutes for minimal requests (300000ms)
  // Real-time updates come from socket events, this is just a safety net
  useEffect(() => {
    if (!streamId || isLoading) return;

    const intervalId = setInterval(() => {
      fetchActiveBid();
    }, 300000); // 5 minutes (300 seconds) for minimal polling

    return () => clearInterval(intervalId);
  }, [fetchActiveBid, streamId, isLoading]);

  // Helper function to place a bid
  const placeBid = useCallback(
    async (amount: number) => {
      if (!activeProductBid || !token) {
        throw new Error("No active product or authentication required");
      }

      try {
        const response = await fetch(
          `/api/live-streams/${streamId}/product/${activeProductBid.id}/bid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to place bid");
        }

        const bidData = await response.json();

        // Refresh the active bid data
        fetchActiveBid();

        return bidData;
      } catch (error) {
        debugLog("Error placing bid", error);
        throw error;
      }
    },
    [activeProductBid, token, streamId, fetchActiveBid, logMessage]
  );

  // Helper function to start countdown (streamer only)
  const startCountdown = useCallback(
    async (duration: number = 60) => {
      if (!activeProductBid || !token || !isStreamer) {
        throw new Error("Unauthorized or no active product");
      }

      try {
        const response = await fetch(`/api/live-streams/${streamId}/product`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: activeProductBid.id,
            action: "start_countdown",
            duration: duration,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to start countdown");
        }

        const result = await response.json();

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

        return result;
      } catch (error) {
        debugLog("Error starting countdown", error);
        throw error;
      }
    },
    [activeProductBid, token, isStreamer, streamId, socket, fetchActiveBid]
  );

  // Helper function to pause/cancel countdown (streamer only)
  const pauseCountdown = useCallback(async () => {
    if (!activeProductBid || !token || !isStreamer) {
      throw new Error("Unauthorized or no active product");
    }

    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: activeProductBid.id,
          action: "pause_countdown",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to pause countdown");
      }

      const result = await response.json();

      // Emit socket event for real-time synchronization
      if (socket) {
        socket.emit("pause-countdown", {
          streamId,
          productId: activeProductBid.id,
        });
      }

      // Refresh the active bid data
      fetchActiveBid();

      return result;
    } catch (error) {
      debugLog("Error pausing countdown", error);
      throw error;
    }
  }, [activeProductBid, token, isStreamer, streamId, socket, fetchActiveBid]);

  // Helper function to end auction (streamer only)
  const endAuction = useCallback(async () => {
    if (!activeProductBid || !token || !isStreamer) {
      throw new Error("Unauthorized or no active product");
    }

    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: activeProductBid.id,
          action: "end_auction",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to end auction");
      }

      const result = await response.json();

      // Emit socket event for real-time synchronization
      if (socket) {
        socket.emit("auction-ended", {
          streamId,
          productId: activeProductBid.id,
          winnerId: result.winnerId,
          winnerUsername: result.winnerUsername,
          winningAmount: result.winningAmount,
          timestamp: new Date().toISOString(),
        });
      }

      // Refresh the active bid data
      fetchActiveBid();

      return result;
    } catch (error) {
      debugLog("Error ending auction", error);
      throw error;
    }
  }, [activeProductBid, token, isStreamer, streamId, socket, fetchActiveBid]);

  // Helper function to cancel auction before countdown starts (streamer only)
  const cancelAuction = useCallback(async () => {
    if (!activeProductBid || !token || !isStreamer) {
      throw new Error("Unauthorized or no active product");
    }

    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: activeProductBid.id,
          action: "cancel_auction",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel auction");
      }

      const result = await response.json();

      // Emit socket event for real-time synchronization
      if (socket) {
        socket.emit("auction-cancelled", {
          streamId,
          productId: activeProductBid.id,
          productName: activeProductBid.product.name,
          timestamp: new Date().toISOString(),
        });
      }

      // Refresh the active bid data (will clear the active product)
      fetchActiveBid();

      return result;
    } catch (error) {
      debugLog("Error cancelling auction", error);
      throw error;
    }
  }, [activeProductBid, token, isStreamer, streamId, socket, fetchActiveBid]);

  return {
    activeProductBid,
    isLoading,
    error,
    fetchActiveBid,
    placeBid,
    startCountdown,
    pauseCountdown,
    endAuction,
    cancelAuction,
  };
}
