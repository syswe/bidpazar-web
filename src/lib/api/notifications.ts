import { fetcher } from "./client";
import type { Notification } from "./types";

/**
 * Notifications API Module
 */

export const getUserNotifications = async (): Promise<{
  notifications: Notification[];
  unreadCount: number;
}> => {
  try {
    console.log("Fetching user notifications...");
    const result = await fetcher<{
      notifications: Notification[];
      unreadCount: number;
    }>(`notifications`, {
      requireAuth: true,
      returnEmptyOnError: true,
      defaultValue: { notifications: [], unreadCount: 0 },
    });
    console.log("Fetched notifications result:", result);

    // Ensure we have a valid structure
    if (!result || typeof result !== "object") {
      console.error("Invalid notifications result from API:", result);
      return { notifications: [], unreadCount: 0 };
    }

    // Ensure notifications is an array
    const notifications = Array.isArray(result.notifications)
      ? result.notifications
      : [];

    // Ensure unreadCount is a number
    const unreadCount =
      typeof result.unreadCount === "number" ? result.unreadCount : 0;

    return { notifications, unreadCount };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return { notifications: [], unreadCount: 0 };
  }
};

export const markNotificationsAsRead = async (): Promise<{
  success: boolean;
}> => {
  return fetcher<{ success: boolean }>(`notifications/read`, {
    method: "POST",
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: { success: false },
  });
}; 