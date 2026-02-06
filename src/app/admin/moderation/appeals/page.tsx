'use client';

import { useEffect, useState } from 'react';
import type { AppealStatus } from '@prisma/client';
import { getToken } from '@/lib/frontend-auth';

interface Appeal {
  id: string;
  reason: string;
  status: AppealStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  user: {
    id: string;
    username: string;
  };
  action: {
    id: string;
    actionType: string;
    reason: string;
    moderator: {
      username: string;
    };
  };
}

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AppealStatus | ''>('PENDING');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    fetchAppeals();
  }, [statusFilter]);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      // ... inside fetchAppeals ...
      if (statusFilter) params.set('status', statusFilter);

      const token = getToken();
      const response = await fetch(`/api/moderation/appeals?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch appeals');

      const data = await response.json();
      setAppeals(data.appeals || []);
    } catch (error) {
      console.error('Error fetching appeals:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewAppeal = async (appealId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!reviewNotes.trim()) {
      alert('Lütfen inceleme notlarını girin');
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`/api/moderation/appeal/${appealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, reviewNotes }),
      });

      if (!response.ok) throw new Error('İtiraz incelenirken hata oluştu');

      await fetchAppeals();
      setSelectedAppeal(null);
      setReviewNotes('');
      alert(`İtiraz başarıyla ${status.toLowerCase() === 'approved' ? 'onaylandı' : 'reddedildi'}`);
    } catch (error) {
      console.error('Error reviewing appeal:', error);
      alert('İtiraz incelenirken hata oluştu');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">İtiraz Yönetimi</h1>

      {/* Filtreler */}
      <div className="mb-6 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AppealStatus | '')}
          className="px-4 py-2 border rounded-md"
        >
          <option value="">Tüm Durumlar</option>
          <option value="PENDING">Beklemede</option>
          <option value="APPROVED">Onaylandı</option>
          <option value="REJECTED">Reddedildi</option>
        </select>

        <button
          type="button"
          onClick={fetchAppeals}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Yenile
        </button>
      </div>

      {/* İtiraz Listesi */}
      {loading ? (
        <div className="text-center py-12">İtirazlar yükleniyor...</div>
      ) : appeals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          İtiraz bulunamadı
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          < table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Kullanıcı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Orijinal Eylem
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Gönderilme Tarihi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Eylemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {appeals.map((appeal) => (
                <tr key={appeal.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {appeal.user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {appeal.action.actionType.replace(/_/g, ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(appeal.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${appeal.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : appeal.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                        }`}
                    >
                      {appeal.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      type="button"
                      onClick={() => setSelectedAppeal(appeal)}
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

      {/* İtirazı İncele Modalı */}
      {selectedAppeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">İtirazı İncele</h2>

            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <h3 className="font-semibold mb-2">Orijinal Moderasyon Eylemi</h3>
              <p className="text-sm mb-1">
                <span className="font-medium">Tip:</span>{' '}
                {selectedAppeal.action.actionType.replace(/_/g, ' ')}
              </p>
              <p className="text-sm mb-1">
                <span className="font-medium">Sebep:</span> {selectedAppeal.action.reason}
              </p>
              <p className="text-sm">
                <span className="font-medium">Moderatör:</span>{' '}
                {selectedAppeal.action.moderator.username}
              </p>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">İtiraz Nedeni</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedAppeal.reason}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                İnceleme Notları *
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows={4}
                placeholder="Kararınızı açıklayın..."
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAppeal(null);
                  setReviewNotes('');
                }}
                className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => reviewAppeal(selectedAppeal.id, 'REJECTED')}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                İtirazı Reddet
              </button>
              <button
                type="button"
                onClick={() => reviewAppeal(selectedAppeal.id, 'APPROVED')}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                İtirazı Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
