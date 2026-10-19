import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { baseUrlFrom, verifyAccessToken } from '@/lib/mcp/oauth';
import { handleRpc, rpcError, type RpcMessage } from '@/lib/mcp/server';

// La dirección que se agrega en Claude como conector. Pide la llave del
// permiso; sin llave, responde dónde pedirlo y Claude arranca la conexión.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
};

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id',
    },
  });
}

async function authenticate(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { user: null, tried: false };
  return { user: await verifyAccessToken(prisma, token), tried: true };
}

function unauthorized(req: Request, tried: boolean) {
  const base = baseUrlFrom(req);
  return NextResponse.json(rpcError(null, -32001, 'Falta el permiso. Conectá la app de nuevo desde Claude.'), {
    status: 401,
    headers: {
      ...CORS,
      'WWW-Authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/api/mcp"${tried ? ', error="invalid_token"' : ''}`,
    },
  });
}

export async function POST(req: Request) {
  const { user, tried } = await authenticate(req);
  if (!user) return unauthorized(req, tried);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'JSON inválido'), { status: 400, headers: CORS });
  }
  const ctx = { db: prisma, userId: user.userId, baseUrl: baseUrlFrom(req) };
  const messages = (Array.isArray(body) ? body : [body]) as RpcMessage[];
  const responses: object[] = [];
  for (const m of messages) {
    const r = await handleRpc(m, ctx);
    if (r) responses.push(r);
  }
  if (responses.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0], { headers: CORS });
}

// Sin conexión abierta: con llave, GET no se usa; sin llave, dice dónde pedirla.
export async function GET(req: Request) {
  const { user, tried } = await authenticate(req);
  if (!user) return unauthorized(req, tried);
  return new NextResponse('Method Not Allowed', { status: 405, headers: { ...CORS, Allow: 'POST' } });
}
