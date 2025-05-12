/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false, // Disable strict mode to prevent double socket connections in development
  images: {
    domains: [
      "localhost",
      "bidpazar.com",
      "www.bidpazar.com",
      "images.unsplash.com",
      "source.unsplash.com",
      "img.youtube.com",
      "picsum.photos",
      "storage.googleapis.com",
      "192.168.1.5",
      "192.168.1.100",
      "cdn.bidpazar.com",
      "bidpazar-storage.s3.amazonaws.com",
      "loremflickr.com",
      "placekitten.com",
      "meet.bidpazar.com", // Added Jitsi server domain
    ],
    unoptimized: true,
  },
  // Ensure server components can be server-side rendered properly
  experimental: {
    forceSwcTransforms: true,
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Reduce package size by removing console/debugger statements in production
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "date-fns",
    ],
  },
  // Disable static optimization to ensure runtime environment variables are used
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Add enhanced webpack config for WebSocket support
  webpack: (config, { isServer, dev }) => {
    // Add WebSocket externals
    config.externals = [
      ...(Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean)),
      {
        "utf-8-validate": "commonjs utf-8-validate",
        bufferutil: "commonjs bufferutil",
      },
    ];

    // Add fallbacks for WebSocket modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore specific modules that can cause issues with WebSocket
    config.module = {
      ...config.module,
      exprContextCritical: false,
      rules: [...config.module.rules],
    };

    return config;
  },
  // Configure headers for WebSocket support
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-Requested-With, Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
      {
        // Required for WebSocket protocol upgrade (Socket.IO)
        source: "/socket.io/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-Requested-With, Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
      {
        source: "/socket.io",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-Requested-With, Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
  // Enhanced rewrites for Socket.IO and WebSocket paths
  async rewrites() {
    return [
      // Explicit rewrites for Socket.IO paths
      {
        source: "/socket.io/:path*",
        destination: "/socket.io/:path*",
      },
      // Add support for Socket.IO with query parameters (no trailing slash)
      {
        source: "/socket.io",
        destination: "/socket.io",
      },
    ];
  },
  // Add redirects to fix route confusion between different auth paths
  async redirects() {
    return [
      {
        source: "/sign-in",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/sign-up",
        destination: "/register",
        permanent: true,
      },
      {
        source: "/auth/login",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/auth/register",
        destination: "/register",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
