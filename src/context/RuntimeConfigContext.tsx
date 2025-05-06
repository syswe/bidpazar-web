'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the shape of the runtime config
interface RuntimeConfig {
  apiUrl: string;
  socketUrl: string;
  appUrl: string;
  webrtcServer: string;
  wsUrl: string;
  turnServerUrl?: string;
  turnUsername?: string;
  turnPassword?: string;
  stunServerUrl?: string;
}

// Define the context shape
interface RuntimeConfigContextProps {
  config: RuntimeConfig | null;
  isLoading: boolean;
}

// Create the context with default values
const RuntimeConfigContext = createContext<RuntimeConfigContextProps>({
  config: null,
  isLoading: true, 
});

// Custom hook to use the context
export const useRuntimeConfig = () => useContext(RuntimeConfigContext);

// Define props for the provider
interface RuntimeConfigProviderProps {
  children: ReactNode;
}

// Create the provider component
export const RuntimeConfigProvider: React.FC<RuntimeConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.statusText}`);
        }
        const data: RuntimeConfig = await response.json();
        if (isMounted) {
          setConfig(data);
          console.log('[RuntimeConfigProvider] Runtime config loaded:', data);
        }
      } catch (error) {
        console.error('[RuntimeConfigProvider] Error fetching runtime config:', error);
        // You might want to set a default/fallback config or handle the error state
        // setConfig(fallbackConfig);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchConfig();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <RuntimeConfigContext.Provider value={{ config, isLoading }}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}; 