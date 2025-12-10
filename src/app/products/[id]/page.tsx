'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Product, getProductById, createProductAuction, ProductAuction, getProductAuctionById, addBidToProductAuction, getProductAuctionByProductId } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { logger } from '@/lib/logger';
import VerifiedSellerBadge from '@/components/VerifiedSellerBadge';
import BidConfirmationModal from '@/components/BidConfirmationModal';
import { calculateMinimumBidAmount, calculateMinimumBidIncrement, calculateNextBidAmount } from '@/lib/utils';
import { analytics } from '@/components/GoogleTagManager';
import { getToken } from '@/lib/frontend-auth';

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
  const [isBuying, setIsBuying] = useState(false);

  // Confirmation modal states
  const [showBidModal, setShowBidModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState<string>('');
  const isAuctionExpired = auction?.endTime
    ? new Date(auction.endTime).getTime() <= Date.now()
    : false;
  const hasActiveAuction = !!auction && !isAuctionExpired;

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

        // Track product view
        analytics.trackProductView(
          data.id,
          data.title,
          data.category?.name,
          data.price
        );

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

      // Use the new API function to get auction by product ID
      const productAuction = await getProductAuctionByProductId(id);

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

  // Show bid confirmation modal
  const handlePlaceBidClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction || !user || !bidAmount) return;

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setAuctionError('Geçerli bir teklif tutarı giriniz');
      return;
    }

    const minimumBidAmount = calculateMinimumBidAmount(auction.currentPrice);
    if (amount < minimumBidAmount) {
      const increment = calculateMinimumBidIncrement(auction.currentPrice);
      setAuctionError(`Teklif en az ${minimumBidAmount} TL olmalıdır (${increment} TL artış)`);
      return;
    }

    setPendingBidAmount(bidAmount);
    setShowBidModal(true);
  };

  // Actually place the bid after confirmation
  const handleConfirmBid = async () => {
    if (!auction || !user || !pendingBidAmount) return;

    setShowBidModal(false);

    try {
      logger.debug('Placing bid on auction', {
        auctionId: auction.id,
        userId: user.id,
        bidAmount: pendingBidAmount
      });

      setAuctionError(null);
      setIsAuctionLoading(true);

      const amount = parseFloat(pendingBidAmount);

      await addBidToProductAuction(auction.id, amount);
      logger.info('Bid placed successfully', {
        auctionId: auction.id,
        userId: user.id,
        bidAmount: amount,
        previousPrice: auction.currentPrice
      });

      // Refresh auction data using the correct endpoint
      logger.debug('Refreshing auction data after bid', { productId: product?.id });
      const updatedAuction = await getProductAuctionByProductId(product!.id);
      setAuction(updatedAuction);
      setBidAmount('');
      setPendingBidAmount('');

      setAuctionSuccess('Teklifiniz başarıyla verildi!');

      // Clear success message after 3 seconds
      setTimeout(() => setAuctionSuccess(null), 3000);
    } catch (err: any) {
      logger.error('Failed to place bid', {
        auctionId: auction.id,
        userId: user.id,
        bidAmount: pendingBidAmount,
        error: err.message,
        stack: err.stack
      });

      // Extract error message from response
      let errorMessage = 'Teklif verilirken bir hata oluştu';

      // Check if error has a response with error field
      if (err.response?.error) {
        errorMessage = err.response.error;
      } else if (err.message && !err.message.includes('API error')) {
        errorMessage = err.message;
      }

      setAuctionError(errorMessage);
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

  // Format buy now price
  const formattedBuyNowPrice = product?.buyNowPrice
    ? new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(product.buyNowPrice)
    : null;

  // Ürün sahibi kontrolü
  const isOwner = user && product && user.id === product.userId;

  // Show buy now confirmation modal
  const handleBuyNowClick = () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/products/${product?.id}`)}`);
      return;
    }

    if (isOwner) {
      alert('Kendi ürününüzü satın alamazsınız.');
      return;
    }

    setShowBuyModal(true);
  };

  // Actually buy the product after confirmation
  const handleConfirmBuy = async () => {
    setShowBuyModal(false);

    if (!product) {
      return;
    }

    const authToken = getToken();
    if (!authToken) {
      alert('Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.');
      router.push(`/login?redirect=${encodeURIComponent(`/products/${product.id}`)}`);
      return;
    }

    try {
      setIsBuying(true);
      const response = await fetch(`/api/products/${product.id}/buy-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Satın alma işlemi başarısız oldu');
      }

      const result = await response.json();
      alert('Ürün başarıyla satın alındı!');
      // Refresh to show updated status
      window.location.reload();
    } catch (error: any) {
      console.error('Buy now error:', error);
      alert(error.message || 'Satın alma işlemi sırasında bir hata oluştu');
    } finally {
      setIsBuying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <Link
              href="/products"
              className="text-[var(--accent)] hover:underline flex items-center text-sm sm:text-base touch-target"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ürünlere geri dön
            </Link>
          </div>

          <div className="animate-pulse">
            <div className="h-8 sm:h-10 bg-[var(--secondary)] rounded-lg w-2/3 sm:w-1/3 mb-6 sm:mb-8"></div>
            <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-12">
              <div className="w-full lg:w-3/5">
                <div className="bg-[var(--secondary)] h-[300px] sm:h-[400px] lg:h-[500px] rounded-2xl mb-4"></div>
                <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 w-16 sm:h-20 sm:w-20 bg-[var(--secondary)] rounded-lg flex-shrink-0"></div>
                  ))}
                </div>
              </div>
              <div className="w-full lg:w-2/5">
                <div className="bg-[var(--card-background)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 lg:p-8 premium-shadow">
                  <div className="h-6 sm:h-8 bg-[var(--secondary)] rounded-lg w-3/4 mb-4 sm:mb-6"></div>
                  <div className="h-4 sm:h-6 bg-[var(--secondary)] rounded-lg w-1/2 mb-6 sm:mb-8"></div>
                  <div className="space-y-3 mb-6">
                    <div className="h-3 sm:h-4 bg-[var(--secondary)] rounded w-full"></div>
                    <div className="h-3 sm:h-4 bg-[var(--secondary)] rounded w-full"></div>
                    <div className="h-3 sm:h-4 bg-[var(--secondary)] rounded w-2/3"></div>
                  </div>
                  <div className="h-8 sm:h-10 bg-[var(--secondary)] rounded-lg w-1/3 mb-8 sm:mb-10"></div>
                  <div className="h-12 sm:h-14 bg-[var(--secondary)] rounded-lg w-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <Link
              href="/products"
              className="text-[var(--accent)] hover:underline flex items-center text-sm sm:text-base touch-target"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ürünlere geri dön
            </Link>
          </div>

          <div className="bg-[var(--card-background)] p-6 sm:p-8 rounded-2xl border border-red-200 premium-shadow text-center">
            <div className="flex items-center justify-center text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-[var(--foreground)] mb-2">{error || 'Ürün bulunamadı'}</h3>
            <p className="text-[var(--muted-foreground)] mb-6 text-sm sm:text-base">
              Bu ürün silinmiş veya kullanılamıyor olabilir.
            </p>
            <Link
              href="/products"
              className="premium-button premium-button-accent inline-flex items-center text-sm sm:text-base touch-target"
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

  // Handle sold product views
  if (product?.isSold) {
    const isSeller = user?.id === product.userId;
    const isBuyer = user?.id === product.soldTo;

    // Seller view: Show product details with "Sold" badge
    if (isSeller) {
      return (
        <div className="min-h-screen bg-[var(--background)] p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4 sm:mb-6">
              <Link
                href="/products"
                className="text-[var(--accent)] hover:underline flex items-center group text-sm sm:text-base touch-target"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Ürünlere geri dön
              </Link>
            </div>

            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-green-700">✅ Ürün Satıldı!</h2>
                  <p className="text-green-600">Bu ürün başarıyla satıldı</p>
                </div>
              </div>
              {product.soldAt && (
                <p className="text-sm text-green-600 mb-2">
                  Satış Tarihi: {new Date(product.soldAt).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>

            {/* Product details still visible to seller */}
            <div className="bg-[var(--card-background)] border border-[var(--border)] rounded-xl p-6">
              <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">{product.title}</h1>
              {product.images && product.images.length > 0 && (
                <div className="relative h-64 mb-4 rounded-lg overflow-hidden">
                  <Image
                    src={product.images[0].url}
                    alt={product.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                  />
                </div>
              )}
              <p className="text-[var(--foreground)] mb-4">{product.description}</p>
              <p className="text-xl font-bold text-[var(--accent)]">
                Satış Fiyatı: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(product.buyNowPrice || product.price)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Buyer view: Show purchase confirmation
    if (isBuyer) {
      return (
        <div className="min-h-screen bg-[var(--background)] p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4 sm:mb-6">
              <Link
                href="/products"
                className="text-[var(--accent)] hover:underline flex items-center group text-sm sm:text-base touch-target"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Ürünlere geri dön
              </Link>
            </div>

            <div className="bg-blue-50 border-2 border-blue-500 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-blue-700">✅ Bu Ürünü Satın Aldınız!</h2>
                  <p className="text-blue-600">Satıcı ile iletişime geçebilirsiniz</p>
                </div>
              </div>
              <Link
                href="/dashboard/messages"
                className="inline-block mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Satıcı ile Mesajlaş
              </Link>
            </div>

            {/* Product details visible to buyer */}
            <div className="bg-[var(--card-background)] border border-[var(--border)] rounded-xl p-6">
              <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">{product.title}</h1>
              {product.images && product.images.length > 0 && (
                <div className="relative h-64 mb-4 rounded-lg overflow-hidden">
                  <Image
                    src={product.images[0].url}
                    alt={product.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                  />
                </div>
              )}
              <p className="text-[var(--foreground)] mb-4">{product.description}</p>
              <p className="text-xl font-bold text-[var(--accent)]">
                Ödediğiniz Tutar: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(product.buyNowPrice || product.price)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Other users: Show "product sold" message
    return (
      <div className="min-h-screen bg-[var(--background)] p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[var(--card-background)] border border-[var(--border)] rounded-xl p-8 text-center">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">Bu Ürün Satıldı</h1>
            <p className="text-[var(--muted-foreground)] mb-8">
              Bu ürün başka bir kullanıcı tarafından satın alındı. Diğer ürünlere göz atabilirsiniz.
            </p>
            <Link
              href="/products"
              className="inline-block px-8 py-4 bg-[var(--accent)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-medium"
            >
              Diğer Ürünleri İncele
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Return Link */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/products"
            className="text-[var(--accent)] hover:underline flex items-center group text-sm sm:text-base touch-target"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Ürünlere geri dön
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-12">
          {/* Product Images */}
          <div className="w-full lg:w-3/5">
            <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] w-full mb-4 bg-[var(--card-background)] border border-[var(--border)] rounded-2xl overflow-hidden premium-shadow">
              {product?.images && product.images.length > 0 ? (
                <Image
                  src={product.images[activeImageIndex].url}
                  alt={product.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-contain p-2 sm:p-4"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-[var(--accent)] opacity-30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-[var(--muted-foreground)] text-sm sm:text-base">Ürün görseli bulunmuyor</p>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {product?.images && product.images.length > 1 && (
              <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {product.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 flex-shrink-0 rounded-lg overflow-hidden transition-all touch-target ${activeImageIndex === index
                      ? 'border-2 border-[var(--accent)] premium-shadow'
                      : 'border border-[var(--border)] opacity-70 hover:opacity-100'
                      }`}
                  >
                    <Image
                      src={image.url}
                      alt={`${product.title} - Görsel ${index + 1}`}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="w-full lg:w-2/5">
            <div className="bg-[var(--card-background)] rounded-2xl border border-[var(--border)] p-4 sm:p-6 lg:p-8 premium-shadow">
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm text-[var(--accent)] font-medium mb-2">
                  {product?.category?.name || 'Kategorisiz Ürün'}
                </span>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--foreground)] mb-2 line-clamp-2">
                  {product?.title}
                </h1>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-6">
                <div className="flex items-center text-xs sm:text-sm text-[var(--muted-foreground)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="flex items-center">
                    {product?.user?.username || 'Bilinmiyor'}
                    <VerifiedSellerBadge userType={product?.user?.userType} variant="inline" />
                  </span>
                </div>
                <span className="hidden sm:block w-1 h-1 rounded-full bg-[var(--muted-foreground)]"></span>
                <div className="flex items-center text-xs sm:text-sm text-[var(--muted-foreground)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {product?.createdAt && new Date(product.createdAt).toLocaleDateString('tr-TR')}
                </div>
              </div>

              <div className="mb-6 sm:mb-8">
                <p className="text-[var(--foreground)] whitespace-pre-line leading-relaxed text-sm sm:text-base line-clamp-4 sm:line-clamp-none">
                  {product?.description}
                </p>
              </div>

              <div className="mb-6 sm:mb-8 py-4 border-y border-[var(--border)] space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs sm:text-sm uppercase tracking-wider text-[var(--muted-foreground)]">
                    {auction ? 'Açık Artırma Fiyatı' : 'Başlangıç Fiyatı'}
                  </div>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--accent)]">
                    {auction ? formattedAuctionPrice : formattedPrice}
                  </div>
                </div>

                {formattedBuyNowPrice && (
                  <div className="flex items-center justify-between">
                    <div className="text-xs sm:text-sm uppercase tracking-wider text-green-600">
                      Hemen Al Fiyatı
                    </div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                      {formattedBuyNowPrice}
                    </div>
                  </div>
                )}
              </div>

              {/* Auction Section */}
              {hasActiveAuction && (
                <div className="mb-6 p-4 bg-opacity-5 rounded-xl border border-[var(--accent)] border-opacity-20">
                  <h3 className="text-base sm:text-lg font-semibold text-[var(--accent)] mb-3">Aktif Açık Artırma</h3>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <span className="text-xs text-[var(--muted-foreground)]">Başlangıç Fiyatı</span>
                      <p className="font-medium text-sm sm:text-base">{new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: 'TRY'
                      }).format(auction!.startPrice)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--muted-foreground)]">Kalan Süre</span>
                      <p className="font-medium text-sm sm:text-base">{auctionEndsIn}</p>
                    </div>
                  </div>

                  {!isOwner && user && (
                    <>
                      {auctionError && (
                        <div className="mb-3 p-3 bg-red-100 text-red-600 text-sm rounded-lg">
                          {auctionError}
                        </div>
                      )}

                      {auctionSuccess && (
                        <div className="mb-3 p-3 bg-green-100 text-green-600 text-sm rounded-lg">
                          {auctionSuccess}
                        </div>
                      )}

                      <div className="mb-3">
                        {/* Display auto-calculated next bid */}
                        <div className="bg-[var(--primary)]/10 rounded-lg p-4 border border-[var(--primary)]/20">
                          <div className="text-center">
                            <p className="text-sm text-[var(--foreground)] opacity-70 mb-2">
                              Sonraki Teklif Tutarı
                            </p>
                            <p className="text-2xl font-bold text-[var(--accent)]">
                              {new Intl.NumberFormat('tr-TR', {
                                style: 'currency',
                                currency: 'TRY'
                              }).format(calculateNextBidAmount(auction!.currentPrice, auction!.startPrice))}
                            </p>
                            {auction!.currentPrice === auction!.startPrice && (
                              <p className="text-xs text-green-600 mt-2">
                                İlk teklif: Başlangıç fiyatı kadar teklif verebilirsiniz
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const nextBid = calculateNextBidAmount(auction!.currentPrice, auction!.startPrice);
                            setPendingBidAmount(nextBid.toString());
                            setShowBidModal(true);
                          }}
                          disabled={isAuctionLoading || isAuctionExpired}
                          className="premium-button premium-button-accent w-full mt-3 touch-target text-sm sm:text-base"
                        >
                          {isAuctionLoading ? "İşleniyor..." : "Teklif Ver"}
                        </button>
                      </div>

                      <div className="text-xs text-[var(--muted-foreground)] space-y-1">
                        <p>
                          Minimum artış: {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY'
                          }).format(calculateMinimumBidIncrement(auction!.currentPrice))}
                        </p>
                      </div>
                    </>
                  )}

                  {auction?.bids && auction.bids.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Son Teklifler</h4>
                      <div className="max-h-32 sm:max-h-40 overflow-y-auto scrollbar-thin">
                        {auction.bids.map(bid => (
                          <div key={bid.id} className="flex justify-between items-center py-1 text-xs sm:text-sm">
                            <span className="text-[var(--muted-foreground)]">{bid.user?.username}</span>
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
              )}

              {!hasActiveAuction && isOwner && (
                <div className="mb-6 p-4 bg-opacity-5 rounded-xl border border-[var(--accent)] border-opacity-20">
                  <h3 className="text-base sm:text-lg font-semibold text-[var(--accent)] mb-3">Açık Artırma Başlat</h3>

                  {auctionError && (
                    <div className="mb-3 p-3 bg-red-100 text-red-600 text-sm rounded-lg">
                      {auctionError}
                    </div>
                  )}

                  {auctionSuccess && (
                    <div className="mb-3 p-3 bg-green-100 text-green-600 text-sm rounded-lg">
                      {auctionSuccess}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="premium-label text-sm">Başlangıç Fiyatı</label>
                    <input
                      type="number"
                      value={startPrice}
                      onChange={(e) => setStartPrice(parseFloat(e.target.value))}
                      className="premium-input text-sm sm:text-base"
                      min="100"
                      step="50"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="premium-label text-sm">Süre</label>
                    <select
                      value={auctionDuration}
                      onChange={(e) => setAuctionDuration(parseInt(e.target.value) as 1 | 3 | 5 | 7)}
                      className="premium-input text-sm sm:text-base"
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
                    className="premium-button premium-button-accent w-full touch-target text-sm sm:text-base"
                  >
                    {isAuctionLoading ? "İşleniyor..." : "Açık Artırma Başlat"}
                  </button>
                </div>
              )}

              {!hasActiveAuction && !isOwner && (
                <div className="mb-6 p-4 bg-opacity-5 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)]">
                  Bu ürün için şu an aktif bir açık artırma bulunmuyor.
                </div>
              )}

              {isOwner ? (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Link
                    href={`/products/${product?.id}/edit`}
                    className="premium-button premium-button-accent flex items-center justify-center touch-target text-sm sm:text-base"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="px-4 sm:px-6 py-3 border border-red-500 text-red-500 font-medium rounded-lg hover:bg-red-50 transition-all flex items-center justify-center touch-target text-sm sm:text-base"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Sil
                  </button>
                </div>
              ) : user ? (
                <div className="space-y-3 sm:space-y-4">
                  {formattedBuyNowPrice && (
                    <button
                      onClick={handleBuyNowClick}
                      disabled={isBuying}
                      className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed touch-target text-sm sm:text-base"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {isBuying ? 'İşleniyor...' : `Hemen Al - ${formattedBuyNowPrice}`}
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      if (!product?.userId) {
                        alert('Satıcı bilgisi bulunamadı.');
                        return;
                      }

                      try {
                        // Navigate to messages with product context
                        const productInfo = encodeURIComponent(JSON.stringify({
                          id: product.id,
                          title: product.title,
                          price: product.price,
                          imageUrl: product.images?.[0]?.url
                        }));
                        router.push(`/dashboard/messages/${product.userId}?product=${productInfo}`);
                      } catch (error) {
                        console.error('Error navigating to messages:', error);
                        alert('Mesajlaşma sayfasına yönlendirilirken bir hata oluştu.');
                      }
                    }}
                    className="premium-button premium-button-accent w-full flex items-center justify-center touch-target text-sm sm:text-base"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Satıcıya Mesaj Gönder
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="premium-button premium-button-accent w-full flex items-center justify-center touch-target text-sm sm:text-base"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Giriş Yapın
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bid Confirmation Modal */}
      <BidConfirmationModal
        isOpen={showBidModal}
        onClose={() => {
          setShowBidModal(false);
          setPendingBidAmount('');
        }}
        onConfirm={handleConfirmBid}
        title={`${new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY'
        }).format(parseFloat(pendingBidAmount || '0'))} Teklif`}
        actionType="bid"
      />

      {/* Buy Now Confirmation Modal */}
      <BidConfirmationModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        onConfirm={handleConfirmBuy}
        title={formattedBuyNowPrice || ''}
        actionType="buy"
      />
    </div>
  );
} 
