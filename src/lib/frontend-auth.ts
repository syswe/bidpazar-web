/**
 * Client-side authentication utilities
 * These functions are designed to work in the browser environment
 */

export interface User {
  id: string;
  email?: string;
  username: string;
  name?: string;
  phoneNumber?: string;
  isVerified?: boolean;
  isAdmin?: boolean;
  userType?: 'MEMBER' | 'SELLER';
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
  requireVerification?: boolean;
  userId?: string;
  phoneNumber?: string;
  smsSent?: boolean;
}

// Define app version - this should match the server APP_VERSION
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";

// Define the base path for auth API routes, consistent with api.ts
const AUTH_API_BASE = "/api/auth";

// Remove direct dependency on env.API_URL for client-side flexibility
// console.log("Auth service initialized. API Base:", AUTH_API_BASE);

/**
 * Store authentication data in localStorage and ensure token cookie is set
 */
export const setAuth = (token: string, user: User): void => {
  if (typeof window !== "undefined") {
    // Store in localStorage for client-side access
    localStorage.setItem("auth", JSON.stringify({ token, user }));
    console.log(
      `Auth set for user: ${user.username} (token length: ${token.length})`
    );

    // Ensure token is available in cookies too (for API requests)
    // This is a backup for cases where the server might not have set it
    document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
  }
};

/**
 * Get authentication data from localStorage with fallback to cookies
 */
export const getAuth = (): { token: string | null; user: User | null } => {
  if (typeof window !== "undefined") {
    try {
      // First check localStorage
      const authData = localStorage.getItem("auth");

      if (authData) {
        try {
          const parsed = JSON.parse(authData);

          // Validate the parsed data structure
          if (parsed && parsed.token && parsed.user && parsed.user.id) {
            return { token: parsed.token, user: parsed.user };
          }
        } catch (error) {
          console.error("Failed to parse auth data from localStorage:", error);
          // Clear invalid data
          localStorage.removeItem("auth");
        }
      }

      // Fallback: Check for token in cookies if localStorage failed
      const tokenFromCookie = getCookieValue("token");
      if (tokenFromCookie) {
        // We have a token but no user data, try to get user data from API
        console.log(
          "Found token in cookie but not in localStorage, will attempt to validate"
        );
        // The AuthProvider will handle fetching user info via validateToken
        return { token: tokenFromCookie, user: null };
      }
    } catch (e) {
      console.error("Error accessing authentication storage:", e);
    }
  }

  return { token: null, user: null };
};

/**
 * Get JWT token from storage (localStorage or cookie)
 */
export const getToken = (): string | null => {
  // First try localStorage
  const { token } = getAuth();
  if (token) return token;

  // Fallback to cookies
  if (typeof window !== "undefined") {
    return getCookieValue("token");
  }

  return null;
};

/**
 * Helper to get a cookie value by name
 */
function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

/**
 * Get user data from localStorage
 */
export const getUser = (): User | null => {
  const { user } = getAuth();
  return user;
};

/**
 * Remove authentication data from localStorage and cookies
 */
export const removeAuth = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth");
    // Also clear the cookie
    document.cookie = "token=; path=/; max-age=0";
    console.log("Auth removed from storage and cookies");
  }
};

/**
 * Check if the user is authenticated (has a token)
 * Note: This only checks for token presence, not validity.
 * Use validateToken() for full validation.
 */
export const isAuthenticated = (): boolean => {
  const token = getToken();
  return !!token;
};

/**
 * Refresh the auth token
 */
// Add rate limiting to token refresh
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 10000; // 10 seconds between refresh attempts

