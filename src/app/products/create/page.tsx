'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Category, getCategories, createProduct, uploadProductImages, uploadProductVideos, createProductAuction } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import SellerAccessGuard from '@/components/SellerAccessGuard';
import { logger } from '@/lib/logger';

export default function CreateProductPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [buyNowPrice, setBuyNowPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [auctionDuration, setAuctionDuration] = useState<3 | 5 | 7>(7);

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
        logger.info('Fetching categories for product creation form');
        const data = await getCategories();
        logger.debug('Categories fetched successfully', {
          count: data.length,
          categoryIds: data.map(c => c.id)
        });
        setCategories(data);
        if (data.length > 0) {
          setCategoryId(data[0].id);
        }
      } catch (err) {
        logger.error('Failed to load categories', { error: err });
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
      logger.debug('Image files selected', {
        count: newFiles.length,
        fileNames: newFiles.map(f => f.name),
        fileSizes: newFiles.map(f => f.size),
        fileTypes: newFiles.map(f => f.type)
      });

      // Check if adding these files would exceed the limit
      if (imageFiles.length + newFiles.length > 5) {
        logger.warn('Image upload limit exceeded', {
          currentCount: imageFiles.length,
          attemptedToAdd: newFiles.length,
          maxAllowed: 5
        });
        setError('En fazla 5 resim yükleyebilirsiniz.');
        return;
      }

      // Create preview URLs for the images
      const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
      logger.debug('Image preview URLs created', { count: newPreviewUrls.length });

      setImageFiles([...imageFiles, ...newFiles]);
      setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
    }
  };

  // Handle video file selection
  const handleVideoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      logger.debug('Video files selected', {
        count: newFiles.length,
        fileNames: newFiles.map(f => f.name),
        fileSizes: newFiles.map(f => f.size),
        fileTypes: newFiles.map(f => f.type)
      });

      // Check if adding these files would exceed the limit
      if (videoFiles.length + newFiles.length > 2) {
        logger.warn('Video upload limit exceeded', {
          currentCount: videoFiles.length,
          attemptedToAdd: newFiles.length,
          maxAllowed: 2
        });
        setError('En fazla 2 video yükleyebilirsiniz.');
        return;
      }

      // Create preview URLs for the videos
      const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
      logger.debug('Video preview URLs created', { count: newPreviewUrls.length });

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
    logger.info('Product form submission started');

    if (!title || !description || !price || !categoryId) {
      logger.warn('Product form validation failed - missing required fields', {
        hasTitle: !!title,
        hasDescription: !!description,
        hasPrice: !!price,
        hasCategoryId: !!categoryId
      });
      setError('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    // Validate at least one image is uploaded
    if (imageFiles.length === 0) {
      logger.warn('Product form validation failed - no images uploaded');
      setError('Lütfen en az 1 ürün görseli ekleyin.');
      return;
    }

    // Validate buyNowPrice if provided
    if (buyNowPrice && parseFloat(buyNowPrice) <= parseFloat(price)) {
      setError('Hemen al fiyatı, başlangıç fiyatından yüksek olmalıdır.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create product
      logger.debug('Creating product', {
        title,
        hasDescription: !!description,
        price: parseFloat(price),
        categoryId
      });

      const product = await createProduct({
        title,
        description,
        price: parseFloat(price),
        buyNowPrice: buyNowPrice ? parseFloat(buyNowPrice) : undefined,
        categoryId
      });

      logger.info('Product created successfully', {
        productId: product.id,
        title: product.title
      });

      // Upload images if any
      if (imageFiles.length > 0) {
        logger.debug('Uploading product images', {
          productId: product.id,
          count: imageFiles.length,
          fileNames: imageFiles.map(f => f.name)
        });

        await uploadProductImages(product.id, imageFiles);
        logger.info('Images uploaded successfully', { productId: product.id });
      }

      // Upload videos if any
      if (videoFiles.length > 0) {
        logger.debug('Uploading product videos', {
          productId: product.id,
          count: videoFiles.length,
          fileNames: videoFiles.map(f => f.name)
        });

        await uploadProductVideos(product.id, videoFiles);
        logger.info('Videos uploaded successfully', { productId: product.id });
      }

      // Create auction automatically
      logger.debug('Creating auction for product', {
        productId: product.id,
        startPrice: parseFloat(price),
        duration: auctionDuration
      });

      try {
        const auction = await createProductAuction({
          productId: product.id,
          startPrice: parseFloat(price),
          duration: auctionDuration
        });
        logger.info('Auction created successfully', {
          productId: product.id,
          auctionId: auction.id,
          duration: auctionDuration,
          endTime: auction.endTime
        });
      } catch (auctionError: any) {
        logger.error('Failed to create auction', {
          productId: product.id,
          error: auctionError.message
        });
        // Don't fail the whole operation, product is already created
        setError('Ürün oluşturuldu ancak açık artırma başlatılamadı. Ürün sayfasından manuel olarak başlatabilirsiniz.');
      }

      logger.info('Product creation complete', { productId: product.id });
      setSuccess('Ürün ve açık artırma başarıyla oluşturuldu!');

      // Redirect to product detail page after a short delay
      logger.debug('Redirecting to product detail page', { productId: product.id });
      setTimeout(() => {
        router.push(`/products/${product.id}`);
      }, 1500);

    } catch (err: any) {
      logger.error('Product creation failed', {
        error: err.message,
        stack: err.stack,
        title,
        categoryId
      });
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
      <SellerAccessGuard>
        <div className="min-h-screen bg-[var(--background)] p-4 sm:p-6 md:p-8">
          {/* Premium Header */}
          <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-8 px-6 rounded-2xl mb-8 shadow-md">
            <div className="max-w-5xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold">Yeni Ürün Ekle</h1>
              <p className="mt-2 text-sm md:text-base opacity-90">
                Eşsiz koleksiyon parçanızı platforma ekleyin ve alıcılarla buluşturun
              </p>
            </div>
          </div>

          <div className="max-w-5xl mx-auto">
            {error && (
              <div className="mb-8 bg-[var(--background)] p-6 rounded-xl border border-red-200 shadow-sm">
                <div className="flex items-center text-red-500 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="font-semibold">Hata</h3>
                </div>
                <p className="text-[var(--foreground)] ml-7">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-8 bg-[var(--background)] p-6 rounded-xl border border-green-200 shadow-sm">
                <div className="flex items-center text-green-500 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="font-semibold">Başarılı</h3>
                </div>
                <p className="text-[var(--foreground)] ml-7">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-[var(--background)] p-8 rounded-2xl shadow-md border border-[var(--border)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Left column - Basic Info */}
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6 pb-2 border-b border-[var(--border)]">
                    <span className="border-b-3 border-[var(--accent)] pb-1">Ürün Bilgileri</span>
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <label htmlFor="title" className="block text-[var(--foreground)] font-medium mb-2">
                        Ürün Adı <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 border rounded-lg bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                        required
                        placeholder="Örn: Antika Gümüş Tepsi"
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-[var(--foreground)] font-medium mb-2">
                        Açıklama <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={6}
                        className="w-full px-4 py-3 border rounded-lg bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                        required
                        placeholder="Ürünün detaylı açıklaması, yaşı, durumu, özellikleri..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="price" className="block text-[var(--foreground)] font-medium mb-2">
                          Başlangıç Fiyatı (TL) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-[var(--foreground)] opacity-70">₺</span>
                          </div>
                          <input
                            type="number"
                            id="price"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full pl-10 pr-4 py-3 border rounded-lg bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                            required
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="buyNowPrice" className="block text-[var(--foreground)] font-medium mb-2">
                          Hemen Al Fiyatı (TL)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-[var(--foreground)] opacity-70">₺</span>
                          </div>
                          <input
                            type="number"
                            id="buyNowPrice"
                            value={buyNowPrice}
                            onChange={(e) => setBuyNowPrice(e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full pl-10 pr-4 py-3 border rounded-lg bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                            placeholder="0.00"
                          />
                        </div>
                        <span className="text-[var(--foreground)] opacity-70 text-sm font-normal">(opsiyonel)</span>
                        <p className="text-xs text-[var(--foreground)] opacity-70 mt-1">
                          Belirlerseniz, kullanıcılar ürünü hemen satın alabilir
                        </p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="category" className="block text-[var(--foreground)] font-medium mb-2">
                        Kategori <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="category"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full px-4 py-3 border rounded-lg bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all"
                        required
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Auction Duration Selection */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-xl border border-[var(--accent)]/20">
                      <label className="block text-[var(--foreground)] font-medium mb-3">
                        <span className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Açık Artırma Süresi <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <p className="text-sm text-[var(--foreground)] opacity-70 mb-4">
                        Ürün oluşturulduğunda açık artırma otomatik olarak başlatılacaktır
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {[3, 5, 7].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setAuctionDuration(days as 3 | 5 | 7)}
                            className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${auctionDuration === days
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-md'
                              : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                              }`}
                          >
                            {days} Gün
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--foreground)] opacity-60 mt-3">
                        Seçilen süre sonunda açık artırma otomatik olarak sonlanacaktır
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right column - Media */}
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6 pb-2 border-b border-[var(--border)]">
                    <span className="border-b-3 border-[var(--accent)] pb-1">Görseller ve Videolar</span>
                  </h2>

                  <div className="mb-6">
                    <label className="block text-[var(--foreground)] font-medium mb-2">
                      Ürün Resimleri <span className="text-red-500">*</span> <span className="text-[var(--foreground)] opacity-70 text-sm font-normal">(en az 1, en fazla 5 resim)</span>
                    </label>

                    <div className="flex flex-wrap gap-3 mb-3">
                      {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border border-[var(--border)] group">
                          <img src={url} alt={`Önizleme ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      {imagePreviewUrls.length < 5 && (
                        <label className="w-24 h-24 border-2 border-dashed border-[var(--border)] rounded-lg flex flex-col items-center justify-center text-[var(--foreground)] opacity-70 cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-xs mt-1">Resim Ekle</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            multiple
                          />
                        </label>
                      )}
                    </div>

                    <p className="text-xs text-[var(--foreground)] opacity-70">
                      Kabul edilen formatlar: JPG, PNG veya GIF. En iyi sonuç için 1000x1000 piksel veya daha yüksek çözünürlükte resimler kullanın.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[var(--foreground)] font-medium mb-2">
                      Ürün Videoları <span className="text-[var(--foreground)] opacity-70 text-sm font-normal">(en fazla 2 video)</span>
                    </label>

                    <div className="flex flex-wrap gap-3 mb-3">
                      {videoPreviewUrls.map((url, index) => (
                        <div key={index} className="relative w-32 h-24 rounded-lg overflow-hidden border border-[var(--border)] bg-black group">
                          <video src={url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVideo(index)}
                            className="absolute top-1 right-1 bg-black bg-opacity-50 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      {videoPreviewUrls.length < 2 && (
                        <label className="w-32 h-24 border-2 border-dashed border-[var(--border)] rounded-lg flex flex-col items-center justify-center text-[var(--foreground)] opacity-70 cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs mt-1">Video Ekle</span>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoUpload}
                            className="hidden"
                            multiple
                          />
                        </label>
                      )}
                    </div>

                    <p className="text-xs text-[var(--foreground)] opacity-70">
                      Kabul edilen formatlar: MP4, MOV veya AVI. Maksimum boyut: 100MB. Kısa ve yüksek kaliteli videolar önerilir.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-8 flex justify-end">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-3 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`px-10 py-3 bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white rounded-lg transition-all flex items-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg'
                      }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>İşleniyor...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Ürünü Oluştur</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </SellerAccessGuard>
    </ProtectedRoute>
  );
} 