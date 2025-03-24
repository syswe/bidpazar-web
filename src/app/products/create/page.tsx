'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Category, getCategories, createProduct, uploadProductImages, uploadProductVideos } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function CreateProductPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // File upload states
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [videoPreviewUrls, setVideoPreviewUrls] = useState<string[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
        if (data.length > 0) {
          setCategoryId(data[0].id);
        }
      } catch (err) {
        console.error('Kategoriler yüklenirken hata oluştu:', err);
        setError('Kategoriler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
      }
    };

    fetchCategories();
  }, []);

  // Handle image file selection
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);

      // Check if adding these files would exceed the limit
      if (imageFiles.length + newFiles.length > 5) {
        setError('En fazla 5 resim yükleyebilirsiniz.');
        return;
      }

      // Create preview URLs for the images
      const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));

      setImageFiles([...imageFiles, ...newFiles]);
      setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
    }
  };

  // Handle video file selection
  const handleVideoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);

      // Check if adding these files would exceed the limit
      if (videoFiles.length + newFiles.length > 2) {
        setError('En fazla 2 video yükleyebilirsiniz.');
        return;
      }

      // Create preview URLs for the videos
      const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));

      setVideoFiles([...videoFiles, ...newFiles]);
      setVideoPreviewUrls([...videoPreviewUrls, ...newPreviewUrls]);
    }
  };

  // Remove an image
  const handleRemoveImage = (index: number) => {
    const newFiles = [...imageFiles];
    const newPreviewUrls = [...imagePreviewUrls];

    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(newPreviewUrls[index]);

    newFiles.splice(index, 1);
    newPreviewUrls.splice(index, 1);

    setImageFiles(newFiles);
    setImagePreviewUrls(newPreviewUrls);
  };

  // Remove a video
  const handleRemoveVideo = (index: number) => {
    const newFiles = [...videoFiles];
    const newPreviewUrls = [...videoPreviewUrls];

    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(newPreviewUrls[index]);

    newFiles.splice(index, 1);
    newPreviewUrls.splice(index, 1);

    setVideoFiles(newFiles);
    setVideoPreviewUrls(newPreviewUrls);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title || !description || !price || !categoryId) {
      setError('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Ürün oluştur
      const product = await createProduct({
        title,
        description,
        price: parseFloat(price),
        categoryId
      });

      // Upload images if any
      if (imageFiles.length > 0) {
        await uploadProductImages(product.id, imageFiles);
      }

      // Upload videos if any
      if (videoFiles.length > 0) {
        await uploadProductVideos(product.id, videoFiles);
      }

      setSuccess('Ürün başarıyla oluşturuldu!');

      // Kısa bir süre sonra ürün detay sayfasına yönlendir
      setTimeout(() => {
        router.push(`/products/${product.id}`);
      }, 1500);

    } catch (err) {
      console.error('Ürün oluşturulurken hata:', err);
      setError('Ürün oluşturulurken bir hata meydana geldi. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      videoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <h1 className="text-3xl font-bold mb-8 text-[var(--foreground)]">Yeni Ürün Ekle</h1>

        {error && (
          <div className="mb-6 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 p-4 rounded-md">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[var(--background)] p-6 rounded-lg shadow-md border border-[var(--border)]">
          <div className="mb-4">
            <label htmlFor="title" className="block text-[var(--foreground)] mb-2">
              Ürün Adı *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-[var(--foreground)] mb-2">
              Açıklama *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full px-4 py-2 border rounded-md bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="price" className="block text-[var(--foreground)] mb-2">
              Fiyat (TL) *
            </label>
            <input
              type="number"
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-4 py-2 border rounded-md bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="category" className="block text-[var(--foreground)] mb-2">
              Kategori *
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-[var(--foreground)] mb-2">
              Ürün Resimleri (en fazla 5 resim)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {imagePreviewUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Preview ${index}`}
                    className="h-24 w-24 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {imageFiles.length < 5 && (
                <label className="h-24 w-24 border-2 border-dashed border-[var(--border)] flex items-center justify-center rounded-md text-[var(--muted-foreground)] cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    multiple
                  />
                  <span>+</span>
                </label>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-[var(--foreground)] mb-2">
              Ürün Videoları (en fazla 2 video)
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {videoPreviewUrls.map((url, index) => (
                <div key={index} className="relative">
                  <video
                    src={url}
                    className="h-24 w-24 object-cover rounded-md"
                    controls
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVideo(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {videoFiles.length < 2 && (
                <label className="h-24 w-24 border-2 border-dashed border-[var(--border)] flex items-center justify-center rounded-md text-[var(--muted-foreground)] cursor-pointer">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                    multiple
                  />
                  <span>+</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border rounded-md border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Gönderiliyor...' : 'Ürün Ekle'}
            </button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
} 