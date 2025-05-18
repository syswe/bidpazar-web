import React from "react";

interface MessageType {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    name?: string;
  };
  senderUsername?: string;
}

interface MessageProps {
  message: MessageType;
  isFromCurrentUser: boolean;
}

const MessageComponent = ({ message, isFromCurrentUser }: MessageProps) => {
  // Use sender from message object or fall back to senderUsername
  const username =
    message.sender?.username || message.senderUsername || "Unknown";

  return (
    <div
      className={`flex ${
        isFromCurrentUser ? "justify-end" : "justify-start"
      } animate-in fade-in duration-150 mb-2`}
    >
      <div
        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
          isFromCurrentUser
            ? "bg-accent text-accent-foreground rounded-br-none"
            : "bg-muted text-foreground rounded-bl-none"
        }`}
      >
        {!isFromCurrentUser && (
          <div className="font-semibold text-xs mb-0.5">{username}</div>
        )}
        <div className="break-words text-sm">{message.content}</div>
        <div className="text-[10px] mt-1 opacity-70 text-right">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
};

export default MessageComponent;
