import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/components/AuthProvider";

interface Message {
  id: string;
  senderId: string;
  senderUsername: string;
  receiverId: string;
  content: string;
  conversationId: string;
  createdAt: string;
}

interface MessageNotification {
  senderId: string;
  senderUsername: string;
  conversationId: string;
  content: string;
  createdAt: string;
}

export function useMessageSocket(conversationId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<MessageNotification[]>([]);
  const { user } = useAuth();

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
      },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketIo.on("connect", () => {
      console.log("Socket connected:", socketIo.id);
      setConnected(true);
    });

    socketIo.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    socketIo.on("error", (error) => {
      console.error("Socket error:", error);
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, [user?.id, user?.username]);

  // Join conversation room when conversationId changes
  useEffect(() => {
    if (!socket || !connected || !conversationId) return;

    console.log(`Joining conversation: ${conversationId}`);
    socket.emit("join-conversation", conversationId);

    // Listen for new messages in this conversation
    socket.on("new-message", (message: Message) => {
      console.log("New message received:", message);
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      console.log(`Leaving conversation: ${conversationId}`);
      socket.emit("leave-conversation", conversationId);
      socket.off("new-message");
    };
  }, [socket, connected, conversationId]);

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
      if (!socket || !connected || !user) {
        console.error(
          "Cannot send message: Socket not connected or user not authenticated"
        );
        return false;
      }

      // Add metadata
      const messageWithMeta = {
        ...message,
        id: Math.random().toString(36).substring(2, 15), // Temporary ID until server assigns one
        senderId: user.id,
        createdAt: new Date().toISOString(),
      };

      console.log("Sending message:", messageWithMeta);
      socket.emit("private-message", messageWithMeta);
      return true;
    },
    [socket, connected, user]
  );

  // Reset messages when changing conversations
  useEffect(() => {
    setMessages([]);
  }, [conversationId]);

  return {
    socket,
    connected,
    messages,
    notifications,
    sendMessage,
  };
}
