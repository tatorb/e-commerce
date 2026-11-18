import { afterEach, describe, expect, it, vi } from 'vitest';
import { askClips, readClipsAnswer } from '@/channels/mercadolibre/clips-api';

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('preguntar por los clips de una publicación', () => {
  it('prueba cada dirección, solo con pedidos de lectura, y cuenta lo que respondió', async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      if (url.includes('/marketplace/')) return answer(401, { message: 'User does not have permission to access this resource', status: 401 });
      return answer(404, { message: 'No clips found for itemId: MLA1', status: 404 });
    });
    const r = await askClips('llave', 'MLA1');
    expect(calls.map((c) => c.method)).toEqual(['GET', 'GET']);
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/marketplace/items/MLA1/clips', '/items/MLA1/clips']);
    expect(r.map((a) => a.status)).toEqual([401, 404]);
    expect(readClipsAnswer(r[0])).toContain('no tiene permiso');
    expect(readClipsAnswer(r[1])).toContain('tiene acceso');
  });

  it('si responde con clips, lo dice', async () => {
    vi.stubGlobal('fetch', async () => answer(200, { clips: [] }));
    const r = await askClips('llave', 'MLA1');
    expect(r[0]).toMatchObject({ status: 200, body: { clips: [] } });
    expect(readClipsAnswer(r[0])).toContain('puede consultar');
  });

  it('una llave que no vale no se toma como respuesta', async () => {
    vi.stubGlobal('fetch', async () => answer(401, { message: 'invalid access token' }));
    await expect(askClips('llave', 'MLA1')).rejects.toThrow('volver a conectar');
  });
});
