"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  ShoppingBag,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import StreamControls from "./components/StreamControls";

// Define a type for SimplePeer module to avoid 'any'
interface SimplePeerModule {
  new(opts?: SimplePeerOptions): SimplePeerInstance;
}

// Define a type for SimplePeer props to avoid type errors
interface SimplePeerOptions {
  initiator?: boolean;
  stream?: MediaStream;
  trickle?: boolean;
}

// Define a type for SimplePeer instance
interface SimplePeerInstance {
  on(event: string, callback: (data: unknown) => void): void;
  signal(data: unknown): void;
  destroy(): void;
  addStream?(stream: MediaStream): void;
}

// Use a hook to handle SimplePeer initialization safely in browser environment
function useSimplePeer() {
  const [simplePeerModule, setSimplePeerModule] = useState<SimplePeerModule | null>(null);

  useEffect(() => {
    // Only import SimplePeer in browser environment
    if (typeof window !== 'undefined') {
      import('simple-peer').then((module) => {
        setSimplePeerModule(module.default);
      }).catch(err => {
        console.error("Failed to load SimplePeer:", err);
      });
    }
  }, []);

  return simplePeerModule;
}

// Define types inline to avoid dependency on @/types
interface User {
  id: string;
  username: string;
}

interface AuctionListing {
  id: string;
  productId: string;
  liveStreamId: string;
  startPrice: number;
  status: "ACTIVE" | "COUNTDOWN" | "SOLD" | "UNSOLD";
  countdownTime: number;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    description: string;
    images?: Array<{
      id: string;
      filename: string;
    }>;
  };
  bids?: Array<{
    id: string;
    amount: number;
    userId: string;
    listingId: string;
    createdAt: string;
    user?: {
      username: string;
    };
  }>;
}

interface ChatMessageType {
  id: string;
  message: string;
  content?: string;
  userId: string;
  liveStreamId: string;
  createdAt: string;
  user?: {
    username: string;
  };
}

interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  startTime: string | null;
  endTime: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  listings?: AuctionListing[];
  chatMessages?: ChatMessageType[];
}

// Define interface for product data
interface ProductFormData {
  productName: string;
  startPrice: number;
}

// Define interface for modal props
interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
  isSubmitting: boolean;
}

