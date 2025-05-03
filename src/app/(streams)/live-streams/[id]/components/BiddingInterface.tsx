"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/frontend-auth";

interface BiddingInterfaceProps {
  streamId: string;
}

interface Product {
  id: string;
  currentBid?: number;
  startingBid: number;
}

export default function BiddingInterface({ streamId }: BiddingInterfaceProps) {
  const [bidAmount, setBidAmount] = useState("");
  const [currentBid, setCurrentBid] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  // Fetch current product and bid information
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

    console.log("Setting up bidding socket with auth:", {
      isAuthenticated,
      hasToken: !!token,
      hasUser: !!user,
      userId: user?.id
    });

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
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      forceNew: false,
      autoConnect: true
    });

    socketRef.current.on("connect", () => {
      console.log("Bidding socket connected with ID:", socketRef.current?.id);
      setIsConnected(true);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("Bidding socket disconnected, reason:", reason);
      setIsConnected(false);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Bidding socket connection error:", error.message);
      setIsConnected(false);
    });

    socketRef.current.io.on("reconnect_attempt", (attempt) => {
      console.log(`Bidding socket reconnection attempt ${attempt}`);
    });

    socketRef.current.io.on("reconnect", (attempt) => {
      console.log(`Bidding socket reconnected after ${attempt} attempts`);
      setIsConnected(true);
    });

    socketRef.current.io.on("reconnect_error", (error) => {
      console.error(`Bidding socket reconnection error:`, error.message);
    });

    // Handle bid updates
    socketRef.current.on("bid-update", (data: { bid: { amount: number }; amount: number }) => {
      setCurrentBid(data.amount);
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
  const handleBid = (e: FormEvent) => {
    e.preventDefault();

    if (!bidAmount || !socketRef.current || !isConnected || !user || !product) {
      return;
    }

    // Ensure proper parsing with parseFloat and fix precision
    const amount = parseFloat(parseFloat(bidAmount).toFixed(2));

    // Make sure it's a valid number
    if (isNaN(amount) || amount <= currentBid) {
      setError(`Bid must be higher than the current bid of $${currentBid}`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    console.log("Placing bid:", {
      streamId,
      listingId: product.id,
      amount: amount
    });

    socketRef.current.emit("place-bid", {
      streamId,
      listingId: product.id,
      amount: amount,
    });

    // Optimistically update UI
    setCurrentBid(amount);
    setBidAmount("");
  };

  if (loading) {
    return <div className="animate-pulse p-4">Loading bidding interface...</div>;
  }

  if (!product) {
    return <div>No active auction to bid on</div>;
  }

  const minimumBid = currentBid + 1;

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium">Current Bid:</span>
        <span className="font-bold text-xl text-green-600 dark:text-green-400">
          ${currentBid}
        </span>
      </div>

      {error && (
        <div className="text-red-500 text-sm mb-3 p-2 bg-red-100 dark:bg-red-900 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleBid} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-gray-500">$</span>
          <input
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`${minimumBid}+`}
            className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            min={minimumBid}
            step="1"
            disabled={!isConnected || !user}
          />
        </div>
        <button
          type="submit"
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400"
          disabled={!isConnected || !bidAmount || !user}
        >
          Bid
        </button>
      </form>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Minimum bid: ${minimumBid}
      </p>
    </div>
  );
} 