import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable client-side sourcemaps in development to avoid noisy DevTools warnings
  webpack(config, { dev, isServer }) {
    if (dev && !isServer) {
      config.devtool = false;
    }
    return config;
  },
  // productionBrowserSourceMaps defaults to false; keep it off in prod
  eslint: {
    // We run ESLint in CI; skip blocking production builds locally
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
