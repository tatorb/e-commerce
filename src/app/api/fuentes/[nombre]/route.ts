import { NextResponse } from 'next/server';
import { ARCHIVO_WOFF2, INTER_WOFF2 } from '@/lib/text-images/fonts-data';

// Las tipografías de la imagen con texto, para la vista previa. Las mismas
// que usa el servidor para el PNG, así se ve igual.

const FONTS: Record<string, string> = { 'archivo.woff2': ARCHIVO_WOFF2, 'inter.woff2': INTER_WOFF2 };

export async function GET(_req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  const data = FONTS[nombre];
  if (!data) return new NextResponse('No existe.', { status: 404 });
  return new NextResponse(Buffer.from(data, 'base64'), {
    headers: { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
