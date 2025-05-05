"use client";

import React, { useEffect, useState, useRef } from "react";
import { Send, ChevronUp, ChevronDown } from "lucide-react";
import ChatMessage from "./ChatMessage";

interface Message {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  createdAt: string;
  liveStreamId: string;
  user?: {
    username: string;
  };
}

interface StreamChatProps {
  dataChannel?: RTCDataChannel;
  streamId: string;
  currentUserId?: string;
  className?: string;
}

export default function StreamChat({ dataChannel, streamId, currentUserId, className = "" }: StreamChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') {
          setMessages(prev => [...prev, {
            ...data.message,
            createdAt: new Date(data.message.timestamp).toISOString()
          }]);
        }
      } catch (error) {
        console.error('Error parsing chat message:', error);
      }
    };

    dataChannel.addEventListener('message', handleMessage);
    return () => {
      dataChannel.removeEventListener('message', handleMessage);
    };
  }, [dataChannel]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !dataChannel) return;

    try {
      const message = {
        id: Math.random().toString(36).substring(7),
        userId: currentUserId || localStorage.getItem('userId') || 'anonymous',
        username: localStorage.getItem('username') || 'Anonymous',
        message: newMessage.trim(),
        timestamp: Date.now(),
        liveStreamId: streamId,
        createdAt: new Date().toISOString(),
      };

      dataChannel.send(JSON.stringify({
        type: 'chat',
        message,
      }));

      // Add message to local state
      setMessages(prev => [...prev, message]);
      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div 
      ref={chatContainerRef}
      className={`w-full bg-background/90 backdrop-blur-sm border-t border-border shadow-lg flex flex-col ${className}`}
    >
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 pt-2 pb-1 space-y-1 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs sm:text-sm py-1">
            Messages will appear here
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage 
              key={msg.id} 
              message={msg} 
              isFromCurrentUser={msg.userId === currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-2 sm:mx-4 mb-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded">
          {error}
        </div>
      )}

      <form onSubmit={sendMessage} className="p-2 border-t border-border">
        <div className="flex items-center gap-1 sm:gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-full border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={!dataChannel || !newMessage.trim()}
            className="p-1.5 sm:p-2 rounded-full bg-accent text-white disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        </div>
      </form>
    </div>
  );
} 