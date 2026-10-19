import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { wordKey } from '@/domain/titles';
import type { McpContext } from '@/lib/mcp/tool';

// Datos inventados. El número raro hace de precio: no puede aparecer en lo que ve Claude.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { handleRpc, toolList } = await import('@/lib/mcp/server');

describe('herramientas de escritura en la lista', () => {
  it('marcadas como de escritura, y las que pisan algo como destructivas', () => {
    const tools = new Map(toolList().map((t) => [t.name, t.annotations]));
    expect(tools.get('add_to_pipeline')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(tools.get('approve_title')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('remove_from_pipeline')).toMatchObject({ destructiveHint: true });
    expect(tools.get('get_publication')).toEqual(expect.not.objectContaining({ destructiveHint: expect.anything() }));
    expect(tools.size).toBe(20);
  });
});

describe.skipIf(!url)('herramientas de escritura', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const ctx: McpContext = { db, userId: 'u1', baseUrl: 'https://app.ejemplo.com' };
  let accountId = '';
  let productId = '';
  let kitId = '';
  let copyId = '';
  let bombaId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE title_rule_sets, title_approvals, title_works, search_positions, search_suggestions, competitor_listings, pipeline_movements, measurements, publications, products, stores, channels, accounts, users CASCADE',
    );
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    const kit = await db.product.create({
      data: {
        accountId,
        name: 'Kit de embrague Gol',
        productType: 'Kit de embrague',
        brand: 'Marca Uno',
        partNumber: 'P-100',
        line: 'Liviano nafta',
        variants: { create: [{ sku: 'SKU-1', measure: 'STD', position: 0 }] },
        compatibilities: { create: [{ vehicleBrand: 'Volkswagen', model: 'Gol', engine: '1.6 8v' }] },
      },
    });
    productId = kit.id;
    const pub = (externalId: string, title: string, extra = {}) =>
      db.publication.create({ data: { productId: kit.id, storeId: store.id, externalId, title, price: '987654.00', ...extra } });
    kitId = (await pub('MLA1110001', 'Kit Embrague Gol', { measurements: { create: [{ takenAt: new Date(), metrics: { sales_90d: 0 } }] } })).id;
    copyId = (await pub('MLA1110002', 'Kit Embrague Gol Cuotas')).id;
    const bomba = await db.product.create({ data: { accountId, name: 'Bomba de agua', productType: 'Bomba de agua' } });
    bombaId = (
      await db.publication.create({
        data: {
          productId: bomba.id,
          storeId: store.id,
          externalId: 'MLA2220002',
          title: 'Bomba Agua Fiat',
          measurements: { create: [{ takenAt: new Date(), metrics: { sales_90d: 4 } }] },
        },
      })
    ).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)) as {
      result: { content: { text: string }[]; isError?: boolean };
    };
    const text = r.result.content[0].text;
    expect(text).not.toContain('987654');
    return { text, isError: r.result.isError === true, data: r.result.isError ? null : JSON.parse(text) };
  }
  const state = (id: string) =>
    db.publication.findUniqueOrThrow({ where: { id }, select: { pipelineStatus: true, pipelineStep: true, pipelineRemoval: true, title: true } });
  const toTitle = async (codigo: string) => {
    await call('add_to_pipeline', { publicaciones: [codigo] });
    await call('move_pipeline_step', { publicacion: codigo, desde_paso: 'INFO', accion: 'avanzar' });
  };

  it('add_to_pipeline: por código o link, con aviso de repetidas, a nombre de la persona', async () => {
    const first = await call('add_to_pipeline', { publicaciones: ['https://articulo.mercadolibre.com.ar/MLA-1110001-kit', 'MLA9990009', 'cualquiera'] });
    expect(first.data).toMatchObject({ listo: true, agregadas: 1, no_estan_en_el_catalogo: ['MLA9990009'], no_se_entienden: ['cualquiera'] });
    const move = await db.pipelineMovement.findFirstOrThrow({ where: { publicationId: kitId } });
    expect(move).toMatchObject({ step: 'INFO', userId: 'u1' });

    const dup = await call('add_to_pipeline', { publicaciones: ['MLA1110002'] });
    expect(dup.data).toMatchObject({ listo: false, repetidas: [expect.objectContaining({ codigo: 'MLA1110002', motivo: 'Es del mismo producto que otra' })] });
    expect((await state(copyId)).pipelineStatus).toBe('UNTOUCHED');
    const forced = await call('add_to_pipeline', { publicaciones: ['MLA1110002'], agregar_repetidas: true });
    expect(forced.data).toMatchObject({ listo: true, agregadas: 1 });
    expect((await call('add_to_pipeline', { publicaciones: ['MLA0000000'] })).isError).toBe(true);
  });

  it('move_pipeline_step y remove_from_pipeline: con el paso esperado, igual que en la app', async () => {
    await call('add_to_pipeline', { publicaciones: ['MLA2220002'] });
    const next = await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'INFO', accion: 'avanzar' });
    expect(next.data).toMatchObject({ listo: true, pipeline: 'En pipeline · Título', link_app: `https://app.ejemplo.com/a/prueba/pipeline/${bombaId}` });
    const twice = await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'INFO', accion: 'avanzar' });
    expect(twice.isError).toBe(true);
    expect(twice.text).toContain('Volvé a consultarla');
    expect((await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'TITLE', accion: 'marcar_corregida' })).text).toContain('faltan pasos');
    expect((await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'TITLE', accion: 'volver' })).data.pipeline).toBe(
      'En pipeline · Información',
    );

    const removed = await call('remove_from_pipeline', { publicacion: 'MLA2220002', desde_paso: 'INFO', motivo: 'LATER' });
    expect(removed.data.pipeline).toBe('Descartada · más adelante');
    expect(await db.pipelineMovement.findFirst({ where: { publicationId: bombaId, exitKind: 'REMOVED' } })).toMatchObject({
      removal: 'LATER',
      exitedById: 'u1',
    });
    expect((await call('remove_from_pipeline', { publicacion: 'MLA2220002', desde_paso: 'INFO', motivo: 'OTRO' })).isError).toBe(true);
  });

  it('update_product_info: cambia solo lo que se manda, conserva las medidas y saca la cilindrada del motor', async () => {
    const variantId = (await db.productVariant.findFirstOrThrow({ where: { productId } })).id;
    const r = await call('update_product_info', {
      publicacion: 'MLA1110001',
      marca: 'Marca Dos',
      linea: '',
      medidas: [{ medida: 'STD', sku: 'sku-1' }, { medida: '0.25', sku: 'SKU-2' }],
    });
    expect(r.data).toMatchObject({ listo: true });
    const p = await db.product.findUniqueOrThrow({
      where: { id: productId },
      include: { variants: { orderBy: { position: 'asc' } }, compatibilities: true },
    });
    expect(p).toMatchObject({ brand: 'Marca Dos', line: null, productType: 'Kit de embrague', partNumber: 'P-100' });
    expect(p.variants.map((v) => [v.id === variantId, v.measure, v.sku])).toEqual([
      [true, 'STD', 'sku-1'],
      [false, '0.25', 'SKU-2'],
    ]);
    expect(p.compatibilities).toHaveLength(1);

    await call('update_product_info', {
      publicacion: 'MLA1110001',
      compatibilidades: [{ marca: 'Volkswagen', modelo: 'Gol', motor: '1.6 8v', desde: 2010, hasta: 2015 }],
    });
    const c = await db.compatibility.findFirstOrThrow({ where: { productId } });
    expect(c).toMatchObject({ displacement: '1.6', yearFrom: 2010, yearTo: 2015 });
    const bad = await call('update_product_info', { publicacion: 'MLA1110001', compatibilidades: [{ marca: 'VW', desde: 2015, hasta: 2010 }] });
    expect(bad).toMatchObject({ isError: true });
    expect(bad.text).toContain('año desde');
  });

  it('save_competitors: reemplaza la lista, hasta 5', async () => {
    const r = await call('save_competitors', {
      publicacion: 'MLA1110001',
      competencia: [{ titulo: 'Kit Embrague Gol Original', vendidos: 120, link: 'https://ejemplo.com/a' }, { titulo: 'Kit Embrague Vw Gol' }],
    });
    expect(r.data).toMatchObject({ listo: true, guardadas: 2 });
    expect(await db.competitorListing.count({ where: { publicationId: kitId } })).toBe(2);
    expect((await call('save_competitors', { publicacion: 'MLA1110001', competencia: [] })).data.guardadas).toBe(0);
    expect((await call('save_competitors', { publicacion: 'MLA1110001', competencia: [{ titulo: 'x', link: 'no-es-link' }] })).isError).toBe(true);
  });

  it('el trabajo del título: semillas, sugerencias, palabras, búsquedas y posiciones', async () => {
    await toTitle('MLA1110001');
    expect((await call('save_title_seeds', { publicacion: 'MLA1110001', semillas: ['Kit Embrague Gol', 'kit embrague gol'] })).data.semillas).toEqual([
      'kit embrague gol',
    ]);
    const s = await call('save_search_suggestions', {
      publicacion: 'MLA1110001',
      semilla: 'kit embrague gol',
      sugerencias: ['1. Kit Embrague Gol Trend', '- kit embrague gol power 1.6', 'kit embrague gol trend'],
    });
    expect(s.data.guardadas).toBe(2);
    const words = await call('set_title_words', { publicacion: 'MLA1110001', palabras: ['kit', 'embrague', 'trend', 'inventada'], estado: 'usar' });
    expect(words.data).toMatchObject({ marcadas: ['kit', 'embrague', 'trend'], no_estan_en_el_mapa: ['inventada'] });
    expect((await call('set_title_words', { publicacion: 'MLA1110001', palabras: ['inventada'], estado: 'usar' })).isError).toBe(true);
    await call('set_title_words', { publicacion: 'MLA1110001', palabras: ['trend'], estado: 'sin_marcar' });
    const work = await db.titleWork.findUniqueOrThrow({ where: { publicationId: kitId } });
    expect(work.words).toEqual({ [wordKey('kit')]: 'use', [wordKey('embrague')]: 'use' });

    expect((await call('set_main_searches', { publicacion: 'MLA1110001', busquedas: ['Kit Embrague Gol', 'kit embrague gol trend'] })).data.busquedas_principales).toEqual([
      'kit embrague gol',
      'kit embrague gol trend',
    ]);
    expect((await call('save_search_position', { publicacion: 'MLA1110001', busqueda: 'kit embrague gol', pagina: 2, posicion: 14 })).data.listo).toBe(true);
    expect((await call('save_search_position', { publicacion: 'MLA1110001', busqueda: 'kit embrague gol trend', pagina: null })).data.listo).toBe(true);
    expect((await call('save_search_position', { publicacion: 'MLA1110001', busqueda: 'x', pagina: 2 })).text).toContain('posición');

    const ws = (await call('get_title_workspace', { publicacion: 'MLA1110001' })).data;
    expect(ws.sugerencias_del_buscador[0]).toMatchObject({ semilla: 'kit embrague gol', origen: 'cargado a mano' });
    expect(ws.palabras_tildadas).toEqual(['kit', 'embrague']);
    expect(ws.posiciones.map((p: { pagina: number | null }) => p.pagina).sort()).toEqual([2, null]);
  });

  it('propuestas y aprobación: con el mismo control de la app', async () => {
    await toTitle('MLA1110001');
    const saved = await call('save_title_proposals', {
      publicacion: 'MLA1110001',
      propuestas: [
        { titulo: 'Kit Embrague Gol 1.6 8v', motivo: 'Cubre la búsqueda principal' },
        { titulo: 'Kit Embrague Gol 1.6 8v', motivo: 'repetida' },
        { titulo: 'Kit Embrague Gol Oferta!', motivo: 'con errores' },
      ],
    });
    expect(saved.data.propuestas).toEqual([
      expect.objectContaining({ titulo: 'Kit Embrague Gol 1.6 8v', se_puede_aprobar: true }),
      expect.objectContaining({ titulo: 'Kit Embrague Gol Oferta!', se_puede_aprobar: false }),
    ]);
    const work = await db.titleWork.findUniqueOrThrow({ where: { publicationId: kitId } });
    expect(work.proposals).toHaveLength(2);
    expect(work.proposalUsage).toBeNull();
    expect((await call('save_title_proposals', { publicacion: 'MLA1110001', propuestas: [] })).isError).toBe(true);

    expect((await call('approve_title', { publicacion: 'MLA1110001', titulo: 'Kit Embrague Gol Oferta!' })).text).toContain('Para aprobar falta');
    const ok = await call('approve_title', { publicacion: 'MLA1110001', titulo: 'Kit Embrague Gol 1.6 8v', propuesta_elegida: 'Kit Embrague Gol 1.6 8v' });
    expect(ok.data).toMatchObject({ listo: true, titulo: 'Kit Embrague Gol 1.6 8v', pipeline: 'En pipeline · Imágenes' });
    expect(await db.titleApproval.findFirstOrThrow({ where: { publicationId: kitId } })).toMatchObject({
      outcome: 'WRITTEN',
      before: 'Kit Embrague Gol',
      aiTitle: 'Kit Embrague Gol 1.6 8v',
      edited: false,
      userId: 'u1',
    });
    expect((await call('approve_title', { publicacion: 'MLA1110001', titulo: 'Otro' })).text).toContain('paso Título');
  });

  it('título bloqueado: no deja aprobar sin decidir; mantener completa el paso', async () => {
    await toTitle('MLA2220002');
    expect((await call('approve_title', { publicacion: 'MLA2220002', titulo: 'Bomba Agua Fiat Uno' })).text).toContain('bloqueado');
    const keep = await call('decide_title_lock', { publicacion: 'MLA2220002', decision: 'mantener' });
    expect(keep.data).toMatchObject({ pipeline: 'En pipeline · Imágenes', titulo: 'Bomba Agua Fiat' });
    expect((await db.titleApproval.findFirstOrThrow({ where: { publicationId: bombaId } })).outcome).toBe('KEPT');
  });

  it('título bloqueado: probar en la copia guarda el título sin escribirlo', async () => {
    await toTitle('MLA2220002');
    await call('decide_title_lock', { publicacion: 'MLA2220002', decision: 'probar_en_copia' });
    const r = await call('approve_title', { publicacion: 'MLA2220002', titulo: 'Bomba Agua Fiat Uno 1.3' });
    expect(r.data).toMatchObject({ mensaje: 'Título guardado para la copia con cuotas.', titulo: 'Bomba Agua Fiat' });
  });

  it('update_title_rules: cambia solo lo que se manda, y restablecer vuelve a las del canal', async () => {
    const r = await call('update_title_rules', { largo_maximo: 50, palabras_no_permitidas: ['Oferta'] });
    expect(r.data.reglas).toMatchObject({ largo_maximo: 50, palabras_no_permitidas: ['Oferta'], son_de_la_cuenta: true });
    expect(r.data.reglas.signos_no_permitidos.length).toBeGreaterThan(0);
    expect((await db.titleRuleSet.findFirstOrThrow()).updatedById).toBe('u1');
    expect((await call('check_title', { publicacion: 'MLA1110001', titulo: 'Kit '.repeat(13) })).data.largo_maximo).toBe(50);
    expect((await call('update_title_rules', { largo_maximo: 5 })).isError).toBe(true);
    expect((await call('update_title_rules', { canal: 'Otro canal', largo_maximo: 50 })).isError).toBe(true);
    const reset = await call('update_title_rules', { restablecer: true });
    expect(reset.data.reglas).toMatchObject({ largo_maximo: 60, son_de_la_cuenta: false });
  });
});
