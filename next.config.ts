import type { NextConfig } from "next";

// Log environment variables during build
console.log('Next.js build environment variables:', env);
console.log('NODE_ENV:', process.env.NODE_ENV);

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  images: {
    domains: [
      'localhost', 
      'bidpazar.com', 
      'www.bidpazar.com',
      'images.unsplash.com',
      'source.unsplash.com',
      'img.youtube.com',
      'picsum.photos',
      'storage.googleapis.com',
      '192.168.1.5',
      '192.168.1.100'
    ],
    unoptimized: true,
  },
  experimental: {
    forceSwcTransforms: true,
    serverActions: {
      bodySizeLimit: '10mb',
    },
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
  // Increase API body size limit to 10MB for file uploads
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
  // Enable WebSocket support for Socket.IO
  webSocketServer: {
    url: '/api/rtc/socket',
  },
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
      'mediasoup': 'commonjs mediasoup',
    });
    return config;
  },
};

export default nextConfig;
