"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  getUser,
  isAuthenticated,
  initializeAuth,
  removeAuth,
  User,
  validateToken,
  setAuth,
  logout as logoutAuth,
  getToken,
  APP_VERSION,
} from "../lib/frontend-auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshAuthState: () => Promise<void>;
  appVersion: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isLoggedIn: false,
  isAuthenticated: false,
  logout: async () => {},
  setUser: () => {},
  refreshAuthState: async () => {},
  appVersion: APP_VERSION,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuthState = async () => {
    setIsLoading(true);
    try {
      console.log("[AuthProvider] Refreshing auth state...");
      // Get current token to help with debugging
      const currentToken = getToken();
      console.log(
        `[AuthProvider] Current token: ${currentToken ? "Found" : "Missing"} (${
          currentToken ? `length: ${currentToken.length}` : "null"
        })`
      );

      // Call validateToken directly to verify with the backend
      const userData = await validateToken(true); // Force check

      if (userData) {
        console.log(
          "[AuthProvider] Auth validation succeeded, user:",
          userData
        );
        setUser(userData);
      } else {
        console.warn("[AuthProvider] Auth validation returned null user");
        setUser(null);
        // If validation fails, remove auth data
        removeAuth();
      }
    } catch (error) {
      console.error("[AuthProvider] Auth validation error:", error);
      setUser(null);
      // If validation fails, remove auth data
      removeAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    console.log("[AuthProvider] Logging out...");
    // Use the comprehensive logout function from frontend-auth
    await logoutAuth();
    // Update state after logout completed
    setUser(null);
  };

  useEffect(() => {
    // Check for existing authentication on component mount
    const checkAuth = async () => {
      try {
        console.log("[AuthProvider] Checking authentication state...");
        // Get user from localStorage first for immediate UI update
        const storedUser = getUser();
        const token = getToken();

        console.log(
          `[AuthProvider] Initial auth check - Token: ${
            token ? "Found" : "Missing"
          }, User: ${storedUser ? "Found" : "Missing"}`
        );

        if (storedUser && token) {
          console.log(
            "[AuthProvider] Found user and token in storage:",
            storedUser
          );
          setUser(storedUser);
          // Then validate with the server
          await refreshAuthState();
        } else if (token) {
          console.log(
            "[AuthProvider] Found token but no user, attempting to validate with server"
          );
          await refreshAuthState();
        } else {
          console.log(
            "[AuthProvider] No auth in storage, trying to hydrate from cookie via /api/auth/validate"
          );
          try {
            const timestamp = new Date().getTime();
            const res = await fetch(
              `/api/auth/validate?_=${timestamp}&appVersion=${APP_VERSION}`,
              {
                credentials: "include", // Add credentials to ensure cookie is sent
                headers: {
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                  Pragma: "no-cache",
                  Expires: "0",
                },
              }
            );

            if (res.ok) {
              const { user, token } = await res.json();
              if (user && token) {
                console.log(
                  "[AuthProvider] Valid token and user received from API"
                );
                // Store them in localStorage for client-side auth
                setAuth(token, user);
                setUser(user);
                console.log(
                  "[AuthProvider] Hydrated user from cookie via /api/auth/validate:",
                  user
                );
              } else {
                console.warn(
                  "[AuthProvider] Missing user or token in successful response"
                );
                setIsLoading(false);
              }
            } else {
              // Handle version mismatch
              if (res.status === 412) {
                // Precondition Failed = version mismatch
                console.warn(
                  "[AuthProvider] App version mismatch detected, clearing authentication"
                );
                removeAuth();
              }

              const errorData = await res.json().catch(() => ({}));
              console.warn(
                "[AuthProvider] Failed to hydrate from cookie. /api/auth/validate response:",
                res.status,
                errorData
              );
              setIsLoading(false);
            }
          } catch (fetchError) {
            console.error(
              "[AuthProvider] Error fetching validation endpoint:",
              fetchError
            );
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("[AuthProvider] Authentication check failed:", error);
        removeAuth();
        setUser(null);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const value = {
    user,
    isLoading,
    isLoggedIn: !!user,
    isAuthenticated: !!user,
    logout,
    setUser,
    refreshAuthState,
    appVersion: APP_VERSION,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
