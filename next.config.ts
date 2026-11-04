import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El Chromium que arma el PNG de las imágenes con texto va tal cual, sin empaquetar.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // Sus archivos comprimidos no se importan desde el código: van a mano, solo donde se arma el PNG.
  outputFileTracingIncludes: {
    '/a/*/pipeline/*': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/mcp': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
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
