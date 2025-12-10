"use client";

import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

import { getToken } from "@/lib/frontend-auth";

interface LiveStreamUser {
  id: string;
  username: string;
  name: string | null;
}

interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  startTime: string | null;
  endTime: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: LiveStreamUser;
  _count?: {
    listings: number;
    viewers: number;
  };
}

export default function LiveStreamsPage() {
  const { user } = useAuth();
  const token = getToken();
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const isSeller = user?.userType === "SELLER";

  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
        console.log("Fetching live streams from:", `${apiUrl}/live-streams`);

        const response = await fetch(`${apiUrl}/live-streams`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          next: { revalidate: 60 },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", response.status, errorText);
          throw new Error(
            `Failed to fetch live streams: ${response.status} ${errorText}`
          );
        }

        const data = await response.json();
        console.log("Received live streams data:", data);

        // Map API status values to UI status values
        const mappedStreams = data.map((stream: any) => ({
          ...stream,
          status:
            stream.status === "LIVE" || stream.status === "active"
              ? "LIVE"
              : stream.status === "SCHEDULED" || stream.status === "scheduled"
                ? "SCHEDULED"
                : "ENDED",
        }));

        // Filter non-ended streams
        const activeStreams = mappedStreams.filter(
          (stream: LiveStream) => stream.status !== "ENDED"
        );

        console.log("Filtered active streams:", activeStreams);
        setLiveStreams(activeStreams);
      } catch (error) {
        console.error("Error fetching live streams:", error);
        toast.error(
          "Failed to load live streams. Please check browser console for details."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLiveStreams();
  }, [token]);

  // Viewer counts are managed via Socket.IO on the stream page itself
  // The listing page now shows 0 viewers initially, which updates when users join streams

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBA";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex flex-col items-center p-8 rounded-xl">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--accent)]" />
          <p className="mt-4 text-[var(--foreground)] text-lg font-medium">
            Yayınlar yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-10 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Canlı Yayınlar
              </h1>
              <p className="text-white/80">
                Koleksiyonerlerle buluşun, canlı müzayedelere katılın veya kendi
                yayınınızı başlatın
              </p>
            </div>
            {isSeller && (
              <Link
                href="/live-streams/create"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-all shadow-lg border border-white/20 group"
              >
                <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Yeni Yayın Başlat</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-10">
        {liveStreams.length > 0 ? (
          <>
            {/* Live Streams Section */}
            <div className="mb-12">
              <h2 className="text-xl md:text-2xl font-semibold text-[var(--foreground)] mb-4 md:mb-6">
                <span className="border-b-3 border-[var(--accent)] pb-1">
                  Aktif ve Planlanan Yayınlar
                </span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {liveStreams.map((stream, index) => (
                  <Link
                    key={stream.id}
                    href={`/live-streams/${stream.id}`}
                    className="live-stream-card group block rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-lg hover:border-[var(--accent)] transition-all duration-300"
                  >
                    {/* Yayın Görseli */}
                    <div className="relative h-32 sm:h-40 md:h-48 w-full bg-[var(--secondary)] overflow-hidden">
                      {stream.thumbnailUrl ? (
                        <Image
                          src={stream.thumbnailUrl}
                          alt={stream.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          unoptimized={true}
                          priority={index < 4}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent)]/10 to-[#071739]/20">
                          <span className="text-[var(--accent)] text-xs sm:text-sm opacity-70">
                            Görsel Yok
                          </span>
                        </div>
                      )}

                      {/* Status Badge - Sol üst */}
                      <div className="absolute top-2 left-2">
                        {stream.status === "LIVE" ? (
                          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold shadow-lg">
                            <span className="flex h-1.5 w-1.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                            </span>
                            <span className="hidden sm:inline">CANLI</span>
                            <span className="sm:hidden">●</span>
                          </div>
                        ) : (
                          <div className="px-2 sm:px-2.5 py-1 rounded-md bg-[var(--background)]/90 backdrop-blur-sm border border-[var(--border)] text-[var(--accent)] text-xs font-medium">
                            Planlı
                          </div>
                        )}
                      </div>

                      {/* İzleyici Sayısı - Sağ üst */}
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="font-medium">
                            {stream._count?.viewers ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Yayın Bilgileri */}
                    <div className="p-3 sm:p-4">
                      {/* Başlık */}
                      <h3 className="text-sm sm:text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors duration-300 line-clamp-2 mb-2 min-h-[2.5rem] sm:min-h-[3rem]">
                        {stream.title}
                      </h3>

                      {/* Yayıncı ve Tarih */}
                      <div className="flex items-center justify-between text-xs text-[var(--foreground)] opacity-70 mb-3 pb-3 border-b border-[var(--border)]">
                        <div className="flex items-center gap-1 min-w-0 flex-1 mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="truncate">
                            {stream.user?.name || stream.user?.username || 'Anonim'}
                          </span>
                        </div>
                      </div>

                      {/* Durum ve Bilgi */}
                      <div className="flex flex-col items-center justify-center py-2 px-2 bg-[var(--secondary)] rounded-lg border border-[var(--border)] group-hover:border-[var(--accent)] transition-colors">
                        <span className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1">
                          {stream.status === "LIVE" ? "Şu an Canlı" : "Başlangıç"}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[var(--accent)] text-center">
                          {stream.status === "SCHEDULED"
                            ? formatDate(stream.startTime)
                            : stream.status === "LIVE"
                              ? "Yayında"
                              : "Sona Erdi"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-10 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              Şu anda aktif yayın bulunmuyor
            </h3>
            <p className="text-[var(--foreground)]/70 mb-6">
              Şu anda aktif veya planlanmış bir yayın bulunmuyor. İlk yayını
              başlatan siz olun!
            </p>
            <Link
              href="/live-streams/create"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Yayın Başlat</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
