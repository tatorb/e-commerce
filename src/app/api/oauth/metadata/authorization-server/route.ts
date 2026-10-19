import { NextResponse } from 'next/server';
import { baseUrlFrom } from '@/lib/mcp/oauth';
import { CORS } from '@/lib/mcp/http';

// Dónde y cómo se pide el permiso (RFC 8414). Se sirve también en
// /.well-known/oauth-authorization-server (next.config.ts).

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const base = baseUrlFrom(req);
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/conectar-claude`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      revocation_endpoint: `${base}/api/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
    },
    { headers: CORS },
  );
}
