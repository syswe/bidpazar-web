import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  images: {
    domains: ["localhost"],
    unoptimized: true,
  },
  experimental: {
    forceSwcTransforms: true,
  },
};

export default nextConfig;
