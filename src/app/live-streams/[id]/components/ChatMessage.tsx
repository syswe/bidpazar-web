import React from 'react';
import ContentMenu from '@/components/ContentMenu';

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
  sessionUserId?: string;
}

const ChatMessage = ({ message, isFromCurrentUser, sessionUserId }: ChatMessageProps) => {
  // Use content if available, otherwise use message (to handle different API formats)
  const messageContent = message.content || message.message;
  const username = message.username || message.user?.username || 'Bilinmeyen';

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContent);
  };

  return (
    <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150 group`}>
      <div className="flex items-start gap-1 max-w-[85%]">
        {/* Message Bubble */}
        <div
          className={`flex-1 px-3 py-2 rounded-2xl text-sm ${isFromCurrentUser
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

        {/* Content Menu - Only show for other users' messages */}
        {!isFromCurrentUser && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ContentMenu
              contentType="CHAT_MESSAGE"
              contentId={message.id}
              showCopy={true}
              onCopy={handleCopy}
              className="p-1"
              trigger={
                <button
                  type="button"
                  className="p-1 rounded hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  aria-label="Mesaj seçenekleri"
                  style={{ minWidth: '32px', minHeight: '32px' }}
                >
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
