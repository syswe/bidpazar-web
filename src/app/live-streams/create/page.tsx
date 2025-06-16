// src/app/(streams)/live-streams/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createLiveStream } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Calendar, Upload } from 'lucide-react';
import { getToken } from '@/lib/frontend-auth';
import { v4 as uuidv4 } from 'uuid';
import StreamTermsModal from '@/components/StreamTermsModal';

export default function CreateLiveStreamPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnailUrl: '',
    startTime: '',
    roomName: '', // For Jitsi room name
  });

  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Handle browser-only code in useEffect
  useEffect(() => {
    setIsMounted(true);
    setToken(getToken());
    
    // Generate a unique room name for the Jitsi meeting
    const uniqueRoomId = uuidv4().substring(0, 8);
    setFormData(prev => ({
      ...prev,
      roomName: `bidpazar-${uniqueRoomId}`
    }));
  }, []);

  // Only run this after the component has mounted (client-side only)
  useEffect(() => {
    if (isMounted && (!isAuthenticated || !token)) {
      router.push('/sign-in');
    }
  }, [isMounted, isAuthenticated, token, router]);

  // Don't render anything during SSR or if not authenticated
  if (!isMounted || !isAuthenticated || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-[var(--foreground)]">Yükleniyor...</p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir resim dosyası yükleyin.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // In a real app, you would upload this to your server/storage
    // For now, we'll just use the preview URL
    setFormData((prev) => ({ ...prev, thumbnailUrl: 'dummy-url' }));
  };

  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      setError('Yayın başlığı gereklidir.');
      return;
    }

    // Check if terms were already accepted
    const termsAccepted = localStorage.getItem('streamTermsAccepted');
    if (termsAccepted === 'true') {
      handleConfirmSubmit();
    } else {
      setShowTermsModal(true);
    }
  };

  const handleConfirmSubmit = async () => {
    setShowTermsModal(false);
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // In a real implementation, you would first upload the thumbnail
      // and then use the returned URL
      const dataToSend = {
        ...formData,
        // If we had thumbnail upload, we would use the real URL here
        thumbnailUrl: thumbnailPreview || undefined,
      };

      const response = await createLiveStream(dataToSend);
      setSuccess('Canlı yayın başarıyla oluşturuldu!');

      // Redirect to the new live stream page after a brief delay
      setTimeout(() => {
        router.push(`/live-streams/${response.id}`);
      }, 1500);
    } catch (err) {
      console.error('Error creating live stream:', err);
      setError('Canlı yayın oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-10 px-6">
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Yeni Canlı Yayın</h1>
          <p className="text-white/80">
            Koleksiyonunuzu canlı olarak sergileyin ve izleyicilerinizle etkileşime geçin
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <Link href="/live-streams" className="text-[var(--accent)] hover:text-[var(--accent)]/80 flex items-center gap-2 group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span>Canlı Yayınlara Dön</span>
          </Link>
        </div>

        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-6 pb-2 border-b border-[var(--border)]">
            <span className="border-b-3 border-[var(--accent)] pb-1">Yayın Detayları</span>
          </h2>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-700">{success}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitClick} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-[var(--foreground)] font-medium mb-2">
                    Yayın Başlığı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full p-3 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                    placeholder="Örn: Antika Saat Koleksiyonum"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-[var(--foreground)] font-medium mb-2">
                    Açıklama
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={5}
                    className="w-full p-3 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                    placeholder="Yayında neler olacağını anlatın"
                  />
                </div>

                <div>
                  <label htmlFor="startTime" className="block text-[var(--foreground)] font-medium mb-2">
                    Başlangıç Zamanı
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Calendar size={18} className="text-[var(--foreground)]/50" />
                    </div>
                    <input
                      type="datetime-local"
                      id="startTime"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      className="w-full p-3 pl-10 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                    />
                  </div>
                  <p className="text-sm text-[var(--foreground)]/60 mt-2">
                    Boş bırakırsanız, yayın &quot;Planlanmış&quot; olarak kaydedilir.
                  </p>
                </div>

                <div>
                  <label className="block text-[var(--foreground)] font-medium mb-2">
                    Jitsi Oda Bilgisi
                  </label>
                  <div className="p-3 border border-[var(--border)] rounded-lg bg-[var(--background)]">
                    <p className="text-sm text-[var(--foreground)]/80">
                      Otomatik oluşturulan oda adı: <strong>{formData.roomName}</strong>
                    </p>
                    <p className="text-xs text-[var(--foreground)]/60 mt-1">
                      Bu bilgi, yayınınız için oluşturulan benzersiz bir oda adıdır ve değiştirilemez.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="thumbnail" className="block text-[var(--foreground)] font-medium mb-2">
                  Kapak Görseli
                </label>
                <div className="mt-2 flex flex-col items-center">
                  {thumbnailPreview ? (
                    <div className="relative w-full aspect-video mb-4">
                      <img
                        src={thumbnailPreview}
                        alt="Kapak görseli önizleme"
                        className="h-full w-full object-cover rounded-xl shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailPreview(null);
                          setFormData((prev) => ({ ...prev, thumbnailUrl: '' }));
                        }}
                        className="absolute top-2 right-2 bg-[var(--background)] text-red-500 p-2 rounded-full shadow-lg hover:bg-red-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="thumbnail-upload"
                      className="w-full h-48 cursor-pointer border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl flex flex-col items-center justify-center bg-[var(--background)] hover:bg-[var(--accent)]/5 transition-colors"
                    >
                      <Upload className="h-12 w-12 text-[var(--accent)] mb-2" />
                      <span className="text-[var(--foreground)]">
                        Kapak görseli eklemek için tıklayın
                      </span>
                      <p className="text-sm text-[var(--foreground)]/60 mt-1">
                        PNG, JPG veya GIF (16:9 önerilir)
                      </p>
                    </label>
                  )}
                  <input
                    id="thumbnail-upload"
                    name="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="sr-only"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-8 border-t border-[var(--border)]">
              <Link
                href="/live-streams"
                className="px-6 py-3 border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:border-[var(--foreground)] transition-colors"
              >
                İptal
              </Link>
              <button
                type="submit"
                className="px-8 py-3 bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    <span>İşleniyor...</span>
                  </>
                ) : (
                  <span>Yayın Oluştur</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Stream Terms Modal */}
      <StreamTermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onConfirm={handleConfirmSubmit}
      />
    </div>
  );
} 