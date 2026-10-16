import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProposalInput, ProposalOutput } from '@/ai/proposal';

// La API de Claude simulada con un servidor local: así se prueba el pedido de
// verdad, con el cliente oficial, sin gastar ni mandar datos afuera.

type Reply = { status: number; body: unknown };
let replies: Reply[] = [];
const received: { headers: http.IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
let server: http.Server;

const input: ProposalInput = {
  accountName: 'Cuenta de prueba',
  channel: { name: 'Canal', titleMaxLength: 60 },
  rules: [],
  missing: [],
  productName: 'Kit de prueba',
  content: {
    title: 'Kit de prueba',
    description: null,
    brand: null,
    partNumber: null,
    productType: null,
    engineSystem: null,
    line: null,
    origin: null,
    warranty: null,
    kitContents: null,
    notes: null,
    measures: [],
    specs: [],
    compatibilities: [],
    photos: [],
    videos: [],
  },
  listing: { photoCount: null, hasVideo: null, channelQuality: null, channelGoals: null },
};

const none = { value: '', reason: '', toConfirm: [] };
const noList = { items: [], reason: '', toConfirm: [] };
const output: ProposalOutput = {
  summary: 'Ordena el título.',
  title: { value: 'Kit de prueba completo', reason: 'Más claro.', toConfirm: [] },
  description: none,
  brand: none,
  partNumber: none,
  kitContents: none,
  warranty: none,
  measures: noList,
  specs: noList,
  compatibilities: noList,
};

const message = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text: JSON.stringify(output) }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 500 },
};

const badRequest = (msg: string): Reply => ({
  status: 400,
  body: { type: 'error', error: { type: 'invalid_request_error', message: msg } },
});

describe('pedido a la API de Claude', () => {
  let requestProposal: typeof import('@/ai/proposal').requestProposal;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        received.push({ headers: req.headers, body: JSON.parse(raw) });
        const reply = replies.shift() ?? { status: 200, body: message };
        res.writeHead(reply.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(reply.body));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    ({ requestProposal } = await import('@/ai/proposal'));
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
  });

  beforeEach(() => {
    replies = [];
    received.length = 0;
  });

  it('devuelve la propuesta y lo gastado', async () => {
    const r = await requestProposal(input);
    expect(r.output.title.value).toBe('Kit de prueba completo');
    expect(r.usage.costUsd).toBe(0.014);
    expect(received[0].headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    expect(received[0].body.fallbacks).toBe('default');
  });

  it('si Claude rechaza el pedido, muestra el motivo que da la API', async () => {
    replies = [badRequest('Schema is too complex for compilation.')];
    await expect(requestProposal(input)).rejects.toThrow(
      'Claude no aceptó el pedido. Motivo: Schema is too complex for compilation.',
    );
    expect(received).toHaveLength(1);
  });

  it('si la cuenta no tiene el reintento ante rechazos, pide igual sin él', async () => {
    replies = [badRequest('fallbacks: not available for this organization')];
    const r = await requestProposal(input);
    expect(r.output.summary).toBe('Ordena el título.');
    expect(received).toHaveLength(2);
    expect(received[1].body).not.toHaveProperty('fallbacks');
    expect(received[1].headers['anthropic-beta']).toBeUndefined();
  });

  it('sin saldo, lo dice claro', async () => {
    replies = [badRequest('Your credit balance is too low to access the Anthropic API.')];
    await expect(requestProposal(input)).rejects.toThrow('no tiene saldo');
  });
});
