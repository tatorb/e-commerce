import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { revokeAccessToken } from '@/lib/mcp/oauth';
import { CORS, corsPreflight, oauthError, readBody } from '@/lib/mcp/http';

// Corta una llave (RFC 7009). Una llave desconocida no es error.

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight('POST, OPTIONS');
}

export async function POST(req: Request) {
  const params = await readBody(req);
  if (!params) return oauthError('invalid_request');
  if (params.token) await revokeAccessToken(prisma, params.token);
  return new NextResponse(null, { status: 200, headers: CORS });
}
