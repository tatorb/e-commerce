import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { actAsAdmin } from '@/lib/auth/guard';
import { getCurrentUser } from '@/lib/auth/session';
import { BrandError, brandLogo, removeBrandLogo, setBrandLogo } from '@/lib/text-images/brands';
import { LOGO_MAX_BYTES } from '@/domain/text-images';

// El logo de una marca de vehículos: lo ve cualquiera con sesión; subirlo o
// sacarlo es cosa de un administrador. Un SVG se muestra sin poder correr nada.

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await getCurrentUser())) return new NextResponse('Entrá a la app para ver este logo.', { status: 401 });
  const { key } = await params;
  const logo = await brandLogo(prisma, key);
  if (!logo) return new NextResponse('La marca no tiene logo.', { status: 404 });
  return new NextResponse(Buffer.from(logo.data), {
    headers: {
      'Content-Type': logo.type,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const r = await actAsAdmin({ does: 'Subió el logo de una marca de vehículos', targetLabel: key }, async () => {
    const form = await req.formData().catch(() => null);
    const file = form?.get('logo');
    if (!(file instanceof File)) return { ok: false as const, error: 'Elegí un archivo.' };
    if (file.size > LOGO_MAX_BYTES) return { ok: false as const, error: 'El logo pesa más de 1 MB.' };
    try {
      await setBrandLogo(prisma, { key, name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
      return { ok: true as const };
    } catch (e) {
      if (e instanceof BrandError) return { ok: false as const, error: e.message };
      throw e;
    }
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const r = await actAsAdmin({ does: 'Sacó el logo de una marca de vehículos', targetLabel: key }, async () => {
    await removeBrandLogo(prisma, key);
    return { ok: true as const };
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
