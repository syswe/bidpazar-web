"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import {
  LiveStream,
  getLiveStreams,
  deleteLiveStream,
  endLiveStream,
  startLiveStream,
  updateLiveStream,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  Trash2,
  Edit,
  Eye,
  PlayCircle,
  StopCircle,
  RefreshCcw,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

// Add an interface for the edit modal state
interface StreamEditFormData {
  title: string;
  description: string;
  thumbnailUrl?: string;
}

export default function AdminStreamsPage() {
  const router = useRouter();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStreamId, setEditStreamId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<StreamEditFormData>({
    title: "",
    description: "",
    thumbnailUrl: "",
  });

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
      console.error("Yayınlar yüklenirken hata:", err);
      setError("Yayınlar yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStream = async (streamId: string) => {
    if (actionInProgress) return;

    setDeleteError(null);

    if (!confirm("Bu yayını silmek istediğinize emin misiniz?")) {
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
        setStreams(streams.filter((stream) => stream.id !== streamId));
        setActionSuccess("Yayın başarıyla silindi");
        setTimeout(() => setActionSuccess(null), 3000);
        return; // Exit the function on success
      } catch (err: unknown) {
        console.error(
          `Yayın silme işlemi başarısız (Deneme ${attempt}/${maxRetries}):`,
          err
        );
        lastError = err;

        // On the last attempt, don't wait, just proceed to error handling
        if (attempt < maxRetries) {
          // Wait a bit before the next attempt (increase wait time for each attempt)
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }

    // If we get here, all attempts failed
    let errorMessage = "Yayın silme işlemi başarısız oldu.";

    // Add more specific error messages
    if (lastError instanceof Error) {
      errorMessage += " Hata: " + lastError.message;

      // Log the full error for debugging
      console.error("Detailed error:", lastError);

      // Check if it's an "Unexpected token" error (HTML instead of JSON)
      if (lastError.message.includes("Unexpected token")) {
        errorMessage +=
          " Sunucu uygun bir yanıt döndürmedi. Lütfen daha sonra tekrar deneyin veya sistem yöneticisiyle iletişime geçin.";
      } else if (lastError.message.includes("Failed to fetch")) {
        errorMessage +=
          " Sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.";
      } else if (lastError.message.includes("API endpoint not found")) {
        errorMessage +=
          " API endpoint bulunamadı. Sistem yapılandırmasını kontrol edin.";
      } else if (lastError.message.includes("Authentication required")) {
        errorMessage +=
          " Oturum süresi dolmuş olabilir. Lütfen tekrar giriş yapın ve deneyin.";
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

  // Handle ending a live stream
  const handleEndStream = async (streamId: string) => {
    if (actionInProgress) return;

    if (!confirm("Bu yayını sonlandırmak istediğinize emin misiniz?")) {
      return;
    }

    try {
      setActionInProgress(streamId);
      const token = localStorage.getItem("token") || "";
      await endLiveStream(streamId, token);

      // Update the stream status locally
      setStreams(
        streams.map((stream) =>
          stream.id === streamId
            ? { ...stream, status: "ENDED" as const }
            : stream
        )
      );

      setActionSuccess("Yayın başarıyla sonlandırıldı");
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error("Yayın sonlandırma hatası:", err);
      setDeleteError(`Yayın sonlandırılamadı: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle starting a scheduled stream
  const handleStartStream = async (streamId: string) => {
    if (actionInProgress) return;

    if (!confirm("Bu yayını başlatmak istediğinize emin misiniz?")) {
      return;
    }

    try {
      setActionInProgress(streamId);
      const token = localStorage.getItem("token") || "";
      await startLiveStream(streamId, token);

      // Update the stream status locally
      setStreams(
        streams.map((stream) =>
          stream.id === streamId
            ? { ...stream, status: "LIVE" as const }
            : stream
        )
      );

      setActionSuccess("Yayın başarıyla başlatıldı");
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error("Yayın başlatma hatası:", err);
      setDeleteError(`Yayın başlatılamadı: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Edit stream function
  const handleEditStream = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editStreamId) return;

    try {
      setActionInProgress(editStreamId);

      // Make API call to update the stream
      const updatedStream = await updateLiveStream(editStreamId, {
        title: editFormData.title,
        description: editFormData.description,
        thumbnailUrl: editFormData.thumbnailUrl,
      });

      // Update local state with the returned data from API
      setStreams(
        streams.map((stream) =>
          stream.id === editStreamId ? updatedStream : stream
        )
      );

      setActionSuccess("Yayın bilgileri güncellendi");
      setTimeout(() => setActionSuccess(null), 3000);

      // Close the modal
      setShowEditModal(false);
      setEditStreamId(null);
    } catch (err: any) {
      console.error("Yayın güncelleme hatası:", err);
      setDeleteError(`Yayın güncellenemedi: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const openEditModal = (stream: LiveStream) => {
    setEditStreamId(stream.id);
    setEditFormData({
      title: stream.title,
      description: stream.description || "",
      thumbnailUrl: stream.thumbnailUrl || "",
    });
    setShowEditModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
            <PlayCircle className="w-3 h-3 mr-1" />
            Planlanmış
          </span>
        );
      case "LIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            Canlı
          </span>
        );
      case "ENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
            <CheckCircle className="w-3 h-3 mr-1" />
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

  // Filter streams based on status
  const filteredStreams =
    filterStatus === "all"
      ? streams
      : streams.filter((stream) => stream.status === filterStatus);

  return (
    <AdminLayout title="Canlı Yayınlar">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
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
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Canlı Yayın Listesi
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Toplam {streams.length} yayın bulunuyor.
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={fetchStreams}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Yenile
              </button>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-sm"
              >
                <option value="all">Tüm Yayınlar</option>
                <option value="SCHEDULED">Planlanmış Yayınlar</option>
                <option value="LIVE">Aktif Yayınlar</option>
                <option value="ENDED">Sonlanan Yayınlar</option>
              </select>
            </div>
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

          {actionSuccess && (
            <div className="bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-200 p-4 rounded-lg mb-4">
              {actionSuccess}
              <button
                onClick={() => setActionSuccess(null)}
                className="ml-4 bg-green-100 dark:bg-green-800 px-3 py-1 rounded-md text-sm"
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
                      Başlangıç Zamanı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStreams.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        Bu filtrelere uygun yayın bulunamadı
                      </td>
                    </tr>
                  ) : (
                    filteredStreams.map((stream) => (
                      <tr
                        key={stream.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          <Link
                            href={`/admin/streams/${stream.id}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                          >
                            {stream.title}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {stream.description
                              ? stream.description.length > 50
                                ? stream.description.substring(0, 50) + "..."
                                : stream.description
                              : "Açıklama bulunmuyor"}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stream.user?.username || "Bilinmiyor"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {getStatusBadge(stream.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stream.viewerCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stream._count?.listings || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stream.startTime
                            ? formatDate(stream.startTime)
                            : "Belirtilmedi"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => viewStream(stream.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Görüntüle"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => openEditModal(stream)}
                              className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                              title="Düzenle"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            {stream.status === "SCHEDULED" && (
                              <button
                                onClick={() => handleStartStream(stream.id)}
                                disabled={actionInProgress === stream.id}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                                title="Yayını Başlat"
                              >
                                <PlayCircle className="h-5 w-5" />
                              </button>
                            )}
                            {stream.status === "LIVE" && (
                              <button
                                onClick={() => handleEndStream(stream.id)}
                                disabled={actionInProgress === stream.id}
                                className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 disabled:opacity-50"
                                title="Yayını Sonlandır"
                              >
                                <StopCircle className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteStream(stream.id)}
                              disabled={actionInProgress === stream.id}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                              title="Sil"
                            >
                              <Trash2 className="h-5 w-5" />
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

      {/* Edit Stream Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Yayın Bilgilerini Düzenle
            </h3>
            <form onSubmit={handleEditStream}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Yayın Başlığı
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Küçük Resim URL'si
                  </label>
                  <input
                    type="text"
                    value={editFormData.thumbnailUrl || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        thumbnailUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress === editStreamId}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionInProgress === editStreamId
                    ? "Kaydediliyor..."
                    : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
