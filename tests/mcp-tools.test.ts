import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { addToPipeline, advanceStep } from '@/domain/pipeline';
import type { McpContext } from '@/lib/mcp/tool';

// Datos inventados. Los números raros hacen de precio y de datos internos:
// ninguno puede aparecer en lo que ve Claude.

const url = process.env.TEST_DATABASE_URL;

// La app crea su conexión a la base al cargarse: que apunte a la de prueba.
vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { handleRpc, toolList } = await import('@/lib/mcp/server');

const SECRETS = ['987654', '777001', '777002', '777003', 'clave-secreta-inventada'];

describe('lista de herramientas', () => {
  it('las de lectura, cada una con su esquema y marcada como de lectura', () => {
    const tools = toolList();
    const read = tools.filter((t) => t.annotations.readOnlyHint);
    expect(read.map((t) => t.name)).toEqual([
      'list_accounts',
      'search_catalog',
      'get_pipeline_board',
      'get_publication',
      'get_title_workspace',
      'check_title',
      'list_tasks',
      'get_publication_media',
    ]);
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.inputSchema).not.toHaveProperty('$schema');
    }
    const search = tools.find((t) => t.name === 'search_catalog')!.inputSchema as { required?: string[]; properties: Record<string, unknown> };
    expect(search.required ?? []).toEqual([]);
    expect(Object.keys(search.properties)).toContain('tipo_de_producto');
  });
});

