'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, validateToken, logout } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  phoneNumber?: string;
  isVerified?: boolean;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = getUser();
    if (storedUser) {
      setUser(storedUser);
    }

    // Validate token with the backend
    const checkAuth = async () => {
      try {
        const validatedUser = await validateToken();
        if (validatedUser) {
          setUser(validatedUser);
        } else {
          setUser(null);
        }
      } catch (error: unknown) {
        console.error('Auth validation error:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (token: string, user: User) => {
    if (!user) {
      console.error('Login attempted with null user');
      return;
    }

    console.log('Setting user in AuthProvider:', user);
    setUser(user);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    router.push('/sign-in');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isVerified: user?.isVerified !== false,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 