"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as ApiUser,
  getUserConversations as getConversations,
  Conversation,
  getOrCreateConversation,
  searchSellerRecipients,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  MessageSquare,
  ChevronRight,
  Loader2,
  UserPlus,
} from "lucide-react";

export default function MessagesPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [sellerSearchTerm, setSellerSearchTerm] = useState("");
  const [sellerResults, setSellerResults] = useState<ApiUser[]>([]);
  const [sellerSearchLoading, setSellerSearchLoading] = useState(false);
  const [sellerSearchError, setSellerSearchError] = useState<string | null>(
    null
  );
  const [creatingConversationId, setCreatingConversationId] = useState<
    string | null
  >(null);
  const sellerSearchDelayRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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

  const clearSellerSearchDebounce = useCallback(() => {
    if (sellerSearchDelayRef.current) {
      clearTimeout(sellerSearchDelayRef.current);
      sellerSearchDelayRef.current = null;
    }
  }, []);

  const fetchSellerResults = useCallback(
    async (term: string) => {
      if (!isAuthenticated || authLoading) {
        setSellerResults([]);
        return;
      }

      setSellerSearchLoading(true);
      try {
        const sellers = await searchSellerRecipients(term);
        setSellerResults(sellers);
        setSellerSearchError(null);
      } catch (err: any) {
        console.error("Failed to search sellers:", err);
        setSellerResults([]);
        setSellerSearchError(
          err?.message || "Satıcılar aranırken bir hata oluştu"
        );
      } finally {
        setSellerSearchLoading(false);
      }
    },
    [authLoading, isAuthenticated]
  );

  const handleSellerSearchChange = useCallback(
    (value: string) => {
      setSellerSearchTerm(value);
      setSellerSearchError(null);
      clearSellerSearchDebounce();

      sellerSearchDelayRef.current = setTimeout(() => {
        fetchSellerResults(value);
      }, 350);
    },
    [clearSellerSearchDebounce, fetchSellerResults]
  );

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

  useEffect(() => {
    return () => {
      clearSellerSearchDebounce();
    };
  }, [clearSellerSearchDebounce]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/sign-in?redirect=/dashboard/messages");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isNewMessageOpen) {
      setSellerSearchError(null);
      fetchSellerResults("");
    } else {
      setSellerSearchTerm("");
      setSellerResults([]);
      setSellerSearchError(null);
      clearSellerSearchDebounce();
    }
  }, [
    isNewMessageOpen,
    fetchSellerResults,
    clearSellerSearchDebounce,
  ]);

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

  const handleStartConversation = useCallback(
    async (seller: ApiUser) => {
      if (!seller?.id) return;

      const existingConversation = conversations.find((conversation) =>
        conversation.participants.some((participant) => participant.id === seller.id)
      );

      if (existingConversation) {
        setIsNewMessageOpen(false);
        router.push(`/dashboard/messages/${existingConversation.id}`);
        return;
      }

      setCreatingConversationId(seller.id);
      try {
        const conversation = await getOrCreateConversation(seller.id);
        await loadConversations();
        setIsNewMessageOpen(false);
        router.push(`/dashboard/messages/${conversation.id}`);
      } catch (err: any) {
        console.error("Failed to start conversation with seller:", err);
        setError(
          err?.message ||
            "Seçilen satıcı ile sohbet başlatılırken bir hata oluştu"
        );
      } finally {
        setCreatingConversationId(null);
      }
    },
    [conversations, loadConversations, router]
  );

  const handleToggleNewMessage = useCallback(() => {
    setIsNewMessageOpen((prev) => !prev);
  }, []);

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
        <div className="flex items-center gap-2">
          <Button
            onClick={handleToggleNewMessage}
            variant={isNewMessageOpen ? "secondary" : "default"}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Yeni Mesaj
          </Button>
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

      {isNewMessageOpen && (
        <div className="mb-6 rounded-lg border bg-background p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Satıcıya yeni mesaj</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Arama yaparak satıcı seçebilir ve sohbet başlatabilirsiniz.
          </p>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Satıcı ara..."
              className="pl-10"
              value={sellerSearchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleSellerSearchChange(e.target.value)
              }
            />
            {sellerSearchLoading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
            ) : null}
          </div>
          {sellerSearchError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {sellerSearchError}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {sellerSearchLoading && sellerResults.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Satıcılar yükleniyor...
              </div>
            ) : sellerResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {sellerSearchTerm
                  ? "Aramanızla eşleşen satıcı bulunamadı"
                  : "Listelenecek satıcı bulunamadı"}
              </p>
            ) : (
              <ul className="divide-y">
                {sellerResults.map((seller) => {
                  const existingConversation = conversations.find((conversation) =>
                    conversation.participants.some(
                      (participant) => participant.id === seller.id
                    )
                  );
                  const isCreating =
                    !existingConversation &&
                    creatingConversationId === seller.id;
                  const buttonLabel = existingConversation
                    ? "Sohbete git"
                    : isCreating
                      ? "Başlatılıyor..."
                      : "Mesaj gönder";

                  return (
                    <li
                      key={seller.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {seller.name || seller.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{seller.username}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={existingConversation ? "secondary" : "outline"}
                        onClick={() => handleStartConversation(seller)}
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {buttonLabel}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

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
              Satıcılarla sohbet başlatmak için Yeni Mesaj butonunu
              kullanabilirsiniz.
            </p>
            <Button onClick={() => setIsNewMessageOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Yeni Mesaj
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
