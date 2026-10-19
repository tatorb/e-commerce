import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El logo y el ícono se cargan del WordPress de studiomrb.com, igual que
  // en app.studiomrb.com.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'studiomrb.com' }],
  },
  // Las direcciones estándar donde Claude busca cómo pedir permiso para
  // conectarse (/api/mcp). Se resuelven en /api/oauth/metadata.
  async rewrites() {
    const as = '/api/oauth/metadata/authorization-server';
    const pr = '/api/oauth/metadata/protected-resource';
    return [
      { source: '/.well-known/oauth-authorization-server', destination: as },
      { source: '/.well-known/oauth-authorization-server/api/mcp', destination: as },
      { source: '/.well-known/oauth-protected-resource', destination: pr },
      { source: '/.well-known/oauth-protected-resource/api/mcp', destination: pr },
    ];
  },
};

export default nextConfig;
