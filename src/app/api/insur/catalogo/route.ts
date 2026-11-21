import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { insurCatalog } from '@/lib/insur';
import { insurCaller } from '@/lib/insur-access';

// Lo que pide la extensión "Insur → E-commerce" antes de leer Insur: los
// productos y las medidas de la cuenta insur con su número de pieza y su SKU,
// y los cruces que ya están. Con la sesión de la persona. Sin precios.

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  const who = await insurCaller();
  if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status, headers });
  return NextResponse.json({ cuenta: who.account.slug, ...(await insurCatalog(prisma, who.account.id)) }, { headers });
}
