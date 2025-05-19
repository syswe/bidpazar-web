import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  getConversationMessages,
  Message as ApiMessage,
  sendMessage as apiSendMessage,
} from "@/lib/api";

interface Message {
  id: string;
  senderId: string;
  senderUsername: string;
  receiverId: string;
  content: string;
  conversationId: string;
  createdAt: string;
  temporary?: boolean;
}

interface MessageNotification {
  senderId: string;
  senderUsername: string;
  conversationId: string;
  content: string;
  createdAt: string;
}

interface UseMessageSocketOptions {
  onAccessError?: (error: any) => void;
}

export function useMessageSocket(
  conversationId?: string,
  options: UseMessageSocketOptions = {}
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<MessageNotification[]>([]);
  const [accessError, setAccessError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { user } = useAuth();
  const router = useRouter();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const failedMessagesRef = useRef<Message[]>([]);

  // Initialize socket connection
  useEffect(() => {
    if (!user?.id) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:3000";
    const socketPath = process.env.NEXT_PUBLIC_WS_URL || "/socket.io";

    console.log(`Connecting to socket at ${socketUrl} with path ${socketPath}`);

    const socketIo = io(socketUrl, {
      path: socketPath,
      query: {
        userId: user.id,
        username: user.username,
        token:
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("authToken"),
      },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketIo.on("connect", () => {
      console.log("Socket connected:", socketIo.id);
      setConnected(true);

      // When reconnected, attempt to re-send any failed messages
      if (failedMessagesRef.current.length > 0) {
        console.log(
          `Attempting to resend ${failedMessagesRef.current.length} failed messages`
        );
        retryFailedMessages();
      }
    });

    socketIo.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    socketIo.on("error", (error) => {
      console.error("Socket error:", error);
    });

    // Listen for access denied events
    socketIo.on("access_denied", (data) => {
      console.error("Socket access denied:", data);
      setAccessError(
        new Error(`Access denied: ${data.reason || "Not authorized"}`)
      );

      if (options.onAccessError) {
        options.onAccessError(
          new Error(`Access denied: ${data.reason || "Not authorized"}`)
        );
      }
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, [user?.id, user?.username, options.onAccessError]);

  // Function to retry sending failed messages via API
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
    if (conversationId) {
      refreshMessages();
    }
  }, [user?.id, conversationId]);

  // Function to refresh messages via API
  const refreshMessages = useCallback(async () => {
    if (!conversationId || !user?.id) return;

    try {
      console.log(`Refreshing messages for conversation: ${conversationId}`);
      const response = await getConversationMessages(conversationId, 1, 50);
      console.log("API response:", response);

      if (response.messages && Array.isArray(response.messages)) {
        // Convert API messages to socket message format
        const formattedApiMessages = response.messages.map(
          (apiMsg: ApiMessage): Message => ({
            id: apiMsg.id,
            senderId: apiMsg.senderId,
            senderUsername: apiMsg.sender?.username || "Unknown",
            receiverId: apiMsg.receiverId,
            content: apiMsg.content,
            conversationId: apiMsg.conversationId,
            createdAt: apiMsg.createdAt,
          })
        );

        if (formattedApiMessages.length > 0) {
          console.log(
            `Received ${formattedApiMessages.length} messages from API`
          );

          // Update messages with server data
          setMessages((prev) => {
            // Keep temporary messages that might not be in the database yet
            const tempMessages = prev.filter(
              (m) =>
                m.temporary === true &&
                !formattedApiMessages.some(
                  (am) => am.senderId === m.senderId && am.content === m.content
                )
            );

            // Combine DB messages with any temporary messages
            return [...formattedApiMessages, ...tempMessages];
          });
        } else {
          console.log("No messages found in database for this conversation");
        }
      } else {
        console.warn("Invalid response format from API:", response);
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error refreshing messages:", err);
    }
  }, [conversationId, user?.id]);

  // Join conversation room if conversationId is provided
  useEffect(() => {
    if (!conversationId) return;

    // Reset access error when trying to join a new conversation
    setAccessError(null);

    // Always refresh messages when joining a conversation, regardless of socket status
    refreshMessages();

    // Only join the socket room if socket is connected
    if (socket && connected) {
      console.log(`Joining conversation room: ${conversationId}`);

      // Request to join the conversation
      socket.emit("join-conversation", conversationId, (response: any) => {
        // Handle errors from join-conversation attempt
        if (response && response.error) {
          console.error(`Failed to join conversation: ${response.error}`);
          setAccessError(new Error(response.error));

          if (options.onAccessError) {
            options.onAccessError(new Error(response.error));
          }
        }
      });

      // Listen for new messages in this conversation
      socket.on("new-message", (message: Message) => {
        console.log("New message received via socket:", message);

        // Add the message to the existing messages
        setMessages((prev) => {
          // Check if message already exists to prevent duplicates
          if (prev.some((m) => m.id === message.id)) {
            console.log(
              `Message with ID ${message.id} already exists, not adding duplicate`
            );
            return prev;
          }

          // Replace any temporary message with the same content if it exists
          const isReplacement = prev.some(
            (m) =>
              m.temporary === true &&
              m.senderId === message.senderId &&
              m.content === message.content
          );

          if (isReplacement) {
            console.log(
              "Replacing temporary message with server-confirmed message"
            );
            return prev
              .filter(
                (m) =>
                  !(
                    m.temporary === true &&
                    m.senderId === message.senderId &&
                    m.content === message.content
                  )
              )
              .concat(message);
          }

          console.log("Adding new message to state:", message);
          return [...prev, message];
        });
      });
    }

    // Set up periodic refresh every 3 seconds regardless of socket connection
    refreshIntervalRef.current = setInterval(() => {
      refreshMessages();
    }, 3000);

    return () => {
      // Only leave socket room if socket is connected
      if (socket && connected) {
        console.log(`Leaving conversation: ${conversationId}`);
        socket.emit("leave-conversation", conversationId);
        socket.off("new-message");
      }

      // Clear the refresh interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [
    socket,
    connected,
    conversationId,
    options.onAccessError,
    refreshMessages,
  ]);

  // Listen for message notifications (when not in a specific conversation)
  useEffect(() => {
    if (!socket || !connected) return;

    socket.on("message-notification", (notification: MessageNotification) => {
      console.log("Message notification received:", notification);
      setNotifications((prev) => [...prev, notification]);
    });

    return () => {
      socket.off("message-notification");
    };
  }, [socket, connected]);

  // Function to send a message
  const sendMessage = useCallback(
    (message: {
      conversationId: string;
      content: string;
      receiverId: string;
    }) => {
      if (!user) {
        console.error("Cannot send message: User not authenticated");
        return false;
      }

      // Create a temporary message ID - will be replaced when saved to the database
      const tempId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Add metadata
      const messageWithMeta = {
        ...message,
        id: tempId, // Temporary ID until server assigns one
        senderId: user.id,
        senderUsername: user.username,
        createdAt: new Date().toISOString(),
        temporary: true, // Mark as temporary until confirmed
      };

      // Add message to local state for immediate display
      setMessages((prevMessages) => [...prevMessages, messageWithMeta]);

      // Try to send via socket if connected
      if (socket && connected) {
        console.log("Sending message via socket:", messageWithMeta);
        socket.emit("private-message", messageWithMeta);
      } else {
        // If socket is not connected, send directly via API
        console.log("Socket not connected, sending message via API directly");
        apiSendMessage(
          message.conversationId,
          message.content,
          message.receiverId
        )
          .then(() => {
            console.log("Message sent successfully via API");
            // Trigger a refresh to get the saved message
            refreshMessages();
          })
          .catch((err) => {
            console.error("Failed to send message via API:", err);
            // Keep track of failed messages to retry later
            failedMessagesRef.current.push(messageWithMeta);
          });
      }

      // Trigger a refresh after a delay to ensure the message is saved
      setTimeout(refreshMessages, 1000);

      return true;
    },
    [socket, connected, user, refreshMessages]
  );

  // Reset messages when changing conversations
  useEffect(() => {
    setMessages([]);
    setAccessError(null);
  }, [conversationId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  return {
    socket,
    connected,
    messages,
    notifications,
    sendMessage,
    accessError,
    refreshMessages,
    lastRefresh,
  };
}
