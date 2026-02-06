'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, AlertOctagon, TrendingUp, XCircle, ShieldAlert, AlertCircle } from 'lucide-react';
import { getToken } from '@/lib/frontend-auth';

interface AnalyticsData {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  dismissedReports: number;
  totalViolations: number;
  activeBans: number;
  activeSuspensions: number;
  activeFilters: number;
  reportsToday: number;
  reportsThisWeek: number;
  reportsThisMonth: number;
  topReportReasons: Array<{ reason: string; count: number }>;
  topReportedContentTypes: Array<{ type: string; count: number }>;
}

export default function ModerationAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/admin/moderation/analytics', {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Analitik verileri yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Analitik verileri yüklenemedi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Moderasyon Analitiği</h1>
        <p className="text-gray-600 mt-2">Platform moderasyon istatistikleri ve trendler</p>
      </div>

      {/* Ana İstatistikler */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">Toplam Rapor</h3>
            <AlertOctagon className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{analytics.totalReports}</div>
            <p className="text-xs text-gray-500 mt-1">
              {analytics.pendingReports} beklemede
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">Aktif İhlaller</h3>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{analytics.totalViolations}</div>
            <p className="text-xs text-gray-500 mt-1">
              Toplam ihlal sayısı
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">Aktif Yasaklar</h3>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{analytics.activeBans}</div>
            <p className="text-xs text-gray-500 mt-1">
              {analytics.activeSuspensions} geçici askıya alma
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">Aktif Filtreler</h3>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{analytics.activeFilters}</div>
            <p className="text-xs text-gray-500 mt-1">
              Otomatik içerik filtreleri
            </p>
          </div>
        </div>
      </div>

      {/* Zaman Bazlı İstatistikler */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="pb-4">
          <h3 className="text-xl font-bold">Rapor Trendleri</h3>
          <p className="text-sm text-gray-600">Zaman bazlı rapor sayıları</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Bugün</p>
              <p className="text-2xl font-bold">{analytics.reportsToday}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Bu Hafta</p>
              <p className="text-2xl font-bold">{analytics.reportsThisWeek}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="p-3 bg-purple-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Bu Ay</p>
              <p className="text-2xl font-bold">{analytics.reportsThisMonth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rapor Dağılımları */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="pb-4">
            <h3 className="text-xl font-bold">En Sık Rapor Sebepleri</h3>
            <p className="text-sm text-gray-600">İçerik rapor sebeplerinin dağılımı</p>
          </div>
          <div className="space-y-4">
            {analytics.topReportReasons.map((item: { reason: string; count: number }, index: number) => (
              <div key={item.reason} className="flex items-center justify-between">
                <span className="text-sm font-medium">{getReasonLabel(item.reason)}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{
                        width: `${(item.count / analytics.totalReports) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="pb-4">
            <h3 className="text-xl font-bold">İçerik Türü Dağılımı</h3>
            <p className="text-sm text-gray-600">Raporlanan içerik türleri</p>
          </div>
          <div className="space-y-4">
            {analytics.topReportedContentTypes.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium">{getContentTypeLabel(item.type)}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{
                        width: `${(item.count / analytics.totalReports) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rapor Durumu */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="pb-4">
          <h3 className="text-xl font-bold">Rapor Durumu Özeti</h3>
          <p className="text-sm text-gray-600">Tüm raporların durum dağılımı</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <div className="p-2 bg-yellow-100 rounded-full">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Beklemede</p>
              <p className="text-xl font-bold">{analytics.pendingReports}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Çözüldü</p>
              <p className="text-xl font-bold">{analytics.resolvedReports}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <div className="p-2 bg-gray-100 rounded-full">
              <XCircle className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Reddedildi</p>
              <p className="text-xl font-bold">{analytics.dismissedReports}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    SPAM: 'Spam',
    HARASSMENT: 'Taciz',
    HATE_SPEECH: 'Nefret Söylemi',
    VIOLENCE: 'Şiddet',
    ILLEGAL_CONTENT: 'Yasadışı İçerik',
    FRAUD: 'Dolandırıcılık',
    INAPPROPRIATE: 'Uygunsuz İçerik',
    COPYRIGHT: 'Telif Hakkı',
    OTHER: 'Diğer',
  };
  return labels[reason] || reason;
}

function getContentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    STREAM: 'Canlı Yayın',
    PRODUCT: 'Ürün',
    CHAT_MESSAGE: 'Sohbet Mesajı',
    STORY: 'Hikaye',
    DIRECT_MESSAGE: 'Direkt Mesaj',
  };
  return labels[type] || type;
}
