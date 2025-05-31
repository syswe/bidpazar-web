import { LiveStream } from "@/lib/api";
import { apiFetcher } from "../utils/client";

// Live Streams client-side API functions
export const getLiveStreams = async (): Promise<LiveStream[]> => {
  return await apiFetcher<LiveStream[]>('/live-streams');
};

export const getLiveStreamsForHomepage = async (): Promise<{
  streams: LiveStream[];
  meta: {
    totalLiveStreams: number;
    hasActiveStreams: boolean;
  };
}> => {
  return await apiFetcher<{
    streams: LiveStream[];
    meta: {
      totalLiveStreams: number;
      hasActiveStreams: boolean;
    };
  }>('/live-streams?onlyActive=true');
};

export const getLiveStreamById = async (id: string): Promise<LiveStream> => {
  return await apiFetcher<LiveStream>(`/live-streams/${id}`);
};

export const createLiveStream = async (data: {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  startTime?: string;
}): Promise<LiveStream> => {
  return await apiFetcher<LiveStream>('/live-streams', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateLiveStream = async (
  id: string,
  data: {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    status?: "SCHEDULED" | "LIVE" | "ENDED";
  }
): Promise<LiveStream> => {
  return await apiFetcher<LiveStream>(`/live-streams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteLiveStream = async (id: string): Promise<void> => {
  await apiFetcher(`/live-streams/${id}`, {
    method: 'DELETE',
  });
}; 