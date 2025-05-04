'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Product, getProductById, createProductAuction, ProductAuction, getProductAuctionById, addBidToProductAuction } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Auction states
  const [auction, setAuction] = useState<ProductAuction | null>(null);
  const [isAuctionLoading, setIsAuctionLoading] = useState(false);
  const [auctionDuration, setAuctionDuration] = useState<1 | 3 | 5 | 7>(3);
  const [startPrice, setStartPrice] = useState<number>(0);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [auctionEndsIn, setAuctionEndsIn] = useState<string>('');
  const [auctionError, setAuctionError] = useState<string | null>(null);
  const [auctionSuccess, setAuctionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        logger.debug('Fetching product details', { productId: id });
        setIsLoading(true);
        const data = await getProductById(id);
        logger.info('Product details fetched successfully', { 
          productId: id,
          title: data.title,
          price: data.price,
          imageCount: data.images?.length || 0
        });
        
        setProduct(data);
        
        // Initialize start price based on product price
        setStartPrice(data.price);
        
        setError(null);
      } catch (err: any) {
        logger.error('Failed to fetch product details', { 
          productId: id, 
          error: err.message,
          stack: err.stack
        });
        setError('Ürün detayları yüklenirken bir hata oluştu.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchProduct();
      fetchProductAuction();
    }
  }, [id]);
  
  // Fetch product auction if exists
  const fetchProductAuction = async () => {
    try {
      logger.debug('Fetching product auction', { productId: id });
      setIsAuctionLoading(true);
      // API call to get product auction by product ID
      // For demo purposes, we'll use a simple approach checking product auctions
      const response = await fetch(`/api/product-auctions?status=ACTIVE`);
      const auctions = await response.json();
      
      // Find auction for this product
      const productAuction = auctions.find((a: ProductAuction) => a.productId === id);
      
      if (productAuction) {
        logger.info('Found active auction for product', { 
          productId: id,
          auctionId: productAuction.id,
          currentPrice: productAuction.currentPrice,
          endTime: productAuction.endTime
        });
        setAuction(productAuction);
        updateAuctionTimeRemaining(productAuction);
      } else {
        logger.debug('No active auction found for product', { productId: id });
      }
    } catch (err: any) {
      logger.error('Failed to fetch auction data', { 
        productId: id, 
        error: err.message,
        stack: err.stack
      });
      console.error('Failed to fetch auction data:', err);
    } finally {
      setIsAuctionLoading(false);
    }
  };
  
  // Update auction time remaining
  const updateAuctionTimeRemaining = (auctionData: ProductAuction) => {
    if (auctionData.endTime) {
      const endTime = new Date(auctionData.endTime);
      const updateTimer = () => {
        const now = new Date();
        const diff = endTime.getTime() - now.getTime();
        
        if (diff <= 0) {
          logger.debug('Auction ended', { 
            auctionId: auctionData.id,
            productId: auctionData.productId
          });
          setAuctionEndsIn('Sona erdi');
          clearInterval(interval);
          return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setAuctionEndsIn(`${days}g ${hours}s ${minutes}d ${seconds}sn`);
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      
      return () => clearInterval(interval);
    }
  };
  
  // Create auction
  const handleCreateAuction = async () => {
    if (!product || !user) return;
    
    try {
      logger.debug('Creating auction for product', { 
        productId: product.id, 
        userId: user.id,
        startPrice,
        duration: auctionDuration
      });
      
      setAuctionError(null);
      setIsAuctionLoading(true);
      
      const newAuction = await createProductAuction({
        productId: product.id,
        startPrice: startPrice,
        duration: auctionDuration
      });
      
      logger.info('Auction created successfully', { 
        productId: product.id,
        auctionId: newAuction.id,
        startPrice,
        duration: auctionDuration,
        endTime: newAuction.endTime
      });
      
      setAuction(newAuction);
      setAuctionSuccess('Açık artırma başarıyla oluşturuldu!');
      updateAuctionTimeRemaining(newAuction);
      
      // Clear success message after 3 seconds
      setTimeout(() => setAuctionSuccess(null), 3000);
    } catch (err: any) {
      logger.error('Failed to create auction', { 
        productId: product.id, 
        userId: user.id,
        error: err.message,
        stack: err.stack
      });
      
      setAuctionError(err.message || 'Açık artırma oluşturulurken bir hata oluştu');
    } finally {
      setIsAuctionLoading(false);
    }
  };
  
  // Place bid
  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction || !user) return;
    
    try {
      logger.debug('Placing bid on auction', { 
        auctionId: auction.id, 
        userId: user.id,
        bidAmount
      });
      
      setAuctionError(null);
      setIsAuctionLoading(true);
      
      const amount = parseFloat(bidAmount);
      if (isNaN(amount) || amount <= 0) {
        logger.warn('Invalid bid amount', { 
          auctionId: auction.id, 
          userId: user.id,
          bidAmount
        });
        setAuctionError('Geçerli bir teklif tutarı giriniz');
        return;
      }
      
      if (amount <= auction.currentPrice) {
        logger.warn('Bid amount too low', { 
          auctionId: auction.id, 
          userId: user.id,
          bidAmount: amount,
          currentPrice: auction.currentPrice
        });
        setAuctionError(`Teklif en az ${auction.currentPrice + 1} TL olmalıdır`);
        return;
      }
      
      await addBidToProductAuction(auction.id, amount);
      logger.info('Bid placed successfully', { 
        auctionId: auction.id, 
        userId: user.id,
        bidAmount: amount,
        previousPrice: auction.currentPrice
      });
      
      // Refresh auction data
      logger.debug('Refreshing auction data after bid', { auctionId: auction.id });
      const updatedAuction = await getProductAuctionById(auction.id);
      setAuction(updatedAuction);
      setBidAmount('');
      
      setAuctionSuccess('Teklifiniz başarıyla verildi!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setAuctionSuccess(null), 3000);
    } catch (err: any) {
      logger.error('Failed to place bid', { 
        auctionId: auction.id, 
        userId: user.id,
        bidAmount,
        error: err.message,
        stack: err.stack
      });
      
      setAuctionError(err.message || 'Teklif verilirken bir hata oluştu');
    } finally {
      setIsAuctionLoading(false);
    }
  };

  // Fiyatı Türk Lirası formatında göster
  const formattedPrice = product
    ? new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(product.price)
    : '';
    
  // Format auction price
  const formattedAuctionPrice = auction
    ? new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(auction.currentPrice)
    : '';

  // Ürün sahibi kontrolü
  const isOwner = user && product && user.id === product.userId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Link
              href="/products"
              className="text-[var(--accent)] hover:underline flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ürünlere geri dön
            </Link>
          </div>

          <div className="animate-pulse">
            <div className="h-10 bg-[var(--secondary)] rounded-lg w-1/3 mb-8"></div>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-1/2">
                <div className="bg-[var(--secondary)] h-[500px] rounded-2xl"></div>
                <div className="flex gap-3 mt-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 w-20 bg-[var(--secondary)] rounded-lg"></div>
                  ))}
                </div>
              </div>
              <div className="w-full md:w-1/2 mt-8 md:mt-0">
                <div className="h-8 bg-[var(--secondary)] rounded-lg w-3/4 mb-6"></div>
                <div className="h-6 bg-[var(--secondary)] rounded-lg w-1/2 mb-8"></div>
                <div className="h-4 bg-[var(--secondary)] rounded-lg w-full mb-3"></div>
                <div className="h-4 bg-[var(--secondary)] rounded-lg w-full mb-3"></div>
                <div className="h-4 bg-[var(--secondary)] rounded-lg w-full mb-3"></div>
                <div className="h-4 bg-[var(--secondary)] rounded-lg w-2/3 mb-10"></div>
                <div className="h-10 bg-[var(--secondary)] rounded-lg w-1/3 mb-10"></div>
                <div className="h-14 bg-[var(--secondary)] rounded-lg w-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Link
              href="/products"
              className="text-[var(--accent)] hover:underline flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ürünlere geri dön
            </Link>
          </div>

          <div className="bg-[var(--background)] p-8 rounded-2xl border border-red-200 shadow-sm text-center">
            <div className="flex items-center justify-center text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">{error || 'Ürün bulunamadı'}</h3>
            <p className="text-[var(--foreground)] opacity-70 mb-6">
              Bu ürün silinmiş veya kullanılamıyor olabilir.
            </p>
            <Link
              href="/products"
              className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Diğer Ürünlere Göz Atın
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Return Link */}
        <div className="mb-6">
          <Link
            href="/products"
            className="text-[var(--accent)] hover:underline flex items-center group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Ürünlere geri dön
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Product Images */}
          <div className="w-full lg:w-3/5">
            <div className="relative h-[500px] w-full mb-4 bg-[var(--background)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
              {product?.images && product.images.length > 0 ? (
                <Image
                  src={product.images[activeImageIndex].url}
                  alt={product.title}
                  fill
                  className="object-contain p-4"
                  unoptimized={true}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-[var(--accent)] opacity-30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-[var(--foreground)] opacity-70">Ürün görseli bulunmuyor</p>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {product?.images && product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden transition-all ${activeImageIndex === index
                        ? 'border-2 border-[var(--accent)] shadow-md'
                        : 'border border-[var(--border)] opacity-70 hover:opacity-100'
                      }`}
                  >
                    <Image
                      src={image.url}
                      alt={`${product.title} - Görsel ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized={true}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="w-full lg:w-2/5">
            <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] p-8 shadow-sm">
              <div className="flex flex-col">
                <span className="text-sm text-[var(--accent)] font-medium mb-2">
                  {product?.category?.name || 'Kategorisiz Ürün'}
                </span>
                <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
                  {product?.title}
                </h1>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center text-sm text-[var(--foreground)] opacity-70">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {product?.user?.username || 'Bilinmiyor'}
                </div>
                <span className="w-1 h-1 rounded-full bg-[var(--foreground)] opacity-30"></span>
                <div className="flex items-center text-sm text-[var(--foreground)] opacity-70">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {product?.createdAt && new Date(product.createdAt).toLocaleDateString('tr-TR')}
                </div>
              </div>

              <div className="mb-8">
                <p className="text-[var(--foreground)] whitespace-pre-line leading-relaxed">
                  {product?.description}
                </p>
              </div>

              <div className="flex items-center justify-between mb-8 py-4 border-y border-[var(--border)]">
                <div className="text-sm uppercase tracking-wider text-[var(--foreground)] opacity-70">
                  {auction ? 'Açık Artırma Fiyatı' : 'Fiyat'}
                </div>
                <div className="text-3xl font-bold text-[var(--accent)]">
                  {auction ? formattedAuctionPrice : formattedPrice}
                </div>
              </div>
              
              {/* Auction Section */}
              {auction ? (
                <div className="mb-6 p-4 bg-[var(--accent)] bg-opacity-5 rounded-lg">
                  <h3 className="text-lg font-semibold text-[var(--accent)] mb-2">Aktif Açık Artırma</h3>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <span className="text-xs text-[var(--foreground)] opacity-70">Başlangıç Fiyatı</span>
                      <p className="font-medium">{new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY'
                      }).format(auction.startPrice)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--foreground)] opacity-70">Kalan Süre</span>
                      <p className="font-medium">{auctionEndsIn}</p>
                    </div>
                  </div>
                  
                  {!isOwner && user && (
                    <>
                      {auctionError && (
                        <div className="mb-3 p-2 bg-red-100 text-red-600 text-sm rounded">
                          {auctionError}
                        </div>
                      )}
                      
                      {auctionSuccess && (
                        <div className="mb-3 p-2 bg-green-100 text-green-600 text-sm rounded">
                          {auctionSuccess}
                        </div>
                      )}
                      
                      <form onSubmit={handlePlaceBid} className="mb-3">
                        <div className="flex space-x-2">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              value={bidAmount}
                              onChange={(e) => setBidAmount(e.target.value)}
                              placeholder={`${auction.currentPrice + 1}+ TL`}
                              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg"
                              min={auction.currentPrice + 1}
                              step="1"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isAuctionLoading}
                            className="px-4 py-2 bg-[var(--accent)] text-white font-medium rounded-lg hover:shadow-md transition-all disabled:opacity-50"
                          >
                            {isAuctionLoading ? "İşleniyor..." : "Teklif Ver"}
                          </button>
                        </div>
                      </form>
                      
                      <p className="text-xs text-[var(--foreground)] opacity-70">
                        Minimum teklif: {new Intl.NumberFormat('tr-TR', {
                          style: 'currency',
                          currency: 'TRY'
                        }).format(auction.currentPrice + 1)}
                      </p>
                    </>
                  )}
                  
                  {auction.bids && auction.bids.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Son Teklifler</h4>
                      <div className="max-h-40 overflow-y-auto">
                        {auction.bids.map(bid => (
                          <div key={bid.id} className="flex justify-between items-center py-1 text-sm">
                            <span className="opacity-70">{bid.user?.username}</span>
                            <span className={`font-medium ${bid.isWinning ? 'text-green-600' : ''}`}>
                              {new Intl.NumberFormat('tr-TR', {
                                style: 'currency',
                                currency: 'TRY'
                              }).format(bid.amount)}
                              {bid.isWinning && <span className="ml-2 text-xs">En Yüksek</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                isOwner && (
                  <div className="mb-6 p-4 bg-[var(--accent)] bg-opacity-5 rounded-lg">
                    <h3 className="text-lg font-semibold text-[var(--accent)] mb-3">Açık Artırma Başlat</h3>
                    
                    {auctionError && (
                      <div className="mb-3 p-2 bg-red-100 text-red-600 text-sm rounded">
                        {auctionError}
                      </div>
                    )}
                    
                    {auctionSuccess && (
                      <div className="mb-3 p-2 bg-green-100 text-green-600 text-sm rounded">
                        {auctionSuccess}
                      </div>
                    )}
                    
                    <div className="mb-3">
                      <label className="block text-sm mb-1">Başlangıç Fiyatı</label>
                      <input
                        type="number"
                        value={startPrice}
                        onChange={(e) => setStartPrice(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg"
                        min="1"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm mb-1">Süre</label>
                      <select
                        value={auctionDuration}
                        onChange={(e) => setAuctionDuration(parseInt(e.target.value) as 1 | 3 | 5 | 7)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg"
                      >
                        <option value={1}>1 Gün</option>
                        <option value={3}>3 Gün</option>
                        <option value={5}>5 Gün</option>
                        <option value={7}>7 Gün</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={handleCreateAuction}
                      disabled={isAuctionLoading}
                      className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-lg hover:shadow-md transition-all disabled:opacity-50"
                    >
                      {isAuctionLoading ? "İşleniyor..." : "Açık Artırma Başlat"}
                    </button>
                  </div>
                )
              )}

              {isOwner ? (
                <div className="flex gap-4">
                  <Link
                    href={`/products/${product?.id}/edit`}
                    className="flex-1 py-3 px-6 bg-[var(--accent)] text-white font-medium rounded-lg hover:shadow-lg transition-all flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Düzenle
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
                        // Delete functionality
                      }
                    }}
                    className="flex-1 py-3 px-6 border border-red-500 text-red-500 font-medium rounded-lg hover:bg-red-50 transition-all flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Sil
                  </button>
                </div>
              ) : user ? (
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      // Contact seller
                    }}
                    className="flex-1 py-3 px-6 bg-[var(--accent)] text-white font-medium rounded-lg hover:shadow-lg transition-all flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Satıcıya Mesaj Gönder
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-lg hover:shadow-lg transition-all flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Giriş Yapın
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 