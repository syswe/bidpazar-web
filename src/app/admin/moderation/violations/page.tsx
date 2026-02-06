'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/frontend-auth';

interface Violation {
  id: string;
  userId: string;
  violationType: string;
  severity: number;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  action: {
    id: string;
    actionType: string;
    reason: string;
    moderatorUserId: string;
    createdAt: string;
    expiresAt?: string;
  };
}

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchUserId, setSearchUserId] = useState('');
  const [searchUsername, setSearchUsername] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [totalActivePoints, setTotalActivePoints] = useState(0);
  const [totalViolations, setTotalViolations] = useState(0);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.push('/');
    }
  }, [user, router]);

  const fetchViolations = async () => {
    // If no search criteria, don't fetch (or clear results)
    if (!searchUserId && !searchUsername) {
      setViolations([]);
      setTotalActivePoints(0);
      setTotalViolations(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchUserId) {
        params.append('userId', searchUserId);
      } else if (searchUsername) {
        params.append('username', searchUsername);
      }

      if (showInactive) params.append('includeInactive', 'true');

      const token = getToken();
      const response = await fetch(`/api/moderation/violations?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Handle 404 cleanly inside the UI logic rather than throwing if possible,
        // but for now we throw to catch block.
        const errorData = await response.json();
        throw new Error(errorData.error || 'İhlaller alınırken hata oluştu');
      }

      const data = await response.json();
      setViolations(data.violations || []);
      setTotalActivePoints(data.totalActivePoints || 0);
      setTotalViolations(data.totalViolations || 0);
    } catch (error) {
      console.error('Error fetching violations:', error);
      setViolations([]);
      setTotalActivePoints(0);
      setTotalViolations(0);
    } finally {
      setIsLoading(false);
    }
  };

  const searchUserByUsername = async () => {
    if (!searchUsername) return;
    // Clear userId to prioritize username search
    setSearchUserId('');
    // Trigger fetch will happen via useEffect if we depend on it, 
    // or we can call explicitly. 
    // Since we are changing searchUserId, the useEffect will fire.
    // But if searchUserId was already empty, it might not fire.
    // So let's call fetch directly if ID is already empty.
    if (!searchUserId) {
      fetchViolations();
    }
  };

  useEffect(() => {
    if (user?.isAdmin) {
      if (searchUserId) {
        fetchViolations();
      }
    }
  }, [user, searchUserId, showInactive]);

  const getViolationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SPAM: 'İstenmeyen İçerik',
      HARASSMENT: 'Taciz',
      HATE_SPEECH: 'Nefret Söylemi',
      VIOLENCE: 'Şiddet',
      ILLEGAL_CONTENT: 'Yasadışı İçerik',
      FRAUD: 'Dolandırıcılık',
      INAPPROPRIATE: 'Uygunsuz İçerik',
      COPYRIGHT: 'Telif Hakkı',
      OTHER: 'Diğer',
    };
    return labels[type] || type;
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      REMOVE_CONTENT: 'İçerik Kaldırıldı',
      HIDE_CONTENT: 'İçerik Gizlendi',
      WARN_USER: 'Kullanıcı Uyarıldı',
      SUSPEND_USER: 'Kullanıcı Askıya Alındı',
      BAN_USER: 'Kullanıcı Yasaklandı',
      RESTORE_CONTENT: 'İçerik Geri Yüklendi',
      DISMISS_REPORT: 'Şikayet Reddedildi',
    };
    return labels[type] || type;
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 5) return 'bg-red-100 text-red-800';
    if (severity >= 3) return 'bg-orange-100 text-orange-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Kullanıcı İhlalleri</h1>

      {/* Arama ve Filtreleme */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kullanıcı ID
            </label>
            <input
              type="text"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              placeholder="Kullanıcı ID girin"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kullanıcı Adı
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                placeholder="Kullanıcı adı girin"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={searchUserByUsername}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Ara
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Pasif İhlalleri Göster</span>
            </label>
          </div>
        </div>

        {/* Özet İstatistikler */}
        {searchUserId && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex gap-6">
            <div>
              <div className="text-sm text-gray-600">Toplam İhlal</div>
              <div className="text-2xl font-bold">{totalViolations}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Aktif Puan</div>
              <div className="text-2xl font-bold text-red-600">{totalActivePoints}</div>
            </div>
          </div>
        )}
      </div>

      {/* İhlaller Tablosu */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kullanıcı
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                İhlal Türü
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Eylem
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Şiddet
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tarih
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {violations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {searchUserId ? 'İhlal bulunamadı' : 'Aramak için kullanıcı ID girin'}
                </td>
              </tr>
            ) : (
              violations.map((violation) => (
                <tr key={violation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {violation.user.username}
                    </div>
                    <div className="text-sm text-gray-500">{violation.user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {getViolationTypeLabel(violation.violationType)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {getActionTypeLabel(violation.action.actionType)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {violation.action.reason}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(
                        violation.severity
                      )}`}
                    >
                      {violation.severity} puan
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {violation.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Pasif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(violation.createdAt).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
