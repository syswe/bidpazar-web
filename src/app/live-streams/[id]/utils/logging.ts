interface LogContext {
  [key: string]: any;
}

export function logInfo(message: string, context?: LogContext) {
  console.info(`[MediaManager] ${message}`, context || '');
}

export function logError(message: string, context?: LogContext) {
  console.error(`[MediaManager] ${message}`, context || '');
}

export function logWarn(message: string, context?: LogContext) {
  console.warn(`[MediaManager] ${message}`, context || '');
}

export function logDebug(message: string, context?: LogContext) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[MediaManager] ${message}`, context || '');
  }
} 