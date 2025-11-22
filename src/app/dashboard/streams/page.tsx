"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getUserLiveStreams,
  LiveStream,
  startLiveStream,
  endLiveStream,
  deleteLiveStream,
  updateLiveStream
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { getToken } from "@/lib/frontend-auth";
import {
  Play,
  Calendar,
  Users,
  Settings,
  Edit,
  Trash2,
  Plus,
  Video,
  AlertCircle,
  X,
  Loader2,
  StopCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-600";
  let label = status;
  let dotColor = "bg-gray-400";

  if (status === "LIVE") {
    bgColor = "bg-red-100";
    textColor = "text-red-600";
    label = "CANLI";
    dotColor = "bg-red-600";
  } else if (status === "SCHEDULED") {
    bgColor = "bg-blue-100";
    textColor = "text-blue-600";
    label = "PLANLANDI";
    dotColor = "bg-blue-600";
  } else if (status === "ENDED") {
    bgColor = "bg-gray-100";
    textColor = "text-gray-600";
    label = "SONA ERDİ";
    dotColor = "bg-gray-500";
  }

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} border border-opacity-20 border-current`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${status === 'LIVE' ? 'animate-pulse' : ''}`}></span>
      {label}
    </span>
  );
};

// Simple Modal Component
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
        {footer && (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--secondary)]/20 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default function MyStreamsPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<LiveStream | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    startTime: "",
  });

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingStreamId, setDeletingStreamId] = useState<string | null>(null);

  // Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch user's streams
  const fetchStreams = async () => {
    try {
      setLoading(true);
      const userStreams = await getUserLiveStreams();
      setStreams(userStreams);
      setError(null);
    } catch (err) {
      console.error("Error fetching streams:", err);
      setError("Yayınlarınız yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, []);



  // End stream handler
  const handleEndStream = async (streamId: string) => {
    if (!confirm("Yayını sonlandırmak istediğinize emin misiniz?")) return;

    try {
      setActionLoading(streamId);
      const token = getToken();
      if (!token) throw new Error("Oturum açmanız gerekiyor");

      await endLiveStream(streamId, token);
      await fetchStreams();
    } catch (err) {
      console.error("Error ending stream:", err);
      setError("Yayın sonlandırılamadı.");
    } finally {
      setActionLoading(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (stream: LiveStream) => {
    setEditingStream(stream);
    setEditForm({
      title: stream.title,
      description: stream.description || "",
      startTime: stream.startTime ? new Date(stream.startTime).toISOString().slice(0, 16) : "",
    });
    setIsEditModalOpen(true);
    setOpenDropdownId(null);
  };

  // Handle Edit Submit
  const handleEditSubmit = async () => {
    if (!editingStream) return;

    try {
      setActionLoading("edit");
      // updateLiveStream does not take token as 3rd argument in the definition provided
      await updateLiveStream(editingStream.id, {
        title: editForm.title,
        description: editForm.description,
        startTime: editForm.startTime ? new Date(editForm.startTime).toISOString() : undefined,
      });

      setIsEditModalOpen(false);
      setEditingStream(null);
      await fetchStreams();
    } catch (err) {
      console.error("Error updating stream:", err);
      setError("Yayın güncellenemedi.");
    } finally {
      setActionLoading(null);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (streamId: string) => {
    setDeletingStreamId(streamId);
    setIsDeleteModalOpen(true);
    setOpenDropdownId(null);
  };

  // Handle Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!deletingStreamId) return;

    try {
      setActionLoading("delete");
      // deleteLiveStream does not take token as 2nd argument in the definition provided
      await deleteLiveStream(deletingStreamId);
      setIsDeleteModalOpen(false);
      setDeletingStreamId(null);
      await fetchStreams();
    } catch (err) {
      console.error("Error deleting stream:", err);
      setError("Yayın silinemedi.");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleDropdown = (e: React.MouseEvent, streamId: string) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === streamId ? null : streamId);
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="bg-[var(--card)] border-b border-[var(--border)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Yayınlarım</h1>
              <p className="text-[var(--muted-foreground)] text-sm mt-1">
                Canlı yayınlarınızı buradan yönetebilirsiniz
              </p>
            </div>
            <Link href="/live-streams/create">
              <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Yeni Yayın Oluştur
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mb-4" />
            <p className="text-[var(--muted-foreground)]">Yayınlarınız yükleniyor...</p>
          </div>
        ) : streams.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-[var(--secondary)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Henüz Yayın Yok</h2>
            <p className="text-[var(--muted-foreground)] mb-6 max-w-md mx-auto">
              Henüz bir canlı yayın oluşturmadınız. İzleyicilerinizle buluşmak için hemen ilk yayınınızı planlayın!
            </p>
            <Link href="/live-streams/create">
              <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white">
                İlk Yayınını Oluştur
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {streams.map((stream) => (
              <div
                key={stream.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Thumbnail Section */}
                  <div className="w-full md:w-72 aspect-video md:aspect-[4/3] relative bg-gray-100 shrink-0">
                    {stream.thumbnailUrl ? (
                      <img
                        src={stream.thumbnailUrl}
                        alt={stream.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--secondary)] text-[var(--muted-foreground)]">
                        <Video className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs font-medium">Görsel Yok</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <StatusBadge status={stream.status} />
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4 relative">
                      <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2 line-clamp-1">
                          {stream.title}
                        </h2>
                        <p className="text-[var(--muted-foreground)] text-sm line-clamp-2 mb-4">
                          {stream.description || "Açıklama yok"}
                        </p>
                      </div>

                      <div className="relative" ref={openDropdownId === stream.id ? dropdownRef : null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => toggleDropdown(e, stream.id)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>

                        {openDropdownId === stream.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--background)] border border-[var(--border)] rounded-md shadow-lg z-10 py-1 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              onClick={() => openEditModal(stream)}
                              className="w-full text-left px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--secondary)] flex items-center"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Düzenle
                            </button>
                            <button
                              onClick={() => openDeleteModal(stream.id)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Sil
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {stream.startTime ? formatDateTime(stream.startTime) : "Belirlenmedi"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                        <Users className="w-4 h-4" />
                        <span>{stream._count?.viewers || 0} İzleyici</span>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-3 pt-4 border-t border-[var(--border)]">
                      {stream.status === "SCHEDULED" && (
                        <>
                          <Link href={`/live-streams/${stream.id}`}>
                            <Button
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Video className="w-4 h-4 mr-2" />
                              Yayına Git
                            </Button>
                          </Link>
                        </>
                      )}

                      {stream.status === "LIVE" && (
                        <>
                          <Link href={`/live-streams/${stream.id}`}>
                            <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                              <Video className="w-4 h-4 mr-2" />
                              Yayına Git
                            </Button>
                          </Link>
                          <Button
                            onClick={() => handleEndStream(stream.id)}
                            disabled={!!actionLoading}
                            variant="destructive"
                          >
                            {actionLoading === stream.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <StopCircle className="w-4 h-4 mr-2" />
                            )}
                            Yayını Bitir
                          </Button>
                        </>
                      )}

                      {stream.status === "ENDED" && (
                        <Button variant="secondary" disabled>
                          Yayın Sona Erdi
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Yayını Düzenle"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>İptal</Button>
            <Button onClick={handleEditSubmit} disabled={actionLoading === "edit"}>
              {actionLoading === "edit" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-[var(--foreground)]">Başlık</label>
            <Input
              id="title"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-[var(--foreground)]">Açıklama</label>
            <Textarea
              id="description"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="startTime" className="text-sm font-medium text-[var(--foreground)]">Başlangıç Zamanı</label>
            <Input
              id="startTime"
              type="datetime-local"
              value={editForm.startTime}
              onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Yayını Sil"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>İptal</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={actionLoading === "delete"}
            >
              {actionLoading === "delete" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sil
            </Button>
          </>
        }
      >
        <p className="text-[var(--muted-foreground)]">
          Bu yayını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
        </p>
      </Modal>
    </div>
  );
}
