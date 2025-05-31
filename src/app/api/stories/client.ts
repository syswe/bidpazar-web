import { Story } from "@/lib/api";
import { apiFetcher } from "../utils/client";
import { getAuthToken } from "../utils/client";

// Stories client-side API functions
export const getStories = async (): Promise<Story[]> => {
  const data = await apiFetcher<{ success: boolean; stories: Story[] }>('/stories');
  return data.stories;
};

export const uploadStoryImage = async (file: File): Promise<string> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/stories/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || 'Failed to upload image');
  }

  const data = await response.json();
  return data.mediaUrl;
};

export const createStory = async (data: {
  content: string;
  type?: "TEXT" | "IMAGE" | "VIDEO";
  mediaUrl?: string;
}): Promise<Story> => {
  const response = await apiFetcher<{ success: boolean; story: Story }>('/stories', {
    method: 'POST',
    body: JSON.stringify({
      content: data.content,
      type: data.type || "TEXT",
      mediaUrl: data.mediaUrl || null,
    }),
  });
  return response.story;
};

export const deleteStory = async (storyId: string): Promise<void> => {
  await apiFetcher(`/stories/${storyId}`, {
    method: 'DELETE',
  });
};

export const viewStory = async (storyId: string): Promise<void> => {
  await apiFetcher(`/stories/${storyId}/view`, {
    method: 'POST',
  });
}; 