'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createLiveStream } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Calendar, Upload } from 'lucide-react';

export default function CreateLiveStreamPage() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnailUrl: '',
    startTime: '',
  });

  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    router.push('/sign-in');
    return null;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!formData.title) {
      setError('Yayın başlığı gereklidir.');
      setLoading(false);
      return;
    }

    try {
      // In a real implementation, you would first upload the thumbnail
      // and then use the returned URL
      const dataToSend = {
        ...formData,
        // If we had thumbnail upload, we would use the real URL here
        thumbnailUrl: thumbnailPreview || undefined,
      };

      const response = await createLiveStream(dataToSend, token!);
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/live-streams" className="text-primary hover:underline flex items-center gap-1">
          <ArrowLeft size={16} />
          <span>Canlı Yayınlara Dön</span>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Yeni Canlı Yayın Oluştur</h1>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 text-green-800 p-4 rounded-md mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Yayın Başlığı *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full p-2 border border-input rounded-md bg-background"
              placeholder="Yayın başlığı girin"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Açıklama
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full p-2 border border-input rounded-md bg-background"
              placeholder="Yayın açıklaması girin"
            />
          </div>

          <div>
            <label htmlFor="startTime" className="block text-sm font-medium mb-1">
              Başlangıç Zamanı
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Calendar size={16} className="text-muted-foreground" />
              </div>
              <input
                type="datetime-local"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full p-2 pl-10 border border-input rounded-md bg-background"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Boş bırakırsanız, yayın "Taslak" olarak kaydedilir.
            </p>
          </div>

          <div>
            <label htmlFor="thumbnail" className="block text-sm font-medium mb-1">
              Kapak Görseli
            </label>
            <div className="mt-1 flex items-center">
              {thumbnailPreview ? (
                <div className="relative">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="h-32 w-48 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnailPreview(null);
                      setFormData((prev) => ({ ...prev, thumbnailUrl: '' }));
                    }}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="thumbnail-upload"
                  className="cursor-pointer bg-muted hover:bg-muted/80 p-6 rounded-md flex flex-col items-center justify-center"
                >
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <span className="mt-2 block text-sm font-medium text-muted-foreground">
                    Kapak görseli eklemek için tıklayın
                  </span>
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

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push('/live-streams')}
              className="px-4 py-2 border border-input rounded-md"
              disabled={loading}
            >
              İptal
            </button>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md flex items-center justify-center min-w-32"
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-t-transparent border-primary-foreground rounded-full animate-spin"></div>
              ) : (
                'Yayın Oluştur'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 