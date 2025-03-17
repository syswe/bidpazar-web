interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  phoneNumber?: string;
  isVerified?: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
  message: string;
  requireVerification?: boolean;
  userId?: string;
  phoneNumber?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

// Store token in localStorage (or you could use cookies in production)
export const setToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("bidpazar_token", token);
  }
};

// Get token from localStorage
export const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("bidpazar_token");
  }
  return null;
};

// Remove token from localStorage
export const removeToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("bidpazar_token");
  }
};

// Store user in localStorage
export const setUser = (user: User): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("bidpazar_user", JSON.stringify(user));
  }
};

// Get user from localStorage
export const getUser = (): User | null => {
  if (typeof window !== "undefined") {
    const user = localStorage.getItem("bidpazar_user");
    return user ? JSON.parse(user) : null;
  }
  return null;
};

// Remove user from localStorage
export const removeUser = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("bidpazar_user");
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

    // Only store token and user in localStorage if the user doesn't require verification
    if (!data.requireVerification) {
      setToken(data.token);
      setUser(data.user);
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
  removeToken();
  removeUser();
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
      removeToken();
      removeUser();
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error: unknown) {
    console.error("Token validation error:", error);
    removeToken();
    removeUser();
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

  // Store token and user in localStorage
  setToken(data.token);
  setUser(data.user);

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
