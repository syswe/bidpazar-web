import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { isLikelyLoopbackConnection } from '../utils/loopbackUtils';

interface UseReconnectionProps {
  streamId: string;
  logMessage: (message: string, level?: string, data?: any) => void;
  fetchStreamDetails?: () => Promise<void>;
  maxAutoReconnects?: number;
  reconnectDelay?: number;
}

/**
 * Hook to manage WebRTC reconnection state and logic
 * 
 * This hook helps handle reconnection attempts when WebRTC connections fail,
 * with configurable retry policies and automatic recovery
 */
export function useReconnection({
  streamId,
  logMessage,
  fetchStreamDetails,
  maxAutoReconnects = 3,
  reconnectDelay = 2000
}: UseReconnectionProps) {
  // State and refs
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [webRtcKey, setWebRtcKey] = useState<string>(uuidv4());
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoReconnectingRef = useRef(false);
  const recoveryAllowedRef = useRef(true);
  const lastErrorTimeRef = useRef<number | null>(null);
  const isLoopbackRef = useRef(isLikelyLoopbackConnection());

  // Error counter to prevent reconnection loops
  const errorsSinceSuccess = useRef(0);
  
  // Clear any pending reconnect timeouts
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Handle initial reconnect request from component
  const handleReconnectRequest = useCallback((error: {
    type: string;
    message: string;
    canReconnect: boolean;
    details?: any;
  }) => {
    logMessage(`Reconnect requested: ${error.type} - ${error.message}`, 'warn', error.details);
    
    // Do not attempt to reconnect if too many errors recently
    if (errorsSinceSuccess.current >= maxAutoReconnects) {
      logMessage(`Too many consecutive errors (${errorsSinceSuccess.current}), preventing auto-reconnect`, 'warn');
      setConnectionError(`Connection failed: ${error.message}. Please try refreshing the page.`);
      return;
    }
    
    setConnectionError(error.message);
    
    // Only auto-reconnect if error type allows it and we're not already reconnecting
    if (error.canReconnect && !isReconnecting && !autoReconnectingRef.current) {
      // Special handling for loopback connections
      if (isLoopbackRef.current) {
        logMessage('Loopback connection detected, modifying reconnection strategy', 'info');
        // Use more aggressive reconnect for loopback
        setReconnectAttempts(prev => prev + 1);
        autoReconnectingRef.current = true;
        
        // Set immediate reconnect for loopback
        reconnectTimeoutRef.current = setTimeout(() => {
          handleReconnect();
        }, 500); // Use shorter delay for loopback
        
        return;
      }
      
      // Standard reconnection flow
      logMessage(`Scheduling reconnect attempt in ${reconnectDelay}ms`, 'info');
      setReconnectAttempts(prev => prev + 1);
      autoReconnectingRef.current = true;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        handleReconnect();
      }, reconnectDelay);
    }
  }, [logMessage, isReconnecting, reconnectDelay, maxAutoReconnects]);

  // Perform the actual reconnection
  const handleReconnect = useCallback(() => {
    if (!recoveryAllowedRef.current) {
      logMessage('Recovery not allowed at this time', 'warn');
      return;
    }
    
    logMessage(`Performing reconnection (attempt ${reconnectAttempts + 1})`, 'info');
    setIsReconnecting(true);
    
    // Generate a new key to force WebRTC component remounting
    setWebRtcKey(uuidv4());
    
    // Update stream details if available
    if (fetchStreamDetails) {
      fetchStreamDetails()
        .then(() => {
          logMessage('Stream details refreshed for reconnection', 'info');
        })
        .catch(err => {
          logMessage('Failed to refresh stream details during reconnection', 'error', err);
        });
    }
    
    // Clear reconnection state after a delay to allow component to remount
    setTimeout(() => {
      setIsReconnecting(false);
      autoReconnectingRef.current = false;
      logMessage('Reconnection process completed', 'info');
      
      // Show toast only for user-initiated reconnects
      if (!autoReconnectingRef.current) {
        toast.success('Reconnection attempt in progress');
      }
    }, 1000);
  }, [reconnectAttempts, logMessage, fetchStreamDetails]);

  // Function to reset connection state (for successful connections)
  const handleConnectionReset = useCallback(() => {
    logMessage('Connection successfully established, resetting reconnection state', 'info');
    setReconnectAttempts(0);
    setConnectionError(null);
    errorsSinceSuccess.current = 0;
    setIsReconnecting(false);
    autoReconnectingRef.current = false;
    clearReconnectTimeout();
  }, [logMessage, clearReconnectTimeout]);
  
  // Function to handle connection success
  const handleConnectionSuccess = useCallback(() => {
    errorsSinceSuccess.current = 0;
    handleConnectionReset();
  }, [handleConnectionReset]);
  
  // Increment error counter when errors occur
  const handleConnectionFailure = useCallback(() => {
    errorsSinceSuccess.current += 1;
    
    // Update last error time
    lastErrorTimeRef.current = Date.now();
    
    logMessage(`Connection failure recorded (${errorsSinceSuccess.current}/${maxAutoReconnects} max)`, 'warn');
  }, [logMessage, maxAutoReconnects]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
    };
  }, [clearReconnectTimeout]);

  // Reset reconnection policy if stream ID changes
  useEffect(() => {
    setWebRtcKey(uuidv4());
    setReconnectAttempts(0);
    setConnectionError(null);
    errorsSinceSuccess.current = 0;
    setIsReconnecting(false);
    autoReconnectingRef.current = false;
    clearReconnectTimeout();
    
    // Check if this is a loopback connection
    isLoopbackRef.current = isLikelyLoopbackConnection();
    
    logMessage(`Stream connection initialized for stream: ${streamId}`, 'info', {
      isLoopback: isLoopbackRef.current
    });
  }, [streamId, logMessage, clearReconnectTimeout]);

  return {
    webRtcKey,
    isReconnecting,
    reconnectAttempts,
    connectionError,
    handleReconnectRequest,
    handleReconnect,
    handleConnectionReset,
    handleConnectionSuccess,
    handleConnectionFailure,
    isLoopback: isLoopbackRef.current
  };
} 