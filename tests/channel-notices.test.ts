import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/canales/[canal]/avisos/route';
import { mercadolibreConnector } from '@/channels/mercadolibre/oauth';

// La dirección de avisos que pide Mercado Libre al crear la aplicación.

const call = (handler: typeof POST, canal: string) =>
  handler(new Request(`https://app.ejemplo.com/api/canales/${canal}/avisos`, { method: 'POST', body: '{"topic":"items"}' }), {
    params: Promise.resolve({ canal }),
  });

describe('avisos del canal', () => {
  it('responde que llegaron, sin guardar nada', async () => {
    expect((await call(POST, 'mercadolibre')).status).toBe(200);
    expect((await call(GET, 'mercadolibre')).status).toBe(200);
  });

  it('un canal que no se conecta no tiene avisos', async () => {
    expect((await call(POST, 'otro')).status).toBe(404);
  });

  it('los pasos para crear la aplicación traen las dos direcciones', () => {
    const steps = mercadolibreConnector.setupSteps({
      redirectUri: 'https://app.ejemplo.com/api/canales/mercadolibre/vuelta',
      noticesUri: 'https://app.ejemplo.com/api/canales/mercadolibre/avisos',
    });
    expect(steps.join(' ')).toContain('https://app.ejemplo.com/api/canales/mercadolibre/vuelta');
    expect(steps.join(' ')).toContain('https://app.ejemplo.com/api/canales/mercadolibre/avisos');
  });
});
