'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, setAuth, removeAuth } from '@/lib/auth';

type User = {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  isAdmin?: boolean;
  name?: string;
};

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshToken: () => string | null;
}

// Create context with default values to avoid the undefined check
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  login: () => { },
  logout: () => { },
  refreshToken: () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on client side only
  useEffect(() => {
    try {
      const { token: storedToken, user: storedUser } = getAuth();
      if (storedToken && storedUser) {
        setIsAuthenticated(true);
        setUser(storedUser);
        setToken(storedToken);
        console.log("Auth initialized from localStorage");
      } else {
        console.warn("Auth data found but token or user is missing");
      }
    } catch (error) {
      console.error('Failed to parse stored auth data:', error);
      removeAuth();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (authToken: string, authUser: User): void => {
    setIsAuthenticated(true);
    setUser(authUser);
    setToken(authToken);

    // Store auth data in localStorage using the updated auth module
    try {
      setAuth(authToken, authUser);
      console.log("Auth data stored in localStorage");
    } catch (error) {
      console.error('Failed to store auth data:', error);
    }
  };

  const logout = () => {
    try {
      removeAuth();
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Function to get the latest token, useful for socket connections
  const refreshToken = (): string | null => {
    try {
      const { token: freshToken } = getAuth();
      if (freshToken && freshToken !== token) {
        setToken(freshToken);
      }
      return freshToken;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return token;
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, token, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 