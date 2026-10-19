import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exchangeAuthorizationCode } from '@/lib/mcp/oauth';
import { CORS, corsPreflight, oauthError, readBody } from '@/lib/mcp/http';

// Cambia el código del permiso por la llave (OAuth 2.1 con PKCE).

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight('POST, OPTIONS');
}

export async function POST(req: Request) {
  const params = await readBody(req);
  if (!params) return oauthError('invalid_request');
  if (params.grant_type !== 'authorization_code') return oauthError('unsupported_grant_type');
  if (!params.code || !params.code_verifier) return oauthError('invalid_request', 'Falta el código o el secreto de PKCE.');

  const r = await exchangeAuthorizationCode(prisma, {
    code: params.code,
    codeVerifier: params.code_verifier,
    redirectUri: params.redirect_uri ?? null,
    clientId: params.client_id ?? null,
  });
  if (!r.ok) return oauthError(r.error, r.detail);
  return NextResponse.json(
    { access_token: r.accessToken, token_type: 'Bearer', expires_in: r.expiresIn, scope: 'mcp' },
    { headers: { ...CORS, 'Cache-Control': 'no-store' } },
  );
}
