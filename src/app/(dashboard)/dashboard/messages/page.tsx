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

        const mappedConversations: Conversation[] = (apiConversations || []).map((apiConvo: ApiConversation) => {
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

        setConversations(mappedConversations);
        
        const mappedNotifications: Notification[] = (notificationsResult?.notifications || []).map((apiNotif: ApiNotification) => ({
           id: apiNotif.id,
           content: apiNotif.content,
           type: apiNotif.type,
           isRead: apiNotif.isRead,
           createdAt: apiNotif.createdAt,
        }));

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
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mesajlar</h1>
        <button
          onClick={() => setShowNewMessageForm(!showNewMessageForm)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium"
        >
          Yeni Mesaj
        </button>
      </div>

      {showNewMessageForm && (
        <div className="mb-6 p-4 border rounded-lg">
          <h2 className="text-lg font-medium mb-4">Yeni Mesaj Gönder</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1">
                Kullanıcı adı
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="username"
                  value={newMessageUsername}
                  onChange={(e) => {
                    setNewMessageUsername(e.target.value);
                    setUserSearchError(null);
                  }}
                  placeholder="Mesaj göndermek istediğiniz kullanıcı adı"
                  className="flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleFindUser}
                  disabled={searchingUser || !newMessageUsername.trim()}
                  className="ml-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {searchingUser ? 'Aranıyor...' : 'Ara'}
                </button>
              </div>
              {userSearchError && (
                <p className="text-red-500 text-sm mt-1">{userSearchError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="inbox" className="relative">
            Gelen Kutusu
            {conversations.length > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                {conversations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="relative">
            Bildirimler
            {unreadNotificationsCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {unreadNotificationsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          {conversations.length > 0 ? (
            <div className="space-y-4">
              {conversations.map(conversation => (
                <Link 
                  key={conversation.id} 
                  href={`/dashboard/messages/${conversation.id}`}
                  className="block"
                >
                  <div className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center">
                    <div className="flex-shrink-0 mr-4">
                      <div className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold">
                        {conversation.otherParticipant.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <h3 className="font-medium text-lg truncate">
                          {conversation.otherParticipant.name || conversation.otherParticipant.username}
                        </h3>
                        <time className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(conversation.updatedAt)}
                        </time>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 truncate">
                        {conversation.latestMessage?.content || "Henüz mesaj yok"}
                      </p>
                    </div>
                    {conversation._count && conversation._count.messages && conversation._count.messages > 0 && (
                      <div className="ml-4 flex-shrink-0">
                        <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                          {conversation._count.messages}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-gray-500 dark:text-gray-400 mb-4">Henüz hiç mesajınız yok</p>
              <button
                onClick={() => setShowNewMessageForm(true)}
                className="text-blue-500 hover:underline"
              >
                Yeni bir mesaj başlat
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`border rounded-lg p-4 ${
                    !notification.isRead
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : ''
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      {notification.type === 'BID_WON' && (
                        <div className="bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200 w-10 h-10 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
                          </svg>
                        </div>
                      )}
                      {notification.type === 'BID_OUTBID' && (
                        <div className="bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200 w-10 h-10 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                        </div>
                      )}
                      {notification.type === 'MESSAGE' && (
                        <div className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200 w-10 h-10 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </div>
                      )}
                      {notification.type === 'SYSTEM' && (
                        <div className="bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-200 w-10 h-10 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h3 className="font-medium">
                          {notification.type === 'BID_WON' && 'Açık Artırma Kazanıldı'}
                          {notification.type === 'BID_OUTBID' && 'Açık Artırma Güncelleme'}
                          {notification.type === 'MESSAGE' && 'Yeni Mesaj'}
                          {notification.type === 'SYSTEM' && 'Sistem Bildirimi'}
                        </h3>
                        <time className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(notification.createdAt)}
                        </time>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mt-1">
                        {notification.content}
                      </p>
                      {!notification.isRead && (
                        <button
                          onClick={() => markNotificationsAsRead([notification.id])}
                          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Okundu olarak işaretle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {unreadNotificationsCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => markNotificationsAsRead(
                      notifications
                        .filter(n => !n.isRead)
                        .map(n => n.id)
                    )}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Tümünü okundu olarak işaretle
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">Henüz bildiriminiz yok</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 