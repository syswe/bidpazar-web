import React from 'react';
import { Button } from '@/components/ui/button';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';

interface StreamControlsProps {
  streamId: string;
  streamStatus: 'SCHEDULED' | 'LIVE' | 'ENDED';
}

const StreamControls = ({ streamId, streamStatus }: StreamControlsProps) => {
  const { token } = useAuth();

  const handleStartStream = async () => {
    try {
      console.log("Starting stream:", {
        streamId,
        endpoint: `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/start`,
        hasToken: !!token
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/start`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log("Stream start response:", response.data);
      toast.success('Stream started successfully');
      // Reload the page to refresh the stream status
      window.location.reload();
    } catch (error: unknown) {
      console.error('Error starting stream:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to start stream';
      toast.error(errorMessage);
    }
  };

  const handleEndStream = async () => {
    try {
      console.log("Ending stream:", {
        streamId,
        endpoint: `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/end`,
        hasToken: !!token
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/end`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log("Stream end response:", response.data);
      toast.success('Stream ended successfully');
      // Reload the page to refresh the stream status
      window.location.reload();
    } catch (error: unknown) {
      console.error('Error ending stream:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to end stream';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-2">
      {streamStatus === 'SCHEDULED' && (
        <Button
          onClick={handleStartStream}
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Start Stream
        </Button>
      )}

      {streamStatus === 'LIVE' && (
        <Button
          onClick={handleEndStream}
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          End Stream
        </Button>
      )}
    </div>
  );
};

export default StreamControls; 