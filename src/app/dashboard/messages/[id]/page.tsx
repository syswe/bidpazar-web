'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
  };
}

interface Conversation {
  id: string;
  messages: Message[];
  participants: {
    id: string;
    username: string;
    name?: string;
  }[];
}

export default function ConversationPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get the ID from params
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=/dashboard/messages');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    // Scroll to bottom of messages when they change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    async function fetchConversation() {
      if (!id || !isAuthenticated) return;

      try {
        setLoading(true);
        const { token } = getAuth();
        
        if (!token) {
          console.error('No token available - user not properly authenticated');
          setError('Authentication error - please try logging in again');
          return;
        }

        // First try to fetch as a conversation ID
        console.log(`Trying to fetch by conversation ID: ${id}`);
        let response = await fetch(`/api/messages/conversations/fetch/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        let data;
        
        // If that fails, try as a user ID
        if (!response.ok) {
          console.log(`Conversation not found by ID, trying as user ID: ${id}`);
          
          // Get or create a conversation with this user
          response = await fetch(`/api/messages/conversations/${id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (${response.status}):`, errorText);
            throw new Error('Failed to fetch conversation');
          }
          
          data = await response.json();
          
          // Now that we have the conversation, redirect to the conversation ID URL
          // This ensures both users see the same view
          if (data && data.id && data.id !== id) {
            console.log(`Redirecting to conversation ID: ${data.id}`);
            router.replace(`/dashboard/messages/${data.id}`);
            return; // Let the redirect handle the rerender
          }
        } else {
          data = await response.json();
        }
        
        console.log('Conversation data:', data);
        
        // Set conversation data
        setConversation(data);
        
        // Find the other user in the participants
        if (data.participants && Array.isArray(data.participants)) {
          const other = data.participants.find((p: { id: string }) => p.id !== user?.id);
          setOtherUser(other || null);
        }
        
        // Set messages
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages.sort((a: Message, b: Message) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ));
        }
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setError('Failed to load the conversation');
      } finally {
        setLoading(false);
      }
    }

    fetchConversation();
  }, [id, isAuthenticated, user?.id, router]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !conversation || !otherUser) return;
    
    try {
      setSending(true);
      const { token } = getAuth();
      
      if (!token) {
        console.error('No token available - user not properly authenticated');
        setError('Authentication error - please try logging in again');
        return;
      }
      
      const response = await fetch('/api/messages/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          content: newMessage,
          receiverId: otherUser.id,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Add the new message to the list
      setMessages(prev => [...prev, data]);
      
      // Clear the input
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Mesajlar</h1>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-2"></div>
          <div className="h-24 bg-gray-200 rounded mb-2"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Mesajlar</h1>
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm underline"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Conversation header */}
      <div className="bg-white dark:bg-gray-800 border-b p-4 flex items-center">
        <Link href="/dashboard/messages" className="mr-4">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">
            {otherUser?.name || otherUser?.username || 'User'}
          </h1>
          {otherUser?.username && otherUser?.name && (
            <p className="text-sm text-gray-500 dark:text-gray-400">@{otherUser.username}</p>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Henüz mesaj yok. Konuşmayı başlat!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(message => (
              <div 
                key={message.id}
                className={`flex ${message.sender.id === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] p-3 rounded-lg ${
                    message.sender.id === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.sender.id !== user?.id && (
                    <div className="font-medium text-xs mb-1">
                      {message.sender.username}
                    </div>
                  )}
                  <p className="break-words">{message.content}</p>
                  <span className="block text-xs opacity-70 mt-1">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="bg-white dark:bg-gray-800 border-t p-4">
        <form onSubmit={handleSendMessage} className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mesaj yazın..."
            className="flex-1 p-2 border rounded-lg mr-2 bg-white dark:bg-gray-700 dark:text-white"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-primary text-primary-foreground p-2 rounded-lg disabled:opacity-50 flex items-center justify-center"
          >
            {sending ? 'Gönderiliyor...' : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
} 