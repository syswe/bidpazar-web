/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: [
      'images.unsplash.com',
      'source.unsplash.com',
      'img.youtube.com',
      'localhost',
      'picsum.photos',
      'storage.googleapis.com',
      'bidpazar.com',
      '192.168.1.5',
      '192.168.1.100'
    ],
  },
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
      'mediasoup': 'commonjs mediasoup',
    });
    return config;
  },
  // Enable WebSocket support for Socket.IO
  webSocketServer: {
    url: '/api/rtc/socket',
  },
}

module.exports = nextConfig 