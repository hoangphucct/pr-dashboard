import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker production builds
  output: 'standalone',
  // Disable strict mode for development (can enable later)
  reactStrictMode: true,
  // Allow external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zigexn.vn',
      },
    ],
  },
};

export default nextConfig;
