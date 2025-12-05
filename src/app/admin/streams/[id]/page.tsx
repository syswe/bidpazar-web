"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { getToken } from "@/lib/frontend-auth";
import { formatDate } from "@/lib/utils";
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
} from "lucide-react";

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
    email?: string;
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
  const config: Record<string, { bg: string; text: string; label: string; icon: any }> = {
    SCHEDULED: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Planlanmış", icon: Clock },
    LIVE: { bg: "bg-red-100", text: "text-red-800", label: "Canlı", icon: AlertCircle },
    ENDED: { bg: "bg-gray-100", text: "text-gray-800", label: "Sona Erdi", icon: CheckCircle },
  };

  const { bg, text, label, icon: Icon } = config[status] || config.ENDED;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

export default function AdminStreamDetailPage() {
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
    <AdminLayout title="Yayın Detayı">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/admin/streams"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Yayın Listesine Dön
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchSalesData}
            className="inline-flex items-center px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-700"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Tekrar Dene
          </button>
        </div>
      ) : data ? (
        <>
          {/* Stream Info Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data.stream.title}
                  </h1>
                  <StatusBadge status={data.stream.status} />
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {data.stream.description || "Açıklama yok"}
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    @{data.stream.host.username}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {data.stream.viewerCount} İzleyici
                  </span>
                  {data.stream.startTime && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(data.stream.startTime)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchSalesData}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Yenile
                </button>
                <Link
                  href={`/live-streams/${streamId}`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Yayına Git
                </Link>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Toplam Gelir</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatPrice(data.summary.totalRevenue)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Satılan Ürün</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.summary.totalSold} / {data.summary.totalProducts}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Gavel className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Açık Arttırma</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.summary.auctionSalesCount} ({formatPrice(data.summary.auctionRevenue)})
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <Tag className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sabit Fiyat</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {data.summary.fixedPriceSalesCount} ({formatPrice(data.summary.fixedPriceRevenue)})
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Products Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab("sold")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === "sold"
                  ? "text-green-600 border-b-2 border-green-600 bg-green-50 dark:bg-green-900/20"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Satılan ({data.summary.totalSold})
              </button>
              <button
                onClick={() => setActiveTab("unsold")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === "unsold"
                  ? "text-gray-600 border-b-2 border-gray-600 bg-gray-50 dark:bg-gray-900/20"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
              >
                <XCircle className="w-4 h-4 inline mr-2" />
                Satılmayan ({data.summary.unsoldCount})
              </button>
              <button
                onClick={() => setActiveTab("active")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === "active"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Aktif ({data.summary.activeCount})
              </button>
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ürün
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tür
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Başlangıç Fiyatı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {activeTab === "sold" ? "Satış Fiyatı" : "Mevcut Fiyat"}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {activeTab === "sold" ? "Alıcı" : "Teklif Sayısı"}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tarih
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {getProductsForTab().length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Bu kategoride ürün bulunmuyor</p>
                      </td>
                    </tr>
                  ) : (
                    getProductsForTab().map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.title}
                                className="w-10 h-10 rounded-lg object-cover mr-3"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center mr-3">
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {product.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {product.description?.substring(0, 50) || "Açıklama yok"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${product.isAuctionMode
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
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
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatPrice(product.basePrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`text-sm font-medium ${product.isSold
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-900 dark:text-white"
                              }`}
                          >
                            {formatPrice(product.soldPrice || product.currentPrice)}
                          </span>
                          {product.isSold && product.soldPrice && product.soldPrice > product.basePrice && (
                            <span className="text-xs text-green-500 ml-1">
                              (+{Math.round(((product.soldPrice - product.basePrice) / product.basePrice) * 100)}%)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {activeTab === "sold" && product.buyer ? (
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                @{product.buyer.username}
                              </p>
                              {product.buyer.email && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {product.buyer.email}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {product.bidCount} teklif
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.soldAt
                            ? formatDate(product.soldAt)
                            : product.endTime
                              ? formatDate(product.endTime)
                              : formatDate(product.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}

