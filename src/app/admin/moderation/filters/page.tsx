'use client';

import { useEffect, useState } from 'react';
import { ReportContentType } from '@prisma/client';
import { getToken } from '@/lib/frontend-auth';

interface Filter {
  id: string;
  name: string;
  pattern: string;
  contentTypes: ReportContentType[];
  action: string;
  severity: number;
  isActive: boolean;
  createdAt: string;
  creator: {
    username: string;
  };
}

export default function FiltersPage() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    pattern: '',
    contentTypes: [] as ReportContentType[],
    action: 'BLOCK',
    severity: 1,
  });

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    setLoading(true);
    // ... inside fetchFilters ...
    try {
      const token = getToken();
      const response = await fetch('/api/moderation/filters', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Filtreler alınırken hata oluştu');
      const data = await response.json();
      setFilters(data.filters);
    } catch (error) {
      console.error('Error fetching filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFilter = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = getToken();
      const response = await fetch('/api/moderation/filters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Filtre oluşturulurken hata oluştu');
      }

      await fetchFilters();
      setShowCreateForm(false);
      setFormData({
        name: '',
        pattern: '',
        contentTypes: [],
        action: 'BLOCK',
        severity: 1,
      });
      alert('Filtre başarıyla oluşturuldu');
    } catch (error: any) {
      alert(error.message || 'Filtre oluşturulurken hata oluştu');
    }
  };

  const toggleContentType = (type: ReportContentType) => {
    setFormData((prev) => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(type)
        ? prev.contentTypes.filter((t) => t !== type)
        : [...prev.contentTypes, type],
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">İçerik Filtreleri</h1>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          + Filtre Ekle
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Filtreler yükleniyor...</div>
      ) : (
        <div className="grid gap-4">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="bg-white rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{filter.name}</h3>
                  <p className="text-sm text-gray-500">
                    {filter.creator.username} tarafından oluşturuldu
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${filter.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                    }`}
                >
                  {filter.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="font-medium text-sm">Desen (Regex):</span>
                  <code className="block mt-1 p-2 bg-gray-50 rounded text-xs">
                    {filter.pattern}
                  </code>
                </div>
                <div>
                  <span className="font-medium text-sm">Eylem:</span>
                  <span className="block mt-1 font-mono text-sm">
                    {filter.action === 'BLOCK' ? 'Engelle' :
                      filter.action === 'FLAG' ? 'İncelemeye Al' :
                        filter.action === 'WARN' ? 'Kullanıcıyı Uyar' : filter.action}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {filter.contentTypes.map((type) => (
                  <span
                    key={type}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                  >
                    {type}
                  </span>
                ))}
              </div>

              <div className="mt-2 text-sm">
                <span className="font-medium">Ciddiyet:</span> {filter.severity}/5
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Filter Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Yeni İçerik Filtresi Oluştur</h2>

            <form onSubmit={handleCreateFilter}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Filtre Adı *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Desen (Regex) *
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                  placeholder="örn: (spam|scam)"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  İçerik Tipleri *
                </label>
                <div className="flex flex-wrap gap-2">
                  {['STREAM', 'PRODUCT', 'CHAT_MESSAGE', 'STORY', 'DIRECT_MESSAGE'].map(
                    (type) => (
                      <label key={type} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.contentTypes.includes(type as ReportContentType)}
                          onChange={() => toggleContentType(type as ReportContentType)}
                        />
                        <span className="text-sm">{type}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Eylem *</label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="BLOCK">Engelle (Block)</option>
                    <option value="FLAG">İncelemeye Al (Flag)</option>
                    <option value="WARN">Kullanıcıyı Uyar (Warn)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Ciddiyet (1-5) *</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.severity}
                    onChange={(e) =>
                      setFormData({ ...formData, severity: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Filtre Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
