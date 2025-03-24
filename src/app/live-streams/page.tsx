'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../components/AuthProvider";

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
  const { token } = useAuth();
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-streams`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
          throw new Error("Failed to fetch live streams");
        }

        const data = await response.json();
        setLiveStreams(data);
      } catch (error) {
        console.error("Error fetching live streams:", error);
        toast.error("Failed to load live streams");
      } finally {
        setLoading(false);
      }
    };

    fetchLiveStreams();
  }, [token]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBA";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Live Streams</h1>
        <Link
          href="/live-streams/create"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md"
        >
          <PlusCircle className="w-4 h-4" />
          Create Stream
        </Link>
      </div>

      {liveStreams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveStreams.map((stream) => (
            <Link
              key={stream.id}
              href={`/live-streams/${stream.id}`}
              className="border rounded-lg overflow-hidden group hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-muted relative">
                {stream.thumbnailUrl ? (
                  <img
                    src={stream.thumbnailUrl}
                    alt={stream.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent/10">
                    <span className="text-muted-foreground">No thumbnail</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-medium bg-background/80">
                  {stream.status === "LIVE" ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                      LIVE
                    </span>
                  ) : (
                    stream.status
                  )}
                </div>
              </div>
              <div className="p-4">
                <h2 className="font-semibold truncate group-hover:text-primary transition-colors">
                  {stream.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-2">
                  {stream.user?.name || stream.user?.username}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {stream.status === "SCHEDULED" ? `Starts: ${formatDate(stream.startTime)}` : (
                      stream.status === "LIVE" ? "Currently Live" : "Ended"
                    )}
                  </span>
                  <span>
                    {stream._count?.viewers ?? 0} {(stream._count?.viewers ?? 0) === 1 ? "viewer" : "viewers"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No live streams available at the moment.</p>
          <p className="mt-2">
            <Link href="/live-streams/create" className="text-primary hover:underline">
              Create your own stream
            </Link>
          </p>
        </div>
      )}
    </div>
  );
} 