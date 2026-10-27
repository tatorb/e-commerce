import { NextResponse } from 'next/server';
import { can, canSeeAccount } from '@/domain/access';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { readStored, storageError } from '@/lib/stored-files';

// Muestra la ilustración de un paso de un protocolo de fotos, del Drive del
// estudio, solo a quien ve la cuenta y Registro de productos o los protocolos.

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ stepId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Entrá a la app para ver esta imagen.', { status: 401 });
  const { stepId } = await params;
  const step = await prisma.shootStep.findUnique({
    where: { id: stepId },
    select: { illustrationUrl: true, illustrationType: true, protocol: { select: { accountId: true } } },
  });
  const allowed = step && canSeeAccount(user.access, step.protocol.accountId) && can(user.access, ['captura', 'protocolos'], 'read');
  if (!step?.illustrationUrl || !allowed) return new NextResponse('La imagen no existe.', { status: 404 });
  try {
    const res = await readStored(prisma, step.illustrationUrl);
    if (!res) return new NextResponse('La imagen ya no está guardada: se borró del Drive.', { status: 404 });
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': step.illustrationType ?? 'image/jpeg',
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const message = storageError(e);
    if (message) return new NextResponse(message, { status: 502 });
    throw e;
  }
}
