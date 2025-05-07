"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { useAuth } from '@/components/AuthProvider';
import { Loader2, Send, LogIn } from 'lucide-react';
import { toast } from "sonner";
import { io, Socket } from 'socket.io-client';

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

export default function StreamChat({ streamId, currentUserId, currentUsername, className = '' }: StreamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  const { user, isLoading: isAuthLoading } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  
  const isAuthenticated = !!user && !!user.id && !!currentUserId;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!streamId || isConfigLoading || !runtimeConfig || !currentUserId) {
      if (!isConfigLoading && runtimeConfig && !currentUserId && !isAuthLoading && !user) {
      }
      if (streamId) {
        const apiUrl = runtimeConfig?.apiUrl || window.location.origin;
        const fetchMessages = async () => {
          try {
            setIsLoading(true);
            const response = await fetch(`${apiUrl}/live-streams/${streamId}/chat`);
            if (response.ok) {
              const data = await response.json();
              setMessages(data.messages || []);
            } else {
              console.error('Error fetching chat messages:', response.status);
            }
          } catch (error) {
            console.error('Error fetching chat messages:', error);
          } finally {
            setIsLoading(false);
          }
        };

        fetchMessages();
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (!runtimeConfig || !streamId) {
        console.log("StreamChat: Not connecting WebSocket, runtimeConfig or streamId missing.");
        return;
      }

      const baseSocketUrl = runtimeConfig.socketUrl || window.location.origin;
      let finalSocketIoUrl = baseSocketUrl;
      if (finalSocketIoUrl.startsWith('https://')) {
        finalSocketIoUrl = finalSocketIoUrl.replace('https://', 'wss://');
      } else if (finalSocketIoUrl.startsWith('http://')) {
        finalSocketIoUrl = finalSocketIoUrl.replace('http://', 'ws://');
      }
      finalSocketIoUrl = finalSocketIoUrl.endsWith('/') ? finalSocketIoUrl.slice(0, -1) : finalSocketIoUrl;

      console.log(`StreamChat: Attempting to connect to Socket.IO at ${finalSocketIoUrl} with path /socket.io`);
      
      const newSocket = io(finalSocketIoUrl, {
        path: '/socket.io',
        query: {
          streamId,
          userId: currentUserId || 'anonymous-chat-user',
          username: currentUsername || 'Anonymous Viewer'
        },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
      });

      newSocket.on('connect', () => {
        console.log('StreamChat: Socket.IO connection established', newSocket.id);
        setIsConnected(true);
        newSocket.emit('joinChatRoom', { streamId });
      });

      newSocket.on('newChatMessage', (message: ChatMessage) => {
        console.log('StreamChat: Received new message', message);
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('chatHistory', (history: ChatMessage[]) => {
        console.log('StreamChat: Received chat history', history);
        setMessages(history);
        setIsLoading(false);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('StreamChat: Socket.IO disconnected', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('StreamChat: Socket.IO connection error', error);
        setIsConnected(false);
      });

      socketRef.current = newSocket;

      return () => {
        if (newSocket) {
          console.log('StreamChat: Disconnecting Socket.IO on cleanup');
          newSocket.emit('leaveChatRoom', { streamId });
          newSocket.disconnect();
        }
        socketRef.current = null;
      };
    }
  }, [streamId, runtimeConfig, isConfigLoading, currentUserId, currentUsername, isAuthLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!isAuthenticated || !socketRef.current || !socketRef.current.connected) {
      toast.error(isAuthenticated ? "Chat not connected. Please wait." : "You must be logged in to send messages");
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

    socketRef.current.emit('sendChatMessage', chatMessage, (ack: any) => {
      if (ack && ack.error) {
        toast.error(`Failed to send message: ${ack.message || 'Server error'}`);
        console.error("StreamChat: Error sending message - ack:", ack);
      } else {
        setNewMessage('');
      }
      setIsSending(false);
    });
  };

  if (isConfigLoading || isAuthLoading) {
    return (
      <div className={`flex flex-col h-full bg-opacity-70 bg-black rounded-lg overflow-hidden items-center justify-center ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <p className="text-white/70 mt-2">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-opacity-70 bg-black rounded-lg overflow-hidden ${className}`}>
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
              className={`flex items-start space-x-2 ${message.userId === currentUserId ? 'justify-end' : ''}`}
            >
              <div 
                className={`px-3 py-2 rounded-lg max-w-[80%] break-words ${
                  message.userId === currentUserId 
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' 
                    : 'bg-[var(--secondary)] text-[var(--secondary-foreground)]'
                }`}
              >
                <div className="text-xs font-medium opacity-80 mb-1">
                  {message.username || 'Anonymous'}
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
            placeholder={isAuthenticated ? (isConnected ? "Send a message..." : "Connecting chat...") : "Login to chat..."}
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