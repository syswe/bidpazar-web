import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { isLikelyLoopbackConnection } from '../utils/loopbackUtils';

export interface LogItem {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  data?: any;
}

export interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastError: string | null;
  isLoopback: boolean;
  optimizedForLoopback: boolean;
}

/**
 * Hook for managing stream-related logging and connection state
 * 
 * Provides consistent logging, error tracking, and debugging tools
 * for live streams, with special handling for loopback connections
 */
export function useStreamLogging(streamId: string) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: false,
    lastError: null,
    isLoopback: false,
    optimizedForLoopback: false
  });
  
  // Limit log history size for performance
  const MAX_LOGS = 500;
  
  // Counters for error types to detect patterns
  const errorCountsRef = useRef<Record<string, number>>({});
  
  // Debug mode for verbose logging
  const [debugMode, setDebugMode] = useState(false);
  
  // Optimize loopback connections automatically
  const [optimizedForLoopback, setOptimizedForLoopback] = useState(false);
  
  // Check if this is a loopback connection on mount
  useEffect(() => {
    const isLoopback = isLikelyLoopbackConnection();
    setConnectionState(prev => ({
      ...prev,
      isLoopback
    }));
    
    // Auto-optimize for loopback connections
    if (isLoopback) {
      setOptimizedForLoopback(true);
    }
    
    // Log initialization
    logMessage(`Stream logging initialized for stream: ${streamId}`, 'info', {
      isLoopback,
      optimizedForLoopback: isLoopback // Auto-optimize for loopback
    });
  }, [streamId]);

  /**
   * Log a message with timestamp and metadata
   */
  const logMessage = useCallback(
    (
      message: string,
      level: 'info' | 'warn' | 'error' | 'debug' = 'info',
      data?: any
    ) => {
      // Skip debug messages unless debug mode is enabled
      if (level === 'debug' && !debugMode) {
        return;
      }
      
      const timestamp = new Date().toISOString();
      
      // Format console output
      const formattedLevel = level.toUpperCase().padEnd(5, ' ');
      const formattedMessage = `${timestamp} [LiveStreamPage] [${formattedLevel}] ${message}`;
      
      // Create formatted data for better readability
      let formattedData: string | undefined;
      if (data !== undefined) {
        try {
          if (typeof data === 'object') {
            // Hide sensitive data
            const sanitizedData = { ...data };
            if (sanitizedData.token) sanitizedData.token = '[REDACTED]';
            if (sanitizedData.password) sanitizedData.password = '[REDACTED]';
            
            formattedData = JSON.stringify(sanitizedData, null, 2);
          } else {
            formattedData = String(data);
          }
        } catch (e) {
          formattedData = '[Unserializable data]';
        }
      }
      
      // Log to console with appropriate styling
      switch (level) {
        case 'error':
          console.error(formattedMessage, formattedData ? formattedData : '');
          break;
        case 'warn':
          console.warn(formattedMessage, formattedData ? formattedData : '');
          break;
        case 'debug':
          console.debug(formattedMessage, formattedData ? formattedData : '');
          break;
        case 'info':
        default:
          console.log(formattedMessage, formattedData ? formattedData : '');
      }
      
      // Update logs state, keeping a limited history
      setLogs(prevLogs => {
        const newLog: LogItem = { timestamp, message, level, data };
        return [newLog, ...prevLogs].slice(0, MAX_LOGS);
      });
      
      // Track error counts for pattern detection
      if (level === 'error') {
        const errorType = (data && data.type) || 'unknown';
        errorCountsRef.current[errorType] = (errorCountsRef.current[errorType] || 0) + 1;
        
        // Detect if we're having repeated errors of the same type
        if (errorCountsRef.current[errorType] >= 3) {
          // Log the error pattern detection
          console.warn(`Detected repeated "${errorType}" errors (${errorCountsRef.current[errorType]} occurrences)`);
        }
      }
    },
    [debugMode]
  );

  /**
   * Handle WebRTC connection errors
   */
  const handleConnectionError = useCallback(
    (error: {
      type: string;
      message: string;
      canReconnect: boolean;
      isLoopback?: boolean;
      canCreateNewStream?: boolean;
      details?: any;
    }) => {
      logMessage(`Connection error: ${error.type} - ${error.message}`, 'error', error.details);
      
      // Update connection state
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        lastError: error.message,
        isLoopback: error.isLoopback || prev.isLoopback
      }));
      
      // Show toast only for critical errors
      if (!error.canReconnect) {
        toast.error(`Connection error: ${error.message}`);
      }
      
      // Special handling for loopback detection
      if (error.isLoopback) {
        handleLoopbackDetected(true);
      }
      
      // Track error in pattern detection
      errorCountsRef.current[error.type] = (errorCountsRef.current[error.type] || 0) + 1;
    },
    [logMessage]
  );

  /**
   * Handle loopback connection detection
   */
  const handleLoopbackDetected = useCallback(
    (isLoopback: boolean) => {
      if (isLoopback) {
        logMessage('Loopback connection detected, optimizing settings', 'warn');
        
        // Update connection state
        setConnectionState(prev => ({
          ...prev,
          isLoopback: true
        }));
        
        // Automatically optimize for loopback
        setOptimizedForLoopback(true);
      }
    },
    [logMessage]
  );

  /**
   * Toggle debug mode
   */
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => {
      const newMode = !prev;
      logMessage(`Debug mode ${newMode ? 'enabled' : 'disabled'}`, 'info');
      return newMode;
    });
  }, [logMessage]);

  /**
   * Clear logs
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
    logMessage('Logs cleared', 'info');
  }, [logMessage]);

  return {
    logs,
    logMessage,
    clearLogs,
    connectionState,
    handleConnectionError,
    handleLoopbackDetected,
    debugMode,
    toggleDebugMode,
    optimizedForLoopback
  };
} 