"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/frontend-auth";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Package,
  Users,
  Banknote,
  Clock,
  ShoppingCart,
  Gavel,
  Tag,
  User,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCcw,
  Eye,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreamSalesData {
  stream: {
    id: string;
    title: string;
    description: string;
    status: string;
    startTime: string | null;
    endTime: string | null;
    viewerCount: number;
    host: {
      id: string;
      username: string;
      name: string | null;
    };
  };
  summary: {
    totalProducts: number;
    totalSold: number;
    totalRevenue: number;
    auctionSalesCount: number;
    fixedPriceSalesCount: number;
    auctionRevenue: number;
    fixedPriceRevenue: number;
    unsoldCount: number;
    activeCount: number;
  };
  soldProducts: SoldProduct[];
  unsoldProducts: SoldProduct[];
  activeProducts: SoldProduct[];
}

interface SoldProduct {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  currentPrice: number;
  soldPrice: number | null;
  stock: number;
  isAuctionMode: boolean;
  isSold: boolean;
  isActive: boolean;
  soldAt: string | null;
  createdAt: string;
  endTime: string | null;
  bidCount: number;
  buyer: {
    id: string;
    username: string;
    name: string | null;
  } | null;
  winningBid: {
    id: string;
    amount: number;
    createdAt: string;
  } | null;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-600";
  let label = status;
  let dotColor = "bg-gray-400";

  if (status === "LIVE") {
    bgColor = "bg-red-100";
    textColor = "text-red-600";
    label = "CANLI";
    dotColor = "bg-red-600";
  } else if (status === "SCHEDULED") {
    bgColor = "bg-blue-100";
    textColor = "text-blue-600";
    label = "PLANLANDI";
    dotColor = "bg-blue-600";
  } else if (status === "ENDED") {
    bgColor = "bg-gray-100";
    textColor = "text-gray-600";
    label = "SONA ERDİ";
    dotColor = "bg-gray-500";
  }

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${status === "LIVE" ? "animate-pulse" : ""}`}></span>
      {label}
    </span>
  );
};

export default function DashboardStreamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [data, setData] = useState<StreamSalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sold" | "unsold" | "active">("sold");

  const fetchSalesData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error("Oturum açmanız gerekiyor");
      }

      const response = await fetch(`/api/live-streams/${streamId}/sales`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Veri yüklenemedi");
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error("Error fetching sales data:", err);
      setError(err.message || "Bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (streamId) {
      fetchSalesData();
    }
  }, [streamId]);

  const getProductsForTab = () => {
    if (!data) return [];
    switch (activeTab) {
      case "sold":
        return data.soldProducts;
      case "unsold":
        return data.unsoldProducts;
      case "active":
        return data.activeProducts;
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="bg-[var(--card)] border-b border-[var(--border)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/streams"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Yayın Detayı</h1>
              <p className="text-[var(--muted-foreground)] text-sm mt-1">
                Satış raporları ve ürün detayları
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mb-4" />
            <p className="text-[var(--muted-foreground)]">Veriler yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={fetchSalesData} variant="outline">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Tekrar Dene
            </Button>
          </div>
        ) : data ? (
          <>
            {/* Stream Info Card */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mb-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-[var(--foreground)]">
                      {data.stream.title}
                    </h2>
                    <StatusBadge status={data.stream.status} />
                  </div>
                  <p className="text-[var(--muted-foreground)] text-sm mb-3">
                    {data.stream.description || "Açıklama yok"}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {data.stream.viewerCount} İzleyici
                    </span>
                    {data.stream.startTime && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDateTime(data.stream.startTime)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={fetchSalesData} variant="outline">
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Yenile
                  </Button>
                  <Link href={`/live-streams/${streamId}`}>
                    <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white">
                      <Video className="w-4 h-4 mr-2" />
                      Yayına Git
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">Toplam Gelir</p>
                    <p className="text-xl font-bold text-[var(--foreground)]">
                      {formatPrice(data.summary.totalRevenue)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">Satılan Ürün</p>
                    <p className="text-xl font-bold text-[var(--foreground)]">
                      {data.summary.totalSold} / {data.summary.totalProducts}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Gavel className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">Açık Arttırma</p>
                    <p className="text-lg font-bold text-[var(--foreground)]">
                      {data.summary.auctionSalesCount} adet
                    </p>
                    <p className="text-xs text-green-600">{formatPrice(data.summary.auctionRevenue)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <Tag className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted-foreground)]">Sabit Fiyat</p>
                    <p className="text-lg font-bold text-[var(--foreground)]">
                      {data.summary.fixedPriceSalesCount} adet
                    </p>
                    <p className="text-xs text-green-600">{formatPrice(data.summary.fixedPriceRevenue)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Section */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
              {/* Tab Headers */}
              <div className="flex border-b border-[var(--border)]">
                <button
                  onClick={() => setActiveTab("sold")}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === "sold"
                    ? "text-green-600 border-b-2 border-green-600 bg-green-50 dark:bg-green-900/10"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Satılan ({data.summary.totalSold})
                </button>
                <button
                  onClick={() => setActiveTab("unsold")}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === "unsold"
                    ? "text-gray-600 border-b-2 border-gray-600 bg-gray-50 dark:bg-gray-900/10"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                >
                  <XCircle className="w-4 h-4" />
                  Satılmayan ({data.summary.unsoldCount})
                </button>
                <button
                  onClick={() => setActiveTab("active")}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === "active"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/10"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                >
                  <Clock className="w-4 h-4" />
                  Aktif ({data.summary.activeCount})
                </button>
              </div>

              {/* Products List */}
              <div className="p-4">
                {getProductsForTab().length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)] opacity-50" />
                    <p className="text-[var(--muted-foreground)]">Bu kategoride ürün bulunmuyor</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getProductsForTab().map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-4 p-4 bg-[var(--secondary)]/30 rounded-lg border border-[var(--border)]"
                      >
                        {/* Product Image */}
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-[var(--secondary)] rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-[var(--muted-foreground)]" />
                          </div>
                        )}

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-[var(--foreground)] truncate">
                              {product.title}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${product.isAuctionMode
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                }`}
                            >
                              {product.isAuctionMode ? (
                                <>
                                  <Gavel className="w-3 h-3" />
                                  Açık Arttırma
                                </>
                              ) : (
                                <>
                                  <Tag className="w-3 h-3" />
                                  Sabit Fiyat
                                </>
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--muted-foreground)] truncate mb-2">
                            {product.description || "Açıklama yok"}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-[var(--muted-foreground)]">
                              Başlangıç: {formatPrice(product.basePrice)}
                            </span>
                            {product.bidCount > 0 && (
                              <span className="text-[var(--muted-foreground)]">
                                {product.bidCount} teklif
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sale Info */}
                        <div className="text-right">
                          {product.isSold ? (
                            <>
                              <p className="text-lg font-bold text-green-600">
                                {formatPrice(product.soldPrice || product.currentPrice)}
                              </p>
                              {product.buyer && (
                                <p className="text-sm text-[var(--muted-foreground)]">
                                  @{product.buyer.username}
                                </p>
                              )}
                              {product.soldAt && (
                                <p className="text-xs text-[var(--muted-foreground)]">
                                  {formatDateTime(product.soldAt)}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-lg font-bold text-[var(--foreground)]">
                                {formatPrice(product.currentPrice)}
                              </p>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {product.isActive ? "Aktif" : "Sona erdi"}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

