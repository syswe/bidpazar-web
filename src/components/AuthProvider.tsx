'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
   import { getUser, isAuthenticated, initializeAuth, removeAuth, User, validateToken, setAuth } from '../lib/frontend-auth';

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
        console.log('[AuthProvider] Checking authentication state...');
        // Get user from localStorage first for immediate UI update
        const storedUser = getUser();
        if (storedUser) {
          console.log('[AuthProvider] Found user in localStorage:', storedUser);
          setUser(storedUser);
          // Then validate with the server
          await refreshAuthState();
        } else {
          console.log('[AuthProvider] No user in localStorage, trying to hydrate from cookie via /api/auth/validate');
          try {
            const timestamp = new Date().getTime();
            const res = await fetch(`/api/auth/validate?_=${timestamp}`, {
              credentials: 'include', // Add credentials to ensure cookie is sent
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            
            if (res.ok) {
              const { user, token } = await res.json();
              if (user && token) {
                console.log('[AuthProvider] Valid token and user received from API');
                // Store them in localStorage for client-side auth
                setAuth(token, user);
                setUser(user);
                console.log('[AuthProvider] Hydrated user from cookie via /api/auth/validate:', user);
              } else {
                console.warn('[AuthProvider] Missing user or token in successful response');
              }
            } else {
              const errorData = await res.json().catch(() => ({}));
              console.warn('[AuthProvider] Failed to hydrate from cookie. /api/auth/validate response:', res.status, errorData);
            }
          } catch (fetchError) {
            console.error('[AuthProvider] Error fetching validation endpoint:', fetchError);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AuthProvider] Authentication check failed:', error);
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