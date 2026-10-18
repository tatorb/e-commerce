import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { completeAuthorization } from '@/lib/connections';
import { publicAppUrl } from '@/lib/public-url';

// Vuelta del canal después de pedir permiso. Puede llegar alguien sin sesión
// en la app, por ejemplo el cliente que abrió el link que le mandamos: el
// código de control alcanza para saber de qué tienda era.

export const dynamic = 'force-dynamic';

function back(path: string, result: { ok: boolean; detail?: string }) {
  const url = new URL(path, publicAppUrl());
  url.searchParams.set('resultado', result.ok ? 'ok' : 'error');
  if (result.detail) url.searchParams.set('detalle', result.detail.slice(0, 300));
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  const denied = params.get('error');
  const user = await getCurrentUser();

  const attempt = state ? await prisma.connectAttempt.findUnique({ where: { state }, include: { store: { select: { account: { select: { slug: true } } } } } }) : null;
  const slug = attempt?.store.account.slug ?? null;
  const target = (s: string | null) => (user && s ? `/a/${s}/conexion` : '/conectado');

  if (denied || !code || !state) {
    if (attempt && !attempt.usedAt) await prisma.connectAttempt.update({ where: { id: attempt.id }, data: { usedAt: new Date() } });
    return back(target(slug), {
      ok: false,
      detail: denied ? 'No se dio el permiso en Mercado Libre.' : 'Faltan datos en la vuelta de Mercado Libre. Probá de nuevo.',
    });
  }

  const r = await completeAuthorization(prisma, { state, code });
  if (!r.ok) return back(target(r.accountSlug), { ok: false, detail: r.error });
  return back(target(r.accountSlug), { ok: true, detail: `Conectada como ${r.nickname}.` });
}
