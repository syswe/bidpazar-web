'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Bell, CheckCircle, AlertCircle, MessageCircle, RefreshCw, Check, Filter, ChevronRight, Info } from 'lucide-react';

interface Notification {
  id: string;
  content: string;
  type: string;
  isRead: boolean;
  relatedId?: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated]);
  
  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get token from localStorage with safer parsing
      let token = '';
      const authData = localStorage.getItem('auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          token = parsed.token || '';
        } catch (e) {
          console.error('Failed to parse auth data:', e);
        }
      }

      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching notifications: ${response.status}`);
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setError('Bildirimler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };
  
  const markAsRead = async (ids?: string[]) => {
    try {
      // Get token from localStorage
      let token = '';
      const authData = localStorage.getItem('auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          token = parsed.token || '';
        } catch (e) {
          console.error('Failed to parse auth data:', e);
        }
      }

      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          notificationIds: ids || [] 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error marking notifications as read: ${response.status}`);
      }
      
      // Update local state
      if (ids && ids.length > 0) {
        // Mark specific notifications as read
        setNotifications(prev => 
          prev.map(notification => 
            ids.includes(notification.id) 
              ? { ...notification, isRead: true } 
              : notification
          )
        );
      } else {
        // Mark all as read
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
      }
      
      // Update unread count
      setUnreadCount(0);
      
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE':
        return <MessageCircle className="h-6 w-6 text-blue-500" />;
      case 'SYSTEM':
        return <Bell className="h-6 w-6 text-purple-500" />;
      case 'BID_WON':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'BID_OUTBID':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Bell className="h-6 w-6 text-gray-500" />;
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true,
        locale: tr 
      });
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  const filteredNotifications = filterType 
    ? notifications.filter(n => n.type === filterType)
    : notifications;
  
  const notificationTypes = [
    { id: 'MESSAGE', label: 'Mesajlar', icon: <MessageCircle className="h-4 w-4" /> },
    { id: 'BID_WON', label: 'Kazanılanlar', icon: <CheckCircle className="h-4 w-4" /> },
    { id: 'BID_OUTBID', label: 'Teklifler', icon: <AlertCircle className="h-4 w-4" /> },
    { id: 'SYSTEM', label: 'Sistem', icon: <Info className="h-4 w-4" /> }
  ];
  
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center justify-center text-center p-10 bg-[var(--secondary)]/10 rounded-xl border border-[var(--border)] premium-shadow">
          <div className="w-20 h-20 flex items-center justify-center rounded-full bg-[var(--accent)]/10 mb-6 text-[var(--accent)]">
            <Bell className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-[var(--foreground)]">Bildirimlerinizi görmek için giriş yapmalısınız</h1>
          <p className="text-[var(--muted-foreground)] mb-6 max-w-md">
            Bildirimlerinizi görüntülemek ve yönetmek için lütfen hesabınıza giriş yapın.
          </p>
          <Link href="/sign-in" className="px-6 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md shadow-sm hover:shadow-md transition-all">
            Giriş Yap
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-[var(--foreground)]">
            <Bell className="h-8 w-8 text-[var(--primary)]" />
            <span>Bildirimler</span>
            {unreadCount > 0 && (
              <span className="ml-2 px-2.5 py-1 text-sm bg-[var(--accent)] text-white rounded-full inline-flex items-center justify-center min-w-[28px] shadow-sm">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1 ml-11">Tüm yeni aktiviteleri ve bildirimleri buradan takip edebilirsiniz</p>
        </div>
        
        <div className="flex items-center gap-2 ml-11 md:ml-0">
          <button 
            onClick={() => fetchNotifications()}
            className="p-2.5 rounded-lg bg-[var(--secondary)]/30 text-[var(--foreground)] hover:bg-[var(--secondary)]/50 transition-colors"
            title="Yenile"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-lg ${filterType ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--secondary)]/30 text-[var(--foreground)]'} hover:bg-[var(--secondary)]/50 transition-colors flex items-center gap-2`}
              title="Filtrele"
            >
              <Filter className="h-5 w-5" />
              {filterType && <span className="text-sm font-medium">{notificationTypes.find(t => t.id === filterType)?.label}</span>}
            </button>
            
            {showFilters && (
              <div className="absolute right-0 mt-2 w-48 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-10 overflow-hidden">
                <div className="p-2 border-b border-[var(--border)] text-sm font-medium text-[var(--muted-foreground)]">
                  Bildirim Türü
                </div>
                <button 
                  onClick={() => {
                    setFilterType(null);
                    setShowFilters(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-[var(--secondary)]/10 text-sm ${!filterType ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' : 'text-[var(--foreground)]'}`}
                >
                  <span>Hepsi</span>
                  {!filterType && <Check className="h-4 w-4" />}
                </button>
                {notificationTypes.map(type => (
                  <button 
                    key={type.id}
                    onClick={() => {
                      setFilterType(type.id);
                      setShowFilters(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-[var(--secondary)]/10 text-sm ${filterType === type.id ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' : 'text-[var(--foreground)]'}`}
                  >
                    <span className="flex-shrink-0">{type.icon}</span>
                    <span>{type.label}</span>
                    {filterType === type.id && <Check className="h-4 w-4 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {unreadCount > 0 && (
            <button 
              onClick={() => markAsRead()}
              className="px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Check className="h-4 w-4" />
              <span>Tümünü Okundu İşaretle</span>
            </button>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className="flex flex-col space-y-4 py-4">
          <div className="h-16 w-full bg-[var(--secondary)]/20 rounded-lg animate-pulse"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-4 border border-[var(--border)]/50 p-4 rounded-lg bg-[var(--background)] animate-pulse">
              <div className="w-12 h-12 rounded-full bg-[var(--secondary)]/30"></div>
              <div className="flex-1 space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 bg-[var(--secondary)]/30 rounded w-1/4"></div>
                  <div className="h-3 bg-[var(--secondary)]/30 rounded w-1/6"></div>
                </div>
                <div className="h-4 bg-[var(--secondary)]/30 rounded w-5/6"></div>
                <div className="h-3 bg-[var(--secondary)]/30 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 premium-shadow">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-lg mb-2">Bildirimler yüklenemedi</h3>
              <p>{error}</p>
              <button 
                onClick={fetchNotifications}
                className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors text-sm"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--background)] border border-[var(--border)] rounded-xl premium-shadow">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-[var(--secondary)]/20 flex items-center justify-center text-[var(--muted-foreground)]">
              <Bell className="h-12 w-12 opacity-60" />
            </div>
            
            {filterType ? (
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[var(--accent)]/20 rounded-full flex items-center justify-center text-[var(--accent)]">
                <Filter className="h-5 w-5" />
              </div>
            ) : (
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-[var(--primary)]/10 rounded-full flex items-center justify-center text-[var(--primary)]">
                <Check className="h-5 w-5" />
              </div>
            )}
          </div>
          
          {filterType ? (
            <>
              <h2 className="text-xl font-semibold mb-2 text-[var(--foreground)]">
                Bu türde bildiriminiz bulunmuyor
              </h2>
              <p className="text-[var(--muted-foreground)] max-w-md mb-6">
                Seçtiğiniz filtre ({notificationTypes.find(t => t.id === filterType)?.label}) ile 
                eşleşen bildirim bulunmuyor.
              </p>
              <button
                onClick={() => setFilterType(null)}
                className="px-5 py-2.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtreyi Temizle
              </button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-2 text-[var(--foreground)]">Bildiriminiz Bulunmuyor</h2>
              <p className="text-[var(--muted-foreground)] max-w-md">
                Yeni bildirimler geldiğinde burada gösterilecek. 
                Mesajlar, teklif güncellemeleri ve sistem bildirimleri için bu alanı kontrol edin.
              </p>
            </>
          )}
        </div>
      ) : (
        <div>
          {filterType && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Filter className="h-4 w-4" />
                <span>Gösteriliyor: </span>
                <span className="font-medium text-[var(--primary)]">{notificationTypes.find(t => t.id === filterType)?.label}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--secondary)]/20 text-xs">
                  {filteredNotifications.length}
                </span>
              </div>
              <button
                onClick={() => setFilterType(null)}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                Filtreyi temizle
              </button>
            </div>
          )}
          
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`flex p-5 rounded-xl border ${
                  notification.isRead 
                    ? 'bg-[var(--background)] border-[var(--border)]' 
                    : 'bg-[var(--primary)]/5 border-[var(--primary)]/20 premium-shadow-sm'
                } transition-all hover:shadow-md`}
              >
                <div className="mr-4 flex-shrink-0">
                  <div className={`rounded-full flex items-center justify-center w-12 h-12 ${
                    notification.type === 'MESSAGE' 
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : notification.type === 'SYSTEM'
                        ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                        : notification.type === 'BID_WON'
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                  } shadow-sm`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <h3 className={`text-base ${notification.isRead ? 'font-medium' : 'font-semibold'} text-[var(--foreground)]`}>
                      {notification.type === 'MESSAGE' && 'Yeni Mesaj'}
                      {notification.type === 'SYSTEM' && 'Sistem Bildirimi'}
                      {notification.type === 'BID_WON' && 'Açık Artırma Kazanıldı'}
                      {notification.type === 'BID_OUTBID' && 'Teklifiniz Aşıldı'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <time className="text-xs text-[var(--muted-foreground)] whitespace-nowrap px-2 py-1 rounded-full bg-[var(--secondary)]/10">
                        {formatDate(notification.createdAt)}
                      </time>
                      {!notification.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span>
                      )}
                    </div>
                  </div>
                  
                  <p className={`mt-2 text-[var(--foreground)] ${notification.isRead ? '' : 'font-medium'}`}>
                    {notification.content}
                  </p>
                  
                  <div className="mt-3 flex justify-between items-center">
                    {notification.relatedId && (
                      <Link 
                        href={`/dashboard/${
                          notification.type === 'MESSAGE' 
                            ? 'messages/' 
                            : notification.type === 'BID_WON' || notification.type === 'BID_OUTBID' 
                              ? 'bids/' 
                              : ''
                        }${notification.relatedId}`}
                        className="text-sm text-[var(--primary)] hover:underline flex items-center"
                      >
                        Detayları Gör <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                    
                    {!notification.isRead && (
                      <button 
                        onClick={() => markAsRead([notification.id])}
                        className="ml-auto text-xs text-[var(--primary)] hover:bg-[var(--primary)]/5 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Okundu İşaretle
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 