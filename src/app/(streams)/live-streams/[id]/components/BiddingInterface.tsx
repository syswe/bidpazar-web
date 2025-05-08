"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/frontend-auth";
import { ArrowUp, DollarSign, Clock, XCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { toast } from "sonner";

interface BiddingInterfaceProps {
  streamId: string;
  isExpanded?: boolean;
  onMinimize?: () => void;
  className?: string;
}

interface Product {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  currentBid?: number;
  startingBid: number;
  countdownEnd?: string;
  creatorId?: string;
}

export default function BiddingInterface({ 
  streamId, 
  isExpanded = false,
  onMinimize,
  className = "" 
}: BiddingInterfaceProps) {
  const [bidAmount, setBidAmount] = useState("");
  const [currentBid, setCurrentBid] = useState<number>(0);
  const [highestBidder, setHighestBidder] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<boolean>(false);
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { user, isLoading: isAuthLoading } = useAuth();
  const bidInputRef = useRef<HTMLInputElement>(null);
  const { config: runtimeConfig } = useRuntimeConfig();

  const isAuthenticated = !!user && !!user.id;

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

  // Fetch current product and bid information
  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const response = await fetch(`/api/live-streams/${streamId}/product`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("No active product for this stream");
          } else {
            throw new Error('Failed to fetch product');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setProduct(data);
        setCurrentBid(data.currentBid || data.startingBid);
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

  // Connect to the socket server for bidding
  useEffect(() => {
    // Get the auth token from auth module
    const token = getAuth().token;
    const isAuthenticated = !!token && !!user;

    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      query: {
        streamId,
        room: `stream:${streamId}`,
        userId: user?.id,
        username: user?.username
      },
      auth: {
        token
      },
      path: "/socket.io/",
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current.on("connect", () => {
      setIsConnected(true);
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
    });

    // Handle bid updates
    socketRef.current.on("bid-update", (data: { 
      amount: number;
      userId: string;
      username: string; 
    }) => {
      setCurrentBid(data.amount);
      setHighestBidder(data.username);
      
      // If this is our bid, show success message
      if (data.userId === user?.id) {
        setBidSuccess(true);
        setTimeout(() => setBidSuccess(false), 3000);
      }
    });

    // Handle bid errors
    socketRef.current.on("bid-error", (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 5000);
    });

    // Join the stream room
    socketRef.current.emit("join-stream", { streamId });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [streamId, user]);

  // Handle submitting a bid
  const handleBid = async (e: FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error("You must be logged in to place a bid", {
        description: "Please sign in or register to participate in auctions"
      });
      return;
    }

    if (!bidAmount || !socketRef.current || !isConnected || !user || !product) {
      return;
    }

    // Ensure proper parsing with parseFloat and fix precision
    const amount = parseFloat(parseFloat(bidAmount).toFixed(2));

    // Make sure it's a valid number
    if (isNaN(amount) || amount <= currentBid) {
      setError(`Bid must be higher than the current bid of ${currentBid}`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setLoading(true);

    try {
      if (!runtimeConfig) {
        throw new Error("Configuration not loaded");
      }
      
      const response = await fetch(`${runtimeConfig.apiUrl}/live-streams/${streamId}/active-bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          productId: product.id
        }),
      });

      if (response.ok) {
        toast.success("Bid placed successfully!");
        setBidAmount("");
        bidInputRef.current?.focus();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to place bid");
      }
    } catch (error) {
      console.error('Error placing bid:', error);
      toast.error("Failed to place bid. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatTimeLeft = (seconds: number): string => {
    if (!seconds || seconds <= 0) return "Ended";
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`p-2 sm:p-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg ${className}`}>
        <div className="flex justify-center items-center py-2 sm:py-3">
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-accent animate-spin mr-2" />
          <span className="text-xs sm:text-sm text-muted-foreground">Loading auction...</span>
        </div>
      </div>
    );
  }

  // No active auction
  if (!product) {
    return null;
  }

  const minimumBid = currentBid + 1;

  return (
    <div className={`bg-background/90 backdrop-blur-sm border border-border rounded-lg overflow-hidden transition-all duration-300 ${isExpanded ? 'p-3 sm:p-4' : 'p-2 sm:p-3'} ${className}`}>
      {/* Product header with close button */}
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-xs sm:text-sm truncate">{product.title || 'Current Auction'}</h3>
          {product.description && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{product.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {countdownTime !== null && (
            <div className="flex items-center bg-muted px-2 py-1 rounded text-[10px] sm:text-xs">
              <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
              <span className={countdownTime < 60 ? 'text-red-500 font-medium' : ''}>
                {formatTimeLeft(countdownTime)}
              </span>
            </div>
          )}
          
          {onMinimize && (
            <button 
              onClick={onMinimize} 
              className="text-muted-foreground hover:text-foreground p-1 rounded-full"
            >
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Current bid display */}
      <div className="flex justify-between items-center mb-2 sm:mb-3 bg-muted p-2 rounded">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Current Bid:</span>
        <span className="font-bold text-sm sm:text-base text-accent">
          <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 inline mr-0.5" />
          {currentBid}
        </span>
      </div>
      
      {highestBidder && (
        <div className="text-[10px] sm:text-xs text-center mb-2 sm:mb-3 text-muted-foreground">
          Highest bidder: <span className="font-medium">{highestBidder}</span>
        </div>
      )}

      {/* Success and error messages */}
      {bidSuccess && (
        <div className="text-green-600 dark:text-green-400 text-[10px] sm:text-xs mb-2 sm:mb-3 p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded flex items-center">
          <CheckCircle2 className="w-3 h-3 mr-1 flex-shrink-0" /> Your bid was placed successfully!
        </div>
      )}
      
      {error && (
        <div className="text-red-600 dark:text-red-400 text-[10px] sm:text-xs mb-2 sm:mb-3 p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/30 rounded flex items-center">
          <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" /> {error}
        </div>
      )}
      
      {/* Bid form */}
      <form onSubmit={handleBid} className="space-y-2">
        <div className="flex items-center">
          <span className="bg-muted border border-r-0 border-border rounded-l-md p-1.5 sm:p-2 text-muted-foreground">
            <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
          </span>
          <input
            type="number"
            ref={bidInputRef}
            step="0.01"
            min={minimumBid}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`${minimumBid} or higher`}
            className="flex-1 p-1.5 sm:p-2 text-xs sm:text-sm border border-border rounded-r-md focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          />
        </div>
        
        <button
          type="submit"
          disabled={!isConnected || !user || loading || !isAuthenticated}
          className="w-full py-1.5 sm:py-2 bg-accent text-accent-foreground font-medium text-xs sm:text-sm flex items-center justify-center rounded-md disabled:opacity-50"
        >
          {!isConnected ? (
            <>Connecting...</>
          ) : !user ? (
            <>Sign in to bid</>
          ) : (
            <>
              <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Place Bid
            </>
          )}
        </button>
      </form>
    </div>
  );
} 