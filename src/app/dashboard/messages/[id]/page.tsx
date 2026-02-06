"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useParams } from "next/navigation";
import {
  getOrCreateConversation,
  sendMessage as apiSendMessage,
  Message as ApiMessage,
  getConversationDetails,
  getConversationMessages,
  Conversation as ApiConversationType,
} from "@/lib/api";
import MessageComponent from "@/components/MessageComponent";
import { Send, ArrowLeft, Loader2, AlertCircle, Lightbulb, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReportButton from "@/components/ReportButton";

interface ConversationState extends ApiConversationType {
  otherParticipant?: {
    id: string;
    username: string;
    name?: string;
  };
}

interface Message {
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
}

export default function ConversationPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const idParam = params.id as string;

  // State for conversation management
  const [conversationId, setConversationId] = useState<string>(idParam);
  const [conversation, setConversation] = useState<ConversationState | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState<
    "idle" | "loading" | "success" | "error" | "not_found"
  >("idle");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | number | null>(null);
  const failedMessagesRef = useRef<Message[]>([]);

  // Product-related states for message suggestions
  const [productInfo, setProductInfo] = useState<{
    id: string;
    title: string;
    price: number;
    imageUrl?: string;
  } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasUsedSuggestion, setHasUsedSuggestion] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Close menu when clicking outside (simple implementation)
  useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

  // Parse product info from URL
  useEffect(() => {
    const productParam = searchParams.get('product');
    if (productParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(productParam));
        setProductInfo(decoded);
        setShowSuggestions(true);

        // Set initial message with product context
        const initialMessage = `Merhaba, "${decoded.title}" ilanınızla ilgili bilgi almak istiyorum. `;
        setMessageContent(initialMessage);
      } catch (error) {
        console.error('Failed to parse product info:', error);
      }
    }
  }, [searchParams]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Handle redirection if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(
        `/sign-in?redirect=/dashboard/messages/${encodeURIComponent(idParam)}`
      );
    }
  }, [authLoading, isAuthenticated, router, idParam]);

  // Setup regular polling for new messages
  useEffect(() => {
    if (initializationStatus === "success" && conversationId) {
      // Initial fetch
      refreshMessages();

      // Setup regular polling (every 3 seconds)
      if (typeof window !== "undefined") {
        refreshIntervalRef.current = window.setInterval(() => {
          refreshMessages();
        }, 3000);
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [initializationStatus, conversationId]);

  // Function to refresh messages
  const refreshMessages = useCallback(async () => {
    if (!conversationId || refreshing || !user?.id) return;

    try {
      setRefreshing(true);
      console.log(`Refreshing messages for conversation: ${conversationId}`);
      const response = await getConversationMessages(conversationId, 1, 50);

      if (response && response.messages) {
        console.log(`Fetched ${response.messages.length} messages from API`);

        // Format messages if needed
        const formattedMessages = response.messages.map((msg) => ({
          ...msg,
          createdAt: msg.createdAt,
        }));

        // Keep temporary messages that might not be in DB yet
        // and failed messages that need to be retried
        setMessages((prevMessages) => {
          const pendingMessages = prevMessages.filter(
            (pm) =>
              (pm.id.startsWith("temp-") || pm.failed) &&
              !formattedMessages.some(
                (m) =>
                  // Don't match on temporary messages
                  !pm.id.startsWith("temp-") &&
                  m.senderId === pm.senderId &&
                  m.content === pm.content &&
                  Math.abs(
                    new Date(m.createdAt).getTime() -
                    new Date(pm.createdAt).getTime()
                  ) < 5000
              )
          );

          // Sort messages by time
          return [...formattedMessages, ...pendingMessages].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error refreshing messages:", err);
    } finally {
      setRefreshing(false);
    }
  }, [conversationId, user?.id, refreshing]);

  // Initialize conversation logic
  useEffect(() => {
    if (
      initializationStatus !== "idle" ||
      !idParam ||
      !user?.id ||
      authLoading
    ) {
      return;
    }

    const initialize = async () => {
      setInitializationStatus("loading");
      setError(null);
      setLoading(true);
      setIsCreatingConversation(false);

      try {
        // First, try to fetch as a conversation ID
        console.log(`Attempting to fetch conversation: ${idParam}`);

        try {
          const details = await getConversationDetails(idParam);

          // If successful, it's a valid conversation ID
          if (details && details.participants) {
            console.log(`Found existing conversation: ${idParam}`);
            setConversationId(idParam);
            const otherP = details.participants.find((p) => p.id !== user.id);
            setConversation({ ...details, otherParticipant: otherP });

            // Fetch the messages for this conversation
            const messagesResponse = await getConversationMessages(
              idParam,
              1,
              50
            );
            if (messagesResponse && messagesResponse.messages) {
              setMessages(messagesResponse.messages);
            }

            setInitializationStatus("success");
          } else {
            throw new Error("Sohbet detayları bulunamadı veya eksik.");
          }
        } catch (conversationError: any) {
          // If conversation not found (404), treat idParam as user ID
          if (conversationError.message?.includes("not found") || conversationError.message?.includes("404")) {
            console.log(
              `Conversation not found, treating as user ID: ${idParam}`
            );
            setIsCreatingConversation(true);
            const createdOrFoundConv = await getOrCreateConversation(idParam);

            setConversationId(createdOrFoundConv.id);
            const otherP = createdOrFoundConv.participants.find(
              (p) => p.id !== user.id
            );
            setConversation({ ...createdOrFoundConv, otherParticipant: otherP });

            // Fetch messages if this is an existing conversation
            if (createdOrFoundConv.id) {
              const messagesResponse = await getConversationMessages(
                createdOrFoundConv.id,
                1,
                50
              );
              if (messagesResponse && messagesResponse.messages) {
                setMessages(messagesResponse.messages);
              }
            }

            // Update URL to use the actual conversation ID
            if (createdOrFoundConv.id !== idParam) {
              const productParam = searchParams.get('product');
              const newUrl = productParam
                ? `/dashboard/messages/${createdOrFoundConv.id}?product=${productParam}`
                : `/dashboard/messages/${createdOrFoundConv.id}`;
              router.replace(newUrl);
            }
            setInitializationStatus("success");
          } else {
            // Re-throw if it's not a "not found" error
            throw conversationError;
          }
        }
      } catch (err: any) {
        console.error("Failed to initialize conversation:", err);
        let specificError = err.message || "Bilinmeyen bir hata oluştu";
        let statusToSet: "not_found" | "error" = "error";

        if (err.status === 404) {
          specificError = `Kullanıcı veya sohbet bulunamadı (${err.message || "404 Bulunamadı"
            })`;
          statusToSet = "not_found";
        } else if (err.status === 403) {
          specificError = `Erişim reddedildi: Yetkiniz yok. (${err.message || "403 Yasak"
            })`;
          statusToSet = "error"; // Keep as general error for access issues
        } else if (specificError.includes("User not found")) {
          // Handle specific string messages if status isn't available
          statusToSet = "not_found";
        } else if (specificError.includes("permission")) {
          statusToSet = "error";
        }

        setError(specificError);
        setInitializationStatus(statusToSet);

        if (statusToSet === "not_found" || statusToSet === "error") {
          redirectTimeoutRef.current = setTimeout(() => {
            router.push("/dashboard/messages");
          }, 7000); // Increased delay for readability
        }
      } finally {
        setIsCreatingConversation(false);
        setLoading(false);
      }
    };

    initialize();
  }, [idParam, user?.id, router, initializationStatus, authLoading]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    if (initializationStatus === "success") {
      console.log("Manually refreshing messages...");
      refreshMessages();
    }
  }, [initializationStatus, refreshMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Function to retry sending failed messages
  const retryFailedMessages = useCallback(async () => {
    if (!user?.id || failedMessagesRef.current.length === 0) return;

    const messagesToRetry = [...failedMessagesRef.current];
    failedMessagesRef.current = []; // Clear the queue

    for (const message of messagesToRetry) {
      try {
        console.log(`Retrying message: ${message.content}`);
        await apiSendMessage(
          message.conversationId,
          message.content,
          message.receiverId
        );
      } catch (err) {
        console.error("Failed to retry message:", err);
        // Put back in the queue if it still failed
        failedMessagesRef.current.push(message);
      }
    }

    // Refresh messages to get the latest from the server
    refreshMessages();
  }, [user?.id, refreshMessages]);

  // Generate message suggestions based on product
  const getMessageSuggestions = useCallback(() => {
    if (!productInfo) return [];

    const formattedPrice = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(productInfo.price);

    return [
      `Ürünün durumu nasıl?`,
      `Fiyatta indirim yapabilir misiniz?`,
      `Kargo ücreti ne kadar?`,
      `Ürünü ne zaman gönderebilirsiniz?`,
      `${formattedPrice} fiyat için son fiyatınız mı?`,
      `Ürünle ilgili daha fazla fotoğraf gönderebilir misiniz?`,
      `Ürün garantisi var mı?`
    ];
  }, [productInfo]);

  // Apply a suggestion to message content
  const applySuggestion = useCallback((suggestion: string) => {
    setMessageContent((prev) => {
      // If message already has content, add suggestion as new sentence
      if (prev.trim()) {
        return `${prev.trim()} ${suggestion}`;
      }
      return suggestion;
    });
    setHasUsedSuggestion(true);
  }, []);

  // Send a message
  const handleSendMessage = async () => {
    if (
      !messageContent.trim() ||
      !conversation?.otherParticipant?.id ||
      !user
    ) {
      console.warn(
        "Cannot send message: Missing content, participant, or user."
      );
      return;
    }

    const content = messageContent.trim();
    setMessageContent("");

    // Create a temporary ID for optimistic UI update
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Add to messages immediately for instant feedback
    const tempMessage = {
      id: tempId,
      content,
      senderId: user.id,
      senderUsername: user.username,
      receiverId: conversation.otherParticipant.id,
      conversationId,
      createdAt: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      // Send the message via API
      console.log("Sending message via API");
      const savedMessage = await apiSendMessage(
        conversationId,
        content,
        conversation.otherParticipant.id
      );

      // Replace the temporary message with the saved one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
              ...savedMessage,
              sender: {
                id: user.id,
                username: user.username,
                name: user.name,
              },
            }
            : msg
        )
      );

      // Refresh to get all messages just to be sure
      setTimeout(() => {
        refreshMessages();
      }, 500);
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(err.message || "Mesaj gönderilemedi");

      // Mark the message as failed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...msg, failed: true, content: `${content} (Gönderilemedi)` }
            : msg
        )
      );

      // Try again after a short delay
      setTimeout(() => {
        retryFailedMessages();
      }, 3000);
    }
  };

  const disableInput =
    isCreatingConversation ||
    !conversation?.otherParticipant ||
    initializationStatus !== "success";

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !disableInput) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render error state more specifically
  const renderErrorState = () => {
    let title = "Bir Hata Oluştu";
    if (initializationStatus === "not_found") {
      title = "Bulunamadı";
    }
    // Default error variable should be displayed for other errors

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-red-50 p-3 mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-xl font-semibold text-red-800 mb-2">{title}</h3>
        <p className="text-[var(--muted-foreground)] max-w-md mb-4 whitespace-pre-wrap">
          {error}
        </p>
        <Link href="/dashboard/messages">
          <Button>Mesajlara Dön</Button>
        </Link>
        {(initializationStatus === "not_found" ||
          initializationStatus === "error") && (
            <p className="text-xs text-gray-500 mt-2">
              Birkaç saniye içinde yönlendirileceksiniz...
            </p>
          )}
      </div>
    );
  };

  if (authLoading || (loading && initializationStatus === "loading")) {
    return (
      <div className="flex flex-col h-screen max-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[var(--primary)] mb-4" />
        <p className="text-[var(--muted-foreground)]">
          {authLoading ? "Kimlik doğrulanıyor..." : "Sohbet yükleniyor..."}
        </p>
      </div>
    );
  }

  if (
    initializationStatus === "error" ||
    initializationStatus === "not_found"
  ) {
    return renderErrorState();
  }

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="py-3 px-4 border-b flex items-center">
        <Link href="/dashboard/messages" className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold truncate">
            {conversation?.otherParticipant?.name ||
              conversation?.otherParticipant?.username ||
              (isCreatingConversation
                ? "Sohbet başlatılıyor..."
                : "Sohbet")}
          </h1>
          <span className="text-xs text-gray-500">
            Son güncelleme: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || initializationStatus !== "success"}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Yenile
        </Button>

        {/* Actions Menu */}
        <div className="relative ml-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
          >
            <Settings className="h-4 w-4" />
          </Button>

          <div className={`absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded shadow-lg z-50 py-1 ${showMenu ? '' : 'hidden'}`}>
            {conversation?.id && (
              <ReportButton
                contentType="DIRECT_MESSAGE"
                contentId={conversation.id}
                variant="menu-item"
                label="Sohbeti Bildir"
              />
            )}
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && initializationStatus === "success" && (
          <div className="text-center text-gray-500 py-8">
            Henüz mesaj yok. Sohbete başlayın!
          </div>
        )}
        {initializationStatus === "success" &&
          messages.map((message) => (
            <MessageComponent
              key={message.id}
              message={message}
              isFromCurrentUser={message.senderId === user?.id}
            />
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="border-t border-[var(--border)]">
        {/* Product info and suggestions */}
        {productInfo && showSuggestions && initializationStatus === "success" && (
          <div className="product-suggestion-panel">
            <div className="flex items-start gap-3 mb-4">
              {productInfo.imageUrl && (
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 border-[var(--accent)] premium-shadow">
                  <img
                    src={productInfo.imageUrl}
                    alt={productInfo.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-[var(--foreground)] truncate mb-1">
                  {productInfo.title}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-[var(--accent)] mb-2">
                  {new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: 'TRY'
                  }).format(productInfo.price)}
                </p>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-xs text-[var(--accent)] hover:text-[var(--primary)] transition-colors font-medium"
                >
                  ✕ Önerileri gizle
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--border)]">
              <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--accent)]" />
              <span className="text-xs sm:text-sm font-semibold text-[var(--foreground)]">
                Mesaj Önerileri
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {getMessageSuggestions().map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => applySuggestion(suggestion)}
                  className="suggestion-chip"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4">
          {initializationStatus === "success" ? (
            <div className="flex space-x-2">
              <Textarea
                className="flex-1 resize-none"
                placeholder={productInfo && !hasUsedSuggestion ? "Yukarıdaki önerilerden birini seçebilir veya kendi mesajınızı yazabilirsiniz..." : "Mesaj yazın..."}
                rows={productInfo ? 2 : 1}
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={disableInput}
              />
              <Button
                className="self-end"
                onClick={handleSendMessage}
                disabled={disableInput || !messageContent.trim() || refreshing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
