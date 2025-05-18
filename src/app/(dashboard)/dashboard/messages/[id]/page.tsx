"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import {
  getConversationMessages,
  sendMessage as apiSendMessage,
  Message as ApiMessage,
} from "@/lib/api";
import { useMessageSocket } from "@/lib/hooks/useMessageSocket";
import MessageComponent from "@/components/MessageComponent";
import { Send, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Conversation {
  id: string;
  participants: {
    id: string;
    username: string;
    name?: string;
  }[];
  otherParticipant?: {
    id: string;
    username: string;
    name?: string;
  };
}

interface MessageResponse {
  messages: ApiMessage[];
  totalCount: number;
  page: number;
  totalPages: number;
  conversation?: {
    participants: {
      id: string;
      username: string;
      name?: string;
    }[];
  };
}

export default function ConversationPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the real-time messaging hook
  const {
    connected,
    messages: socketMessages,
    sendMessage,
  } = useMessageSocket(conversationId);

  // Combine API-loaded messages with real-time socket messages
  const allMessages = [...apiMessages, ...socketMessages];

  // Sort messages by createdAt date
  const sortedMessages = [...allMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/sign-in?redirect=/dashboard/messages");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    async function fetchConversationMessages() {
      if (!conversationId || !user?.id) return;

      try {
        setLoading(true);
        setError(null);

        console.log(
          `Fetching messages for conversation: ${conversationId}, page: ${page}`
        );
        const response = (await getConversationMessages(
          conversationId,
          page
        )) as MessageResponse;

        if (response.messages) {
          // Add to existing messages for pagination
          setApiMessages((prev) => {
            const newMessages = [...prev];

            // Add messages that aren't already in the state
            response.messages.forEach((msg: ApiMessage) => {
              if (!newMessages.some((m) => m.id === msg.id)) {
                newMessages.push(msg);
              }
            });

            return newMessages;
          });

          // Determine if there are more messages to load
          setHasMore(response.page < response.totalPages);

          // Set conversation data if first load
          if (page === 1) {
            // Extract the other participant
            const otherParticipant = response.conversation?.participants?.find(
              (p: { id: string }) => p.id !== user?.id
            );

            setConversation({
              id: conversationId,
              participants: response.conversation?.participants || [],
              otherParticipant,
            });
          }
        }
      } catch (err: any) {
        console.error("Error fetching messages:", err);
        setError(err.message || "Failed to load messages");
      } finally {
        setLoading(false);
      }
    }

    fetchConversationMessages();
  }, [conversationId, user?.id, page]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages.length]);

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !conversation?.otherParticipant?.id) return;

    // Clear the input right away for better UX
    const content = messageContent.trim();
    setMessageContent("");

    try {
      // Send via socket if connected
      if (connected) {
        sendMessage({
          conversationId,
          content,
          receiverId: conversation.otherParticipant.id,
        });
      } else {
        // Fall back to API if socket not connected
        const sentMessage = await apiSendMessage(
          conversationId,
          content,
          conversation.otherParticipant.id
        );

        if (sentMessage) {
          console.log("Message sent via API:", sentMessage);
        }
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(err.message || "Failed to send message");
    }
  };

  const loadMoreMessages = () => {
    if (hasMore && !loading) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="py-3 px-4 border-b flex items-center">
        <Link href="/dashboard/messages" className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {conversation?.otherParticipant?.name ||
              conversation?.otherParticipant?.username ||
              "Loading..."}
          </h1>
          {connected ? (
            <span className="text-xs text-green-500">Real-time connected</span>
          ) : (
            <span className="text-xs text-gray-500">Connecting...</span>
          )}
        </div>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasMore && (
          <div className="text-center mb-4">
            <Button
              variant="outline"
              onClick={loadMoreMessages}
              disabled={loading}
              className="text-xs"
            >
              {loading ? "Loading..." : "Load earlier messages"}
            </Button>
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded text-sm mb-4">
            Error: {error}
          </div>
        )}

        {sortedMessages.length === 0 && !loading ? (
          <div className="text-center text-gray-500 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          sortedMessages.map((message) => (
            <MessageComponent
              key={message.id}
              message={message}
              isFromCurrentUser={message.senderId === user?.id}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Textarea
            value={messageContent}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setMessageContent(e.target.value)
            }
            placeholder="Type a message..."
            className="flex-1 resize-none"
            rows={1}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageContent.trim()}
            className="self-end"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
