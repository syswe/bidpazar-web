'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';

interface Address {
  id: string;
  title: string;
  fullName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  isDefault: boolean;
}

export default function Addresses() {
  const { user } = useAuth();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    fullName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phoneNumber: '',
    isDefault: false
  });

  // Load addresses when component mounts
  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  const fetchAddresses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real implementation, this would fetch from your API
      // This is just a placeholder
      const mockAddresses: Address[] = [
        {
          id: '1',
          title: 'Ev',
          fullName: user?.name || 'Kullanıcı',
          address: 'Örnek Mah. Deneme Sok. No:123',
          city: 'İstanbul',
          state: 'Kadıköy',
          zipCode: '34000',
          phoneNumber: user?.phoneNumber || '5551234567',
          isDefault: true
        },
        {
          id: '2',
          title: 'İş',
          fullName: user?.name || 'Kullanıcı',
          address: 'İş Merkezi No:45 Kat:3',
          city: 'İstanbul',
          state: 'Şişli',
          zipCode: '34000',
          phoneNumber: user?.phoneNumber || '5551234567',
          isDefault: false
        }
      ];
      
      // Simulate API call
      setTimeout(() => {
        setAddresses(mockAddresses);
        setIsLoading(false);
      }, 500);
      
    } catch (error: any) {
      setError('Adresler yüklenirken bir hata oluştu.');
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddAddress = () => {
    setFormData({
      title: '',
      fullName: user?.name || '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      phoneNumber: user?.phoneNumber || '',
      isDefault: false
    });
    setEditingAddress(null);
    setShowAddModal(true);
  };

  const handleEditAddress = (address: Address) => {
    setFormData({
      title: address.title,
      fullName: address.fullName,
      address: address.address,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      phoneNumber: address.phoneNumber,
      isDefault: address.isDefault
    });
    setEditingAddress(address);
    setShowAddModal(true);
  };

  const handleDeleteAddress = async (id: string) => {
    // Normally you would call your API here
    if (window.confirm('Bu adresi silmek istediğinize emin misiniz?')) {
      try {
        // Filter out the deleted address
        setAddresses(addresses.filter(address => address.id !== id));
      } catch (error) {
        setError('Adres silinirken bir hata oluştu.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // This would normally be an API call
      if (editingAddress) {
        // Update existing address
        const updatedAddresses = addresses.map(addr => 
          addr.id === editingAddress.id ? { ...addr, ...formData, id: addr.id } : addr
        );
        setAddresses(updatedAddresses);
      } else {
        // Add new address
        const newAddress: Address = {
          ...formData,
          id: Math.random().toString(36).substr(2, 9) // Generate random ID
        };
        setAddresses([...addresses, newAddress]);
      }
      
      setShowAddModal(false);
      
    } catch (error) {
      setError('Adres kaydedilirken bir hata oluştu.');
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Adreslerim</h1>
              <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">
                Teslimat ve fatura adreslerinizi yönetin.
              </p>
            </div>
            <button
              onClick={handleAddAddress}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:opacity-90 transition-all text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Yeni Adres Ekle
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
              {error}
            </div>
          )}
          
          {isLoading ? (
            <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
              <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--foreground)] font-medium">Adresleriniz yükleniyor...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
              <div className="w-16 h-16 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Henüz adres eklenmemiş</h3>
              <p className="text-[var(--foreground)] opacity-70 mb-6 max-w-md mx-auto">
                Teslimat ve faturalama için adreslerinizi ekleyebilirsiniz.
              </p>
              <button
                onClick={handleAddAddress}
                className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                İlk Adresinizi Ekleyin
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {addresses.map((address) => (
                <div key={address.id} className={`bg-[var(--background)] p-6 rounded-xl border ${address.isDefault ? 'border-[var(--accent)]' : 'border-[var(--border)]'} shadow-sm relative group`}>
                  {address.isDefault && (
                    <span className="absolute top-4 right-4 text-xs px-2 py-1 bg-[var(--accent)] text-white rounded-full">
                      Varsayılan
                    </span>
                  )}
                  
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{address.title}</h3>
                    <p className="text-[var(--foreground)] font-medium">{address.fullName}</p>
                  </div>
                  
                  <div className="space-y-1 text-sm text-[var(--foreground)] opacity-80">
                    <p>{address.address}</p>
                    <p>{address.state}, {address.city}, {address.zipCode}</p>
                    <p className="pt-2">{address.phoneNumber}</p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditAddress(address)}
                      className="p-2 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(address.id)}
                      className="p-2 text-[var(--foreground)] hover:text-red-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-8">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Geri Dön
            </button>
          </div>
        </div>
      </div>
      
      {/* Address Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[var(--background)] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-[var(--background)] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-[var(--foreground)]" id="modal-title">
                      {editingAddress ? 'Adresi Düzenle' : 'Yeni Adres Ekle'}
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="mt-4">
                      <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="title" className="block text-sm font-medium text-[var(--foreground)]">
                            Adres Başlığı
                          </label>
                          <input
                            type="text"
                            name="title"
                            id="title"
                            placeholder="Örn: Ev, İş"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="fullName" className="block text-sm font-medium text-[var(--foreground)]">
                            Ad Soyad
                          </label>
                          <input
                            type="text"
                            name="fullName"
                            id="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm"
                          />
                        </div>
                        
                        <div className="sm:col-span-2">
                          <label htmlFor="address" className="block text-sm font-medium text-[var(--foreground)]">
                            Adres
                          </label>
                          <textarea
                            name="address"
                            id="address"
                            rows={3}
                            value={formData.address}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="city" className="block text-sm font-medium text-[var(--foreground)]">
                            İl
                          </label>
                          <input
                            type="text"
                            name="city"
                            id="city"
                            value={formData.city}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="state" className="block text-sm font-medium text-[var(--foreground)]">
                            İlçe
                          </label>
                          <input
                            type="text"
                            name="state"
                            id="state"
                            value={formData.state}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="zipCode" className="block text-sm font-medium text-[var(--foreground)]">
                            Posta Kodu
                          </label>
                          <input
                            type="text"
                            name="zipCode"
                            id="zipCode"
                            value={formData.zipCode}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="phoneNumber" className="block text-sm font-medium text-[var(--foreground)]">
                            Telefon
                          </label>
                          <input
                            type="tel"
                            name="phoneNumber"
                            id="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm"
                          />
                        </div>
                        
                        <div className="sm:col-span-2">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              name="isDefault"
                              id="isDefault"
                              checked={formData.isDefault}
                              onChange={handleChange}
                              className="h-4 w-4 text-[var(--accent)] border-[var(--border)] rounded focus:ring-[var(--accent)]"
                            />
                            <label htmlFor="isDefault" className="ml-2 text-sm text-[var(--foreground)]">
                              Varsayılan adres olarak belirle
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[var(--accent)] text-base font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddModal(false)}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-[var(--border)] shadow-sm px-4 py-2 bg-[var(--background)] text-base font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--border)] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          İptal
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
} 