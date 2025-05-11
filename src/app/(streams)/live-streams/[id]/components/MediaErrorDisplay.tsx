import React from 'react';

interface MediaErrorObject {
  type: string;
  message: string;
  details?: any;
}

interface MediaErrorDisplayProps {
  mediaError: string | MediaErrorObject;
  onDismiss: () => void;
  onRetry?: () => void; // Optional retry handler
}

const MediaErrorDisplay: React.FC<MediaErrorDisplayProps> = ({ mediaError, onDismiss, onRetry }) => {
  if (!mediaError) return null;
  
  // Format the error message based on whether it's a string or object
  const errorMessage = typeof mediaError === 'string' 
    ? mediaError 
    : `${mediaError.type}: ${mediaError.message}`;
  
  return (
    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white py-2 px-4 rounded-lg text-sm max-w-xs text-center">
      <p>{errorMessage}</p>
      <div className="mt-2 flex justify-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs bg-blue-500/70 hover:bg-blue-500/90 rounded px-2 py-1"
          >
            Retry
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default MediaErrorDisplay; 