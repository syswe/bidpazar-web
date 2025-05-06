'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ProfileEdit() {
  const { user, refreshAuthState } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: ''
  });

  // Load user data when available
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || ''
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          phoneNumber: formData.phoneNumber
        }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Profil güncellenirken bir hata oluştu.');
      }
      
      setSuccess('Profiliniz başarıyla güncellendi.');
      // Refresh auth state to update user data
      await refreshAuthState();
      
    } catch (error: any) {
      setError(error.message || 'Profil güncellenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--foreground)]">Profil Bilgilerim</h1>
            <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">
              Kişisel bilgilerinizi güncelleyebilirsiniz.
            </p>
          </div>
          
          <div className="bg-[var(--background)] p-8 rounded-2xl border border-[var(--border)] shadow-sm">
            {success && (
              <div className="mb-6 p-4 bg-green-50 text-green-800 rounded-md border border-green-200">
                {success}
              </div>
            )}
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-[var(--foreground)]">
                      Ad Soyad
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-[var(--foreground)]">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      name="username"
                      id="username"
                      value={formData.username}
                      onChange={handleChange}
                      className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)]">
                      E-posta Adresi
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-[var(--foreground)]">
                      Telefon Numarası
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      id="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                  >
                    Geri Dön
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:opacity-90 transition-colors text-sm"
                  >
                    {isLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 