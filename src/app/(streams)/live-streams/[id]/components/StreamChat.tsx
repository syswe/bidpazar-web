"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
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
  const { config: runtimeConfig, isLoading: isConfigLoading } =
    useRuntimeConfig();
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
    if (!streamId || isConfigLoading) return;

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const apiUrl = runtimeConfig?.apiUrl || window.location.origin;
        console.log(
          "StreamChat: Fetching initial messages from",
          `${apiUrl}/live-streams/${streamId}/chat`
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
  }, [streamId, runtimeConfig, isConfigLoading]);

  // Set up Socket.IO for real-time chat
  useEffect(() => {
    if (!streamId || isConfigLoading || !runtimeConfig) {
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

        // First try using socketUrl from runtime config
        const baseSocketUrl = runtimeConfig.socketUrl || window.location.origin;
        console.log(`StreamChat: Connecting to Socket.IO at ${baseSocketUrl}`);

        // Create socket with more resilient options
        const newSocket = io(baseSocketUrl, {
          path: "/socket.io",
          query: {
            streamId,
            userId: currentUserId || "anonymous-chat-user",
            username: currentUsername || "Anonymous Viewer",
            isAnonymous: !user ? "1" : "0",
          },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 2000,
          timeout: 15000, // Reduce timeout to fail faster
          forceNew: true, // Create a fresh connection each time
        });

        socketRef.current = newSocket;

        newSocket.on("connect", () => {
          console.log(
            "StreamChat: Socket.IO connected successfully",
            newSocket.id
          );
          setIsConnected(true);
          setReconnectAttempts(0);

          // Join the chat room for this stream
          newSocket.emit("joinChatRoom", { streamId }, (response: any) => {
            if (response && response.error) {
              console.error(
                "StreamChat: Error joining chat room:",
                response.message
              );
            } else {
              console.log("StreamChat: Successfully joined chat room");
            }
          });
        });

        newSocket.on("newChatMessage", (message: ChatMessage) => {
          console.log("StreamChat: Received new chat message", message);
          setMessages((prev) => [...prev, message]);
        });

        newSocket.on("chatHistory", (history: ChatMessage[]) => {
          console.log(
            "StreamChat: Received chat history with",
            history.length,
            "messages"
          );
          if (Array.isArray(history) && history.length > 0) {
            setMessages(history);
          }
          setIsLoading(false);
        });

        newSocket.on("chatNotification", (notification: any) => {
          console.log("StreamChat: Received notification", notification);
          // You could display user join/leave notifications if desired
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

          // Specific error handling for timeouts
          if (error.message === "timeout") {
            console.log("StreamChat: Connection timeout");
            
            // Only try to reconnect if we haven't exceeded the limit
            if (reconnectAttempts < 2) {
              // Silently try to reconnect without showing errors to the user
              setReconnectAttempts(prev => prev + 1);
            } else {
              // After multiple failed attempts, don't show error toast
              // Just silently fail and let the user still watch the stream
              console.log("StreamChat: Max reconnect attempts reached, chat will be unavailable");
            }
          }
        });

        newSocket.on("error", (error) => {
          console.error("StreamChat: Socket.IO error:", error);
        });

        return newSocket;
      } catch (error) {
        console.error("StreamChat: Error creating socket connection:", error);
        return null;
      }
    };

    // Don't immediately create socket when component mounts
    // Instead, wait a bit to prevent race conditions with other components
    const timer = setTimeout(() => {
      connectSocket();
    }, 1000);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (socketRef.current) {
        console.log("StreamChat: Cleaning up socket connection");
        // Leave the chat room before disconnecting
        socketRef.current.emit("leaveChatRoom", { streamId });
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    };
  }, [
    streamId,
    runtimeConfig,
    isConfigLoading,
    currentUserId,
    currentUsername,
    user,
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

    const chatMessage: ChatMessage = {
      streamId,
      userId: currentUserId,
      username: currentUsername,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      // Use a Promise to handle the socket.io callback
      const sendViaSocket = () =>
        new Promise((resolve, reject) => {
          if (!socketRef.current) {
            return reject(new Error("Socket not connected"));
          }

          socketRef.current.emit("sendChatMessage", chatMessage, (ack: any) => {
            if (ack && ack.error) {
              reject(new Error(ack.message || "Failed to send message"));
            } else {
              resolve(ack);
            }
          });
        });

      await sendViaSocket();
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
  if (isConfigLoading || isAuthLoading) {
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
        {(isLoading && messages.length === 0) ? (
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
            disabled={!isAuthenticated || isSending || !isConnected || reconnectAttempts >= 2}
            className="w-full bg-black/50 text-white placeholder-white/50 px-4 py-2 pr-10 rounded-full focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
          {isAuthenticated ? (
            <button
              type="submit"
              disabled={isSending || !newMessage.trim() || !isConnected || reconnectAttempts >= 2}
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
