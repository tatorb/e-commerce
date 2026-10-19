import { NextResponse } from 'next/server';
import { baseUrlFrom } from '@/lib/mcp/oauth';
import { CORS } from '@/lib/mcp/http';

// Qué protege el permiso y quién lo da (RFC 9728). Se sirve también en
// /.well-known/oauth-protected-resource (next.config.ts).

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const base = baseUrlFrom(req);
  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
      resource_name: 'E-commerce Studio MRB',
    },
    { headers: CORS },
  );
}
