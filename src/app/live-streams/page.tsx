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
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
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

  useEffect(() => {
    if (liveStreams.length === 0) return;

    const fetchViewerCounts = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
        const counts: Record<string, number> = {};

        await Promise.all(
          liveStreams.map(async (stream) => {
            try {
              const response = await fetch(
                `${apiUrl}/live-streams/${stream.id}/viewers`,
                {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                }
              );

              if (response.ok) {
                const data = await response.json();
                counts[stream.id] = data.count;
              }
            } catch (error) {
              console.error(
                `Error fetching viewer count for stream ${stream.id}:`,
                error
              );
            }
          })
        );

        setViewerCounts(counts);
      } catch (error) {
        console.error("Error fetching viewer counts:", error);
      }
    };

    fetchViewerCounts();

    const intervalId = setInterval(fetchViewerCounts, 10000);

    return () => clearInterval(intervalId);
  }, [liveStreams, token]);

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

      <div className="container mx-auto max-w-7xl px-6 py-10">
        {liveStreams.length > 0 ? (
          <>
            {/* Live Streams Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-8">
                <span className="border-b-3 border-[var(--accent)] pb-1">
                  Aktif ve Planlanan Yayınlar
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {liveStreams.map((stream, index) => (
                  <Link
                    key={stream.id}
                    href={`/live-streams/${stream.id}`}
                    className="bg-[var(--background)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl overflow-hidden group hover:shadow-xl transition-all"
                  >
                    <div className="aspect-video bg-[var(--secondary)] relative">
                      {stream.thumbnailUrl ? (
                        <Image
                          src={stream.thumbnailUrl}
                          alt={stream.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          priority={index < 3}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent)]/5 to-[#071739]/10">
                          <span className="text-[var(--accent)]">
                            Görsel Yok
                          </span>
                        </div>
                      )}
                      <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md bg-[var(--background)]/80 shadow-md">
                        {stream.status === "LIVE" ? (
                          <span className="flex items-center gap-2 text-red-500">
                            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                            CANLI
                          </span>
                        ) : (
                          <span className="text-[var(--accent)]">
                            PLANLANMIŞ
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold text-lg text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
                        {stream.title}
                      </h3>
                      <p className="text-sm text-[var(--foreground)]/70 mb-3 flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        {stream.user?.name || stream.user?.username}
                      </p>
                      <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
                        <span className="text-xs text-[var(--foreground)]/60 flex items-center gap-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {stream.status === "SCHEDULED"
                            ? `${formatDate(stream.startTime)}`
                            : stream.status === "LIVE"
                            ? "Şu an Canlı"
                            : "Sona Erdi"}
                        </span>
                        <span className="text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full">
                          {viewerCounts[stream.id] !== undefined
                            ? viewerCounts[stream.id]
                            : stream._count?.viewers ?? 0}{" "}
                          izleyici
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
