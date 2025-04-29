import type { NextConfig } from "next";

/**
 * Use environment variables or fall back to defaults
 */
const env = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:5001',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  NEXT_PUBLIC_WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || 'ws://localhost:5001',
  NEXT_BACKEND_API_URL: process.env.NEXT_BACKEND_API_URL || 'http://localhost:5001/api',
  NEXT_PUBLIC_TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || 'turn:localhost:3478',
  NEXT_PUBLIC_TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || 'bidpazar',
  NEXT_PUBLIC_TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'bidpazarpass',
  NEXT_PUBLIC_STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || 'stun:localhost:3478',
};

// Log environment variables during build
console.log('Next.js build environment variables:', env);
console.log('NODE_ENV:', process.env.NODE_ENV);

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  images: {
    domains: ["localhost", "api.bidpazar.com", "bidpazar.com", "45.147.46.183", "web", "api"],
    unoptimized: true,
  },
  experimental: {
    forceSwcTransforms: true,
  },
  // Explicitly set environment variables for server-side rendering
  env: env,
  // Disable static optimization to ensure runtime environment variables are used
  reactStrictMode: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
