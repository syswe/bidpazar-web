import React from "react";
import { AlertTriangle } from "lucide-react";

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
  failed?: boolean;
  temporary?: boolean;
}

interface MessageProps {
  message: MessageType;
  isFromCurrentUser: boolean;
}

const MessageComponent = ({ message, isFromCurrentUser }: MessageProps) => {
  // Use sender from message object or fall back to senderUsername
  const username =
    message.sender?.username || message.senderUsername || "Bilinmeyen";

  // Check if message is temporary or failed
  const isPending = message.id.startsWith("temp-") && !message.failed;
  const isFailed = message.failed || false;

  // Debug log the message data
  console.log(`Rendering message: ${message.id}`, {
    content: message.content,
    sender: message.sender,
    senderUsername: message.senderUsername,
    isFromCurrentUser,
    timestamp: message.createdAt,
    formattedTime: new Date(message.createdAt).toLocaleTimeString(),
  });

  return (
    <div
      className={`flex ${isFromCurrentUser ? "justify-end" : "justify-start"
        } animate-in fade-in duration-150 mb-2`}
    >
      <div
        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isFromCurrentUser
            ? `bg-accent text-accent-foreground rounded-br-none ${isPending ? "opacity-70" : ""
            } ${isFailed ? "bg-red-100 border border-red-300" : ""}`
            : "bg-muted text-foreground rounded-bl-none"
          }`}
      >
        {!isFromCurrentUser && (
          <div className="font-semibold text-xs mb-0.5">{username}</div>
        )}
        <div className="break-words text-sm flex items-center">
          {message.content}
          {isFailed && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 ml-1.5 inline flex-shrink-0" />
          )}
        </div>
        <div className="text-[10px] mt-1 opacity-70 text-right flex justify-end items-center">
          {isPending && <span className="mr-1">Gönderiliyor...</span>}
          {isFailed && <span className="mr-1 text-red-500">Başarısız</span>}
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
