import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El logo y el ícono se cargan del WordPress de studiomrb.com, igual que
  // en app.studiomrb.com.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'studiomrb.com' }],
  },
};

export default nextConfig;
