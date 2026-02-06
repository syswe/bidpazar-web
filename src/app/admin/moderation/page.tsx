'use client';

import { useEffect, useState } from 'react';
import { ReportStatus, ReportContentType, ReportReason } from '@prisma/client';
import { getToken } from '@/lib/frontend-auth';

interface Report {
  id: string;
  contentType: ReportContentType;
  contentId: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: string;
  reporter: {
    id: string;
    username: string;
  };
}

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('PENDING');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');

      const token = getToken();
      const response = await fetch(`/api/moderation/reports?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Raporlar alınırken hata oluştu');

      const data = await response.json();
      setReports(data.reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const takeAction = async (
    reportId: string,
    actionType: string,
    reason: string
  ) => {
    try {
      const token = getToken();
      const response = await fetch('/api/moderation/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reportId,
          actionType,
          reason,
        }),
      });

      if (!response.ok) throw new Error('Eylem yapılırken hata oluştu');

      // Refresh reports
      await fetchReports();
      setSelectedReport(null);
      alert('Eylem başarıyla gerçekleştirildi');
    } catch (error) {
      console.error('Error taking action:', error);
      alert('Eylem yapılırken hata oluştu');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">İçerik Moderasyon Kuyruğu</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
          className="px-4 py-2 border rounded-md"
        >
          <option value="">Tüm Durumlar</option>
          <option value="PENDING">Beklemede (Pending)</option>
          <option value="UNDER_REVIEW">İnceleniyor</option>
          <option value="RESOLVED">Çözüldü</option>
          <option value="DISMISSED">Reddedildi</option>
        </select>

        <button
          onClick={fetchReports}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Yenile
        </button>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-12">Raporlar yükleniyor...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Rapor bulunamadı
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tip
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sebep
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Raporlayan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tarih
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eylemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {report.contentType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {report.reason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {report.reporter.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(report.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${report.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : report.status === 'RESOLVED'
                          ? 'bg-green-100 text-green-800'
                          : report.status === 'DISMISSED'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      İncele
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for reviewing report */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Raporu İncele</h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <span className="font-semibold">İçerik Tipi:</span> {selectedReport.contentType}
              </div>
              <div>
                <span className="font-semibold">İçerik ID:</span> {selectedReport.contentId}
              </div>
              <div>
                <span className="font-semibold">Sebep:</span> {selectedReport.reason}
              </div>
              {selectedReport.description && (
                <div>
                  <span className="font-semibold">Açıklama:</span>
                  <p className="mt-1 text-gray-700">{selectedReport.description}</p>
                </div>
              )}
              <div>
                <span className="font-semibold">Raporlayan:</span> {selectedReport.reporter.username}
              </div>
              <div>
                <span className="font-semibold">Rapor Tarihi:</span>{' '}
                {new Date(selectedReport.createdAt).toLocaleString('tr-TR')}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Aksiyon Al</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => takeAction(selectedReport.id, 'DISMISS_REPORT', 'İhlal yok')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Reddet (İhlal Yok)
                </button>
                <button
                  onClick={() =>
                    takeAction(selectedReport.id, 'WARN_USER', 'Topluluk kuralları ihlali')
                  }
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                >
                  Kullanıcıyı Uyar
                </button>
                <button
                  onClick={() =>
                    takeAction(selectedReport.id, 'REMOVE_CONTENT', 'İçerik politikası ihlali')
                  }
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                >
                  İçeriği Kaldır
                </button>
                <button
                  onClick={() =>
                    takeAction(selectedReport.id, 'SUSPEND_USER', 'Ciddi politika ihlali')
                  }
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  Kullanıcıyı Askıya Al
                </button>
                <button
                  onClick={() =>
                    takeAction(selectedReport.id, 'BAN_USER', 'Ağır ihlal - kalıcı ban')
                  }
                  className="px-4 py-2 bg-red-900 text-white rounded-md hover:bg-red-950"
                >
                  Kullanıcıyı Yasakla (Ban)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
