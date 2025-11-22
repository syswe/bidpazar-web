import React from 'react';

interface ChatMessageType {
  id: string;
  message: string;
  content?: string;
  userId: string;
  liveStreamId: string;
  createdAt: string;
  username?: string;
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
  const username = message.username || message.user?.username || 'Bilinmeyen';

  return (
    <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isFromCurrentUser
            ? 'bg-accent text-accent-foreground rounded-br-none'
            : 'bg-muted text-foreground rounded-bl-none'
          }`}
      >
        {!isFromCurrentUser && (
          <div className="font-semibold text-xs mb-0.5">
            {username}
          </div>
        )}
        <div className="break-words text-sm">{messageContent}</div>
        <div className="text-[10px] mt-1 opacity-70 text-right">
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