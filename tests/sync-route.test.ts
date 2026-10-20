import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/sincronizar/route';

// La dirección de la tarea programada solo responde con la clave.

vi.mock('@/lib/db', () => ({ prisma: {} }));

const call = (authorization?: string) =>
  GET(new Request('https://app.ejemplo.com/api/sincronizar', { headers: authorization ? { authorization } : {} }));

describe('la tarea programada', () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('sin la clave configurada no lee', async () => {
    expect((await call('Bearer algo')).status).toBe(503);
  });

  it('con otra clave, o sin clave, no lee', async () => {
    process.env.CRON_SECRET = 'clave-de-prueba-de-la-tarea';
    expect((await call()).status).toBe(401);
    expect((await call('Bearer otra-clave')).status).toBe(401);
    expect((await call('clave-de-prueba-de-la-tarea')).status).toBe(401);
  });
});
