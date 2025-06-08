import { fetcher, fetcherAuth, handleApiError } from "./client";
import type { User, WonAuction, Order } from "./types";

/**
 * Users API Module
 */

export const getAllUsers = async (): Promise<User[]> => {
  const response = await fetcher<{ users: User[]; pagination: any }>(`users`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: {
      users: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    },
  });

  // Return just the users array to maintain backward compatibility
  return response.users;
};

export const getUserById = async (id: string): Promise<User> => {
  return fetcher<User>(`users/${id}`, { requireAuth: true });
};

export const createUser = async (userData: {
  username: string;
  email: string;
  name?: string;
  password: string;
  isAdmin?: boolean;
}): Promise<User> => {
  return fetcher<User>(`users`, {
    method: "POST",
    body: userData,
    requireAuth: true,
  });
};

export const resetUserPassword = async (
  userId: string,
  newPassword: string
): Promise<{ success: boolean }> => {
  return fetcher<{ success: boolean }>(`users/${userId}/reset-password`, {
    method: "POST",
    body: { password: newPassword },
    requireAuth: true,
  });
};

export const updateUser = async (
  id: string,
  data: {
    name?: string;
    email?: string;
    username?: string;
    phoneNumber?: string;
    isVerified?: boolean;
    isAdmin?: boolean;
  }
): Promise<User> => {
  return fetcher<User>(`users/${id}`, {
    method: "PUT",
    body: data,
    requireAuth: true,
  });
};

export const deleteUser = async (id: string): Promise<void> => {
  return fetcher<void>(`users/${id}`, {
    method: "DELETE",
    requireAuth: true,
  });
};

export const makeAdmin = async (id: string): Promise<User> => {
  return fetcher<User>(`users/${id}/make-admin`, {
    method: "POST",
    requireAuth: true,
  });
};

export const removeAdmin = async (id: string): Promise<User> => {
  return fetcher<User>(`users/${id}/remove-admin`, {
    method: "POST",
    requireAuth: true,
  });
};

export const findUserByUsername = async (
  username: string
): Promise<User | null> => {
  try {
    // First try to find by username using the new API endpoint
    const userResponse = await fetcher<{
      exists: boolean;
      user?: {
        id: string;
        username: string;
        name?: string;
      };
    }>(`users/exists`, {
      method: "POST",
      body: { username },
      requireAuth: true,
      returnEmptyOnError: true,
    });

    if (userResponse?.exists && userResponse?.user) {
      return userResponse.user as User;
    }

    // Fall back to the old endpoint
    return fetcher<User | null>(`users/byUsername/${username}`, {
      requireAuth: true,
      returnEmptyOnError: true,
      defaultValue: null,
    });
  } catch (error) {
    console.error(`Error finding user by username ${username}:`, error);
    return null;
  }
};

// Helper functions to map statuses
function getAuctionStatus(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Tamamlandı";
    case "ACTIVE":
      return "İşleniyor";
    case "PENDING":
      return "Beklemede";
    case "CANCELLED":
      return "İptal Edildi";
    default:
      return "Beklemede";
  }
}

function getListingStatus(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Tamamlandı";
    case "ACTIVE":
      return "İşleniyor";
    case "COUNTDOWN":
      return "İşleniyor";
    case "PENDING":
      return "Beklemede";
    case "CANCELLED":
      return "İptal Edildi";
    default:
      return "Beklemede";
  }
}

function mapAuctionStatusToOrderStatus(status: string): string {
  switch (status) {
    case "Tamamlandı":
      return "Tamamlandı";
    case "İşleniyor":
      return "Kargoda";
    case "Beklemede":
      return "Beklemede";
    case "İptal Edildi":
      return "İptal Edildi";
    default:
      return "Beklemede";
  }
}

// Get user's won auctions (both types)
export async function getUserWonAuctions(): Promise<WonAuction[]> {
  try {
    // Fetch both types of auctions the user has won
    const [productAuctions, livestreamAuctions] = await Promise.all([
      fetcherAuth("/api/auctions/won"),
      fetcherAuth("/api/listings/won"),
    ]);

    // Process regular auctions
    const processedProductAuctions = productAuctions.map((auction: any) => ({
      id: auction.id,
      auctionId: auction.id,
      productId: auction.product.id,
      productName: auction.product.title,
      productImage:
        auction.product.media?.[0]?.url || "https://via.placeholder.com/150",
      winDate: new Date(auction.updatedAt).toISOString(),
      winningBid: auction.currentPrice,
      status: getAuctionStatus(auction.status),
      seller: {
        id: auction.product.userId,
        name:
          auction.product.user?.name ||
          auction.product.user?.username ||
          "Satıcı",
        username: auction.product.user?.username || "user",
      },
      isPaid: auction.isPaid || false,
      isLiveStream: false,
    }));

    // Process livestream auctions
    const processedLivestreamAuctions = livestreamAuctions.map(
      (listing: any) => ({
        id: listing.id,
        auctionId: listing.id,
        productId: listing.product.id,
        productName: listing.product.title,
        productImage:
          listing.product.media?.[0]?.url || "https://via.placeholder.com/150",
        winDate: new Date(listing.updatedAt).toISOString(),
        winningBid: listing.winningBid?.amount || listing.startPrice,
        status: getListingStatus(listing.status),
        seller: {
          id: listing.product.userId,
          name:
            listing.product.user?.name ||
            listing.product.user?.username ||
            "Satıcı",
          username: listing.product.user?.username || "user",
        },
        isPaid: listing.isPaid || false,
        isLiveStream: true,
        streamId: listing.liveStreamId,
      })
    );

    // Combine both types and sort by win date (newest first)
    return [...processedProductAuctions, ...processedLivestreamAuctions].sort(
      (a, b) => new Date(b.winDate).getTime() - new Date(a.winDate).getTime()
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// Get user's orders
export async function getUserOrders(): Promise<Order[]> {
  try {
    // Since we don't have a dedicated Orders table, we'll use winning bids as orders
    const wonAuctions = await getUserWonAuctions();

    // Transform won auctions into orders format
    return wonAuctions
      .filter((auction) => auction.isPaid) // Only paid auctions are considered orders
      .map((auction, index) => ({
        id: auction.id,
        orderNumber: `BP-${new Date().getFullYear()}-${String(
          index + 1
        ).padStart(3, "0")}`,
        date: auction.winDate,
        total: auction.winningBid,
        status: mapAuctionStatusToOrderStatus(auction.status),
        items: [
          {
            id: auction.productId,
            name: auction.productName,
            quantity: 1,
            price: auction.winningBid,
            imageUrl: auction.productImage,
          },
        ],
      }));
  } catch (error) {
    return handleApiError(error);
  }
} 