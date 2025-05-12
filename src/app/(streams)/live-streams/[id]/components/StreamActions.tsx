import React from 'react';
import { Heart, Share2 } from 'lucide-react';

interface StreamActionsProps {
  isLiked: boolean;
  onLike: () => void;
  onShare: () => void;
  likeCount?: number;
}

const StreamActions: React.FC<StreamActionsProps> = ({ 
  isLiked, 
  onLike, 
  onShare,
  likeCount = 0
}) => {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col items-center">
        <button 
          onClick={onLike}
          className="action-button"
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <Heart 
            className={`w-5 h-5 ${isLiked ? 'text-red-500 fill-red-500' : 'text-white'}`} 
          />
        </button>
        {likeCount > 0 && (
          <span className="text-xs text-white mt-1">{likeCount}</span>
        )}
      </div>
      
      <button 
        onClick={onShare}
        className="action-button"
        aria-label="Share"
      >
        <Share2 className="w-5 h-5 text-white" />
      </button>
    </div>
  );
};

export default StreamActions; 