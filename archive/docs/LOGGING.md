# BidPazar Logging Standards

This document outlines the logging standards and patterns for the BidPazar application.

## Logging Principles

- **Consistency**: Use the same logging format and patterns across the application
- **Verbosity Control**: Implement different log levels (debug, info, warn, error)
- **Context**: Include relevant context with each log entry
- **Traceability**: Include request IDs or correlation IDs where possible
- **Privacy**: Never log sensitive information (passwords, tokens, etc.)

## Logging Utility

We use a centralized logging utility (`src/lib/logger.ts`) to standardize logs across the application.

```ts
// src/lib/logger.ts
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

const CURRENT_LOG_LEVEL =
  process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

export function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: any
) {
  if (level >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const levelString = LogLevel[level];
    console.log(
      `[${timestamp}] [${levelString}] [${context}] ${message}`,
      data ? data : ""
    );
  }
}

export const logger = {
  trace: (context: string, message: string, data?: any) =>
    log(LogLevel.TRACE, context, message, data),
  debug: (context: string, message: string, data?: any) =>
    log(LogLevel.DEBUG, context, message, data),
  info: (context: string, message: string, data?: any) =>
    log(LogLevel.INFO, context, message, data),
  warn: (context: string, message: string, data?: any) =>
    log(LogLevel.WARN, context, message, data),
  error: (context: string, message: string, data?: any) =>
    log(LogLevel.ERROR, context, message, data),
};
```

## API Request Logging

For API endpoints, log the following for every request:

```ts
import { logger } from "@/lib/logger";

export async function logApiRequest({
  method,
  url,
  headers,
  body,
  query,
  user,
  extra,
}: {
  method: string;
  url: string;
  headers: any;
  body?: any;
  query?: any;
  user?: any;
  extra?: any;
}) {
  // Sanitize headers to remove sensitive info
  const sanitizedHeaders = { ...headers };
  if (sanitizedHeaders.authorization) {
    sanitizedHeaders.authorization = "[REDACTED]";
  }

  logger.info("API", `${method} ${url}`, {
    headers: sanitizedHeaders,
    body,
    query,
    userId: user?.id,
    ...extra,
  });
}
```

## WebRTC and Media Logging

For WebRTC and media components, implement enhanced logging:

```ts
// In WebRTCStreamManager.tsx or similar
const log = (message: string, data?: any) => {
  logger.debug("WebRTC", message, data);
};

const logError = (message: string, error: any) => {
  logger.error("WebRTC", message, {
    error: error.message,
    stack: error.stack,
    // Add context specific to media
    deviceId: selectedVideoDevice?.deviceId,
    streamId,
    connectionState,
  });
};
```

## Error Handling and Logging

Always log errors with stack traces and context:

```ts
try {
  // Operation that might fail
} catch (error) {
  logger.error("ContextName", "Operation failed", {
    error: error.message,
    stack: error.stack,
    // Additional context
    userId,
    resourceId,
    operation: "operationName",
  });
  // Then handle the error appropriately
}
```

## Production vs Development Logging

- In development: More verbose logging with DEBUG or TRACE level
- In production: Focus on INFO level and above, with structured JSON format if possible

## MediaSoup Specific Logging

For MediaSoup debugging:

```bash
# Enable detailed MediaSoup logs
DEBUG=mediasoup* npm run dev

# Enable MediaSoup and Socket.IO logs
DEBUG=mediasoup*,socket.io* npm run dev

# More granular MediaSoup debugging
DEBUG=mediasoup:WARNING* npm run dev
```

## Performance Considerations

- Log asynchronously when possible to avoid blocking operations
- Be mindful of logging volume in production environments
- Consider implementing log rotation and archiving for production

## Monitoring and Alerts

- Set up alerts for ERROR level logs in production
- Monitor frequency of WARNING logs
- Implement health check logs at regular intervals

## Next Steps for Logging Implementation

1. Ensure logger utility is used consistently across the application
2. Implement structured logging in production
3. Set up log aggregation and monitoring
4. Add request ID tracking for better traceability
