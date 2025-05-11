import { createContext, useContext, ReactNode } from 'react';
import { useStreamDetails } from '@/hooks/useStreamDetails';

// Import LiveStream type if available from a central types file, otherwise declare it here
interface LiveStream {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  status: string;
  startTime?: string;
  endTime?: string;
  creatorId: string;
  viewerCount: number;
  [key: string]: any; // For any additional fields
}

interface StreamDetailsContextValue {
  streamDetails: LiveStream | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  isCurrentUserStreamer: boolean;
}

const StreamDetailsContext = createContext<StreamDetailsContextValue | null>(null);

export interface StreamDetailsProviderProps {
  children: ReactNode;
  streamId: string;
  userId?: string;
  token?: string;
}

/**
 * Provider component that makes stream details available to any nested components
 */
export function StreamDetailsProvider({ 
  children, 
  streamId, 
  userId, 
  token 
}: StreamDetailsProviderProps) {
  const { streamDetails, isLoading, error, reload } = useStreamDetails(streamId, token);
  
  // Calculate if current user is the streamer with proper loading handling
  const isCurrentUserStreamer = !isLoading && !error && 
    userId !== undefined && userId === streamDetails?.creatorId;
  
  return (
    <StreamDetailsContext.Provider value={{
      streamDetails,
      isLoading,
      error,
      reload,
      isCurrentUserStreamer
    }}>
      {children}
    </StreamDetailsContext.Provider>
  );
}

/**
 * Hook to use the stream details context
 */
export function useStreamDetailsContext(): StreamDetailsContextValue {
  const context = useContext(StreamDetailsContext);
  
  if (!context) {
    throw new Error('useStreamDetailsContext must be used within a StreamDetailsProvider');
  }
  
  return context;
} 