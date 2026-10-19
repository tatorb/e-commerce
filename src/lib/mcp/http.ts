import { NextResponse } from 'next/server';

// Lo común de las direcciones del permiso: los programas de Claude las llaman
// desde otros sitios, así que aceptan pedidos de cualquier origen.

export const CORS = { 'Access-Control-Allow-Origin': '*' };

export function corsPreflight(methods: string) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version',
    },
  });
}

export function oauthError(error: string, detail: string | null = null, status = 400) {
  return NextResponse.json(
    { error, ...(detail ? { error_description: detail } : {}) },
    { status, headers: { ...CORS, 'Cache-Control': 'no-store' } },
  );
}

/** Lee el cuerpo como formulario (lo estándar) o como JSON. */
export async function readBody(req: Request): Promise<Record<string, string> | null> {
  try {
    if ((req.headers.get('content-type') ?? '').includes('application/json')) {
      const body = await req.json();
      if (!body || typeof body !== 'object') return {};
      return Object.fromEntries(
        Object.entries(body as Record<string, unknown>).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
      );
    }
    const form = await req.formData();
    return Object.fromEntries([...form.entries()].flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])));
  } catch {
    return null;
  }
}
