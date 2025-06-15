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
}

export default function StreamChat({
  streamId,
  currentUserId,
  currentUsername,
  className = "",
  onSendMessage,
  showInput = true,
  maxVisibleMessages = 50,
  isCompact = false,
}: StreamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [fadingMessages, setFadingMessages] = useState<Set<string>>(new Set());
  const [hiddenMessages, setHiddenMessages] = useState<Set<string>>(new Set());
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageTimeouts = useRef<Map<string, number>>(new Map());
  const expandTimeoutRef = useRef<number | null>(null);

  const { user, isLoading: isAuthLoading } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const isAuthenticated = !!user && !!user.id && !!currentUserId;

  // Detect mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                            window.innerWidth <= 768 ||
                            'ontouchstart' in window;
      setIsMobile(isMobileDevice);
      console.log('Mobile detection:', { 
        isMobileDevice, 
        userAgent: navigator.userAgent, 
        width: window.innerWidth, 
        hasTouch: 'ontouchstart' in window 
      });
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current && (!isCompact || showAllMessages || isExpanded)) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isCompact, showAllMessages, isExpanded]);

  // Handle mobile tap to expand
  const handleTouchInteraction = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isMobile) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    setShowAllMessages(newExpanded);
    
    console.log('Mobile chat interaction:', { newExpanded, hiddenCount: hiddenMessages.size });
    
    // Clear any existing timeout
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    
    // Auto-collapse after 8 seconds on mobile (longer time)
    if (newExpanded) {
      expandTimeoutRef.current = window.setTimeout(() => {
        setIsExpanded(false);
        setShowAllMessages(false);
        console.log('Auto-collapsing mobile chat');
      }, 8000);
    }
  };

  // Handle desktop hover
  const handleMouseEnter = () => {
    if (isMobile) return;
    setShowAllMessages(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setShowAllMessages(false);
  };

  // Auto-fade messages after 3 seconds (only in compact mode)
  useEffect(() => {
    if (!isCompact) return;

    // Set up fade timers for new messages
    messages.forEach((message) => {
      const messageId = message.id || `${message.timestamp}-${message.userId}`;
      
      // Skip if already has a timer
      if (messageTimeouts.current.has(messageId)) return;

      const timer = setTimeout(() => {
        setFadingMessages(prev => new Set([...prev, messageId]));
        
        // Hide message after fade animation (don't remove from messages array)
        setTimeout(() => {
          setHiddenMessages(prev => new Set([...prev, messageId]));
          setFadingMessages(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageId);
            return newSet;
          });
          messageTimeouts.current.delete(messageId);
        }, 300); // Wait for fade animation to complete
      }, 3000); // 3 seconds before fade

      messageTimeouts.current.set(messageId, timer);
    });

    // Cleanup function
    return () => {
      messageTimeouts.current.forEach(timer => clearTimeout(timer));
      messageTimeouts.current.clear();
      if (expandTimeoutRef.current) {
        clearTimeout(expandTimeoutRef.current);
      }
    };
  }, [messages, isCompact]);

  // Fetch initial messages via REST API
  useEffect(() => {
    if (!streamId) return;

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        console.log(
          "StreamChat: Fetching initial messages from",
          `/api/live-streams/${streamId}/chat`
        );

        const response = await fetch(`/api/live-streams/${streamId}/chat`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.messages)) {
            console.log(
              "StreamChat: Successfully loaded",
              data.messages.length,
              "messages"
            );
            setMessages(data.messages);
          } else {
            console.warn("StreamChat: Invalid response format", data);
          }
        } else {
          console.error(
            "StreamChat: Error fetching chat messages:",
            response.status
          );
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
    if (!streamId) {
      return;
    }

    // Clean up previous socket if it exists
    if (socketRef.current) {
      console.log("StreamChat: Disconnecting previous socket");
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Connect to Socket.IO server
    const connectSocket = () => {
      try {
        if (socketRef.current?.connected) {
          console.log("StreamChat: Socket already connected");
          return;
        }

        // Get socket URL from environment variables directly
        // Using the window object to access NEXT_PUBLIC env variables
        const socketUrl = window.location.origin;
        console.log(`StreamChat: Connecting to Socket.IO at ${socketUrl}`);

        // Create socket with more resilient options
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
          console.log(
            "StreamChat: Socket.IO connected successfully",
            newSocket.id
          );
          setIsConnected(true);
          setReconnectAttempts(0);

          // Join the stream room
          newSocket.emit("join-stream", streamId);
          console.log(`StreamChat: Joined stream: ${streamId}`);
        });

        // Listen for stream-message events
        newSocket.on("stream-message", (message: any) => {
          console.log("StreamChat: Received new message", message);

          // Normalize message format
          const normalizedMessage = {
            id: message.id || `temp-${Date.now()}`,
            streamId: message.streamId,
            userId: message.userId,
            username: message.username,
            content: message.message || message.content, // Handle both formats
            timestamp: message.timestamp,
          };

          setMessages((prev) => {
            const newMessages = [...prev, normalizedMessage];
            // Keep only recent messages to prevent memory issues
            return newMessages.slice(-maxVisibleMessages);
          });
        });

        newSocket.on("disconnect", (reason) => {
          console.warn("StreamChat: Socket.IO disconnected, reason:", reason);
          setIsConnected(false);
        });

        newSocket.on("connect_error", (error) => {
          console.error(
            "StreamChat: Socket.IO connection error:",
            error.message
          );
          setIsConnected(false);

          // Try to reconnect
          if (reconnectAttempts < 3) {
            setReconnectAttempts((prev) => prev + 1);
          }
        });

        return newSocket;
      } catch (error) {
        console.error("StreamChat: Error creating socket connection:", error);
        return null;
      }
    };

    // Connect after a short delay
    const timer = setTimeout(() => {
      connectSocket();
    }, 500);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (socketRef.current) {
        console.log("StreamChat: Cleaning up socket connection");
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
    maxVisibleMessages,
  ]);

  // Expose socket and functions to parent for external message sending
  useEffect(() => {
    if (onSendMessage && socketRef.current) {
      // Expose socket and auth status to parent
      (window as any).streamChatSocket = socketRef.current;
      (window as any).streamChatConnected = isConnected;
      (window as any).streamChatAuthenticated = isAuthenticated;
    }
  }, [onSendMessage, socketRef.current, isConnected, isAuthenticated]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // This component no longer handles sending messages directly
    // Message sending is handled by parent component
    console.log("StreamChat: handleSendMessage called but not implemented");
  };

  // Get visible messages (compact mode shows fewer)
  const visibleMessages = isCompact 
    ? (showAllMessages || isExpanded)
      ? messages // Show all messages when hovering/expanded
      : messages.filter(msg => {
          const msgId = msg.id || `${msg.timestamp}-${msg.userId}`;
          return !hiddenMessages.has(msgId);
        }).slice(-3) // Show only last 3 visible messages in compact mode
    : messages;

  // Render a more user-friendly loading state
  if (isAuthLoading) {
    return (
      <div
        className={`flex flex-col h-full items-center justify-center ${className}`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        <p className="text-white/50 mt-2 text-xs">Loading chat...</p>
      </div>
    );
  }

  if (isCompact) {
    // Compact mode for TikTok/Instagram style overlay
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div 
          className={`flex-1 flex flex-col justify-end space-y-2 p-2 ${(showAllMessages || isExpanded) ? 'chat-expanded' : ''} ${isMobile ? 'mobile-chat' : ''}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={isMobile ? handleTouchInteraction : undefined}
          style={isMobile && isExpanded ? {
            touchAction: 'pan-y',
            overflowY: 'auto',
            maxHeight: '60vh',
            minHeight: '300px'
          } : undefined}
        >
          {/* Mobile expand indicator */}
          {isMobile && !isExpanded && hiddenMessages.size > 0 && (
            <div 
              className="text-center text-white/80 py-2 text-sm mobile-expand-hint"
              onTouchStart={handleTouchInteraction}
            >
              👆 Tap to see all messages ({hiddenMessages.size} hidden)
            </div>
          )}
          
          {visibleMessages.length === 0 ? (
            <div className="text-center text-white/50 py-2 text-xs">
              No messages yet
            </div>
          ) : (
            visibleMessages.map((message, index) => {
              const messageId = message.id || `${message.timestamp}-${message.userId}`;
              const isFading = fadingMessages.has(messageId);
              const isHidden = hiddenMessages.has(messageId);
              
              // Don't show hidden messages unless hovering/expanded
              if (isHidden && !showAllMessages && !isExpanded) {
                return null;
              }
              
              return (
                <div
                  key={message.id || index}
                  className={`chat-message animate-in fade-in duration-300 ${isFading ? 'fading' : ''} ${isHidden ? 'was-hidden' : ''}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="username">{message.username}</div>
                  <div className="message-text">{message.content}</div>
                </div>
              );
            })
          )}
          {(showAllMessages || isExpanded) && <div ref={messagesEndRef} />}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full bg-opacity-70 bg-black rounded-lg overflow-hidden ${className}`}
    >
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-white/70 py-4 text-sm">
            No messages yet. Be the first to chat!
          </div>
        ) : (
          visibleMessages.map((message, index) => (
            <div
              key={message.id || index}
              className={`flex items-start space-x-2 ${
                message.userId === currentUserId ? "justify-end" : ""
              }`}
            >
              <div
                className={`px-3 py-2 rounded-lg max-w-[80%] break-words ${
                  message.userId === currentUserId
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--secondary)] text-[var(--secondary-foreground)]"
                }`}
              >
                <div className="text-xs font-medium opacity-80 mb-1">
                  {message.username || "Anonymous"}
                </div>
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {showInput && (
        <form onSubmit={handleSendMessage} className="p-2 bg-black/30">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={
                isAuthenticated
                  ? isConnected
                    ? "Send a message..."
                    : "Connecting chat..."
                  : "Login to chat..."
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={
                !isAuthenticated ||
                isSending ||
                !isConnected ||
                reconnectAttempts >= 2
              }
              className="w-full bg-black/50 text-white placeholder-white/50 px-4 py-2 pr-10 rounded-full focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
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
                className="absolute right-2 text-white/80 hover:text-white disabled:text-white/40"
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            ) : (
              <div className="absolute right-2 text-white/50">
                <LogIn className="h-5 w-5" />
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
