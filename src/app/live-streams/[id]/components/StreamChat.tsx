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
}

export default function StreamChat({
  streamId,
  currentUserId,
  currentUsername,
  className = "",
}: StreamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user, isLoading: isAuthLoading } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const isAuthenticated = !!user && !!user.id && !!currentUserId;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

          setMessages((prev) => [...prev, normalizedMessage]);
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
  ]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (!isAuthenticated) {
      toast.error("You must be logged in to send messages");
      return;
    }

    if (!socketRef.current || !socketRef.current.connected) {
      toast.error("Chat not connected. Please wait or refresh the page.");
      return;
    }

    setIsSending(true);

    try {
      // Create message object
      const messageData = {
        streamId,
        userId: currentUserId,
        username: currentUsername,
        message: newMessage.trim(), // Use 'message' to match server expectations
      };

      // Send message via socket.io
      socketRef.current.emit("stream-message", messageData);

      // Locally add message for immediate display
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          streamId,
          userId: currentUserId,
          username: currentUsername,
          content: newMessage.trim(),
          timestamp: new Date().toISOString(),
        },
      ]);

      setNewMessage("");
    } catch (error) {
      console.error("StreamChat: Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Simplified UI when chat is unavailable
  const renderChatUnavailableUI = () => {
    if (isLoading) return null;

    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <MessageCircle className="h-8 w-8 text-white/30 mb-2" />
        <p className="text-white/70 text-center text-sm">
          Chat is currently unavailable. You can still watch the stream.
        </p>
      </div>
    );
  };

  // Render a more user-friendly loading state
  if (isAuthLoading) {
    return (
      <div
        className={`flex flex-col h-full bg-opacity-70 bg-black rounded-lg overflow-hidden items-center justify-center ${className}`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        <p className="text-white/70 mt-2 text-sm">Loading chat...</p>
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
          reconnectAttempts >= 2 ? (
            renderChatUnavailableUI()
          ) : (
            <div className="text-center text-white/70 py-4 text-sm">
              No messages yet. Be the first to chat!
            </div>
          )
        ) : (
          messages.map((message, index) => (
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
    </div>
  );
}
