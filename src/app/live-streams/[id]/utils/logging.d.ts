interface LogContext {
  [key: string]: any;
}

export function logInfo(message: string, context?: LogContext): void;
export function logError(message: string, context?: LogContext): void;
export function logWarn(message: string, context?: LogContext): void;
export function logDebug(message: string, context?: LogContext): void; 