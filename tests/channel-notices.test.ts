import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mercadolibreConnector } from '@/channels/mercadolibre/oauth';

// La dirección de avisos que pide Mercado Libre al crear la aplicación:
// confirma enseguida y procesa después. Lo que hace con cada aviso se prueba
// en buyer-questions.test.ts.

const received = vi.hoisted(() => [] as { kind: string; body: unknown }[]);

vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/answers', () => ({
  handleNotice: async (_db: unknown, kind: string, body: unknown) => {
    received.push({ kind, body });
    return { saved: 0, drafted: 0 };
  },
}));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  // Fuera de Next no hay "después": se corre en el momento.
  after: (task: () => Promise<void>) => task(),
}));

const { GET, POST } = await import('@/app/api/canales/[canal]/avisos/route');

const post = (canal: string, body: string) =>
  POST(new Request(`https://app.ejemplo.com/api/canales/${canal}/avisos`, { method: 'POST', body }), { params: Promise.resolve({ canal }) });

describe('avisos del canal', () => {
  beforeEach(() => {
    received.length = 0;
  });

  it('responde que llegaron y después los procesa', async () => {
    expect((await post('mercadolibre', '{"topic":"items"}')).status).toBe(200);
    expect((await post('mercadolibre', '{"topic":"questions","resource":"/questions/1","user_id":7}')).status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toEqual([
      { kind: 'MERCADOLIBRE', body: { topic: 'items' } },
      { kind: 'MERCADOLIBRE', body: { topic: 'questions', resource: '/questions/1', user_id: 7 } },
    ]);
    const res = await GET(new Request('https://app.ejemplo.com/api/canales/mercadolibre/avisos'), { params: Promise.resolve({ canal: 'mercadolibre' }) });
    expect(res.status).toBe(200);
  });

  it('un canal que no se conecta no tiene avisos; lo que no es un aviso no se procesa', async () => {
    expect((await post('otro', '{}')).status).toBe(404);
    expect((await post('mercadolibre', 'no es json')).status).toBe(400);
    expect((await post('mercadolibre', JSON.stringify({ x: 'a'.repeat(20_000) }))).status).toBe(413);
    expect(received).toEqual([]);
  });

  it('los pasos para crear la aplicación traen las dos direcciones y el tópico de preguntas', () => {
    const steps = mercadolibreConnector.setupSteps({
      redirectUri: 'https://app.ejemplo.com/api/canales/mercadolibre/vuelta',
      noticesUri: 'https://app.ejemplo.com/api/canales/mercadolibre/avisos',
    });
    expect(steps.join(' ')).toContain('https://app.ejemplo.com/api/canales/mercadolibre/vuelta');
    expect(steps.join(' ')).toContain('https://app.ejemplo.com/api/canales/mercadolibre/avisos');
    expect(steps.join(' ')).toContain('Questions');
  });
});
