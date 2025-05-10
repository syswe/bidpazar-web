import { NextResponse } from "next/server";

// This interface defines the structure of the config object returned to the client.
// Only include variables that the client needs and are safe to expose.
interface ClientConfig {
  apiUrl: string;
  socketUrl: string;
  appUrl: string;
  webrtcServer: string;
  wsUrl: string;
  turnServerUrl?: string;
  turnUsername?: string;
  turnPassword?: string; // Be cautious exposing credentials if not needed directly by client JS
  stunServerUrl?: string;
}

export async function GET() {
  console.log("[API Config] Fetching runtime configuration");

  try {
    // Read runtime environment variables from the server's process.env
    const isDevelopment = process.env.NODE_ENV !== "production";
    const hostname = process.env.APP_URL || "http://localhost:3000";

    // Carefully build configuration - add fallbacks for everything
    const config: ClientConfig = {
      apiUrl: process.env.API_URL || `${hostname}/api`,
      // Allow ws:// and wss:// protocols for Socket.IO URL
      socketUrl: process.env.SOCKET_URL
        ? process.env.SOCKET_URL // Prefer the direct value from .env if it exists
        : hostname, // Fallback to hostname (which might need ws:// prefix later)
      appUrl: process.env.APP_URL || hostname,
      // Ensure WebRTC server uses http/https protocol (this might be different, assuming it's for API calls)
      webrtcServer: process.env.WEBRTC_SERVER
        ? process.env.WEBRTC_SERVER.startsWith("ws://")
          ? process.env.WEBRTC_SERVER.replace("ws://", "http://")
          : process.env.WEBRTC_SERVER.startsWith("wss://")
          ? process.env.WEBRTC_SERVER.replace("wss://", "https://")
          : process.env.WEBRTC_SERVER
        : hostname,
      wsUrl: process.env.WS_URL || "/socket.io", // This is the path, not the full URL
    };

    // Ensure URLs have proper protocol
    // For socketUrl, if it doesn't have a protocol and came from hostname, prefix with ws://
    if (config.socketUrl && !config.socketUrl.match(/^[a-z]+:\/\//i)) {
      config.socketUrl = `ws://${config.socketUrl}`; // Default to ws for sockets
    }

    if (config.webrtcServer && !config.webrtcServer.startsWith("http")) {
      config.webrtcServer = `http://${config.webrtcServer}`;
    }

    // Add TURN/STUN credentials if available
    if (process.env.TURN_SERVER_URL) {
      config.turnServerUrl = process.env.TURN_SERVER_URL;
    }

    if (process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
      config.turnUsername = process.env.TURN_USERNAME;
      config.turnPassword = process.env.TURN_PASSWORD;
    }

    if (process.env.STUN_SERVER_URL) {
      config.stunServerUrl = process.env.STUN_SERVER_URL;
    } else {
      // Always provide a default STUN server
      config.stunServerUrl = "stun:stun.l.google.com:19302";
    }

    console.log("[API Config] Generated runtime config:", config);

    return NextResponse.json(config, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[API Config] Error generating config:", error);

    // Always return a valid JSON object, even in case of error
    // This prevents HTML error pages from being sent
    const fallbackConfig: ClientConfig = {
      apiUrl: "/api",
      socketUrl: "http://localhost:3000", // Changed from ws:// to http:// for Socket.IO
      appUrl: "http://localhost:3000",
      webrtcServer: "http://localhost:3000", // Ensure consistent http:// protocol
      wsUrl: "/socket.io",
      stunServerUrl: "stun:stun.l.google.com:19302",
    };

    return NextResponse.json(fallbackConfig, {
      status: 200, // Return 200 even with fallback to avoid client failures
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "X-Config-Fallback": "true",
      },
    });
  }
}

// Opt out of caching for this dynamic config route
export const dynamic = "force-dynamic";
