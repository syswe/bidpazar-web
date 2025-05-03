'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { LiveStream, getLiveStreams, deleteLiveStream } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function AdminStreamsPage() {
  const router = useRouter();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getLiveStreams();
      setStreams(data);
    } catch (err) {
      console.error('Yayınlar yüklenirken hata:', err);
      setError('Yayınlar yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStream = async (streamId: string) => {
    if (actionInProgress) return;

    setDeleteError(null);

    if (!confirm('Bu yayını silmek istediğinize emin misiniz?')) {
      return;
    }

    // We'll try up to 3 times with a small delay between attempts
    const maxRetries = 3;
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`Delete attempt ${attempt} for stream ${streamId}`);

      try {
        setActionInProgress(streamId);
        await deleteLiveStream(streamId);
        // If we get here, it worked! Update the streams list
        setStreams(streams.filter(stream => stream.id !== streamId));
        return; // Exit the function on success
      } catch (err: unknown) {
        console.error(`Yayın silme işlemi başarısız (Deneme ${attempt}/${maxRetries}):`, err);
        lastError = err;

        // On the last attempt, don't wait, just proceed to error handling
        if (attempt < maxRetries) {
          // Wait a bit before the next attempt (increase wait time for each attempt)
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
      }
    }

    // If we get here, all attempts failed
    let errorMessage = 'Yayın silme işlemi başarısız oldu.';

    // Add more specific error messages
    if (lastError instanceof Error) {
      errorMessage += ' Hata: ' + lastError.message;

      // Log the full error for debugging
      console.error('Detailed error:', lastError);

      // Check if it's an "Unexpected token" error (HTML instead of JSON)
      if (lastError.message.includes('Unexpected token')) {
        errorMessage += ' Sunucu uygun bir yanıt döndürmedi. Lütfen daha sonra tekrar deneyin veya sistem yöneticisiyle iletişime geçin.';
      } else if (lastError.message.includes('Failed to fetch')) {
        errorMessage += ' Sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.';
      } else if (lastError.message.includes('API endpoint not found')) {
        errorMessage += ' API endpoint bulunamadı. Sistem yapılandırmasını kontrol edin.';
      } else if (lastError.message.includes('Authentication required')) {
        errorMessage += ' Oturum süresi dolmuş olabilir. Lütfen tekrar giriş yapın ve deneyin.';
      }
    }

    setDeleteError(errorMessage);
    setActionInProgress(null);

    // Automatically refresh the streams list after an error
    // This helps in case a deletion actually succeeded but reported an error
    setTimeout(() => {
      fetchStreams();
    }, 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
            Planlanmış
          </span>
        );
      case 'LIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
            Canlı
          </span>
        );
      case 'ENDED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
            Sona Erdi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
            {status}
          </span>
        );
    }
  };

  const viewStream = (streamId: string) => {
    router.push(`/live-streams/${streamId}`);
  };

  return (
    <AdminLayout title="Canlı Yayınlar">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 p-4 rounded-lg">
          {error}
          <button
            onClick={fetchStreams}
            className="ml-4 bg-red-100 dark:bg-red-800 px-3 py-1 rounded-md text-sm"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Canlı Yayın Listesi
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Toplam {streams.length} yayın bulunuyor.
            </p>
          </div>

          {deleteError && (
            <div className="bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 p-4 rounded-lg mb-4">
              {deleteError}
              <button
                onClick={() => setDeleteError(null)}
                className="ml-4 bg-red-100 dark:bg-red-800 px-3 py-1 rounded-md text-sm"
              >
                Kapat
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Yayın
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Yayıncı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İzleyici Sayısı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ürün Sayısı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {streams.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Henüz yayın bulunmuyor
                      </td>
                    </tr>
                  ) : (
                    streams.map((stream) => (
                      <tr key={stream.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {stream.thumbnailUrl ? (
                                <img
                                  className="h-10 w-10 rounded-full object-cover"
                                  src={stream.thumbnailUrl}
                                  alt={stream.title}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                                  <span className="text-blue-600 dark:text-blue-300 font-medium">
                                    {stream.title.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {stream.title}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {stream.description?.slice(0, 50) || 'Açıklama yok'}
                                {stream.description && stream.description.length > 50 ? '...' : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {stream.user?.username || 'Bilinmeyen Kullanıcı'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(stream.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stream.viewerCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stream._count?.listings || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stream.startTime ? formatDate(new Date(stream.startTime)) : 'Henüz başlamadı'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => viewStream(stream.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Görüntüle
                            </button>
                            <button
                              onClick={() => handleDeleteStream(stream.id)}
                              disabled={actionInProgress === stream.id}
                              className={`text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ${actionInProgress === stream.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
} 