describe.skipIf(!url)('herramientas para Claude', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const ctx: McpContext = { db, userId: 'u1', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
  let accountId = '';
  let kitId = '';
  let bombaId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE title_approvals, title_works, search_positions, search_suggestions, competitor_listings, pipeline_movements, measurements, channel_connections, publications, products, stores, channels, accounts, users CASCADE',
    );
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    await db.channelConnection.create({
      data: { storeId: store.id, appId: '1234', appSecret: 'clave-secreta-inventada', appSecretHint: 'ada' },
    });

    const kit = await db.product.create({
      data: {
        accountId,
        name: 'Kit de embrague Modelo X',
        productType: 'Kit de embrague',
        brand: 'Marca Uno',
        partNumber: 'P-100',
        notes: 'Lista del proveedor 777003',
        specs: [
          { name: 'Diámetro', value: '200 mm' },
          { name: 'Precio de lista', value: '777001' },
        ],
        compatibilities: { create: [{ vehicleBrand: 'Marca Auto', model: 'Modelo X', engine: '1.6 8v', yearFrom: 2010, yearTo: 2015 }] },
        variants: { create: [{ sku: 'SKU-1', measure: 'STD' }] },
      },
    });
    kitId = (
      await db.publication.create({
        data: {
          productId: kit.id,
          storeId: store.id,
          externalId: 'MLA1110001',
          url: 'https://articulo.mercadolibre.com.ar/MLA-1110001-kit',
          title: 'Kit Embrague Modelo X',
          description: 'Descripción del kit',
          price: '987654.00',
          attributes: [
            { name: 'Marca', value: 'Marca Uno' },
            { name: 'Costo proveedor', value: '777002' },
          ],
          measurements: { create: [{ takenAt: new Date(), metrics: { visits_90d: 120, sales_90d: 3 } }] },
          competitors: { create: [{ title: 'Kit Embrague Modelo X Original', soldQuantity: 50 }] },
        },
      })
    ).id;
    const bomba = await db.product.create({ data: { accountId, name: 'Bomba de agua', productType: 'Bomba de agua' } });
    bombaId = (
      await db.publication.create({
        data: { productId: bomba.id, storeId: store.id, externalId: 'MLA2220002', title: 'Bomba Agua', price: '987654.00' },
      })
    ).id;
    await db.$transaction((tx) => addToPipeline(tx, { accountId, publicationIds: [kitId, bombaId], userId: 'u1' }));
    await db.$transaction((tx) => advanceStep(tx, { publicationId: kitId, expected: 'INFO', userId: 'u1' }));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)) as {
      result: { content: { text: string }[]; isError?: boolean };
    };
    const text = r.result.content[0].text;
    for (const s of SECRETS) expect(text).not.toContain(s);
    return { text, isError: r.result.isError === true, data: r.result.isError ? null : JSON.parse(text) };
  }

  it('responde el saludo con las instrucciones y la versión que pide Claude', async () => {
    const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, ctx)) as {
      result: { protocolVersion: string; instructions: string; capabilities: unknown };
    };
    expect(r.result.protocolVersion).toBe('2025-06-18');
    expect(r.result.instructions).toContain('Información, Título');
    expect(r.result.capabilities).toEqual({ tools: { listChanged: false } });
    const future = (await handleRpc({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2099-01-01' } }, ctx)) as {
      result: { protocolVersion: string };
    };
    expect(future.result.protocolVersion).toBe('2025-11-25');
    expect(await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx)).toBeNull();
    expect(await handleRpc({ jsonrpc: '2.0', id: 3, method: 'otra/cosa' }, ctx)).toMatchObject({ error: { code: -32601 } });
    expect(await handleRpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'no_existe' } }, ctx)).toMatchObject({
      error: { code: -32602 },
    });
  });

  it('list_accounts: cuentas, tiendas y conteos del pipeline', async () => {
    const { data } = await call('list_accounts');
    expect(data.conectado_como).toBe('Persona');
    expect(data.cuentas).toEqual([
      expect.objectContaining({
        cuenta: 'prueba',
        tiendas: ['Mercado Libre · TIENDA'],
        publicaciones: 2,
        pipeline: expect.objectContaining({ 'En pipeline': 2, 'Sin tocar': 0 }),
        en_cada_paso: expect.objectContaining({ Información: 1, Título: 1 }),
      }),
    ]);
  });

  it('pide la cuenta cuando hay más de una', async () => {
    await db.account.create({ data: { slug: 'otra', name: 'Otra cuenta' } });
    const r = await call('get_pipeline_board');
    expect(r.isError).toBe(true);
    expect(r.text).toContain('prueba');
    expect((await call('get_pipeline_board', { cuenta: 'Cuenta de prueba' })).isError).toBe(false);
    expect((await call('get_pipeline_board', { cuenta: 'nada' })).isError).toBe(true);
  });

  it('search_catalog: filtros de la pantalla, paso y tipo de producto aproximado', async () => {
    expect((await call('search_catalog')).data.total).toBe(2);
    const byStep = (await call('search_catalog', { paso: ['TITLE'] })).data;
    expect(byStep.publicaciones.map((p: { codigo: string }) => p.codigo)).toEqual(['MLA1110001']);
    expect(byStep.publicaciones[0]).toMatchObject({
      tipo_de_producto: 'Kit de embrague',
      visitas_90d: 120,
      ventas_90d: 3,
      titulo_bloqueado: 'sí',
      pipeline: 'En pipeline · Título',
      link_app: `https://app.ejemplo.com/a/prueba/pipeline/${kitId}`,
    });
    expect((await call('search_catalog', { tipo_de_producto: ['embrague'] })).data.total).toBe(1);
    expect((await call('search_catalog', { tipo_de_producto: ['no existe'] })).isError).toBe(true);
    expect((await call('search_catalog', { ventas: ['con'] })).data.total).toBe(1);
    expect((await call('search_catalog', { texto: 'sku-1' })).data.total).toBe(1);
    const page = (await call('search_catalog', { limite: 1, desde: 1, orden: 'titulo' })).data;
    expect(page).toMatchObject({ total: 2, mostrando: '2 a 2' });
    expect(page.publicaciones[0].codigo).toBe('MLA1110001');
    const types = (await call('search_catalog', { incluir_tipos: true })).data.tipos_de_producto;
    expect(types).toHaveLength(2);
    expect((await call('search_catalog', { pipeline: ['NADA'] })).isError).toBe(true);
  });

  it('get_pipeline_board: cada paso con sus publicaciones y los días', async () => {
    const { data } = await call('get_pipeline_board');
    expect(data.en_el_pipeline).toBe(2);
    const info = data.pasos.find((p: { paso: string }) => p.paso === 'INFO');
    expect(info).toMatchObject({ nombre: 'Información', cantidad: 1 });
    expect(info.publicaciones[0]).toMatchObject({ codigo: 'MLA2220002', dias_en_el_paso: 0 });
    expect(data.pasos).toHaveLength(9);
  });

  it('get_publication: ficha, puntaje, medición e historial, sin precios ni datos internos', async () => {
    for (const ref of ['MLA1110001', 'https://articulo.mercadolibre.com.ar/MLA-1110001-kit', kitId]) {
      const { data } = await call('get_publication', { publicacion: ref });
      expect(data.id).toBe(kitId);
    }
    const { data, text } = await call('get_publication', { publicacion: 'mla1110001' });
    expect(data.ficha).toMatchObject({
      tipo: 'Kit de embrague',
      numero_de_pieza: 'P-100',
      ficha_tecnica: [{ name: 'Diámetro', value: '200 mm' }],
      variantes: [{ medida: 'STD', sku: 'SKU-1' }],
    });
    expect(data.atributos_en_el_canal).toEqual([{ name: 'Marca', value: 'Marca Uno' }]);
    expect(data.ultima_medicion.metricas).toMatchObject({ 'Visitas (90 días)': '120', 'Ventas (90 días)': '3' });
    expect(data.pipeline.historial.map((m: { paso: string }) => m.paso)).toEqual(['Información', 'Título']);
    expect(data.competencia).toMatchObject([{ titulo: 'Kit Embrague Modelo X Original', vendidos: 50, link: null, precio_de_lista: null }]);
    // El precio de la publicación no va; el de la competencia sí, porque es público.
    expect(text.replace(/"competencia":\[.*?\](?=,"investigacion")/s, '')).not.toMatch(/price|precio|notes|currency/i);
    expect((await call('get_publication', { publicacion: 'MLA9990009' })).text).toContain('no está en las Publicaciones');
    expect((await call('get_publication', {})).isError).toBe(true);
  });

  it('get_title_workspace: reglas, semillas, palabras y chequeo del título actual', async () => {
    await db.titleWork.create({ data: { publicationId: kitId, proposals: [{ title: 'Kit Embrague Modelo X 1.6', reason: 'r' }] } });
    const { data } = await call('get_title_workspace', { publicacion: 'MLA1110001' });
    expect(data.publicacion).toMatchObject({ codigo: 'MLA1110001', titulo_actual: 'Kit Embrague Modelo X', pipeline: 'En pipeline · Título' });
    expect(data.reglas.largo_maximo).toBe(60);
    expect(data.semillas.length).toBeGreaterThan(0);
    expect(data.mapa_de_palabras.palabras.map((w: { palabra: string }) => w.palabra)).toContain('original');
    expect(data.propuestas).toEqual([{ titulo: 'Kit Embrague Modelo X 1.6', motivo: 'r' }]);
    expect(data.chequeo_del_titulo_actual.errors).toEqual([]);
    expect(data.titulo_bloqueado.bloqueado).toBe('sí');
  });

  it('check_title: el mismo control de la app, con el aviso del título bloqueado', async () => {
    const ok = (await call('check_title', { publicacion: 'MLA1110001', titulo: 'Kit Embrague Modelo X 1.6' })).data;
    expect(ok).toMatchObject({ se_puede_aprobar: true, errores: [], caracteres: 25, largo_maximo: 60 });
    expect(ok.avisos.join(' ')).toContain('bloqueado');
    const long = (await call('check_title', { publicacion: 'MLA1110001', titulo: 'Kit '.repeat(20) })).data;
    expect(long.se_puede_aprobar).toBe(false);
    expect(long.errores.join(' ')).toContain('máximo es 60');
  });
});
