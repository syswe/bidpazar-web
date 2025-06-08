import { fetcher } from "./client";
import type { Conversation, Message } from "./types";

/**
 * Messages API Module
 */

export const getUserConversations = async (): Promise<Conversation[]> => {
  try {
    console.log("Fetching user conversations...");
    const result = await fetcher<Conversation[]>(`messages/conversations`, {
      requireAuth: true,
      returnEmptyOnError: true,
      defaultValue: [],
    });
    console.log("Fetched conversations result:", result);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
};

export const getConversationMessages = async (
  conversationId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ messages: Message[]; totalCount: number }> => {
  return fetcher<{ messages: Message[]; totalCount: number }>(
    `messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
    { requireAuth: true }
  );
};

export const getOrCreateConversation = async (
  otherUserId: string
): Promise<Conversation> => {
  try {
    console.log(
      `Attempting to get or create conversation with user: ${otherUserId}`
    );

    // Validate the otherUserId format before making the request
    if (
      !otherUserId ||
      typeof otherUserId !== "string" ||
      otherUserId.trim() === ""
    ) {
      throw new Error("Invalid user ID provided");
    }

    // Check if this is a UUID (most likely a user ID) or a username
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        otherUserId
      ) || /^c[a-z0-9]{20,30}$/i.test(otherUserId); // Handle Cuid format as well

    if (isUuid) {
      // First, try to find if the user exists with this ID
      try {
        // Make a lightweight call to check if user exists by ID
        await fetcher<{ exists: boolean }>(`users/exists/${otherUserId}`, {
          requireAuth: true,
        });
      } catch (userError: any) {
        if (userError.status === 404) {
          console.error(`User with ID ${otherUserId} does not exist`);
          throw new Error(
            `User not found: The user you're trying to message doesn't exist or has been deleted`
          );
        }
        // For other errors, continue and try the conversation endpoint
      }

      // If we get here, attempt to get or create the conversation by user ID
      const conversation = await fetcher<Conversation>(
        `messages/conversations/${otherUserId}`,
        {
          requireAuth: true,
        }
      );

      console.log(
        `Successfully fetched or created conversation: ${conversation.id}`
      );
      return conversation;
    } else {
      // This might be a username, try to find the user by username first
      try {
        const userResponse = await fetcher<{
          exists: boolean;
          user: { id: string; username: string; name?: string };
        }>(`users/exists`, {
          method: "POST",
          body: { username: otherUserId },
          requireAuth: true,
        });

        if (userResponse.exists && userResponse.user) {
          // Now we have the user ID, get or create conversation
          const conversation = await fetcher<Conversation>(
            `messages/conversations/${userResponse.user.id}`,
            {
              requireAuth: true,
            }
          );

          console.log(
            `Successfully fetched or created conversation with username ${otherUserId}: ${conversation.id}`
          );
          return conversation;
        }
      } catch (usernameError: any) {
        if (usernameError.status === 404) {
          console.error(`User with username ${otherUserId} does not exist`);
          throw new Error(
            `User not found: The user you're trying to message doesn't exist`
          );
        }
        // For other errors, try the conversation endpoint directly
      }

      // As a fallback, try the conversation endpoint directly
      const conversation = await fetcher<Conversation>(
        `messages/conversations/${otherUserId}`,
        {
          requireAuth: true,
        }
      );
      return conversation;
    }
  } catch (error: any) {
    // Improve error handling with more specific messages
    if (error.status === 404) {
      console.error(
        `Failed to create conversation with user ${otherUserId}: User not found`
      );
      throw new Error(`Could not create conversation: User not found`);
    } else if (error.status === 403) {
      console.error(`Access denied to conversation with user ${otherUserId}`);
      throw new Error(`You don't have permission to access this conversation`);
    } else {
      console.error(
        `Failed to get or create conversation with user ${otherUserId}:`,
        error
      );
      throw error;
    }
  }
};

export const getConversationDetails = async (
  conversationId: string
): Promise<Conversation> => {
  return fetcher<Conversation>(
    `messages/conversations/details/${conversationId}`,
    { requireAuth: true }
  );
};

export const sendMessage = async (
  conversationId: string,
  content: string,
  receiverId: string
): Promise<Message> => {
  return fetcher<Message>("messages/messages", {
    method: "POST",
    body: { conversationId, content, receiverId },
    requireAuth: true,
  });
}; 