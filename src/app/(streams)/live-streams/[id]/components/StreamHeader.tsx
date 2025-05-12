import React from 'react';
import { ArrowLeft, Play, Clock, Radio, X } from 'lucide-react';
import { LiveStreamDetails } from '../hooks/useStreamDetails';

interface StreamHeaderProps {
  streamDetails: LiveStreamDetails;
  onBackClick: () => void;
  isStreamer?: boolean;
  onStatusChange?: (newStatus: "SCHEDULED" | "STARTING" | "LIVE" | "ENDED") => Promise<void>;
  isUpdatingStatus?: boolean;
}

const StreamHeader: React.FC<StreamHeaderProps> = ({ 
  streamDetails, 
  onBackClick,
  isStreamer = false,
  onStatusChange,
  isUpdatingStatus = false
}) => {
  // Format the status for display
  const getStatusBadge = () => {
    switch (streamDetails.status) {
      case 'LIVE':
        return (
          <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            CANLI
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
            PLANLANMIŞ
          </span>
        );
      case 'STARTING':
        return (
          <span className="flex items-center gap-1.5 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            BAŞLIYOR
          </span>
        );
      case 'ENDED':
        return (
          <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">
            SONA ERDİ
          </span>
        );
      default:
        return null;
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  return (
    <div className="p-4 flex items-center">
      <button 
        onClick={onBackClick}
        className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white mr-3 hover:bg-black/50 transition-colors"
      >
        <ArrowLeft size={18} />
      </button>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h1 className="text-white font-medium text-lg line-clamp-1">
            {streamDetails.title}
          </h1>
          {getStatusBadge()}
        </div>
        
        <div className="flex items-center text-white/70 text-xs mt-0.5">
          <span>{streamDetails.user?.name || streamDetails.user?.username}</span>
          <span className="mx-1.5">•</span>
          <span>
            {streamDetails.status === 'SCHEDULED' 
              ? `Başlangıç: ${formatDate(streamDetails.startTime)}` 
              : streamDetails.status === 'LIVE'
                ? 'Canlı Yayında'
                : streamDetails.status === 'ENDED'
                  ? `Sona Erdi: ${formatDate(streamDetails.endTime)}`
                  : 'Başlıyor...'}
          </span>
        </div>
      </div>

      {/* Status management buttons for streamers */}
      {isStreamer && onStatusChange && (
        <div className="flex items-center gap-2">
          {isUpdatingStatus ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              {streamDetails.status === 'SCHEDULED' && (
                <button
                  onClick={() => onStatusChange('STARTING')}
                  className="p-1.5 rounded bg-yellow-500 text-white text-xs flex items-center"
                  title="Start stream"
                >
                  <Clock className="w-3 h-3 mr-1" /> Başla
                </button>
              )}
              
              {streamDetails.status === 'STARTING' && (
                <button
                  onClick={() => onStatusChange('LIVE')}
                  className="p-1.5 rounded bg-red-500 text-white text-xs flex items-center"
                  title="Go live"
                >
                  <Radio className="w-3 h-3 mr-1" /> Canlı Yayın
                </button>
              )}
              
              {streamDetails.status === 'LIVE' && (
                <button
                  onClick={() => onStatusChange('ENDED')}
                  className="p-1.5 rounded bg-gray-500 text-white text-xs flex items-center"
                  title="End stream"
                >
                  <X className="w-3 h-3 mr-1" /> Bitir
                </button>
              )}
              
              {streamDetails.status === 'ENDED' && (
                <button
                  onClick={() => onStatusChange('SCHEDULED')}
                  className="p-1.5 rounded bg-blue-500 text-white text-xs flex items-center"
                  title="Schedule again"
                >
                  <Clock className="w-3 h-3 mr-1" /> Yeniden Planla
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StreamHeader; 