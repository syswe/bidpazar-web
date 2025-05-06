import { NextResponse } from 'next/server';

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
  // Read runtime environment variables from the server's process.env
  // Use empty string fallbacks for safety
  const config: ClientConfig = {
    apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '',
    socketUrl: process.env.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || '',
    appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '',
    webrtcServer: process.env.WEBRTC_SERVER || process.env.NEXT_PUBLIC_WEBRTC_SERVER || '',
    wsUrl: process.env.WS_URL || process.env.NEXT_PUBLIC_WS_URL || '',
    turnServerUrl: process.env.TURN_SERVER_URL || process.env.NEXT_PUBLIC_TURN_SERVER_URL,
    turnUsername: process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME,
    // Consider if the client *really* needs the TURN password directly.
    // Often, the client only needs the URL and username, and the server handles credential generation.
    // If the client library requires it, keep it, otherwise remove.
    turnPassword: process.env.TURN_PASSWORD || process.env.NEXT_PUBLIC_TURN_PASSWORD,
    stunServerUrl: process.env.STUN_SERVER_URL || process.env.NEXT_PUBLIC_STUN_SERVER_URL,
  };

  // Basic check to ensure essential config is present
  if (!config.apiUrl || !config.appUrl) {
    console.error('[API Config] Critical environment variables missing on server.');
    // Avoid sending back incomplete essential config
    return NextResponse.json(
      { error: 'Server configuration error.' }, 
      { status: 500 }
    );
  }

  // console.log('[API Config] Sending runtime config to client:', config);
  return NextResponse.json(config);
}

// Opt out of caching for this dynamic config route
export const dynamic = 'force-dynamic'; 