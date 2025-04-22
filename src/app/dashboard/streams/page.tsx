"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserLiveStreams, LiveStream, startLiveStream, endLiveStream } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { env } from "@/lib/env"; // Import env config

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = "bg-gray-200";
  let textColor = "text-gray-800";

  if (status === "LIVE") {
    bgColor = "bg-red-500";
    textColor = "text-white";
  } else if (status === "SCHEDULED") {
    bgColor = "bg-blue-500";
    textColor = "text-white";
  } else if (status === "ENDED") {
    bgColor = "bg-gray-500";
    textColor = "text-white";
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor}`}>
      {status}
    </span>
  );
};

export default function MyStreamsPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch user's streams
  const fetchStreams = async () => {
    try {
      setLoading(true);
      // First try with our helper function
      try {
        const userStreams = await getUserLiveStreams();
        setStreams(userStreams);
        setError(null);
        return;
      } catch (error) {
        console.warn("First attempt to fetch streams failed, trying alternative method", error);
      }

      // Fallback method using direct fetch
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`${env.BACKEND_API_URL}/live-streams/user/streams`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch streams: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setStreams(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching streams:", err);
      setError("Failed to load your streams. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  // Start stream handler
  const handleStartStream = async (streamId: string) => {
    try {
      await startLiveStream(streamId, localStorage.getItem("token") || "");
      // Redirect to the stream page
      router.push(`/live-streams/${streamId}`);
    } catch (err) {
      console.error("Error starting stream:", err);
      setError("Failed to start stream. Please try again.");
    }
  };

  // End stream handler
  const handleEndStream = async (streamId: string) => {
    try {
      if (confirm("Are you sure you want to end this stream?")) {
        // Get token using the helper function instead of directly from localStorage
        const token = getToken();
        if (!token) {
          throw new Error("Authentication required to end a stream");
        }

        await endLiveStream(streamId, token);
        // Refresh the streams list
        fetchStreams();
      }
    } catch (err) {
      console.error("Error ending stream:", err);
      setError("Failed to end stream. Please try again.");
    }
  };

  // Delete stream handler - Removing this function as per requirements
  // Users should only be able to END streams, not delete them

  // Manage stream handler - redirects to the stream detail/management page
  const handleManageStream = (streamId: string) => {
    router.push(`/dashboard/streams/${streamId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Streams</h1>
        <Link
          href="/dashboard/streams/create"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Create New Stream
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Loading your streams...</p>
        </div>
      ) : streams.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">No Streams Found</h2>
          <p className="text-gray-600 mb-4">
            You haven&apos;t created any livestreams yet. Start by creating your first stream!
          </p>
          <Link
            href="/dashboard/streams/create"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Create Your First Stream
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {streams.map((stream) => (
            <div key={stream.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="flex flex-col md:flex-row">
                {/* Thumbnail */}
                <div className="w-full md:w-1/4 aspect-video md:aspect-square overflow-hidden bg-gray-100">
                  {stream.thumbnailUrl ? (
                    <img
                      src={stream.thumbnailUrl}
                      alt={stream.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <span className="text-gray-400">No thumbnail</span>
                    </div>
                  )}
                </div>

                {/* Stream details */}
                <div className="p-4 md:p-6 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-semibold">{stream.title}</h2>
                    <StatusBadge status={stream.status} />
                  </div>

                  <p className="text-gray-600 mb-4 line-clamp-2">{stream.description || "No description"}</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Scheduled Start:</p>
                      <p className="font-medium">{stream.startTime ? formatDateTime(stream.startTime) : "Not set"}</p>
                    </div>
                    {stream.endTime && (
                      <div>
                        <p className="text-sm text-gray-500">End Time:</p>
                        <p className="font-medium">{formatDateTime(stream.endTime)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="flex gap-2 text-sm text-gray-600">
                      <span>{stream._count?.listings || 0} Products</span>
                      <span>•</span>
                      <span>{stream._count?.viewers || 0} Viewers</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {stream.status === "SCHEDULED" && (
                      <>
                        <button
                          onClick={() => handleStartStream(stream.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Go Live
                        </button>
                        <button
                          onClick={() => handleManageStream(stream.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => handleEndStream(stream.id)}
                          className="px-3 py-1.5 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
                        >
                          End Stream
                        </button>
                      </>
                    )}

                    {stream.status === "LIVE" && (
                      <>
                        <button
                          onClick={() => router.push(`/live-streams/${stream.id}`)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          View Stream
                        </button>
                        <button
                          onClick={() => handleManageStream(stream.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Manage Products
                        </button>
                        <button
                          onClick={() => handleEndStream(stream.id)}
                          className="px-3 py-1.5 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
                        >
                          End Stream
                        </button>
                      </>
                    )}

                    {stream.status === "ENDED" && (
                      <>
                        <button
                          onClick={() => handleManageStream(stream.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleManageStream(stream.id)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                        >
                          View History
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 