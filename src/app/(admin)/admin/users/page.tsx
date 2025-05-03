'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { User, getAllUsers, makeAdmin, removeAdmin, deleteUser } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Kullanıcılar yüklenirken hata:', err);
      setError('Kullanıcılar yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    if (actionInProgress) return;

    try {
      setActionInProgress(userId);
      await makeAdmin(userId);
      // Kullanıcı listesini güncelle
      setUsers(users.map(user =>
        user.id === userId ? { ...user, isAdmin: true } : user
      ));
    } catch (err) {
      console.error('Admin yapma işlemi başarısız:', err);
      alert('Admin yapma işlemi başarısız oldu.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (actionInProgress) return;

    // Kendini admin olmaktan çıkarmasını engelle
    if (userId === currentUser?.id) {
      alert('Kendinizi admin olmaktan çıkaramazsınız.');
      return;
    }

    try {
      setActionInProgress(userId);
      await removeAdmin(userId);
      // Kullanıcı listesini güncelle
      setUsers(users.map(user =>
        user.id === userId ? { ...user, isAdmin: false } : user
      ));
    } catch (err) {
      console.error('Admin yetkisi kaldırma işlemi başarısız:', err);
      alert('Admin yetkisi kaldırma işlemi başarısız oldu.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (actionInProgress) return;

    // Kendini silmesini engelle
    if (userId === currentUser?.id) {
      alert('Kendinizi silemezsiniz.');
      return;
    }

    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      setActionInProgress(userId);
      await deleteUser(userId);
      // Kullanıcı listesini güncelle
      setUsers(users.filter(user => user.id !== userId));
    } catch (err) {
      console.error('Kullanıcı silme işlemi başarısız:', err);
      alert('Kullanıcı silme işlemi başarısız oldu.');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <AdminLayout title="Kullanıcılar">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 p-4 rounded-lg">
          {error}
          <button
            onClick={fetchUsers}
            className="ml-4 bg-red-100 dark:bg-red-800 px-3 py-1 rounded-md text-sm"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Kullanıcı Listesi
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Toplam {users.length} kullanıcı bulunuyor.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Kullanıcı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ürün Sayısı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-300 font-medium">
                              {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name || user.username}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {user.isAdmin && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                              Admin
                            </span>
                          )}
                          {user.isVerified ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                              Doğrulanmış
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
                              Doğrulanmamış
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user._count?.products || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {user.isAdmin ? (
                            <button
                              onClick={() => handleRemoveAdmin(user.id)}
                              disabled={actionInProgress === user.id || user.id === currentUser?.id}
                              className={`text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 ${(actionInProgress === user.id || user.id === currentUser?.id) ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                              Admin Yetkisini Kaldır
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMakeAdmin(user.id)}
                              disabled={actionInProgress === user.id}
                              className={`text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 ${actionInProgress === user.id ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                              Admin Yap
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={actionInProgress === user.id || user.id === currentUser?.id}
                            className={`text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ${(actionInProgress === user.id || user.id === currentUser?.id) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
} 