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
}

interface AuthResponse {
  token: string;
  user: User;
  message: string;
  requireVerification?: boolean;
  userId?: string;
  phoneNumber?: string;
}

import { env } from "./env";

// Use env.API_URL for all API calls
const API_URL = env.API_URL;

console.log("Auth service initialized with API URL:", API_URL);

/**
 * Store authentication data in localStorage
 */
export const setAuth = (token: string, user: User): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth", JSON.stringify({ token, user }));
    console.log(`Auth set for user: ${user.username}`);
  }
};

/**
 * Get authentication data from localStorage
 */
export const getAuth = (): { token: string | null; user: User | null } => {
  if (typeof window !== "undefined") {
    const authData = localStorage.getItem("auth");
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        return { token: parsed.token, user: parsed.user };
      } catch (error) {
        console.error("Failed to parse auth data:", error);
        localStorage.removeItem("auth");
      }
    }
  }
  return { token: null, user: null };
};

/**
 * Get JWT token from localStorage
 */
export const getToken = (): string | null => {
  const { token } = getAuth();
  return token;
};

/**
 * Get user data from localStorage
 */
export const getUser = (): User | null => {
  const { user } = getAuth();
  return user;
};

/**
 * Remove authentication data from localStorage (logout)
 */
export const removeAuth = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth");
  }
};

/**
 * Check if the user is authenticated (has a token)
 * Note: This only checks for token presence, not validity.
 * Use validateToken() for full validation.
 */
export const isAuthenticated = (): boolean => {
  const { token } = getAuth();
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
    console.log(`Token refresh on cooldown. Last refresh was ${(now - lastRefreshTime)/1000}s ago.`);
    return false;
  }
  
  try {
    console.log("Attempting to refresh token...");
    lastRefreshTime = now; // Update timestamp before the request
    
    const response = await fetch(`${API_URL}/auth/refresh-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentToken}`,
        "Content-Type": "application/json",
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error(`Token refresh failed with status: ${response.status}`);
      if (response.status === 401 || response.status === 403) {
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
    console.log(`Sending registration request to ${API_URL}/auth/register with data:`, {
      email,
      username,
      password: '********',
      name,
      phoneNumber
    });

    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, username, name, phoneNumber }),
      credentials: 'include',
    });

    const data = await response.json();
    console.log('Registration response status:', response.status, 'data:', data);

    if (!response.ok) {
      // Check if there are detailed validation errors
      if (data.details && Array.isArray(data.details)) {
        // Create a more detailed error message from Zod validation errors
        const errorFields = data.details.map((err: any) => {
          const field = err.path.join('.');
          const message = err.message;
          
          // Create more user-friendly field names
          let fieldName = field;
          if (field === 'email') fieldName = 'E-posta';
          if (field === 'username') fieldName = 'Kullanıcı adı';
          if (field === 'password') fieldName = 'Şifre';
          if (field === 'name') fieldName = 'Ad Soyad';
          if (field === 'phoneNumber') fieldName = 'Telefon numarası';
          
          return `${fieldName}: ${message}`;
        }).join(', ');
        
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
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emailOrUsername, password }),
      credentials: 'include',
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
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    }).catch(error => {
      console.error("Logout API call failed:", error);
    });
  }
  // Always remove local auth data
  removeAuth();
  if (typeof window !== 'undefined') {
    await fetch('/api/auth/logout', { 
      method: 'POST',
      credentials: 'include',
    });
  }
};

/**
 * Validate token with the backend
 * This is the primary way to check if a token is still valid
 */
// Add rate limiting to token validation
let lastValidationTime = 0;
const VALIDATION_COOLDOWN = 1000; // 1 second between validation attempts

export const validateToken = async (): Promise<User | null> => {
  const token = getToken();

  if (!token) {
    console.log("No token found in storage");
    return null;
  }

  console.log("Token found in localStorage, length:", token.length);

  // Prevent too frequent validation requests
  const now = Date.now();
  if (now - lastValidationTime < VALIDATION_COOLDOWN) {
    console.log(`Token validation on cooldown. Last validation was ${(now - lastValidationTime)/1000}s ago.`);
    // Return the last cached user data instead of making a new request
    return getUser();
  }

  try {
    // Add a timestamp to prevent caching
    const timestamp = new Date().getTime();
    console.log("Validating token with backend");
    lastValidationTime = now; // Update timestamp before the request
    
    const response = await fetch(`${API_URL}/auth/validate?_=${timestamp}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`Token validation failed with status: ${response.status}`);
      // If specifically unauthorized (401) or forbidden (403), try refresh
      if (response.status === 401 || response.status === 403) {
        console.warn("Token invalid, attempting refresh");
        const refreshed = await refreshToken();
        if (refreshed) {
          console.log("Token refreshed, trying validation again");
          // Try validation again with new token
          return validateToken();
        }
        
        console.warn("Token refresh failed, removing auth");
        removeAuth();
      }
      return null;
    }

    const data = await response.json();
    console.log("Token validated successfully, response:", {
      user: data.user,
      isAdmin: data.user?.isAdmin
    });
    
    // Update user data in case it changed
    const currentAuth = getAuth();
    if (currentAuth.token && data.user) {
      console.log("Updating stored user data with validation response", {
        currentIsAdmin: currentAuth.user?.isAdmin,
        newIsAdmin: data.user.isAdmin
      });
      setAuth(currentAuth.token, data.user);
    }
    
    return data.user;
  } catch (error: unknown) {
    console.error("Token validation error:", error);
    
    // Don't try refresh immediately on general errors
    // This helps prevent cascading errors
    console.warn("Authentication validation error, keeping current state");
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
    console.log(`Sending verification request to ${API_URL}/auth/verify with data:`, {
      code,
      userId,
      isRegistration: false
    });
    
    const response = await fetch(`${API_URL}/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, userId, isRegistration: false }),
      credentials: 'include',
    });

    const data = await response.json();
    console.log('Verification response status:', response.status, 'data:', data);

    if (!response.ok) {
      throw new Error(data.message || "Verification failed");
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
): Promise<{ message: string }> => {
  try {
    console.log(`Sending resend verification request to ${API_URL}/auth/resend-verification with data:`, {
      userId,
      isRegistration: false
    });
    
    const response = await fetch(`${API_URL}/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, isRegistration: false }),
    });

    const data = await response.json();
    console.log('Resend verification response status:', response.status, 'data:', data);

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