import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { completeDriveAuthorization } from '@/lib/drive';
import { publicAppUrl } from '@/lib/public-url';

// Vuelta de Google después de pedir permiso para el Drive del estudio. Se
// conecta desde Equipo, así que hace falta la sesión en la app.

export const dynamic = 'force-dynamic';

function back(result: { ok: boolean; detail: string }) {
  const url = new URL('/equipo', publicAppUrl());
  url.searchParams.set('drive', result.ok ? 'ok' : 'error');
  url.searchParams.set('detalle', result.detail.slice(0, 300));
  url.hash = 'drive';
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  const denied = params.get('error');
  const user = await getCurrentUser();
  if (!user) return back({ ok: false, detail: 'Tu sesión en la app venció. Entrá y conectá el Drive de nuevo.' });
  if (!user.isAdmin) return back({ ok: false, detail: 'Solo un administrador puede conectar el Drive.' });

  if (denied || !code || !state) {
    if (state) {
      await prisma.driveConnection.updateMany({ where: { pendingState: state }, data: { pendingState: null, pendingVerifier: null, pendingUntil: null } });
    }
    return back({
      ok: false,
      detail: denied === 'access_denied' ? 'No se dio el permiso en Google.' : 'Faltan datos en la vuelta de Google. Probá de nuevo.',
    });
  }

  const r = await completeDriveAuthorization(prisma, { state, code });
  return r.ok ? back({ ok: true, detail: `Conectado con ${r.email}.` }) : back({ ok: false, detail: r.error });
}
