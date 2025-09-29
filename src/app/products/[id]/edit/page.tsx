'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { getProductById, getCategories, updateProduct, uploadProductImages, Category } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [productData, setProductData] = useState({
    title: '',
    description: '',
    price: 0,
    categoryId: '',
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: string; url: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [product, categoriesData] = await Promise.all([
          getProductById(id),
          getCategories(),
        ]);

        setProductData({
          title: product.title,
          description: product.description,
          price: product.price,
          categoryId: product.categoryId,
        });

        if (product.images && product.images.length > 0) {
          setExistingImages(product.images);
        }

        setCategories(categoriesData);
      } catch (err) {
        console.error('Veri yüklenirken hata:', err);
        setError('Ürün bilgileri yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && isAuthenticated) {
      fetchData();
    }
  }, [id, authLoading, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=' + encodeURIComponent(`/products/${id}/edit`));
    }
  }, [authLoading, isAuthenticated, router, id]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProductData(prev => ({
      ...prev,
      [name]: name === 'price' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
      e.target.value = '';
    }
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await updateProduct(id, productData);

      if (selectedFiles.length > 0) {
        await uploadProductImages(id, selectedFiles);
      }

      router.push(`/products/${id}`);
    } catch (err) {
      console.error('Ürün güncellenirken hata:', err);
      setError('Ürün güncellenirken bir hata oluştu.');
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-[var(--secondary)] border-t-[var(--accent)] animate-spin" />
        <p className="text-sm text-[var(--muted-foreground)]">Ürün bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/products/${id}`}
            className="text-[var(--accent)] hover:underline flex items-center gap-2 text-sm sm:text-base touch-target"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Ürün detayına dön
          </Link>
          {existingImages.length > 0 && (
            <span className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              Son güncelleme için hazır
            </span>
          )}
        </div>

        <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white rounded-2xl p-6 sm:p-8 premium-shadow">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Ürünü Düzenle</h1>
          <p className="text-sm sm:text-base opacity-90">
            {productData.title
              ? `${productData.title} ilanının bilgilerini güncelleyin`
              : 'İlan bilgilerini güncelleyin'}
          </p>
        </div>

        {error && <div className="premium-error">{error}</div>}

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--card-background)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 lg:p-8 premium-shadow space-y-6 sm:space-y-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--foreground)] mb-4">
                  Ürün Bilgileri
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="premium-label">
                      Ürün Adı
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={productData.title}
                      onChange={handleChange}
                      required
                      className="premium-input"
                      placeholder="Ürün adını girin"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="premium-label">
                      Açıklama
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={productData.description}
                      onChange={handleChange}
                      rows={6}
                      required
                      className="premium-input resize-y"
                      placeholder="Ürünle ilgili detayları paylaşın"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="price" className="premium-label">
                        Fiyat (TL)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-1 text-[var(--muted-foreground)]">
                          ₺
                        </span>
                        <input
                          type="number"
                          id="price"
                          name="price"
                          value={productData.price}
                          onChange={handleChange}
                          min="0"
                          step="50"
                          required
                          className="premium-input pl-9"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="categoryId" className="premium-label">
                        Kategori
                      </label>
                      <select
                        id="categoryId"
                        name="categoryId"
                        value={productData.categoryId}
                        onChange={handleChange}
                        required
                        className="premium-input"
                      >
                        <option value="">Kategori Seç</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--foreground)] mb-4">
                  Görseller
                </h2>
                <div className="space-y-4">
                  <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 sm:p-5">
                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                      Mevcut Görseller
                    </h3>
                    {existingImages.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {existingImages.map(image => (
                          <div
                            key={image.id}
                            className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--secondary)]"
                          >
                            <img
                              src={image.url}
                              alt="Ürün görseli"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                        Bu ürün için henüz görsel bulunmuyor.
                      </div>
                    )}
                  </div>

                  <div className="bg-[var(--background)] border border-dashed border-[var(--border)] rounded-xl p-4 sm:p-5">
                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
                      Yeni Görseller Ekle
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mb-4">
                      Mevcut görseller korunur, yükledikleriniz ek olarak kaydedilir.
                    </p>
                    <label className="flex flex-col items-center justify-center gap-3 border border-dashed border-[var(--border)] rounded-lg py-6 cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <div className="text-xs sm:text-sm text-center">
                        <span className="font-medium">Dosya seç</span> veya sürükleyip bırak
                      </div>
                      <input
                        type="file"
                        id="images"
                        name="images"
                        onChange={handleFileChange}
                        multiple
                        accept="image/*"
                        className="hidden"
                      />
                    </label>
                    {selectedFiles.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between bg-[var(--secondary)]/60 border border-[var(--border)] rounded-lg px-3 py-2 text-xs sm:text-sm"
                          >
                            <span className="truncate pr-3 text-[var(--muted-foreground)]">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedFile(index)}
                              className="text-[var(--accent)] hover:underline"
                            >
                              Kaldır
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                        JPG, PNG veya GIF formatında birden fazla görsel seçebilirsiniz.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-6 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="premium-button bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--secondary)]/80"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="premium-button premium-button-accent px-6"
            >
              {isSubmitting ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
