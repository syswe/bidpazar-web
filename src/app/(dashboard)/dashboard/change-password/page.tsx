'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ChangePassword() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

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
    
    // Validate passwords
    if (formData.newPassword.length < 8) {
      setError('Yeni şifreniz en az 8 karakter olmalıdır.');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Yeni şifre ve şifre tekrarı eşleşmiyor.');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Şifre değiştirirken bir hata oluştu.');
      }
      
      setSuccess('Şifreniz başarıyla değiştirildi.');
      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
    } catch (error: any) {
      setError(error.message || 'Şifre değiştirirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--foreground)]">Şifre Değiştir</h1>
            <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">
              Hesabınızın güvenliği için şifrenizi düzenli olarak değiştirmenizi öneririz.
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
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-[var(--foreground)]">
                    Mevcut Şifre
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    id="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  />
                </div>
                
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--foreground)]">
                    Yeni Şifre
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    id="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  />
                  <p className="mt-1 text-xs text-[var(--foreground)] opacity-70">
                    Şifreniz en az 8 karakter uzunluğunda olmalıdır.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--foreground)]">
                    Yeni Şifre (Tekrar)
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  />
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
                    {isLoading ? 'İşleniyor...' : 'Şifreyi Değiştir'}
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