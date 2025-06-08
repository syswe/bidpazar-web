"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  User,
  getAllUsers,
  makeAdmin,
  removeAdmin,
  deleteUser,
  createUser,
  resetUserPassword,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

// Define interface for the API response
interface UserApiResponse {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    isAdmin: false,
  });
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] =
    useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllUsers();
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data && typeof data === "object" && "users" in data) {
        // Handle the object format where users are in a 'users' property
        const apiResponse = data as UserApiResponse;
        setUsers(apiResponse.users);
      } else {
        console.error("Expected array but received:", data);
        setError("Kullanıcı verileri beklenen formatta değil.");
      }
    } catch (err) {
      console.error("Kullanıcılar yüklenirken hata:", err);
      setError("Kullanıcılar yüklenirken bir hata oluştu.");
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
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, isAdmin: true } : user
        )
      );
    } catch (err) {
      console.error("Admin yapma işlemi başarısız:", err);
      alert("Admin yapma işlemi başarısız oldu.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (actionInProgress) return;

    // Kendini admin olmaktan çıkarmasını engelle
    if (userId === currentUser?.id) {
      alert("Kendinizi admin olmaktan çıkaramazsınız.");
      return;
    }

    try {
      setActionInProgress(userId);
      await removeAdmin(userId);
      // Kullanıcı listesini güncelle
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, isAdmin: false } : user
        )
      );
    } catch (err) {
      console.error("Admin yetkisi kaldırma işlemi başarısız:", err);
      alert("Admin yetkisi kaldırma işlemi başarısız oldu.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (actionInProgress) return;

    // Kendini silmesini engelle
    if (userId === currentUser?.id) {
      alert("Kendinizi silemezsiniz.");
      return;
    }

    if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) {
      return;
    }

    try {
      setActionInProgress(userId);
      await deleteUser(userId);
      // Kullanıcı listesini güncelle
      setUsers(users.filter((user) => user.id !== userId));
    } catch (err) {
      console.error("Kullanıcı silme işlemi başarısız:", err);
      alert("Kullanıcı silme işlemi başarısız oldu.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    setResetPasswordUserId(userId);
    setNewPassword("");
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetPasswordUserId || !newPassword.trim()) return;

    try {
      setActionInProgress(resetPasswordUserId);
      await resetUserPassword(resetPasswordUserId, newPassword);
      setIsResetPasswordModalOpen(false);
      alert("Şifre başarıyla sıfırlandı.");
    } catch (err) {
      console.error("Şifre sıfırlama işlemi başarısız:", err);
      alert("Şifre sıfırlama işlemi başarısız oldu.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCreateUser = async () => {
    if (
      !newUser.username.trim() ||
      !newUser.email.trim() ||
      !newUser.password.trim()
    ) {
      alert("Kullanıcı adı, e-posta ve şifre gereklidir.");
      return;
    }

    try {
      setActionInProgress("createUser");
      const createdUser = await createUser(newUser);
      setUsers([createdUser, ...users]);
      setIsCreateUserModalOpen(false);
      setNewUser({
        username: "",
        email: "",
        name: "",
        password: "",
        isAdmin: false,
      });
    } catch (err) {
      console.error("Kullanıcı oluşturma işlemi başarısız:", err);
      alert("Kullanıcı oluşturma işlemi başarısız oldu.");
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
              <div
                key={i}
                className="h-12 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
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
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Kullanıcı Listesi
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Toplam {users.length} kullanıcı bulunuyor.
              </p>
            </div>
            <button
              onClick={() => setIsCreateUserModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              disabled={actionInProgress === "createUser"}
            >
              {actionInProgress === "createUser"
                ? "İşleniyor..."
                : "Yeni Kullanıcı Ekle"}
            </button>
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
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-300 font-medium">
                              {user.name
                                ? user.name.charAt(0).toUpperCase()
                                : user.username.charAt(0).toUpperCase()}
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
                        <div className="text-sm text-gray-900 dark:text-white">
                          {user.email}
                        </div>
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
                              disabled={
                                actionInProgress === user.id ||
                                user.id === currentUser?.id
                              }
                              className={`text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 ${
                                actionInProgress === user.id ||
                                user.id === currentUser?.id
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              Admin Yetkisini Kaldır
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMakeAdmin(user.id)}
                              disabled={actionInProgress === user.id}
                              className={`text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 ${
                                actionInProgress === user.id
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              Admin Yap
                            </button>
                          )}
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            disabled={actionInProgress === user.id}
                            className={`text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 ${
                              actionInProgress === user.id
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            Şifre Sıfırla
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={
                              actionInProgress === user.id ||
                              user.id === currentUser?.id
                            }
                            className={`text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ${
                              actionInProgress === user.id ||
                              user.id === currentUser?.id
                                ? "opacity-50 cursor-not-allowed"
                                : ""
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

      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Yeni Kullanıcı Ekle
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kullanıcı Adı*
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="kullanici_adi"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  E-posta*
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="ornek@eposta.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="Ad Soyad"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Şifre*
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="********"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={newUser.isAdmin}
                  onChange={(e) =>
                    setNewUser({ ...newUser, isAdmin: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-700 focus:ring-blue-500"
                />
                <label
                  htmlFor="isAdmin"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Admin yetkisi ver
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={() => setIsCreateUserModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                İptal
              </button>
              <button
                onClick={handleCreateUser}
                disabled={actionInProgress === "createUser"}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
                  actionInProgress === "createUser"
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {actionInProgress === "createUser"
                  ? "Oluşturuluyor..."
                  : "Kullanıcı Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Şifre Sıfırlama
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Kullanıcı için yeni bir şifre belirleyin.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Yeni Şifre
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-white"
                placeholder="********"
              />
            </div>
            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                İptal
              </button>
              <button
                onClick={handleResetPasswordSubmit}
                disabled={
                  !newPassword.trim() ||
                  actionInProgress === resetPasswordUserId
                }
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
                  !newPassword.trim() ||
                  actionInProgress === resetPasswordUserId
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {actionInProgress === resetPasswordUserId
                  ? "Sıfırlanıyor..."
                  : "Şifreyi Sıfırla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