export const refreshToken = async (): Promise<boolean> => {
  const currentToken = getToken();

  if (!currentToken) {
    console.warn("No token to refresh");
    return false;
  }

  // Check if we've refreshed recently and prevent too many refreshes
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_COOLDOWN) {
    console.log(
      `Token refresh on cooldown. Last refresh was ${
        (now - lastRefreshTime) / 1000
      }s ago.`
    );
    return false;
  }

  try {
    console.log("Attempting to refresh token...");
    lastRefreshTime = now; // Update timestamp before the request

    const response = await fetch(
      `${AUTH_API_BASE}/refresh-token?appVersion=${APP_VERSION}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      console.error(`Token refresh failed with status: ${response.status}`);
      // Check for version mismatch (status 412 = Precondition Failed)
      if (response.status === 412) {
        console.warn("App version changed, removing auth data");
        removeAuth();
      } else if (response.status === 401 || response.status === 403) {
        // Token is invalid or expired and cannot be refreshed
        removeAuth();
      }
      return false;
    }

    const data = await response.json();
    console.log("Token refreshed successfully");

    // Update stored token
    const currentAuth = getAuth();
    if (currentAuth.user) {
      setAuth(data.token, data.user || currentAuth.user);
    }

    return true;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return false;
  }
};

/**
 * Add authorization header to fetch options
 */
export const withAuthHeader = (options: RequestInit = {}): RequestInit => {
  const token = getToken();

  if (!token) {
    return options;
  }

  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  };
};

/**
 * Register a new user
 */
export const register = async (
  email: string,
  password: string,
  username: string,
  name?: string,
  phoneNumber?: string
): Promise<AuthResponse> => {
  try {
    console.log(
      `Sending registration request to ${AUTH_API_BASE}/register with data:`,
      {
        email,
        username,
        password: "********",
        name,
        phoneNumber,
      }
    );

    const response = await fetch(`${AUTH_API_BASE}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, username, name, phoneNumber }),
      credentials: "include",
    });

    const data = await response.json();
    console.log(
      "Registration response status:",
      response.status,
      "data:",
      data
    );

    if (!response.ok) {
      // Check if there are detailed validation errors
      if (data.details && Array.isArray(data.details)) {
        // Create a more detailed error message from Zod validation errors
        const errorFields = data.details
          .map((err: any) => {
            const field = err.path.join(".");
            const message = err.message;

            // Create more user-friendly field names
            let fieldName = field;
            if (field === "email") fieldName = "E-posta";
            if (field === "username") fieldName = "Kullanıcı adı";
            if (field === "password") fieldName = "Şifre";
            if (field === "name") fieldName = "Ad Soyad";
            if (field === "phoneNumber") fieldName = "Telefon numarası";

            return `${fieldName}: ${message}`;
          })
          .join(", ");

        throw new Error(`Validation error: ${errorFields}`);
      }

      throw new Error(data.error || data.message || "Registration failed");
    }

    // If the user doesn't require verification, store auth data
    if (!data.requireVerification) {
      setAuth(data.token, data.user);
    }

    return data;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
};

/**
 * Login a user
 */
export const login = async (
  emailOrUsername: string,
  password: string
): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${AUTH_API_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emailOrUsername, password }),
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    // Only store auth data in localStorage if the user doesn't require verification
    if (!data.requireVerification) {
      setAuth(data.token, data.user);
    }

    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

/**
 * Logout a user
 */
export const logout = async (): Promise<void> => {
  // Try to call logout endpoint if we have a token
  const token = getToken();
  if (token) {
    fetch(`${AUTH_API_BASE}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    }).catch((error) => {
      console.error("Logout API call failed:", error);
    });
  }
  // Always remove local auth data
  removeAuth();
  if (typeof window !== "undefined") {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  }
};

/**
 * Validate token with the backend
 * This is the primary way to check if a token is still valid
 */
// Add a better rate limiting to token validation
let lastValidationTime = 0;
const VALIDATION_COOLDOWN = 300; // Reduced cooldown when checking admin routes (300ms instead of 1000ms)
let adminRouteChecking = false; // Flag to identify when validating for admin routes

export const validateToken = async (
  forceCheck = false
): Promise<User | null> => {
  const now = Date.now();
  const state = getAuth();
  const token = state.token;

  if (!token) {
    console.log("[validateToken] No token found in storage");
    return null;
  }

  // Detect if we're validating from an admin route
  if (
    typeof window !== "undefined" &&
    window.location.pathname?.includes("/admin")
  ) {
    adminRouteChecking = true;
  }

  // Skip validation if we've checked recently (unless forced)
  if (!forceCheck && lastValidationTime && now - lastValidationTime < 60000) {
    console.log(
      `[validateToken] Skipping validation - last check was ${
        (now - lastValidationTime) / 1000
      } seconds ago`
    );
    return getUser(); // Return cached user
  }

  // Add timestamp to prevent cached responses
  const timestamp = now;

  try {
    console.log(
      `[validateToken] Validating token with backend (admin route: ${
        adminRouteChecking ? "yes" : "no"
      }, force: ${forceCheck ? "yes" : "no"})`
    );
    lastValidationTime = now; // Update timestamp before the request

    const response = await fetch(
      `${AUTH_API_BASE}/validate?_=${timestamp}&appVersion=${APP_VERSION}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      console.error(
        `[validateToken] Token validation failed with status: ${response.status}`
      );

      // Check for version mismatch (status 412 = Precondition Failed)
      if (response.status === 412) {
        console.warn("[validateToken] App version changed, removing auth data");
        removeAuth();
        return null;
      }

      // Handle database connection issues (status 503 = Service Unavailable)
      if (response.status === 503) {
        try {
          const errorData = await response.json();
          if (errorData.code === "DB_UNAVAILABLE" && errorData.temporary) {
            console.warn(
              "[validateToken] Database unavailable (temporary error), keeping current auth state"
            );
            return getUser(); // Return cached user to allow continued app usage
          }
        } catch (e) {
          // If response parsing fails, continue with normal error handling
          console.error("[validateToken] Error parsing 503 response:", e);
        }
      }

      // If specifically unauthorized (401) or forbidden (403), try refresh
      if (response.status === 401 || response.status === 403) {
        console.warn("[validateToken] Token invalid, attempting refresh");
        const refreshed = await refreshToken();
        if (refreshed) {
          console.log(
            "[validateToken] Token refreshed, trying validation again"
          );
          // Try validation again with new token
          adminRouteChecking = false; // Reset flag to prevent double-detection
          return validateToken(true); // Force check after refresh
        }

        console.warn("[validateToken] Token refresh failed, removing auth");
        removeAuth();
      }
      return null;
    }

    const data = await response.json();
    console.log("[validateToken] Token validated successfully, response:", {
      user: data.user
        ? {
            id: data.user.id,
            username: data.user.username,
            isAdmin: data.user.isAdmin,
          }
        : null,
    });

    // Update user data and token in case they changed
    if (data.user && data.token) {
      console.log(
        "[validateToken] Updating stored auth data with validation response",
        {
          tokenLength: data.token.length,
          userId: data.user.id,
          username: data.user.username,
        }
      );

      // Update both localStorage and cookies
      setAuth(data.token, data.user);
    } else if (data.user) {
      // Update just the user data if no new token provided
      const currentAuth = getAuth();
      if (currentAuth.token) {
        console.log(
          "[validateToken] Updating only user data (no new token provided)"
        );
        setAuth(currentAuth.token, data.user);
      }
    }

    // Reset admin route flag after successful validation
    if (adminRouteChecking) {
      setTimeout(() => {
        console.log("[validateToken] Resetting admin route flag");
        adminRouteChecking = false;
      }, 1000);
    }

    return data.user;
  } catch (error: unknown) {
    console.error("[validateToken] Token validation error:", error);

    // Don't try refresh immediately on general errors
    // This helps prevent cascading errors
    console.warn(
      "[validateToken] Authentication validation error, keeping current state"
    );
    return getUser();
  }
};

