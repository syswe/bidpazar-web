'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { deleteAccount, getToken } from '@/lib/frontend-auth';
import { User, Upload, X } from 'lucide-react';

export default function ProfileEdit() {
  const { user, refreshAuthState } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Account deletion state
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: '',
    bio: ''
  });

  // Profile image state
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user data when available
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        bio: (user as { bio?: string }).bio || ''
      });
      setProfileImage((user as { profileImageUrl?: string }).profileImageUrl || null);
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle profile image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Dosya boyutu en fazla 5MB olabilir.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Sadece resim dosyaları kabul edilir.');
        return;
      }
      setImageFile(file);
      setProfileImage(URL.createObjectURL(file));
    }
  };

  // Handle profile image upload
  const handleImageUpload = async () => {
    if (!imageFile) return;

    try {
      setIsUploadingImage(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('Oturum bilgisi bulunamadı.');
      }

      const formDataUpload = new FormData();
      formDataUpload.append('file', imageFile);

      const response = await fetch('/api/users/profile/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataUpload
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Profil fotoğrafı yüklenirken bir hata oluştu.');
      }

      setProfileImage(data.user.profileImageUrl);
      setImageFile(null);
      setSuccess('Profil fotoğrafı başarıyla yüklendi.');
      await refreshAuthState();
    } catch (error: unknown) {
      const err = error as Error;
      setError(err.message || 'Profil fotoğrafı yüklenirken bir hata oluştu.');
    } finally {
      setIsUploadingImage(false);
    }
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
          phoneNumber: formData.phoneNumber,
          bio: formData.bio
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

  // Function to handle account deletion
  const handleDeleteAccount = async () => {
    const expectedText = 'hesabımın silineceğinin farkındayım ve silmek istiyorum';

    if (deleteConfirmationText.toLowerCase() !== expectedText.toLowerCase()) {
      setDeleteAccountError('Lütfen onay metnini tam olarak yazın.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      setDeleteAccountError(null);

      await deleteAccount();

      // Redirect to home page after successful deletion
      router.push('/');
    } catch (error: any) {
      setDeleteAccountError(error.message || 'Hesap silinirken bir hata oluştu.');
    } finally {
      setIsDeletingAccount(false);
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
                {/* Profile Photo Section */}
                <div className="pb-6 border-b border-[var(--border)]">
                  <h3 className="text-lg font-medium text-[var(--foreground)] mb-4">Profil Fotoğrafı</h3>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-[var(--secondary)] border-2 border-[var(--border)]">
                        {profileImage ? (
                          <Image
                            src={profileImage}
                            alt="Profil fotoğrafı"
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-12 h-12 text-[var(--foreground)] opacity-30" />
                          </div>
                        )}
                      </div>
                      {imageFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setProfileImage((user as { profileImageUrl?: string })?.profileImageUrl || null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Fotoğraf Seç
                      </button>
                      {imageFile && (
                        <button
                          type="button"
                          onClick={handleImageUpload}
                          disabled={isUploadingImage}
                          className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:opacity-90 transition-colors text-sm"
                        >
                          {isUploadingImage ? 'Yükleniyor...' : 'Fotoğrafı Kaydet'}
                        </button>
                      )}
                      <p className="text-xs text-[var(--foreground)] opacity-60">
                        JPG, PNG veya GIF. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>

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

                {/* Bio/Description Field */}
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-[var(--foreground)]">
                    Açıklama / Hakkımda
                    {user?.userType === 'SELLER' && <span className="text-xs text-[var(--foreground)] opacity-60 ml-2">(Satıcı profilinizde görünecek)</span>}
                  </label>
                  <textarea
                    name="bio"
                    id="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={4}
                    maxLength={500}
                    placeholder="Kendiniz hakkında kısa bir açıklama yazın..."
                    className="mt-1 block w-full bg-[var(--background)] border border-[var(--border)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--accent)] focus:border-[var(--accent)] resize-none"
                  />
                  <p className="mt-1 text-xs text-[var(--foreground)] opacity-60">
                    {formData.bio.length}/500 karakter
                  </p>
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

          {/* Dangerous Actions Section */}
          <div className="mt-8 bg-[var(--background)] p-6 rounded-2xl border border-red-200 shadow-sm">
            <h2 className="text-xl font-bold text-red-600 mb-4">Tehlikeli İşlemler</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Hesabımı Sil</h3>
              <p className="text-sm text-red-700 mb-4">
                Bu işlem geri alınamaz. Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinecektir.
              </p>
              <ul className="text-sm text-red-700 mb-4 list-disc list-inside space-y-1">
                <li>Tüm kişisel bilgileriniz silinecek</li>
                <li>Ürünleriniz ve ilanlarınız kaldırılacak</li>
                <li>Mesajlarınız ve yayın geçmişiniz silinecek</li>
                <li>Bu hesapla tekrar giriş yapamazsınız</li>
              </ul>
              <button
                onClick={() => setShowDeleteAccountModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Hesabımı Sil
              </button>
            </div>
          </div>
        </div>

        {/* Delete Account Modal */}
        {showDeleteAccountModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="delete-modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" aria-hidden="true"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-[var(--background)] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full mx-4">
                <div className="bg-[var(--background)] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-red-600" id="delete-modal-title">
                        Hesabınızı Silmek İstediğinizden Emin Misiniz?
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-[var(--foreground)] opacity-70 mb-4">
                          Bu işlem <strong>geri alınamaz</strong>. Hesabınızı sildiğinizde:
                        </p>
                        <ul className="text-sm text-[var(--foreground)] opacity-70 mb-4 list-disc list-inside space-y-1">
                          <li>Tüm kişisel bilgileriniz silinecek</li>
                          <li>Ürünleriniz ve ilanlarınız kaldırılacak</li>
                          <li>Mesajlarınız ve yayın geçmişiniz silinecek</li>
                          <li>Bu hesapla tekrar giriş yapamazsınız</li>
                        </ul>

                        <p className="text-sm text-red-600 font-medium mb-3">
                          Devam etmek için aşağıdaki metni tam olarak yazın:
                        </p>
                        <p className="text-sm text-[var(--foreground)] font-mono bg-gray-100 p-2 rounded mb-3">
                          hesabımın silineceğinin farkındayım ve silmek istiyorum
                        </p>

                        <div className="mt-4">
                          <input
                            type="text"
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            placeholder="Yukarıdaki metni buraya yazın..."
                            className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-[var(--foreground)] bg-[var(--background)] text-sm"
                          />
                        </div>

                        {deleteAccountError && (
                          <div className="mt-2 p-2 bg-red-100 text-red-800 rounded-md text-sm">
                            {deleteAccountError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--background)] px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteAccountModal(false);
                      setDeleteConfirmationText('');
                      setDeleteAccountError(null);
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-[var(--border)] shadow-sm px-4 py-2 bg-[var(--background)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--border)] sm:w-auto"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || deleteConfirmationText.toLowerCase() !== 'hesabımın silineceğinin farkındayım ve silmek istiyorum'}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingAccount ? 'Hesap Siliniyor...' : 'Hesabımı Sil'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
} 