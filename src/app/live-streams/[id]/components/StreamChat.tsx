"use client";

import React, { useState, useEffect, useRef } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Loader2, Send, LogIn, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

interface ChatMessage {
  id?: string;
  streamId: string;
  userId: string;
  username: string;
  content: string;
  timestamp?: string;
  message?: string; // For compatibility with server messages
}

interface StreamChatProps {
  streamId: string;
  currentUserId: string;
  currentUsername: string;
  className?: string;
  onSendMessage?: (message: string) => void;
  showInput?: boolean;
  maxVisibleMessages?: number;
  isCompact?: boolean;
  isMinimal?: boolean;
}

// Generate consistent colors for usernames
const getUsernameColor = (username: string): string => {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FECA57",
    "#FF9FF3",
    "#54A0FF",
    "#5F27CD",
    "#00D2D3",
    "#FF9F43",
    "#10AC84",
    "#EE5A24",
    "#0984E3",
    "#6C5CE7",
    "#00B894",
    "#F39C12",
    "#E74C3C",
    "#9B59B6",
    "#3498DB",
    "#1ABC9C",
    "#2ECC71",
    "#F1C40F",
    "#E67E22",
    "#E91E63",
    "#9C27B0",
    "#673AB7",
    "#3F51B5",
    "#2196F3",
    "#03A9F4",
    "#00BCD4",
    "#009688",
    "#4CAF50",
    "#8BC34A",
    "#CDDC39",
    "#FFEB3B",
    "#FFC107",
    "#FF9800",
    "#FF5722",
    "#795548",
    "#607D8B",
    "#FF1744",
    "#F50057",
    "#E91E63",
    "#AA00FF",
    "#6200EA",
    "#651FFF",
    "#3D5AFE",
    "#2979FF",
    "#00B0FF",
    "#00E5FF",
    "#1DE9B6",
    "#00C853",
    "#64DD17",
    "#AEEA00",
    "#FFD600",
    "#FFAB00",
    "#FF6D00",
    "#DD2C00",
    "#D50000",
    "#C51162",
  ];

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

