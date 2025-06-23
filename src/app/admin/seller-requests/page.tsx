"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";

interface SellerRequest {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  productCategories: string;
  notes?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  user: {
    id: string;
    username: string;
    email: string;
    name?: string;
  };
}

export default function SellerRequestsPage() {
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({});

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("auth")
        ? JSON.parse(localStorage.getItem("auth")!).token
        : null;

      const response = await fetch("/api/seller-requests", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      } else {
        console.error("Failed to fetch seller requests");
      }
    } catch (error) {
      console.error("Error fetching seller requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (id: string, status: "APPROVED" | "REJECTED") => {
    setProcessing(id);
    try {
      const token = localStorage.getItem("auth")
        ? JSON.parse(localStorage.getItem("auth")!).token
        : null;

      const response = await fetch(`/api/seller-requests/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          reviewNotes: reviewNotes[id] || "",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchRequests(); // Refresh the list
        setReviewNotes((prev) => ({ ...prev, [id]: "" })); // Clear notes
      } else {
        const error = await response.json();
        alert(error.error || "Failed to process request");
      }
    } catch (error) {
      console.error("Error processing request:", error);
      alert("Error processing request");
    } finally {
      setProcessing(null);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100",
      APPROVED:
        "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
      REJECTED: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100",
    };

    const labels = {
      PENDING: "Beklemede",
      APPROVED: "Onaylandı",
      REJECTED: "Reddedildi",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[status as keyof typeof styles]
        }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <AdminLayout title="Satıcı Başvuruları">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Satıcı Başvuruları">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Toplam Başvuru
            </h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {requests.length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Bekleyen
            </h3>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {requests.filter((r) => r.status === "PENDING").length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Onaylanan
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {requests.filter((r) => r.status === "APPROVED").length}
            </p>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Satıcı Başvuruları
            </h3>
          </div>

          {requests.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Henüz satıcı başvurusu bulunmamaktadır.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Başvuran
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İletişim
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Kategoriler
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {request.fullName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            @{request.user?.username || "Bilinmiyor"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {request.email}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {request.phoneNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white max-w-xs">
                          {request.productCategories}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(request.createdAt).toLocaleDateString(
                          "tr-TR"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {request.status === "PENDING" ? (
                          <div className="space-y-2">
                            <textarea
                              placeholder="Değerlendirme notu (isteğe bağlı)"
                              value={reviewNotes[request.id] || ""}
                              onChange={(e) =>
                                setReviewNotes((prev) => ({
                                  ...prev,
                                  [request.id]: e.target.value,
                                }))
                              }
                              className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleRequest(request.id, "APPROVED")
                                }
                                disabled={processing === request.id}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
                              >
                                {processing === request.id
                                  ? "İşleniyor..."
                                  : "Onayla"}
                              </button>
                              <button
                                onClick={() =>
                                  handleRequest(request.id, "REJECTED")
                                }
                                disabled={processing === request.id}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
                              >
                                {processing === request.id
                                  ? "İşleniyor..."
                                  : "Reddet"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {request.reviewedAt && (
                              <div>
                                {new Date(
                                  request.reviewedAt
                                ).toLocaleDateString("tr-TR")}{" "}
                                tarihinde değerlendirildi
                                {request.reviewNotes && (
                                  <div className="mt-1 text-xs">
                                    Not: {request.reviewNotes}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes Section */}
        {requests.some((r) => r.notes) && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Başvuru Notları
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {requests
                .filter((r) => r.notes)
                .map((request) => (
                  <div
                    key={request.id}
                    className="border-l-4 border-blue-500 pl-4"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {request.fullName} (@
                      {request.user?.username || "Bilinmiyor"})
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {request.notes}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
