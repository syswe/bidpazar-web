import React from 'react';

interface ChatMessageType {
  id: string;
  message: string;
  content?: string;
  userId: string;
  liveStreamId: string;
  createdAt: string;
  user?: {
    username: string;
  };
}

interface ChatMessageProps {
  message: ChatMessageType;
  isFromCurrentUser: boolean;
}

const ChatMessage = ({ message, isFromCurrentUser }: ChatMessageProps) => {
  // Use content if available, otherwise use message (to handle different API formats)
  const messageContent = message.content || message.message;

  return (
    <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] p-2 rounded-lg text-sm ${isFromCurrentUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-foreground'
          }`}
      >
        {!isFromCurrentUser && (
          <div className="font-medium text-xs mb-1">
            {message.user?.username || 'Unknown'}
          </div>
        )}
        <div className="break-words">{messageContent}</div>
        <div className="text-xs mt-1 opacity-70">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 