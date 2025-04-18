interface User {
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

import env from "./env";

// Use the API_URL from our env utility
const API_URL = env.API_URL;

// Store auth data in localStorage (using a single key for both token and user)
export const setAuth = (token: string, user: User): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth", JSON.stringify({ token, user }));
  }
};

// Get auth data from localStorage
export const getAuth = (): { token: string | null; user: User | null } => {
  if (typeof window !== "undefined") {
    const authData = localStorage.getItem("auth");
    if (authData) {
      try {
        return JSON.parse(authData);
      } catch (error) {
        console.error("Failed to parse auth data:", error);
        localStorage.removeItem("auth");
      }
    }
  }
  return { token: null, user: null };
};

// Get token from localStorage (for compatibility with existing code)
export const getToken = (): string | null => {
  const { token } = getAuth();
  return token;
};

// Get user from localStorage (for compatibility with existing code)
export const getUser = (): User | null => {
  const { user } = getAuth();
  return user;
};

// Remove auth data from localStorage
export const removeAuth = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth");
  }
};

// Register a new user
export const register = async (
  email: string,
  password: string,
  username: string,
  name?: string,
  phoneNumber?: string
): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, username, name, phoneNumber }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Registration failed");
  }

  return data;
};

// Login a user
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
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    // Only store auth data in localStorage if the user doesn't require verification
    if (!data.requireVerification) {
      setAuth(data.token, data.user);
    } else {
      console.log("User requires verification, not storing credentials yet");
    }

    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// Logout a user
export const logout = (): void => {
  removeAuth();
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// Validate token with the backend
export const validateToken = async (): Promise<User | null> => {
  const token = getToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/auth/validate`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      removeAuth();
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error: unknown) {
    console.error("Token validation error:", error);
    removeAuth();
    return null;
  }
};

// Verify SMS code
export const verifyCode = async (
  code: string,
  userId: string
): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/auth/verify-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, userId, isRegistration: false }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Verification failed");
  }

  // Store auth data in localStorage
  setAuth(data.token, data.user);

  return data;
};

// Resend verification code
export const resendVerificationCode = async (
  userId: string
): Promise<{ message: string }> => {
  const response = await fetch(`${API_URL}/auth/resend-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, isRegistration: false }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to resend verification code");
  }

  return data;
};
