"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
import { useAuth } from "@/components/AuthProvider";
import { Loader2, Send, LogIn } from "lucide-react";
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

        const baseSocketUrl = runtimeConfig.socketUrl || window.location.origin;
        console.log(`StreamChat: Connecting to Socket.IO at ${baseSocketUrl}`);

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

          // If the disconnection wasn't intentional, try to reconnect
          if (
            reason === "io server disconnect" ||
            reason === "transport close"
          ) {
            console.log("StreamChat: Will try to reconnect...");
          }
        });

        newSocket.on("connect_error", (error) => {
          console.error(
            "StreamChat: Socket.IO connection error:",
            error.message
          );
          setIsConnected(false);

          // Manual reconnect if needed
          if (reconnectAttempts < 3) {
            const timeout = Math.min(2000 * (reconnectAttempts + 1), 10000);
            console.log(
              `StreamChat: Will attempt reconnect in ${timeout}ms (attempt ${
                reconnectAttempts + 1
              })`
            );

            setTimeout(() => {
              setReconnectAttempts((prev) => prev + 1);
              if (socketRef.current) {
                socketRef.current.connect();
              }
            }, timeout);
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

    const socket = connectSocket();

    // Cleanup function
    return () => {
      if (socket) {
        console.log("StreamChat: Cleaning up socket connection");
        // Leave the chat room before disconnecting
        socket.emit("leaveChatRoom", { streamId });
        socket.disconnect();
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

  if (isConfigLoading || isAuthLoading) {
    return (
      <div
        className={`flex flex-col h-full bg-opacity-70 bg-black rounded-lg overflow-hidden items-center justify-center ${className}`}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <p className="text-white/70 mt-2">Loading chat...</p>
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
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-white/70 py-4">
            No messages yet. Be the first to chat!
          </div>
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
                <p>{message.content}</p>
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
            disabled={!isAuthenticated || isSending || !isConnected}
            className="w-full bg-black/50 text-white placeholder-white/50 px-4 py-2 pr-10 rounded-full focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
          {isAuthenticated ? (
            <button
              type="submit"
              disabled={isSending || !newMessage.trim() || !isConnected}
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
