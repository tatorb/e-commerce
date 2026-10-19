import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import {
  authorizeQuery,
  baseUrlFrom,
  checkAuthorizeRequest,
  errorRedirect,
  issueAuthorizationCode,
  readAuthorizeParams,
} from '@/lib/mcp/oauth';

// Lo que pasa al tocar Autorizar o Cancelar en /conectar-claude. El código
// recién se emite acá, con la sesión de la persona y después de revisar el
// pedido otra vez.

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const base = baseUrlFrom(req);
  // Solo desde la propia pantalla de permiso.
  const origin = req.headers.get('origin');
  if (origin && origin !== base) return new NextResponse('Pedido de otro sitio.', { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse('Pedido inválido.', { status: 400 });
  }
  const params = readAuthorizeParams((k) => form.get(k));
  const check = await checkAuthorizeRequest(prisma, params);
  if (!check.ok) {
    if ('redirect' in check) return NextResponse.redirect(check.redirect, 303);
    return new NextResponse(check.show, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    const back = `/conectar-claude?${authorizeQuery(params)}`;
    return NextResponse.redirect(`${base}/login?from=${encodeURIComponent(back)}`, 303);
  }
  if (form.get('decision') !== 'allow') {
    return NextResponse.redirect(errorRedirect(check.redirectUri, 'access_denied', check.state), 303);
  }

  const code = await issueAuthorizationCode(prisma, {
    userId: user.id,
    clientId: check.clientId,
    redirectUri: check.redirectUri,
    codeChallenge: check.codeChallenge,
  });
  const dest = new URL(check.redirectUri);
  dest.searchParams.set('code', code);
  if (check.state) dest.searchParams.set('state', check.state);
  return NextResponse.redirect(dest.toString(), 303);
}

