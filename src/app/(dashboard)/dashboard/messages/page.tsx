'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Conversation as ApiConversation,
  Notification as ApiNotification,
  Message as ApiMessage,
  getUserConversations, 
  getUserNotifications, 
  markNotificationsAsRead as apiMarkNotificationsAsRead,
  findUserByUsername, 
  User as ApiUser
} from '@/lib/api';
import { MessageSquare, Search, Bell, CheckCircle, AlertCircle, MessageCircle, Plus, X, Send } from 'lucide-react';

interface Conversation {
  id: string;
  updatedAt: string;
  otherParticipant: {
    id: string;
    username: string;
    name?: string;
  };
  latestMessage?: ApiMessage;
  _count?: { messages: number };
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
  };
}

interface Notification {
  id: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showNewMessageForm, setShowNewMessageForm] = useState(false);
  const [newMessageUsername, setNewMessageUsername] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('inbox');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=/dashboard/messages');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    async function fetchConversationsAndNotifications() {
      if (!isAuthenticated || !user) return;

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching conversations and notifications using API functions');
        
        const [apiConversations, notificationsResult] = await Promise.all([
          getUserConversations(),
          getUserNotifications()
        ]);

        console.log('API conversations result:', apiConversations);
        console.log('API notifications result:', notificationsResult);

        // Ensure apiConversations is an array before mapping
        const conversationsArray = Array.isArray(apiConversations) ? apiConversations : [];
        const mappedConversations: Conversation[] = conversationsArray.map((apiConvo: ApiConversation) => {
          const otherParticipant = apiConvo.participants?.find(p => p.id !== user?.id) || 
                                   apiConvo.participants?.[0] || 
                                   { id: 'unknown', username: 'Unknown User' };

          return {
            id: apiConvo.id,
            updatedAt: apiConvo.updatedAt,
            otherParticipant: {
              id: otherParticipant.id,
              username: otherParticipant.username,
              name: otherParticipant.name,
            },
            latestMessage: apiConvo.latestMessage,
            _count: apiConvo._count,
          };
        });

        console.log('Mapped conversations:', mappedConversations);
        setConversations(mappedConversations);
        
        // Ensure notifications array exists before mapping
        const notificationsArray = notificationsResult?.notifications || [];
        const mappedNotifications: Notification[] = notificationsArray.map((apiNotif: ApiNotification) => ({
           id: apiNotif.id,
           content: apiNotif.content,
           type: apiNotif.type,
           isRead: apiNotif.isRead,
           createdAt: apiNotif.createdAt,
        }));

        console.log('Mapped notifications:', mappedNotifications);
        setNotifications(mappedNotifications);
        setUnreadNotificationsCount(notificationsResult?.unreadCount || 0);

      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load your messages');
      } finally {
        setLoading(false);
      }
    }

    fetchConversationsAndNotifications();
  }, [isAuthenticated, user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Dün';
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const markNotificationsAsRead = async (notificationIds: string[]) => {
    try {
      const result = await apiMarkNotificationsAsRead();
      
      if (!result.success) {
        throw new Error('Failed to mark notifications as read via API');
      }
      
      setNotifications(prevNotifications =>
        prevNotifications.map(notification =>
          notificationIds.includes(notification.id)
            ? { ...notification, isRead: true }
            : notification
        )
      );
      setUnreadNotificationsCount(prev => Math.max(0, prev - notificationIds.length));

    } catch (err: any) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const handleFindUser = async () => {
    if (!newMessageUsername.trim()) return;
    
    try {
      setSearchingUser(true);
      setUserSearchError(null);
      
      console.log(`Searching for user with username: ${newMessageUsername}`);
      
      const foundUser: ApiUser | null = await findUserByUsername(newMessageUsername);
      
      if (foundUser) {
        console.log('User found:', foundUser);
        router.push(`/dashboard/messages/${foundUser.id}`);
        setShowNewMessageForm(false);
        setNewMessageUsername('');
      } else {
        setUserSearchError('Kullanıcı bulunamadı');
      }
      
    } catch (err: any) {
      console.error('Kullanıcı aranırken hata:', err);
      setUserSearchError(err.message || 'Kullanıcı aranırken bir hata oluştu');
    } finally {
      setSearchingUser(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Mesajlar</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-[var(--secondary)]/30 rounded-lg mb-6"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex space-x-4">
              <div className="rounded-full bg-[var(--secondary)]/30 h-12 w-12"></div>
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-[var(--secondary)]/30 rounded w-3/4"></div>
                <div className="h-4 bg-[var(--secondary)]/30 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Mesajlar</h1>
        <div className="bg-red-100 border border-red-300 text-red-700 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Bir hata oluştu</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md shadow-sm hover:opacity-90 transition-opacity"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Mesajlar</h1>
        <button
          onClick={() => setShowNewMessageForm(!showNewMessageForm)}
          className="flex items-center gap-2 bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg shadow-sm hover:opacity-90 transition-all text-sm font-medium"
        >
          {showNewMessageForm ? <X size={18} /> : <Plus size={18} />}
          {showNewMessageForm ? 'İptal' : 'Yeni Mesaj'}
        </button>
      </div>

      {showNewMessageForm && (
        <div className="mb-6 p-5 border border-[var(--border)] rounded-lg shadow-sm bg-[var(--background)] premium-shadow">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <MessageSquare size={18} />
            Yeni Mesaj Gönder
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1 text-[var(--foreground)]">
                Kullanıcı adı
              </label>
              <div className="flex relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-[var(--muted-foreground)]" />
                </div>
                <input
                  type="text"
                  id="username"
                  value={newMessageUsername}
                  onChange={(e) => {
                    setNewMessageUsername(e.target.value);
                    setUserSearchError(null);
                  }}
                  placeholder="Mesaj göndermek istediğiniz kullanıcı adı"
                  className="pl-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                />
                <button
                  onClick={handleFindUser}
                  disabled={searchingUser || !newMessageUsername.trim()}
                  className="ml-2 bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap shadow-sm"
                >
                  {searchingUser ? 'Aranıyor...' : 'Kullanıcı Bul'}
                  {!searchingUser && <Send size={14} />}
                </button>
              </div>
              {userSearchError && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle size={14} /> {userSearchError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-[var(--border)] mb-6">
          <TabsList className="w-full flex justify-start h-auto bg-transparent p-0 gap-1">
            <TabsTrigger 
              value="inbox" 
              className={`relative py-3 px-6 rounded-t-lg border-b-2 ${
                activeTab === 'inbox' 
                  ? 'border-[var(--primary)] text-[var(--primary)]' 
                  : 'border-transparent hover:text-[var(--primary)] hover:bg-[var(--secondary)]/10'
              } transition-all`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={18} />
                <span>Gelen Kutusu</span>
                {conversations.length > 0 && (
                  <span className="ml-1 bg-[var(--primary)] text-[var(--primary-foreground)] text-xs rounded-full px-2 py-0.5 inline-flex items-center justify-center min-w-[20px]">
                    {conversations.length}
                  </span>
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className={`relative py-3 px-6 rounded-t-lg border-b-2 ${
                activeTab === 'notifications' 
                  ? 'border-[var(--primary)] text-[var(--primary)]' 
                  : 'border-transparent hover:text-[var(--primary)] hover:bg-[var(--secondary)]/10'
              } transition-all`}
            >
              <div className="flex items-center gap-2">
                <Bell size={18} />
                <span>Bildirimler</span>
                {unreadNotificationsCount > 0 && (
                  <span className="ml-1 bg-[var(--accent)] text-[var(--accent-foreground)] text-xs rounded-full px-2 py-0.5 inline-flex items-center justify-center min-w-[20px]">
                    {unreadNotificationsCount}
                  </span>
                )}
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inbox" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map(conversation => (
                <Link 
                  key={conversation.id} 
                  href={`/dashboard/messages/${conversation.id}`}
                  className="block"
                >
                  <div className="border border-[var(--border)] rounded-lg p-4 hover:bg-[var(--secondary)]/10 transition-colors flex items-center gap-4 shadow-sm hover:shadow hover:border-[var(--primary)]/20 bg-[var(--background)]">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-lg font-bold shadow-sm">
                        {conversation.otherParticipant.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-lg truncate text-[var(--foreground)]">
                          {conversation.otherParticipant.name || conversation.otherParticipant.username}
                        </h3>
                        <time className="text-sm text-[var(--muted-foreground)] whitespace-nowrap ml-2">
                          {formatDate(conversation.updatedAt)}
                        </time>
                      </div>
                      <p className="text-[var(--muted-foreground)] truncate mt-1">
                        {conversation.latestMessage?.content || "Henüz mesaj yok"}
                      </p>
                    </div>
                    {conversation._count && conversation._count.messages > 0 && (
                      <div className="ml-2 flex-shrink-0">
                        <span className="bg-[var(--primary)] text-[var(--primary-foreground)] text-xs rounded-full px-2 py-1 inline-flex items-center justify-center min-w-[24px]">
                          {conversation._count.messages}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-[var(--border)] rounded-lg bg-[var(--background)] premium-shadow">
              <div className="mb-6 relative">
                <div className="w-20 h-20 rounded-full bg-[var(--secondary)]/20 flex items-center justify-center text-[var(--primary)]">
                  <MessageSquare size={40} className="opacity-70" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[var(--accent)] rounded-full flex items-center justify-center text-white animate-pulse">
                  <Plus size={18} />
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-[var(--foreground)]">Mesaj kutunuz boş</h2>
              <p className="text-[var(--muted-foreground)] max-w-md mb-6">
                Henüz hiç mesajınız yok. Diğer kullanıcılarla iletişime geçmek için yeni bir konuşma başlatın.
              </p>
              <button
                onClick={() => setShowNewMessageForm(true)}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-3 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 font-medium"
              >
                <MessageCircle size={18} />
                Yeni Konuşma Başlat
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-0 space-y-3 focus-visible:outline-none focus-visible:ring-0">
          {notifications.length > 0 ? (
            <>
              <div className="space-y-3">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`border rounded-lg p-4 transition-all shadow-sm ${
                      !notification.isRead
                        ? 'bg-[var(--primary)]/5 border-[var(--primary)]/20'
                        : 'bg-[var(--background)] border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {notification.type === 'BID_WON' && (
                          <div className="bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200 w-10 h-10 rounded-full flex items-center justify-center shadow-sm">
                            <CheckCircle size={20} />
                          </div>
                        )}
                        {notification.type === 'BID_OUTBID' && (
                          <div className="bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200 w-10 h-10 rounded-full flex items-center justify-center shadow-sm">
                            <AlertCircle size={20} />
                          </div>
                        )}
                        {notification.type === 'MESSAGE' && (
                          <div className="bg-[var(--primary)]/10 text-[var(--primary)] w-10 h-10 rounded-full flex items-center justify-center shadow-sm">
                            <MessageCircle size={20} />
                          </div>
                        )}
                        {notification.type === 'SYSTEM' && (
                          <div className="bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-200 w-10 h-10 rounded-full flex items-center justify-center shadow-sm">
                            <Bell size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start flex-wrap gap-1">
                          <h3 className={`font-medium text-[var(--foreground)] ${!notification.isRead ? 'font-semibold' : ''}`}>
                            {notification.type === 'BID_WON' && 'Açık Artırma Kazanıldı'}
                            {notification.type === 'BID_OUTBID' && 'Açık Artırma Güncelleme'}
                            {notification.type === 'MESSAGE' && 'Yeni Mesaj'}
                            {notification.type === 'SYSTEM' && 'Sistem Bildirimi'}
                          </h3>
                          <time className="text-sm text-[var(--muted-foreground)] whitespace-nowrap">
                            {formatDate(notification.createdAt)}
                          </time>
                        </div>
                        <p className={`text-[var(--foreground)] mt-1 ${!notification.isRead ? 'font-medium' : ''}`}>
                          {notification.content}
                        </p>
                        {!notification.isRead && (
                          <button
                            onClick={() => markNotificationsAsRead([notification.id])}
                            className="mt-2 text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                          >
                            <CheckCircle size={12} />
                            Okundu olarak işaretle
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {unreadNotificationsCount > 0 && (
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => markNotificationsAsRead(
                      notifications
                        .filter(n => !n.isRead)
                        .map(n => n.id)
                    )}
                    className="text-sm text-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <CheckCircle size={14} />
                    Tümünü okundu olarak işaretle
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-[var(--border)] rounded-lg bg-[var(--background)] premium-shadow">
              <div className="mb-6">
                <div className="w-20 h-20 rounded-full bg-[var(--secondary)]/20 flex items-center justify-center text-[var(--accent)]">
                  <Bell size={40} className="opacity-70" />
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-[var(--foreground)]">Bildiriminiz yok</h2>
              <p className="text-[var(--muted-foreground)] max-w-md">
                Yeni bildirimleri burada görebilirsiniz. 
                Mesajlar, teklif güncellemeleri ve sistem bildirimleri için bu alanı kontrol edin.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 