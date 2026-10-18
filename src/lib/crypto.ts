import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Cifrado de las claves y llaves de los canales. Usa una sola clave para toda
// la app, CHANNEL_TOKEN_KEY, que vive solo en Vercel. Sin esa clave, lo
// guardado en la base no sirve para nada.

export const KEY_NOT_CONFIGURED =
  'Falta configurar CHANNEL_TOKEN_KEY en Vercel: es la clave con la que se guardan cifradas las conexiones.';

export class CryptoError extends Error {}

export function isCryptoConfigured(): boolean {
  return Boolean(process.env.CHANNEL_TOKEN_KEY?.trim());
}

// La clave puede ser cualquier texto largo: se lleva a 32 bytes.
function key(): Buffer {
  const raw = process.env.CHANNEL_TOKEN_KEY?.trim();
  if (!raw) throw new CryptoError(KEY_NOT_CONFIGURED);
  return createHash('sha256').update(raw).digest();
}

/** Cifra un texto. Cada vez da un resultado distinto, aunque el texto sea el mismo. */
export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

export function decrypt(value: string): string {
  const [version, iv, tag, data] = value.split(':');
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new CryptoError('El dato cifrado no tiene la forma esperada.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new CryptoError('No se pudo leer un dato cifrado: la clave CHANNEL_TOKEN_KEY cambió. Hay que volver a cargar la conexión.');
  }
}

/** Texto al azar para códigos de control y secretos de un solo uso. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** El desafío de PKCE: el resumen del secreto, que es lo único que viaja al canal al pedir permiso. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