// Add a modal dialog component for inline product adding
const AddProductModal = ({ isOpen, onClose, onSubmit, isSubmitting }: AddProductModalProps) => {
  const [productName, setProductName] = useState("");
  const [startPrice, setStartPrice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ productName, startPrice: parseFloat(startPrice) });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg w-full max-w-md p-4 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Add Item to Stream</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="productName" className="block text-sm font-medium">
              Ürün Adı (Product Name)
            </label>
            <input
              type="text"
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="startPrice" className="block text-sm font-medium">
              Açılış Fiyatı (Starting Price)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
              <input
                type="number"
                id="startPrice"
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
                className="w-full p-2 pl-8 border rounded-md bg-background"
                min="0.01"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary text-primary-foreground"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isSubmitting ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function StreamPage() {
  const params = useParams();
  const { id } = params;
  const { user, token, isAuthenticated } = useAuth();

  const [liveStream, setLiveStream] = useState<LiveStream | null>(null);
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageType[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isStreamer, setIsStreamer] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnections, setPeerConnections] = useState<Record<string, SimplePeerInstance>>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<Socket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const SimplePeer = useSimplePeer();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add new state for active product/auction
  const [activeProduct, setActiveProduct] = useState<AuctionListing | null>(null);
  // Add state for chat visibility on mobile
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Add function to handle WebRTC peer connection
  const setupPeerConnection = (isInitiator: boolean, targetUserId: string) => {
    try {
      if (!SimplePeer) {
        console.error("SimplePeer is not loaded yet");
        return null;
      }

      console.log("Setting up peer connection", { isInitiator, targetUserId, hasLocalStream: !!localStream });

      const peerOptions: SimplePeerOptions = {
        initiator: isInitiator,
        trickle: true
      };

      if (isStreamer && localStream) {
        peerOptions.stream = localStream;
      }

      const peer = new SimplePeer(peerOptions);

      peer.on('signal', (data: unknown) => {
        // Send signaling data through socket
        console.log("Generated signal to send", { targetUserId });
        if (socketRef.current?.connected) {
          socketRef.current.emit('webrtc-signal', {
            signal: data,
            targetUserId,
            streamId: id
          });
        } else {
          console.error("Socket not connected for signaling");
        }
      });

      peer.on('stream', (stream: MediaStream) => {
        console.log("Received remote stream", stream);
        if (!isStreamer) {
          setRemoteStream(stream);
        }
      });

      peer.on('error', (err: Error) => {
        console.error("Peer connection error:", err);
        toast.error("Video connection error: " + err.message);
      });

      return peer;
    } catch (error) {
      console.error("Error setting up peer connection:", error);
      return null;
    }
  };

  // Function to start the camera for the streamer
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log("Camera access granted", stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setLocalStream(stream);

      // Notify server that streamer has started camera
      if (socketRef.current?.connected) {
        socketRef.current.emit('camera-started', { streamId: id });
      }

      toast.success("Camera streaming started!");
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Failed to access camera. Please check permissions.");
    }
  };

  // Function to stop the camera
  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);

      // Close all peer connections
      Object.values(peerConnections).forEach((peer: any) => {
        if (peer && typeof peer.destroy === 'function') {
          peer.destroy();
        }
      });

      setPeerConnections({});

      if (socketRef.current?.connected) {
        socketRef.current.emit('camera-stopped', { streamId: id });
      }

      toast.info("Camera stream ended");
    }
  };

  useEffect(() => {
    // Fetch stream data
    const fetchStreamData = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${id}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
        const data = response.data;

        setLiveStream(data);
        if (data.listings) setListings(data.listings);
        if (data.chatMessages) {
          // Transform chatMessages to match the expected format
          const formattedMessages = data.chatMessages.map((msg: {
            id: string;
            message: string;
            userId: string;
            liveStreamId: string;
            createdAt: string;
            user?: { username: string };
          }) => {
            const chatMsg: ChatMessageType = {
              ...msg,
              content: msg.message // Add content property that matches the message
            };
            return chatMsg;
          });
          setChatMessages(formattedMessages.reverse()); // Reverse to show newest at bottom
        }

        setIsStreamer(user?.id === data.user.id);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching stream:", error);
        toast.error("Failed to load stream data");
        setLoading(false);
      }
    };

    fetchStreamData();

    // Create socket connection with proper authentication
    const setupSocket = () => {
      console.log("Setting up socket connection with token:", token ? "present" : "not present");

      if (!token) {
        console.warn("No authentication token available - trying to connect as guest");
      }

      // Connect to socket with proper auth
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001", {
        auth: {
          token: token
        },
        query: {
          streamId: id,
        },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      });

      socket.on("connect", () => {
        console.log("Socket connected with ID:", socket.id, "authenticated:", !!token);
        // Join room for this stream
        socket.emit("joinStream", { streamId: id });
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        if (!isAuthenticated) {
          toast.error("Login to chat and place bids");
        } else {
          toast.error("Failed to connect to the live stream");
        }
      });

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        toast.error("Disconnected from stream");
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
        // Convert error object to string if possible, otherwise show generic message
        let errorMessage = "An error occurred";
        try {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error && typeof error === 'object') {
            errorMessage = error.message || JSON.stringify(error);
          }
        } catch (e) {
          console.error("Error parsing socket error:", e);
        }
        toast.error(errorMessage);
      });

      socket.on("new-message", (message: {
        id: string;
        message: string;
        userId: string;
        liveStreamId: string;
        createdAt: string;
        user?: { username: string };
      }) => {
        console.log("Received new message:", message);
        try {
          // Transform to match expected format
          const formattedMessage: ChatMessageType = {
            ...message,
            content: message.message // Ensure content property is set from message
          };
          setChatMessages((prev) => [...prev, formattedMessage]);

          // Notify for messages from others
          if (message.userId !== user?.id) {
            toast.info(`${message.user?.username || 'Someone'}: ${message.message.substring(0, 30)}${message.message.length > 30 ? '...' : ''}`);
          }
        } catch (error) {
          console.error("Error processing new message:", error);
        }
      });

      socket.on("new-bid", (data: {
        bid: {
          id: string;
          amount: number;
          userId: string;
          listingId: string;
          createdAt: string;
          user?: {
            username: string;
          };
        },
        listingId: string
      }) => {
        console.log("Received new bid:", data);
        try {
          // Play a sound or show a notification for new bids
          toast.info(`New bid: $${data.bid.amount} by ${data.bid.user?.username || 'Someone'}`);
        } catch (error) {
          console.error("Error processing new bid:", error);
        }
      });

      socket.on("listing-update", (updatedListing: AuctionListing) => {
        console.log("Received listing update:", updatedListing);
        try {
          setListings((prev) =>
            prev.map((listing) =>
              listing.id === updatedListing.id ? updatedListing : listing
            )
          );
        } catch (error) {
          console.error("Error processing listing update:", error);
        }
      });

      socket.on("new-listing", (newListing: AuctionListing) => {
        setListings((prev) => [...prev, newListing]);
      });

      // Add WebRTC signaling handlers
      socket.on("webrtc-signal", (data: {
        signal: unknown,
        fromUserId: string
      }) => {
        try {
          console.log("Received WebRTC signal from:", data.fromUserId);

          // If we don't have a peer connection for this user yet, create one
          if (!peerConnections[data.fromUserId]) {
            const newPeer = setupPeerConnection(false, data.fromUserId);
            if (newPeer) {
              setPeerConnections(prev => ({
                ...prev,
                [data.fromUserId]: newPeer
              }));
            }
          }

          // Signal the peer
          if (peerConnections[data.fromUserId]) {
            peerConnections[data.fromUserId].signal(data.signal);
          }
        } catch (error) {
          console.error("Error handling WebRTC signal:", error);
        }
      });

      socket.on("viewer-joined", (data: { userId: string }) => {
        if (isStreamer && localStream) {
          console.log("New viewer joined, initializing WebRTC connection:", data.userId);
          const newPeer = setupPeerConnection(true, data.userId);
          if (newPeer) {
            setPeerConnections(prev => ({
              ...prev,
              [data.userId]: newPeer
            }));
          }
        }
      });

      return socket;
    };

    // Initialize socket
    const socket = setupSocket();
    socketRef.current = socket;

    // Cleanup function
    return () => {
      // Stop camera if active
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // Close all peer connections
      Object.values(peerConnections).forEach((peer: any) => {
        if (peer && typeof peer.destroy === 'function') {
          peer.destroy();
        }
      });

      if (socketRef.current) {
        console.log("Disconnecting socket");
        socketRef.current.disconnect();
      }
    };
  }, [id, token, isAuthenticated, isStreamer]);

  // Update peer connections when local stream changes
  useEffect(() => {
    if (isStreamer && localStream) {
      console.log("Local stream changed, updating peer connections");

      // For each peer connection, add the local stream
      Object.entries(peerConnections).forEach(([userId, peer]) => {
        if (peer && typeof peer.addStream === 'function') {
          try {
            peer.addStream(localStream);
          } catch (error) {
            console.error("Error adding stream to peer:", error);
          }
        }
      });
    }
  }, [localStream, isStreamer, peerConnections]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;

    if (!isAuthenticated) {
      toast.error("Please log in to send messages");
      return;
    }

    // Display sending indicator
    const toastId = toast.loading("Sending message...");

    console.log("Sending message:", {
      streamId: id,
      message: chatInput,
      socketConnected: socketRef.current.connected,
      userId: user?.id,
      isAuthenticated
    });

    // First check if socket is connected
    if (!socketRef.current.connected) {
      console.error("Socket is not connected. Attempting to reconnect...");
      toast.error("Connection lost. Reconnecting...", { id: toastId });

      socketRef.current.connect();
      // Add event handler for reconnnection
      socketRef.current.once("connect", () => {
        console.log("Reconnected, retrying send message");
        trySendMessage();
      });
      return;
    }

    trySendMessage();

    function trySendMessage() {
      try {
        socketRef.current?.emit("send-message", {
          streamId: id,
          message: chatInput,
        }, (response: { success?: boolean; error?: string; messageId?: string }) => {
          // Add acknowledgement callback
          if (response && response.error) {
            console.error("Error sending message:", response.error);
            toast.error(response.error, { id: toastId });
            return;
          } else if (response && response.success) {
            console.log("Message sent successfully:", response);
            toast.success("Message sent", { id: toastId });
            // Clear input on success
            setChatInput("");
          } else {
            console.warn("Unknown response from server:", response);
            toast.error("Unexpected response from server", { id: toastId });
          }
        });

        // Set a timeout to handle cases where the acknowledgement doesn't come back
        setTimeout(() => {
          // Check if the toast is still in loading state
          toast.dismiss(toastId);
        }, 5000);
      } catch (error) {
        console.error("Exception while sending message:", error);
        toast.error("Failed to send message due to an error", { id: toastId });
      }
    }
  };

  // Toggle the bottom sheet expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Replace navigation with modal open
  const handleAddItem = () => {
    setIsModalOpen(true);
  };

  // Handle submitting the product directly from the modal
  const handleAddProductSubmit = async (productData: ProductFormData) => {
    if (!productData.productName) {
      toast.error("Please enter a product name");
      return;
    }

    if (!productData.startPrice || productData.startPrice <= 0) {
      toast.error("Please enter a valid starting price");
      return;
    }

    try {
      setIsSubmitting(true);

      // Use the same API endpoint from the create listing page
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-streams/${id}/listings/simplified`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productName: productData.productName,
          startPrice: productData.startPrice
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API error response:", errorData);

        // If the simplified endpoint fails, try the original endpoint with a fallback method
        console.log("Simplified API failed, trying fallback method");

        const fallbackResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-streams/${id}/listings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            productId: "default", // This will be ignored, but helps with backward compatibility
            title: productData.productName,
            startPrice: productData.startPrice,
            countdownTime: 30
          })
        });

        if (!fallbackResponse.ok) {
          const fallbackErrorData = await fallbackResponse.json().catch(() => ({}));
          console.error("Fallback API error response:", fallbackErrorData);
          throw new Error(fallbackErrorData.message || "Failed to create listing");
        }

        const data = await fallbackResponse.json();
        console.log("Listing created with fallback method:", data);
      } else {
        const data = await response.json();
        console.log("Listing created successfully:", data);
      }

      toast.success("Listing added to stream");
      setIsModalOpen(false);
      refreshListings(); // Refresh listings to show the new item
    } catch (error) {
      console.error("Error creating listing:", error);
      toast.error("Failed to add listing to stream");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add a refresh function for listings
  const refreshListings = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${id}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (response.data.listings) {
        setListings(response.data.listings);
        console.log("Listings refreshed manually");
      }
    } catch (error) {
      console.error("Error refreshing listings:", error);
    }
  };

  // Add a polling mechanism for periodic updates if socket isn't working
  useEffect(() => {
    // Only use polling as a fallback if sockets aren't working well
    const pollingInterval = setInterval(() => {
      if (!socketRef.current?.connected) {
        console.log("Socket disconnected, using polling fallback to refresh data");
        refreshListings();
      }
    }, 10000); // Poll every 10 seconds if socket is disconnected

    return () => clearInterval(pollingInterval);
  }, [id]);

  // Modify the bid handling to be more robust
  const handlePlaceBid = (listing: AuctionListing) => {
    if (!isAuthenticated) {
      toast.error("Please log in to place bids");
      return;
    }

    // Calculate bid amount
    const currentAmount = listing.bids && listing.bids[0]
      ? listing.bids[0].amount
      : listing.startPrice;

    const bidAmount = currentAmount + 50;

    // Try socket first
    if (socketRef.current?.connected) {
      console.log("Placing bid via socket:", {
        listingId: listing.id,
        amount: bidAmount
      });

      socketRef.current.emit("place-bid", {
        listingId: listing.id,
        amount: bidAmount,
      });

      // For better UX, optimistically update UI
      toast.success(`Bid of $${bidAmount} placed!`);
    } else {
      // Fallback to direct API call if socket is not connected
      console.log("Socket not connected, trying direct API call for bid");
      placeBidViaApi(listing.id, bidAmount);
    }
  };

  // API fallback for bidding
  const placeBidViaApi = async (listingId: string, amount: number) => {
    try {
      if (!token) {
        toast.error("You must be logged in to place bids");
        return;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/live-streams/listings/${listingId}/bids`,
        { amount },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log("Bid placed via API:", response.data);
      toast.success(`Bid of $${amount} placed!`);

      // Refresh listings to show the new bid
      refreshListings();
    } catch (error) {
      console.error("Error placing bid via API:", error);
      toast.error("Failed to place bid");
    }
  };

  // Find the most active product (with most recent bid or most expensive)
  useEffect(() => {
    if (listings.length > 0) {
      // Find product with active bids, or default to first item
      const productWithBids = listings.find(listing =>
        listing.bids && listing.bids.length > 0 && listing.status === "ACTIVE"
      );

      setActiveProduct(productWithBids || listings[0]);
    } else {
      setActiveProduct(null);
    }
  }, [listings]);

  // Toggle mobile chat visibility
  const toggleMobileChat = () => {
    setShowMobileChat(!showMobileChat);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="md:ml-16 fixed inset-0 bg-black overflow-hidden">
      {/* Main container with relative positioning for overlays */}
      <div className="relative w-full h-full flex flex-col">
        {/* Video container takes all available space */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {liveStream && (
            <div className="w-full h-full flex items-center justify-center">
              {/* Video element */}
              <div className="relative w-full h-full">
                {liveStream.status === "LIVE" ? (
                  <>
                    <div className="w-full h-full">
                      {isStreamer ? (
                        // Streamer view
                        <div className="flex flex-col h-full">
                          <div className="relative flex-1 w-full">
                            {/* Local video preview */}
                            <video
                              ref={localVideoRef}
                              className="h-full w-full object-cover"
                              autoPlay
                              playsInline
                              muted
                            />
                          </div>
                        </div>
                      ) : (
                        // Viewer view
                        <div className="h-full w-full flex items-center justify-center">
                          {remoteStream ? (
                            <video
                              className="h-full w-full object-contain"
                              autoPlay
                              playsInline
                              ref={(videoElement) => {
                                if (videoElement && !videoElement.srcObject && remoteStream) {
                                  videoElement.srcObject = remoteStream;
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center text-white">
                              <p className="mb-2">Waiting for stream to start...</p>
                              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Placeholder for non-live streams
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-2xl text-white">
                      {liveStream.status === "SCHEDULED" ? "Stream Scheduled" : "Stream Ended"}
                    </div>
                  </div>
                )}

                {/* TikTok-style overlays */}

                {/* Top section: Stream info */}
                <div className="absolute top-0 left-0 right-0 p-4 z-20">
                  <div className="flex items-center justify-between">
                    {/* Broadcaster info */}
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white overflow-hidden">
                        {liveStream.user?.username ? (
                          <span className="text-lg font-bold">{liveStream.user.username.charAt(0).toUpperCase()}</span>
                        ) : (
                          <span className="text-lg font-bold">?</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm sm:text-base">{liveStream.user?.username}</h3>
                        <div className="flex items-center">
                          <span className="text-xs text-white/80">{liveStream.title}</span>
                        </div>
                      </div>
                    </div>

                    {/* Live status indicator */}
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500 flex items-center">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse mr-1"></span>
                        <span className="text-xs text-white">LIVE</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right section: Controls for streamer */}
                {isStreamer && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center space-y-4 z-20">
                    <div className="flex flex-col items-center space-y-2">
                      {!localStream ? (
                        <button
                          onClick={startCamera}
                          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={stopCamera}
                          className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                        </button>
                      )}
                      <span className="text-xs text-white">Camera</span>
                    </div>

                    <div className="flex flex-col items-center space-y-2">
                      <button
                        onClick={handleAddItem}
                        className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white"
                      >
                        <Plus className="h-6 w-6" />
                      </button>
                      <span className="text-xs text-white">Add Item</span>
                    </div>

                    <StreamControls streamId={id as string} streamStatus={liveStream.status} />
                  </div>
                )}

                {/* Right section: Actions for viewers */}
                {!isStreamer && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center space-y-4 z-20">
                    <div className="flex flex-col items-center space-y-2">
                      <button
                        onClick={() => activeProduct && handlePlaceBid(activeProduct)}
                        className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white"
                        disabled={!activeProduct}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <span className="text-xs text-white">Bid</span>
                    </div>

                    {/* Mobile chat toggle button */}
                    <div className="flex flex-col items-center space-y-2 md:hidden">
                      <button
                        onClick={toggleMobileChat}
                        className="w-12 h-12 rounded-full bg-primary/60 flex items-center justify-center text-white"
                      >
                        <MessageCircle className="h-6 w-6" />
                      </button>
                      <span className="text-xs text-white">Chat</span>
                    </div>
                  </div>
                )}

                {/* Bottom left: Active product information */}
                {activeProduct && (
                  <div className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-xs bg-black/60 backdrop-blur-sm rounded-lg p-3 z-20">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white text-sm truncate">{activeProduct.product?.name}</h4>
                      <div className="flex items-center bg-primary/20 px-2 py-1 rounded-full">
                        <span className="text-primary text-xs font-medium">
                          ${activeProduct.bids && activeProduct.bids[0]
                            ? activeProduct.bids[0].amount.toFixed(2)
                            : activeProduct.startPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <p className="text-white/70 text-xs mt-1 line-clamp-1">{activeProduct.product?.description}</p>
                  </div>
                )}

                {/* Bottom right: Chat container (desktop) */}
                <div className="hidden md:block absolute bottom-4 right-4 w-72 max-h-[50vh] bg-black/60 backdrop-blur-sm rounded-lg overflow-hidden z-20">
                  <div className="p-2 border-b border-white/10 flex justify-between items-center">
                    <h4 className="font-semibold text-white text-sm">Live Chat</h4>
                    <div className="text-xs text-white/70">{chatMessages.length} messages</div>
                  </div>
                  <div
                    ref={chatContainerRef}
                    className="overflow-y-auto p-2 max-h-[30vh]"
                  >
                    {chatMessages.length > 0 ? (
                      <div className="space-y-2">
                        {chatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex items-start ${message.userId === user?.id ? 'justify-end' : ''}`}
                          >
                            <div className={`max-w-[85%] rounded px-2 py-1 ${message.userId === user?.id
                              ? 'bg-primary/80 text-white'
                              : 'bg-gray-600/80 text-white'
                              }`}>
                              <div className="flex items-center space-x-1">
                                <span className="font-medium text-xs text-white/90">
                                  {message.user?.username || 'Guest'}:
                                </span>
                              </div>
                              <p className="text-xs break-words">{message.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-white/50 text-xs">
                        No messages yet
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-white/10">
                    <div className="flex space-x-1">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Say something..."
                        className="flex-1 px-2 py-1 text-xs bg-white/20 border border-white/30 rounded text-white placeholder:text-white/50"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="px-2 py-1 bg-primary rounded text-white text-xs"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile chat overlay */}
                {showMobileChat && (
                  <div className="md:hidden absolute inset-0 bg-black/90 z-30 flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b border-white/10">
                      <h4 className="font-semibold text-white">Live Chat</h4>
                      <button onClick={toggleMobileChat} className="text-white">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div
                      ref={chatContainerRef}
                      className="flex-1 overflow-y-auto p-4"
                    >
                      {chatMessages.length > 0 ? (
                        <div className="space-y-3">
                          {chatMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex items-start ${message.userId === user?.id ? 'justify-end' : ''}`}
                            >
                              <div className={`max-w-[85%] rounded px-3 py-2 ${message.userId === user?.id
                                ? 'bg-primary/80 text-white'
                                : 'bg-gray-600/80 text-white'
                                }`}>
                                <div className="flex items-center space-x-1 mb-1">
                                  <span className="font-medium text-sm text-white/90">
                                    {message.user?.username || 'Guest'}
                                  </span>
                                </div>
                                <p className="text-sm break-words">{message.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-white/50">
                          No messages yet
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-white/10">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded text-white placeholder:text-white/50"
                        />
                        <button
                          onClick={handleSendMessage}
                          className="px-4 py-2 bg-primary rounded text-white"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Products list bottom drawer - only visible when expanded */}
        <div className={`bg-background transition-all duration-300 overflow-hidden ${isExpanded ? 'h-60' : 'h-0'}`}>
          <div className="p-2 border-b border-muted flex items-center justify-between">
            <h3 className="font-semibold">All Items ({listings.length})</h3>
            <button
              onClick={toggleExpanded}
              className="p-1 rounded-md hover:bg-muted"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          <div className="h-[calc(100%-40px)] overflow-y-auto p-2">
            {listings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {listings.map((listing) => (
                  <div key={listing.id} className="border rounded-md p-2 hover:bg-muted/50">
                    <div className="flex justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm truncate">{listing.product?.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{listing.product?.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium">
                          ${listing.bids && listing.bids[0]
                            ? listing.bids[0].amount.toFixed(2)
                            : listing.startPrice.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => handlePlaceBid(listing)}
                        >
                          Bid
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No items available yet
              </div>
            )}
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="h-12 bg-background border-t border-muted flex items-center justify-between px-4">
          <button
            onClick={toggleExpanded}
            className="flex items-center space-x-2 text-sm"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>{isExpanded ? 'Hide Items' : 'Show Items'}</span>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          <div className="flex items-center space-x-1">
            {isStreamer && (
              <Button
                onClick={handleAddItem}
                size="sm"
                variant="outline"
                className="text-xs h-8"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddProductSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
} 