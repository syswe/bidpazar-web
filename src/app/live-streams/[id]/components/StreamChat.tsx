"use client";

import React, { useEffect, useState, useRef, FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/auth";
import { Send } from "lucide-react";

interface ChatMessage {
  id: string;
  userId: string;
  user?: {
    username: string;
  };
  username?: string;
  message?: string;
  content?: string;
  timestamp?: string;
  createdAt?: string;
}

interface StreamChatProps {
  streamId: string;
  isPremium?: boolean;
}

export default function StreamChat({ streamId, isPremium = true }: StreamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Connect to the socket server
  useEffect(() => {
    // Get the auth token from auth module
    const token = getAuth().token;
    const isAuthenticated = !!token && !!user;

    console.log("Setting up chat socket with auth:", {
      isAuthenticated,
      hasToken: !!token,
      hasUser: !!user,
      userId: user?.id
    });

    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001", {
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
      console.log("Chat socket connected with ID:", socketRef.current?.id);
      setIsConnected(true);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("Chat socket disconnected, reason:", reason);
      setIsConnected(false);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Chat socket connection error:", error.message);
      setIsConnected(false);
    });

    socketRef.current.io.on("reconnect_attempt", (attempt) => {
      console.log(`Chat socket reconnection attempt ${attempt}`);
    });

    socketRef.current.io.on("reconnect", (attempt) => {
      console.log(`Chat socket reconnected after ${attempt} attempts`);
      setIsConnected(true);
    });

    socketRef.current.io.on("reconnect_error", (error) => {
      console.error(`Chat socket reconnection error:`, error.message);
    });

    socketRef.current.on("new-message", (message: ChatMessage) => {
      console.log("Received new message:", message);
      setMessages((prev) => [...prev, message]);
    });

    // Join the stream room
    socketRef.current.emit("join-stream", { streamId });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [streamId, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || !socketRef.current || !isConnected || !user) {
      return;
    }

    socketRef.current.emit("send-message", {
      streamId,
      message: inputMessage,
    });

    // Add optimistic UI update
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId: user.id,
      username: user.username || 'You',
      message: inputMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputMessage("");
  };

  // Format message timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Render message item
  const getMessage = (message: ChatMessage) => message.message || message.content || '';
  const getUsername = (message: ChatMessage) => message.username || message.user?.username || 'Anonymous';
  const getTimestamp = (message: ChatMessage) => message.timestamp || message.createdAt || new Date().toISOString();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto mb-2 space-y-2 scrollbar-thin scrollbar-thumb-[var(--accent)]/30 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className={`text-center py-4 ${isPremium ? 'text-white/60' : 'text-[var(--foreground)]/60'}`}>
            Henüz mesaj yok. İlk mesajı gönderen siz olun!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`p-2 rounded-lg backdrop-blur-sm max-w-[95%] ${message.userId === user?.id
                  ? isPremium
                    ? "bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-white ml-auto"
                    : "bg-[var(--accent)]/10 border border-[var(--accent)]/30 ml-auto"
                  : isPremium
                    ? "bg-black/40 border border-white/10 text-white"
                    : "bg-[var(--background)] border border-[var(--border)]"
                }`}
            >
              <div className="flex justify-between text-xs items-center mb-1">
                <span className={`font-medium ${isPremium ? 'text-white' : 'text-[var(--accent)]'}`}>
                  {getUsername(message)}
                </span>
                <span className={`${isPremium ? 'text-white/60' : 'text-[var(--foreground)]/60'} ml-2 text-[10px]`}>
                  {formatTimestamp(getTimestamp(message))}
                </span>
              </div>
              <p className={`text-sm break-words ${isPremium ? 'text-white' : 'text-[var(--foreground)]'}`}>
                {getMessage(message)}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-1 mt-auto">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Bir mesaj yazın..."
          className={`flex-1 rounded-full px-4 py-2 text-sm ${isPremium
              ? "bg-black/40 border border-white/20 text-white placeholder:text-white/60 focus:border-[var(--accent)]/70"
              : "bg-[var(--background)] border border-[var(--border)] focus:border-[var(--accent)]"
            } focus:outline-none transition-colors`}
          disabled={!isConnected || !user}
        />
        <button
          type="submit"
          className={`p-2 rounded-full flex items-center justify-center ${isPremium
              ? "bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white"
              : "bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          disabled={!isConnected || !inputMessage.trim() || !user}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
} 