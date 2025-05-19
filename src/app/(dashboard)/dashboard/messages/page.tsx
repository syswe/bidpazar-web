"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as ApiUser,
  getUserConversations as getConversations,
  Conversation,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  MessageSquare,
  PlusCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";

export default function MessagesPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Function to load conversations from API
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    setRefreshing(true);
    try {
      const data = await getConversations();
      setConversations(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load conversations:", err);
      setError("Failed to load conversations. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated, user]);

  // Initial load and setup periodic refresh
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      // Initial load
      loadConversations();

      // Set up refresh timer (every 10 seconds)
      const refreshInterval = setInterval(() => {
        loadConversations();
      }, 10000);

      return () => clearInterval(refreshInterval);
    }
  }, [authLoading, isAuthenticated, loadConversations]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/sign-in?redirect=/dashboard/messages");
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredConversations = conversations.filter((conversation) => {
    if (!searchInput.trim()) return true;

    const searchTerm = searchInput.toLowerCase();
    const otherParticipant = conversation.participants.find(
      (p) => p.id !== user?.id
    );

    return (
      otherParticipant?.username?.toLowerCase().includes(searchTerm) ||
      otherParticipant?.name?.toLowerCase().includes(searchTerm)
    );
  });

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Button
          onClick={() => loadConversations()}
          variant="outline"
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Refresh
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search conversations..."
          className="pl-10"
          value={searchInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchInput(e.target.value)
          }
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="bg-background shadow rounded-lg">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
            <p className="text-muted-foreground mb-4">
              Start messaging with other users to begin a conversation
            </p>
            <Button asChild>
              <Link href="/dashboard/users">
                <PlusCircle className="h-4 w-4 mr-2" />
                Find Users
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {filteredConversations.map((conversation) => {
              const otherParticipant = conversation.participants.find(
                (p) => p.id !== user?.id
              );

              // Check for unread messages if the property exists
              const hasUnreadMessages =
                conversation.latestMessage &&
                conversation.latestMessage.receiverId === user?.id &&
                !conversation.latestMessage.isRead;

              return (
                <li key={conversation.id}>
                  <Link
                    href={`/dashboard/messages/${conversation.id}`}
                    className="flex items-center p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-medium">
                          {otherParticipant?.name ||
                            otherParticipant?.username ||
                            "Unknown User"}
                        </h3>
                        {hasUnreadMessages && (
                          <span className="ml-2 bg-blue-500 rounded-full w-2 h-2"></span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.latestMessage?.content ||
                          "No messages yet"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {conversation.updatedAt
                          ? new Date(conversation.updatedAt).toLocaleString()
                          : ""}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