/**
 * Verify SMS code
 */
export const verifyCode = async (
  code: string,
  userId: string
): Promise<AuthResponse> => {
  try {
    console.log(
      `Sending verification request to ${AUTH_API_BASE}/verify with data:`,
      {
        code,
        userId,
        isRegistration: false,
      }
    );

    const response = await fetch(`${AUTH_API_BASE}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, userId, isRegistration: false }),
      credentials: "include",
    });

    const data = await response.json();
    console.log(
      "Verification response status:",
      response.status,
      "data:",
      data
    );

    if (!response.ok) {
      throw new Error(data.message || "Verification failed");
    }

    // Make sure we have valid data before storing
    if (!data.token) {
      console.error("Missing token in verification response", data);
      throw new Error("Server returned an invalid response. Please try again.");
    }

    if (!data.user || !data.user.id) {
      console.error(
        "Missing or invalid user data in verification response",
        data
      );
      throw new Error("Server returned invalid user data. Please try again.");
    }

    // Store auth data in localStorage
    setAuth(data.token, data.user);

    return data;
  } catch (error) {
    console.error("Verification error:", error);
    throw error;
  }
};

/**
 * Resend verification code
 */
export const resendVerificationCode = async (
  userId: string
): Promise<{ message: string; smsSent?: boolean }> => {
  try {
    console.log(
      `Sending resend verification request to ${AUTH_API_BASE}/resend-verification with data:`,
      {
        userId,
        isRegistration: false,
      }
    );

    const response = await fetch(`${AUTH_API_BASE}/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, isRegistration: false }),
    });

    const data = await response.json();
    console.log(
      "Resend verification response status:",
      response.status,
      "data:",
      data
    );

    if (!response.ok) {
      throw new Error(data.message || "Failed to resend verification code");
    }

    return data;
  } catch (error) {
    console.error("Resend verification error:", error);
    throw error;
  }
};

/**
 * Delete user account
 */
export const deleteAccount = async (): Promise<{ message: string }> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Hesap silmek için giriş yapmalısınız');
  }

  try {
    console.log('Sending delete account request...');

    const response = await fetch(`${AUTH_API_BASE}/delete-account`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Hesap silinirken bir hata oluştu');
    }

    // Clear auth data after successful deletion
    removeAuth();
    console.log('Account deleted successfully and auth data cleared');

    return data;
  } catch (error) {
    console.error('Delete account error:', error);
    throw error;
  }
};

/**
 * Check if a session is still valid and refresh if needed
 * Call this on app initialization or when loading protected pages
 */
export const initializeAuth = async (): Promise<User | null> => {
  console.log("Initializing auth...");
  // First check if we have a stored token
  const token = getToken();

  if (!token) {
    console.log("No token found during initialization");
    return null;
  }

  console.log("Found token during initialization");

  // Always validate the token with the backend during initialization
  console.log("Validating token during initialization");
  return validateToken();
};
