/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false, // Disable strict mode to prevent double socket connections in development
  images: {
    // Use custom loader to bypass optimization for /uploads/ paths
    loaderFile: './src/lib/imageLoader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'bidpazar.com' },
      { protocol: 'https', hostname: 'www.bidpazar.com' },
      { protocol: 'https', hostname: 'cdn.bidpazar.com' },
      { protocol: 'https', hostname: 'live.bidpazar.com' },
      { protocol: 'https', hostname: 'meet.bidpazar.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'bidpazar-storage.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'loremflickr.com' },
      { protocol: 'https', hostname: 'placekitten.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '192.168.1.5' },
      { protocol: 'http', hostname: '192.168.1.100' },
    ],
    // Enable image optimization with specific settings
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp', 'image/avif'],
  },
  // This option has been moved to experimental in latest Next.js
  // Specify any packages that should not be bundled
  serverExternalPackages: [],
  // Disable static optimization to ensure runtime environment variables are used
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Add enhanced webpack config for WebSocket support
  webpack: (config, { isServer, dev }) => {
    // Add WebSocket externals
    (config.externals = [
      ...(Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean)),
      {
        "utf-8-validate": "commonjs utf-8-validate",
        bufferutil: "commonjs bufferutil",
      },
    ]),
      (config.watchOptions = {
        ignored: /node_modules|bpmobile|\.git/,
      });

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
  // Configure headers for WebSocket support and caching
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
        // Cache uploaded images for 1 year (immutable content)
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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
  // Socket.IO paths are handled by custom server, no rewrites needed
  async rewrites() {
    return [];
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
  typescript: {
    // Enable TypeScript checking for better development experience
    ignoreBuildErrors: false,
  },
  experimental: {
    // Configure server actions
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Optimize package imports for better bundle size
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "date-fns",
    ],
    // Remaining experimental options that haven't been stabilized
    forceSwcTransforms: true,
  },
};

module.exports = nextConfig;