export default function StreamChat({
  streamId,
  currentUserId,
  currentUsername,
  className = "",
  onSendMessage,
  showInput = true,
  maxVisibleMessages = 3, // Default to 3 for minimal UI
  isCompact = false,
  isMinimal = false,
}: StreamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [fadingMessages, setFadingMessages] = useState<Set<string>>(new Set());
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageTimeouts = useRef<Map<string, number>>(new Map());
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { user, isLoading: isAuthLoading } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const isAuthenticated = !!user && !!user.id && !!currentUserId;

  // Detect mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) ||
        window.innerWidth <= 768 ||
        "ontouchstart" in window;
      setIsMobile(isMobileDevice);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      // Always scroll to bottom for new messages, but smooth only when hovered
      messagesEndRef.current.scrollIntoView({
        behavior: isHovered ? "smooth" : "auto",
        block: "end",
      });
    }
  }, [visibleMessages]);

  // Scroll to bottom when chat is expanded
  useEffect(() => {
    if (isHovered && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }, 100); // Small delay to ensure DOM is updated
    }
  }, [isHovered]);

  // Manage visible messages with auto-fade (3 seconds display time)
  useEffect(() => {
    // Clear previous timeouts
    messageTimeouts.current.forEach((timer) => clearTimeout(timer));
    messageTimeouts.current.clear();

    if (isHovered) {
      // When hovering, show all messages (scrollable)
      setVisibleMessages(messages); // Show ALL messages when expanded
      return;
    }

    // Show only the most recent messages with auto-fade
    const recentMessages = messages.slice(-maxVisibleMessages);
    setVisibleMessages(recentMessages);

    // Set up fade timers for each message (only when not hovering)
    recentMessages.forEach((message, index) => {
      const messageId = message.id || `${message.timestamp}-${message.userId}`;

      const timer = setTimeout(() => {
        if (!isHovered) {
          // Only fade if not hovering
          setFadingMessages((prev) => new Set([...prev, messageId]));

          // Remove from visible after fade animation
          setTimeout(() => {
            if (!isHovered) {
              // Double check
              setVisibleMessages((prev) =>
                prev.filter((msg) => {
                  const msgId = msg.id || `${msg.timestamp}-${msg.userId}`;
                  return msgId !== messageId;
                })
              );
              setFadingMessages((prev) => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
              });
            }
          }, 500); // Fade animation duration
        }
      }, 3000 + index * 200); // Stagger the fade timing

      messageTimeouts.current.set(messageId, timer as any);
    });

    return () => {
      messageTimeouts.current.forEach((timer) => clearTimeout(timer));
      messageTimeouts.current.clear();
    };
  }, [messages, maxVisibleMessages, isHovered]);

  // Fetch initial messages via REST API
  useEffect(() => {
    if (!streamId) return;

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/live-streams/${streamId}/chat`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error("StreamChat: Error fetching chat messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [streamId]);

  // Set up Socket.IO for real-time chat
  useEffect(() => {
    if (!streamId) return;

    // Clean up previous socket if it exists
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const connectSocket = () => {
      try {
        if (socketRef.current?.connected) return;

        const socketUrl = window.location.origin;
        const newSocket = io(socketUrl, {
          path: "/socket.io",
          query: {
            streamId,
            userId: currentUserId || "anonymous-chat-user",
            username: currentUsername || "Anonymous Viewer",
          },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
        });

        socketRef.current = newSocket;

        newSocket.on("connect", () => {
          if (isAuthenticated) {
            console.log(
              "StreamChat: Socket.IO connected successfully",
              newSocket.id
            );
          }
          setIsConnected(true);
          setReconnectAttempts(0);
          newSocket.emit("join-stream", streamId);
        });

        // Listen for stream-message events
        newSocket.on("stream-message", (message: any) => {
          const normalizedMessage = {
            id: message.id || `temp-${Date.now()}`,
            streamId: message.streamId,
            userId: message.userId,
            username: message.username,
            content: message.message || message.content,
            timestamp: message.timestamp,
          };

          setMessages((prev) => {
            const newMessages = [...prev, normalizedMessage];
            return newMessages.slice(-50); // Keep last 50 messages in memory
          });
        });

        newSocket.on("disconnect", (reason) => {
          if (isAuthenticated) {
            console.warn("StreamChat: Socket.IO disconnected, reason:", reason);
          }
          setIsConnected(false);
        });

        newSocket.on("connect_error", (error) => {
          if (isAuthenticated) {
            console.error(
              "StreamChat: Socket.IO connection error:",
              error.message
            );
          }
          setIsConnected(false);
          if (reconnectAttempts < 3) {
            setReconnectAttempts((prev) => prev + 1);
          }
        });

        return newSocket;
      } catch (error) {
        if (isAuthenticated) {
          console.error("StreamChat: Error creating socket connection:", error);
        }
        return null;
      }
    };

    const timer = setTimeout(() => {
      connectSocket();
    }, 500);

    return () => {
      clearTimeout(timer);
      if (socketRef.current) {
        if (isAuthenticated) {
          console.log("StreamChat: Cleaning up socket connection");
        }
        socketRef.current.emit("leave-stream", streamId);
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    };
  }, [
    streamId,
    currentUserId,
    currentUsername,
    reconnectAttempts,
    isAuthenticated,
  ]);

  // Expose socket and functions to parent for external message sending
  useEffect(() => {
    if (onSendMessage && socketRef.current) {
      (window as any).streamChatSocket = socketRef.current;
      (window as any).streamChatConnected = isConnected;
      (window as any).streamChatAuthenticated = isAuthenticated;
    }
  }, [onSendMessage, socketRef.current, isConnected, isAuthenticated]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    // If parent provided onSendMessage handler, use it
    if (onSendMessage) {
      onSendMessage(newMessage.trim());
      setNewMessage("");
      return;
    }

    // Otherwise, send via socket directly
    if (!socketRef.current || !isConnected) {
      toast.error("Chat not connected. Please wait...");
      return;
    }

    if (!isAuthenticated) {
      toast.error("You must be logged in to send messages");
      return;
    }

    try {
      setIsSending(true);

      socketRef.current.emit("stream-message", {
        streamId,
        userId: currentUserId,
        username: currentUsername,
        message: newMessage.trim(),
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Handle hover/touch interactions
  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsHovered(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isMobile) {
      e.preventDefault();
      setIsHovered(!isHovered);
    }
  };

  const handleClick = () => {
    if (isMobile) {
      setIsHovered(!isHovered);
    }
  };

  if (isAuthLoading) {
    return null; // Don't show loading for chat
  }

  // Minimal live-style chat (like TikTok/YouTube Live)
  return (
    <div className={`flex flex-col ${className}`}>
      {/* Messages Area - Transparent background */}
      <div
        ref={chatContainerRef}
        className={`flex flex-col justify-end space-y-1 transition-all duration-300 ${
          isMobile ? "cursor-pointer" : "cursor-default"
        } ${
          isHovered
            ? "max-h-96 overflow-y-scroll scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent"
            : "max-h-20 overflow-hidden"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        style={{
          // Subtle background for better visibility
          background: isAuthenticated ? "rgba(0,0,0,0.4)" : "transparent",
          borderRadius: "8px",
          padding: isAuthenticated ? "8px" : "0",
          minHeight: isAuthenticated ? "40px" : "auto",
          border: isAuthenticated ? "1px solid rgba(255,255,255,0.1)" : "none",
          // Add subtle text shadow for readability
          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
          // Force scrolling to work
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Chat hint for authenticated users - only when no messages AND not expanded */}
        {isAuthenticated &&
          visibleMessages.length === 0 &&
          messages.length === 0 &&
          !isHovered && (
            <div className="text-white/30 text-xs text-center py-1">
              💬 Sohbet
            </div>
          )}
        {visibleMessages.map((message, index) => {
          const messageId =
            message.id || `${message.timestamp}-${message.userId}`;
          const isFading = fadingMessages.has(messageId);
          const usernameColor = getUsernameColor(message.username);

          return (
            <div
              key={messageId}
              className={`text-sm transition-opacity duration-500 ${
                isFading ? "opacity-0" : "opacity-100"
              }`}
              style={{
                textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              <span style={{ color: usernameColor }} className="font-semibold">
                {message.username}
              </span>
              <span className="text-white">: {message.content}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Show for authenticated users or when hovered */}
      {showInput && (isAuthenticated || isHovered) && (
        <form onSubmit={handleSendMessage} className="mt-3">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={
                isAuthenticated
                  ? isConnected
                    ? "Mesaj gönderin..."
                    : "Chat bağlanıyor..."
                  : "Giriş yapın..."
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={
                !isAuthenticated ||
                isSending ||
                !isConnected ||
                reconnectAttempts >= 2
              }
              className="w-full bg-black/60 text-white placeholder-white/60 px-4 py-3 pr-12 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-sm border border-white/30 transition-all hover:bg-black/70 focus:bg-black/70"
            />
            {isAuthenticated ? (
              <button
                type="submit"
                disabled={
                  isSending ||
                  !newMessage.trim() ||
                  !isConnected ||
                  reconnectAttempts >= 2
                }
                className="absolute right-3 p-1.5 text-white/80 hover:text-white disabled:text-white/40 hover:bg-white/10 rounded-full transition-all"
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            ) : (
              <div className="absolute right-3 p-1.5 text-white/50">
                <LogIn className="h-5 w-5" />
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
