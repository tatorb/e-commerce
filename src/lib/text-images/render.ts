import { existsSync } from 'node:fs';
import { ARCHIVO_WOFF2, INTER_WOFF2 } from './fonts-data';
import { pieceDocument, type PieceFit, type PiecePaint } from './piece-html';

// Arma el PNG de la imagen con texto en el servidor, con un Chromium sin
// pantalla: la misma página y el mismo ajuste que la vista previa, así sale
// igual desde cualquier navegador y desde Claude. En Vercel usa el Chromium
// liviano de @sparticuz/chromium; en una computadora, el de CHROMIUM_PATH.

export type PieceRender = { png: Uint8Array; fit: PieceFit };
export type PieceRenderer = (paint: PiecePaint) => Promise<PieceRender>;

export class RenderError extends Error {}

const LOCAL_CHROMIUM = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'];

async function launchOptions(): Promise<{ executablePath: string; args: string[] }> {
  const local = process.env.CHROMIUM_PATH || (!process.env.VERCEL ? LOCAL_CHROMIUM.find((p) => existsSync(p)) : undefined);
  if (local) return { executablePath: local, args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] };
  const chromium = (await import('@sparticuz/chromium')).default;
  return { executablePath: await chromium.executablePath(), args: [...chromium.args, '--font-render-hinting=none'] };
}

const woff2 = (base64: string) => `data:font/woff2;base64,${base64}`;

/** La página de la pieza con las tipografías adentro, para que no dependa de nada de afuera. */
export function standaloneDocument(): string {
  return pieceDocument({ archivo: woff2(ARCHIVO_WOFF2), inter: woff2(INTER_WOFF2) });
}

export const renderPiece: PieceRenderer = async (paint) => {
  const puppeteer = (await import('puppeteer-core')).default;
  const options = await launchOptions();
  const browser = await puppeteer.launch({ ...options, headless: true, defaultViewport: { width: 1200, height: 1200, deviceScaleFactor: 1 } });
  try {
    const page = await browser.newPage();
    // Solo lo que va adentro de la página: nada de afuera.
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith('data:') || r.url() === 'about:blank' ? r.continue() : r.abort()));
    await page.setContent(standaloneDocument(), { waitUntil: 'load', timeout: 30_000 });
    const fit = (await page.evaluate((p) => (window as unknown as { pintar: (x: unknown) => Promise<unknown> }).pintar(p), paint as unknown as Record<string, unknown>)) as PieceFit;
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 1200 } });
    return { png: new Uint8Array(png), fit };
  } catch (e) {
    console.error('No se pudo armar el PNG de la imagen con texto.', e);
    throw new RenderError('No se pudo armar el PNG. Probá de nuevo en un rato.');
  } finally {
    await browser.close().catch(() => undefined);
  }
};
