'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Category, getCategories, createProduct, addProductMedia, uploadProductImages, uploadProductVideos } from '@/lib/api';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function CreateProductPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // File upload states
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(['']); // Keep for backward compatibility
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

      // For backward compatibility, also handle image URLs if provided
      const validImageUrls = imageUrls.filter(url => url.trim() !== '');
      if (validImageUrls.length > 0) {
        for (const url of validImageUrls) {
          await addProductMedia(product.id, {
            url,
            type: 'image'
          });
        }
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

  // Keep these for backward compatibility
  const handleAddImageField = () => {
    setImageUrls([...imageUrls, '']);
  };

  const handleRemoveImageField = (index: number) => {
    const newImageUrls = [...imageUrls];
    newImageUrls.splice(index, 1);
    setImageUrls(newImageUrls);
  };

  const handleImageUrlChange = (index: number, value: string) => {
    const newImageUrls = [...imageUrls];
    newImageUrls[index] = value;
    setImageUrls(newImageUrls);
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />

        <main className="container mx-auto px-4 py-8 pt-24">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Yeni Ürün Ekle</h1>

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

          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="mb-4">
              <label htmlFor="title" className="block text-gray-700 dark:text-gray-300 mb-2">
                Ürün Adı *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="description" className="block text-gray-700 dark:text-gray-300 mb-2">
                Açıklama *
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="price" className="block text-gray-700 dark:text-gray-300 mb-2">
                Fiyat (TL) *
              </label>
              <input
                type="number"
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="category" className="block text-gray-700 dark:text-gray-300 mb-2">
                Kategori *
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                required
              >
                {categories.length === 0 ? (
                  <option value="">Kategori yükleniyor...</option>
                ) : (
                  categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">
                Ürün Görselleri (URL)
              </label>

              {imageUrls.map((url, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleImageUrlChange(index, e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 px-4 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />

                  {imageUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImageField(index)}
                      className="px-3 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800"
                    >
                      Sil
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddImageField}
                className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Başka Görsel URL'si Ekle
              </button>
            </div>

            {/* File Upload Section for Images */}
            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">
                Ürün Görselleri (Dosya Yükleme)
              </label>

              <div className="mb-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                  multiple
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  Resim Seç (Maks. 5)
                </label>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  {imageFiles.length} resim seçildi
                </span>
              </div>

              {imagePreviewUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Upload Section for Videos */}
            <div className="mb-6">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">
                Ürün Videoları (Dosya Yükleme)
              </label>

              <div className="mb-2">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                  multiple
                />
                <label
                  htmlFor="video-upload"
                  className="cursor-pointer inline-block px-4 py-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800"
                >
                  Video Seç (Maks. 2)
                </label>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  {videoFiles.length} video seçildi
                </span>
              </div>

              {videoPreviewUrls.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {videoPreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <video
                        src={url}
                        controls
                        className="w-full h-48 object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className={`px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
              >
                {isLoading ? 'Ürün Oluşturuluyor...' : 'Ürünü Oluştur'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
} 