import React from 'react';
import { Heart, Share2, Terminal } from 'lucide-react';

interface StreamActionsProps {
  isLiked: boolean;
  onLike: () => void;
  onShare: () => void;
  onShowDiagnostics: () => void;
}

const StreamActions = ({ 
  isLiked, 
  onLike, 
  onShare, 
  onShowDiagnostics 
}: StreamActionsProps) => {
  return (
    <div className="stream-actions">
      <button
        onClick={onLike}
        className="action-button"
        aria-label="Like stream"
      >
        <Heart
          className={`h-5 w-5 ${
            isLiked ? "fill-red-500 text-red-500" : ""
          }`}
        />
      </button>
      <button 
        className="action-button" 
        aria-label="Share stream"
        onClick={onShare}
      >
        <Share2 className="h-5 w-5" />
      </button>
      <button
        onClick={onShowDiagnostics}
        className="action-button"
        aria-label="Stream diagnostics"
      >
        <Terminal className="h-5 w-5" />
      </button>
    </div>
  );
};

export default StreamActions; 