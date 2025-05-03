'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
   import { getUser, isAuthenticated, initializeAuth, removeAuth, User, validateToken } from '../lib/frontend-auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  setUser: (user: User | null) => void;
  refreshAuthState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isLoggedIn: false,
  isAuthenticated: false,
  logout: () => {},
  setUser: () => {},
  refreshAuthState: async () => {},
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
      // Call validateToken directly to verify with the backend
      const userData = await validateToken();
      setUser(userData);
    } catch (error) {
      console.error('Auth validation error:', error);
      setUser(null);
      // If validation fails, remove auth data
      removeAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Remove auth data from localStorage
    removeAuth();
    // Update state
    setUser(null);
  };

  useEffect(() => {
    // Check for existing authentication on component mount
    const checkAuth = async () => {
      try {
        // Get user from localStorage first for immediate UI update
        const storedUser = getUser();
        if (storedUser) {
          setUser(storedUser);
          
          // Then validate with the server
          await refreshAuthState();
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        // If validation fails, remove auth data
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 