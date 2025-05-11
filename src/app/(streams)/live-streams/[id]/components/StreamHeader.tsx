import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LiveStreamDetails } from '../hooks/useStreamDetails';

interface StreamHeaderProps {
  streamDetails: LiveStreamDetails | null;
  onBackClick: () => void;
}

const StreamHeader = ({ streamDetails, onBackClick }: StreamHeaderProps) => {
  if (!streamDetails) return null;
  
  return (
    <div className="stream-header">
      <div className="stream-info-wrapper">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white">
            {streamDetails?.user?.username?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="stream-info">
            <span className="text-white font-medium">
              {streamDetails?.user?.username || "Unknown User"}
            </span>
            <span className="text-white/80 text-sm">
              {streamDetails?.title}
            </span>
          </div>
        </div>
      </div>
      <button onClick={onBackClick} className="back-button">
        <ArrowLeft className="h-5 w-5" />
      </button>
    </div>
  );
};

export default StreamHeader; 