import { NextResponse } from 'next/server';
import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { BLOB_NOT_CONFIGURED, isBlobConfigured } from './files';

// Da el permiso para que el navegador suba un archivo directo al depósito de
// Vercel, sin pasar por la app: así no hay límite de peso de Vercel. Es un
// link firmado para ese nombre, ese tipo y hasta ese peso, que vence solo.
// Anda con el permiso automático de Vercel y con la clave del depósito.

export type UploadRule = { contentType: string; maxBytes: number };

/** Responde el pedido de subida del navegador. `rule` decide si se acepta; si no, tira un error con el motivo. */
export async function presignedUpload(req: Request, rule: (pathname: string) => Promise<UploadRule>, validMs = 30 * 60 * 1000) {
  if (!isBlobConfigured()) return NextResponse.json({ error: BLOB_NOT_CONFIGURED }, { status: 503 });
  let body: HandleUploadPresignedBody;
  try {
    body = (await req.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  try {
    const json = await handleUploadPresigned({
      body,
      request: req,
      // Sirve solo para el aviso de subida terminada, que la app no usa.
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'sin-aviso',
      getSignedToken: async (pathname) => {
        const { contentType, maxBytes } = await rule(pathname);
        const limits = { allowedContentTypes: [contentType], maximumSizeInBytes: maxBytes, validUntil: Date.now() + validMs };
        return {
          token: await issueSignedToken({ pathname, operations: ['put'], ...limits }),
          urlOptions: { ...limits, addRandomSuffix: true },
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo subir.' }, { status: 400 });
  }
}
