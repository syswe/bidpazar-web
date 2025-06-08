// Promisify Socket.IO events for better async usage
export const socketPromise = (socket: any, event: string, data?: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Set a reasonable timeout for all socket operations
    const timeout = setTimeout(() => {
      reject(new Error(`Socket request timed out after 15000ms: ${event}`));
    }, 15000);
    
    try {
      socket.emit(event, data, (response: any) => {
        clearTimeout(timeout);
        
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
};

// Normalize socket URL to ensure consistent format
export const normalizeSocketIOUrl = (url: string): string => {
  // If it's already a full URL, return it
  if (url.startsWith('http://') || url.startsWith('https://') || 
      url.startsWith('ws://') || url.startsWith('wss://')) {
    return url;
  }
  
  // Handle relative URLs
  if (url.startsWith('/')) {
    const currentProtocol = window.location.protocol;
    const wsProtocol = currentProtocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}${url}`;
  }
  
  // Assume it's a hostname only
  const currentProtocol = window.location.protocol;
  const wsProtocol = currentProtocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url}`;
};

// Add retry mechanism for socket operations with exponential backoff
export const withRetry = async <T>(
  operation: () => Promise<T>,
  retries = 3,
  baseDelay = 1000,
  shouldRetry?: (error: Error) => boolean
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      
      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }
      
      // Exit if this was the last attempt
      if (attempt === retries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85-1.15
      const delay = Math.min(baseDelay * Math.pow(1.5, attempt) * jitter, 10000);
      
      console.warn(`Socket operation failed, retrying in ${Math.round(delay)}ms (attempt ${attempt+1}/${retries})`, error);
      
      // Wait before next try
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we got here, we failed after all retries
  throw lastError || new Error('Operation failed after retries');
};

// Add a function to detect connection issues
export const isConnectionIssue = (error: Error): boolean => {
  const errorString = error.toString().toLowerCase();
  return (
    errorString.includes('timeout') ||
    errorString.includes('disconnected') ||
    errorString.includes('network') ||
    errorString.includes('connection') ||
    errorString.includes('transport') ||
    errorString.includes('closed')
  );
};

// Check if the browser has connectivity
export const checkConnectivity = async (): Promise<boolean> => {
  try {
    // Try a lightweight connection to a reliable endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    // Use a custom endpoint that just returns a 204 No Content
    const response = await fetch('/api/ping', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch (e) {
    return false;
  }
}; 