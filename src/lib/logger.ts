// Define log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableServerLogging: boolean;
  serverLogEndpoint?: string;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  enableConsole: true,
  enableServerLogging: false,
  serverLogEndpoint: `${process.env.BACKEND_API_URL}/logs`,
};

// Current configuration (can be updated at runtime)
let config: LoggerConfig = { ...defaultConfig };

// Map log levels to numeric values for comparison
const logLevelsMap: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Formatter for log timestamps
const formatTimestamp = (): string => {
  return new Date().toISOString();
};

// Main logging function
const log = (level: LogLevel, message: string, ...args: any[]) => {
  // Check if this log level should be processed
  if (logLevelsMap[level] > logLevelsMap[config.level]) {
    return;
  }

  const timestamp = formatTimestamp();
  const logObject = {
    timestamp,
    level,
    message,
    ...(args.length > 0 && { data: args }),
    source: 'frontend',
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // Console logging
  if (config.enableConsole) {
    const consoleMethod = level === 'debug' 
      ? console.debug 
      : level === 'info' 
        ? console.info 
        : level === 'warn' 
          ? console.warn 
          : console.error;
          
    consoleMethod(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
  }

  // Server logging
  if (config.enableServerLogging && config.serverLogEndpoint) {
    try {
      fetch(config.serverLogEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logObject),
        // Use keepalive to ensure logs are sent even during page navigation
        keepalive: true,
      }).catch((e) => {
        // Silent catch to avoid recursive logging errors
        if (config.enableConsole) {
          console.error('[Logger] Failed to send log to server:', e);
        }
      });
    } catch (error) {
      // Silent catch to avoid recursive logging errors
      if (config.enableConsole) {
        console.error('[Logger] Error sending log to server:', error);
      }
    }
  }
};

// Logger interface
export const logger = {
  error: (message: string, ...args: any[]) => log('error', message, ...args),
  warn: (message: string, ...args: any[]) => log('warn', message, ...args),
  info: (message: string, ...args: any[]) => log('info', message, ...args),
  debug: (message: string, ...args: any[]) => log('debug', message, ...args),
  
  // Configuration methods
  configure: (newConfig: Partial<LoggerConfig>) => {
    config = { ...config, ...newConfig };
    return logger;
  },
  
  getConfig: () => ({ ...config }),
  
  // Enable server logging
  enableServerLogging: (endpoint?: string) => {
    config.enableServerLogging = true;
    if (endpoint) {
      config.serverLogEndpoint = endpoint;
    }
    return logger;
  },
  
  // Disable server logging
  disableServerLogging: () => {
    config.enableServerLogging = false;
    return logger;
  },
  
  // Reset to default configuration
  resetConfig: () => {
    config = { ...defaultConfig };
    return logger;
  }
};

export default logger; 