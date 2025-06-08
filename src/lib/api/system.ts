import { fetcher, apiBaseUrl } from "./client";
import { getToken } from "../frontend-auth";

/**
 * System API Module - Health checks, diagnostics, auth utilities
 */

// Health API functions
export const healthCheck = async (): Promise<{ status: string }> => {
  return fetcher<{ status: string }>("health", {
    returnEmptyOnError: true,
    defaultValue: { status: "error" },
  });
};

export const detailedHealthCheck = async (): Promise<{
  status: string;
  database: string;
  uptime: number;
  memory: object;
  env: string;
}> => {
  return fetcher<{
    status: string;
    database: string;
    uptime: number;
    memory: object;
    env: string;
  }>("health/detailed");
};

export const socketHealthCheck = async (): Promise<{
  status: string;
  activeConnections: number;
}> => {
  return fetcher<{ status: string; activeConnections: number }>(
    "health/socket"
  );
};

// Diagnostics API functions
export const diagnosticsHealth = async (): Promise<{
  status: string;
  timestamp: string;
}> => {
  return fetcher<{ status: string; timestamp: string }>("diagnostics/health");
};

export const testBandwidth = async (sizeKB: number = 100): Promise<Blob> => {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${apiBaseUrl}/diagnostics/test-bandwidth?size=${sizeKB}`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to perform bandwidth test");
  }

  return response.blob();
};

export const getConnectionStats = async (): Promise<{
  activeConnections: number;
  serverLoad: {
    cpu: object;
    memory: object;
    uptime: number;
  };
  timestamp: string;
}> => {
  return fetcher<{
    activeConnections: number;
    serverLoad: {
      cpu: object;
      memory: object;
      uptime: number;
    };
    timestamp: string;
  }>("diagnostics/connection-stats");
};

export const getRateLimitStatus = async (): Promise<{
  isRateLimited: boolean;
  rateLimitedUntil: string | null;
  connectionCount: number;
  maxConnections: number;
  ipAddress: string;
  timestamp: string;
}> => {
  return fetcher<{
    isRateLimited: boolean;
    rateLimitedUntil: string | null;
    connectionCount: number;
    maxConnections: number;
    ipAddress: string;
    timestamp: string;
  }>("diagnostics/rate-limit-status");
};

// Auth API functions
export const requestVerificationCode = async (
  email: string
): Promise<{ message: string; userId: string; phoneNumber?: string }> => {
  return fetcher<{ message: string; userId: string; phoneNumber?: string }>(
    "auth/request-verification",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
}; 