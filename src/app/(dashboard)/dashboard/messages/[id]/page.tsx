'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuth } from '@/lib/frontend-auth';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Send, 
  User, 
  CheckCircle2,
  Clock,
  Image,
  Paperclip,
  Smile,
  MoreHorizontal
} from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Get the ID from params
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  // Group messages by date
  const groupedMessages = messages.reduce((groups: Record<string, Message[]>, message) => {
    const date = new Date(message.createdAt).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=/dashboard/messages');
    }
  }, [isAuthenticated, isLoading, router]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0 && !isScrolling) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isScrolling]);

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
      
      // Optimistically add message
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        content: newMessage,
        createdAt: new Date().toISOString(),
        sender: {
          id: user?.id || '',
          username: user?.username || '',
        },
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      // Focus input field after sending
      inputRef.current?.focus();
      
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
        
        // Remove the temp message
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Replace the temp message with the real one
      setMessages(prev => 
        prev.map(msg => msg.id === tempId ? data : msg)
      );
      
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const messageDate = new Date(dateString);
    return format(messageDate, 'HH:mm');
  };

  const formatMessageDate = (dateString: string) => {
    const messageDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Bugün';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Dün';
    } else {
      return format(messageDate, 'd MMMM yyyy', { locale: tr });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsScrolling(!isAtBottom);
  };

  if (isLoading || loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="bg-[var(--background)] border-b p-4 flex items-center animate-pulse">
          <div className="w-8 h-8 bg-[var(--muted)] rounded-full mr-4"></div>
          <div className="flex-1">
            <div className="h-5 bg-[var(--muted)] rounded w-1/4 mb-2"></div>
            <div className="h-3 bg-[var(--muted)] rounded w-1/6"></div>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-hidden bg-[var(--muted)]/10">
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] h-16 rounded-lg ${
                    i % 2 === 0 ? 'bg-[var(--primary)]/30' : 'bg-[var(--muted)]/50'
                  } animate-pulse`}
                  style={{ width: `${Math.floor(Math.random() * 200) + 100}px` }}
                ></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--background)] border-t p-4 animate-pulse">
          <div className="flex items-center">
            <div className="flex-1 h-10 bg-[var(--muted)] rounded-lg"></div>
            <div className="w-10 h-10 bg-[var(--primary)]/30 rounded-lg ml-2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[var(--muted)]/5">
        <div className="bg-[var(--background)] border-b p-4 flex items-center">
          <Link href="/dashboard/messages" className="mr-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Mesajlar</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-6 rounded-xl max-w-md w-full shadow-lg border border-red-200 dark:border-red-800">
            <h2 className="font-bold text-xl mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Bir sorun oluştu
            </h2>
            <p className="mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-100 dark:bg-red-800/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-200 rounded-lg transition-colors font-medium"
              >
                Tekrar Dene
              </button>
              <Link 
                href="/dashboard/messages"
                className="px-4 py-2 bg-[var(--muted)] text-[var(--muted-foreground)] rounded-lg hover:bg-[var(--muted)]/80 transition-colors"
              >
                Mesajlara Dön
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isFirstMessageOfGroup = (index: number, messages: Message[]) => {
    if (index === 0) return true;
    const currentMessage = messages[index];
    const previousMessage = messages[index - 1];
    return currentMessage.sender.id !== previousMessage.sender.id;
  };

  const isLastMessageOfGroup = (index: number, messages: Message[]) => {
    if (index === messages.length - 1) return true;
    const currentMessage = messages[index];
    const nextMessage = messages[index + 1];
    return currentMessage.sender.id !== nextMessage.sender.id;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[var(--muted)]/5">
      {/* Conversation header */}
      <div className="bg-[var(--background)] border-b px-4 py-3 flex items-center shadow-sm sticky top-0 z-10">
        <Link 
          href="/dashboard/messages" 
          className="mr-3 p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 transition-colors"
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        
        <div className="flex items-center flex-1 min-w-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/70 flex items-center justify-center text-white shadow-md mr-3 flex-shrink-0">
            {otherUser?.name ? (
              otherUser.name.charAt(0).toUpperCase()
            ) : otherUser?.username ? (
              otherUser.username.charAt(0).toUpperCase()
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          
          <div className="overflow-hidden">
            <h1 className="text-lg font-semibold truncate">
              {otherUser?.name || otherUser?.username || 'User'}
            </h1>
            {otherUser?.username && otherUser?.name && (
              <p className="text-sm text-[var(--muted-foreground)] truncate">@{otherUser.username}</p>
            )}
          </div>
        </div>
        
        <button className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 transition-colors">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6" onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-20 h-20 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mb-4 animate-pulse">
              <Send className="h-8 w-8 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)]">Bu konuşma henüz başlamadı</h3>
            <p className="text-[var(--muted-foreground)] max-w-md mb-6">
              {otherUser?.name || otherUser?.username} ile ilk mesajını gönder ve konuşmayı başlat!
            </p>
            <div className="w-full max-w-md border-b border-[var(--border)] opacity-50"></div>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {Object.entries(groupedMessages).map(([date, dayMessages]) => (
              <div key={date} className="space-y-4">
                <div className="flex justify-center">
                  <div className="text-xs font-medium text-[var(--muted-foreground)] bg-[var(--background)] px-3 py-1 rounded-full shadow-sm border border-[var(--border)]">
                    {formatMessageDate(dayMessages[0].createdAt)}
                  </div>
                </div>
                
                {dayMessages.map((message, index) => {
                  const isCurrentUser = message.sender.id === user?.id;
                  const isFirstInGroup = isFirstMessageOfGroup(index, dayMessages);
                  const isLastInGroup = isLastMessageOfGroup(index, dayMessages);
                  
                  return (
                    <div 
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} max-w-[85%] items-end gap-2`}>
                        {isLastInGroup && !isCurrentUser && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--secondary)] to-[var(--secondary)]/60 flex items-center justify-center text-[var(--secondary-foreground)] text-xs font-medium flex-shrink-0 mb-1">
                            {message.sender.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        <div className={`group relative ${!isFirstInGroup && !isCurrentUser ? 'ml-10' : ''}`}>
                          <div
                            className={`p-3 ${
                              isCurrentUser
                                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] rounded-2xl rounded-tr-sm'
                                : 'bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl rounded-tl-sm shadow-sm'
                            } ${
                              // Apply specific styling for message bubble sequence
                              isFirstInGroup && !isLastInGroup 
                                ? isCurrentUser ? 'rounded-tr-2xl mb-1' : 'rounded-tl-2xl mb-1'
                                : !isFirstInGroup && !isLastInGroup
                                ? 'my-1'
                                : !isFirstInGroup && isLastInGroup
                                ? isCurrentUser ? 'rounded-tr-2xl mt-1' : 'rounded-tl-2xl mt-1'
                                : ''
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            <div className={`flex items-center gap-1 text-[10px] mt-1 ${
                              isCurrentUser ? 'text-[var(--primary-foreground)]/70 justify-end' : 'text-[var(--muted-foreground)]'
                            }`}>
                              <span>{formatMessageTime(message.createdAt)}</span>
                              {isCurrentUser && (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                          
                          {isLastInGroup && !isCurrentUser && (
                            <div className="text-xs text-[var(--muted-foreground)] mt-1 ml-1">
                              {message.sender.username}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {isScrolling && (
        <button 
          onClick={scrollToBottom}
          className="absolute bottom-24 right-6 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-full p-3 shadow-lg hover:shadow-xl transition-all"
          aria-label="Scroll to bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Message input */}
      <div className="bg-[var(--background)] border-t p-3 px-4 shadow-md">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Mesaj yazın..."
              className="w-full px-4 py-3 pr-12 rounded-full border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--background)] transition-all text-[var(--foreground)]"
              disabled={sending}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <button 
                type="button" 
                className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus:outline-none"
                aria-label="Add attachment"
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-[var(--primary)] text-[var(--primary-foreground)] p-3 rounded-full disabled:opacity-50 flex items-center justify-center hover:shadow-md transition-all"
            aria-label="Send message"
          >
            {sending ? (
              <Clock className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 