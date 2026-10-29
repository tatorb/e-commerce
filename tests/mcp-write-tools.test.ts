import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { wordKey } from '@/domain/titles';
import type { McpContext } from '@/lib/mcp/tool';

// Datos inventados.

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
    expect(tools.get('save_catalog_data')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('create_publication')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(tools.get('update_publication')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    for (const name of ['save_technical_sheet', 'save_kit_contents', 'set_publication_title', 'copy_publication_data', 'save_store_knowledge', 'save_publication_qa']) {
      expect(tools.get(name)).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
    expect(tools.get('create_task')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(tools.get('update_task')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(tools.get('set_product_stock')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('set_product_cost')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('save_price')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('update_pricing_settings')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('set_publication_status')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('push_prices')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('choose_campaign')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(tools.size).toBe(49);
  });
});

describe.skipIf(!url)('herramientas de escritura', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const ctx: McpContext = { db, userId: 'u1', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
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
    return { text, isError: r.result.isError === true, data: r.result.isError ? null : JSON.parse(text) };
  }
  const state = (id: string) =>
    db.publication.findUniqueOrThrow({ where: { id }, select: { pipelineStatus: true, pipelineStep: true, pipelineRemoval: true, title: true } });
  const toTitle = async (codigo: string) => {
    await call('add_to_pipeline', { publicaciones: [codigo] });
    await call('move_pipeline_step', { publicacion: codigo, desde_paso: 'INFO', accion: 'avanzar' });
  };

  it('add_to_pipeline: por código o link, con aviso de las del mismo producto, a nombre de la persona', async () => {
    const first = await call('add_to_pipeline', { publicaciones: ['https://articulo.mercadolibre.com.ar/MLA-1110001-kit', 'MLA9990009', 'cualquiera'] });
    expect(first.data).toMatchObject({ listo: true, agregadas: 1, no_estan_en_el_catalogo: ['MLA9990009'], no_se_entienden: ['cualquiera'] });
    const move = await db.pipelineMovement.findFirstOrThrow({ where: { publicationId: kitId } });
    expect(move).toMatchObject({ step: 'INFO', userId: 'u1' });

    // La otra del mismo producto entra igual, con aviso.
    const dup = await call('add_to_pipeline', { publicaciones: ['MLA1110002'] });
    expect(dup.data).toMatchObject({
      listo: true,
      agregadas: 1,
      avisos: [expect.objectContaining({ codigo: 'MLA1110002', motivo: 'Es del mismo producto que otra' })],
    });
    expect((await state(copyId)).pipelineStatus).toBe('IN_PIPELINE');
    expect((await call('add_to_pipeline', { publicaciones: ['MLA0000000'] })).isError).toBe(true);
  });

  it('create_publication y update_publication: nueva sin publicar, en Información, y después su código', async () => {
    expect((await call('create_publication', {})).text).toContain('producto o producto_nuevo');
    expect((await call('create_publication', { producto: 'P-100', tienda: 'Otra' })).text).toContain('No encontré la tienda');

    const existing = await call('create_publication', { producto: 'P-100' });
    expect(existing.data).toMatchObject({
      listo: true,
      producto: 'Kit de embrague Gol',
      tienda: 'TIENDA',
      codigo: null,
      pipeline: 'En pipeline · Información',
    });
    const nuevo = await call('create_publication', { producto_nuevo: { nombre: 'Combo Gol', tipo: 'Kit de embrague', individual_o_combo: 'combo' } });
    expect(nuevo.data).toMatchObject({ listo: true, producto: 'Combo Gol', codigo: null });
    const pubId = nuevo.data.link_app.split('/').pop();
    const created = await db.publication.findUniqueOrThrow({ where: { id: pubId }, include: { product: true } });
    expect(created).toMatchObject({ channelStatus: 'UNPUBLISHED', pipelineStep: 'INFO', product: { kind: 'COMBO', productType: 'Kit de embrague' } });

    // El código se busca por id, porque todavía no tiene código.
    expect((await call('update_publication', { publicacion: pubId, codigo: 'MLA1110001' })).text).toContain('Ya hay una publicación con ese ID');
    const coded = await call('update_publication', { publicacion: pubId, codigo: 'https://articulo.mercadolibre.com.ar/MLA-5550001-combo-_JM' });
    expect(coded.data).toMatchObject({ listo: true, codigo: 'MLA5550001', link_canal: 'https://articulo.mercadolibre.com.ar/MLA-5550001' });
    expect((await db.publication.findUniqueOrThrow({ where: { id: pubId } })).channelStatus).toBe('ACTIVE');
  });

  it('move_pipeline_step y remove_from_pipeline: con el paso esperado, igual que en la app', async () => {
    await call('add_to_pipeline', { publicaciones: ['MLA2220002'] });
    const next = await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'INFO', accion: 'avanzar' });
    expect(next.data).toMatchObject({ listo: true, pipeline: 'En pipeline · Título', link_app: `https://app.ejemplo.com/a/prueba/pipeline/${bombaId}` });
    const twice = await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'INFO', accion: 'avanzar' });
    expect(twice.isError).toBe(true);
    expect(twice.text).toContain('Volvé a consultarla');
    expect((await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'TITLE', accion: 'marcar_corregida' })).text).toContain('faltan pasos');
    expect((await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'TITLE', accion: 'mover' })).text).toContain('a_paso');
    expect((await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'TITLE', accion: 'mover', a_paso: 'PRICE' })).data.pipeline).toBe(
      'En pipeline · Precio',
    );
    expect((await call('move_pipeline_step', { publicacion: 'MLA2220002', desde_paso: 'PRICE', accion: 'mover', a_paso: 'TITLE' })).data.pipeline).toBe(
      'En pipeline · Título',
    );
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

  it('save_competitors: reemplaza la lista, también con más de 5', async () => {
    const r = await call('save_competitors', {
      publicacion: 'MLA1110001',
      competencia: [{ titulo: 'Kit Embrague Gol Original', vendidos: 120, link: 'https://ejemplo.com/a', marca: 'Sachs' }, { titulo: 'Kit Embrague Vw Gol' }],
    });
    expect(r.data).toMatchObject({ listo: true, guardadas: 2 });
    expect(await db.competitorListing.count({ where: { publicationId: kitId } })).toBe(2);
    expect((await db.competitorListing.findFirstOrThrow({ where: { publicationId: kitId }, orderBy: { position: 'asc' } })).brand).toBe('Sachs');
    const seven = Array.from({ length: 7 }, (_, i) => ({ titulo: `Kit Embrague Gol ${i + 1}` }));
    expect((await call('save_competitors', { publicacion: 'MLA1110001', competencia: seven })).data.guardadas).toBe(7);
    expect((await call('save_competitors', { publicacion: 'MLA1110001', competencia: [] })).data.guardadas).toBe(0);
    expect((await call('save_competitors', { publicacion: 'MLA1110001', competencia: [{ titulo: 'x', link: 'no-es-link' }] })).isError).toBe(true);
  });

  it('save_competitors: con precio, descuento, cuotas y envío; sin fecha queda la de hoy', async () => {
    const r = await call('save_competitors', {
      publicacion: 'MLA1110001',
      competencia: [
        { titulo: 'Kit Embrague Gol A', vendedor: 'Repuestos A', precio_de_lista: 100000, descuento_pct: 10, cuotas_sin_interes: 6, envio_gratis: true, notas: 'Lleva regalo' },
        { titulo: 'Kit Embrague Gol B', precio_de_lista: 80000, relevado: '2026-10-01' },
        { titulo: 'Kit Embrague Gol C' },
      ],
    });
    expect(r.data).toMatchObject({ listo: true, guardadas: 3 });
    const rows = await db.competitorListing.findMany({ where: { publicationId: kitId }, orderBy: { position: 'asc' } });
    expect(rows[0]).toMatchObject({ sellerName: 'Repuestos A', installments: 6, freeShipping: true, notes: 'Lleva regalo' });
    expect(Number(rows[0].listPrice)).toBe(100000);
    expect(Number(rows[0].discountPct)).toBe(10);
    expect(rows[0].surveyedAt).not.toBeNull();
    expect(rows[1].surveyedAt?.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(rows[2]).toMatchObject({ listPrice: null, surveyedAt: null, installments: 0, freeShipping: false });

    const { data } = await call('get_publication', { publicacion: 'MLA1110001' });
    expect(data.competencia[0]).toMatchObject({ vendedor: 'Repuestos A', precio_de_lista: 100000, precio_final: 90000, valor_cuota: 15000, envio_gratis: true });
    expect(data.competencia[2]).toMatchObject({ precio_de_lista: null, precio_final: null, valor_cuota: null });

    expect((await call('save_competitors', { publicacion: 'MLA1110001', competencia: [{ titulo: 'x', cuotas_sin_interes: 4 }] })).isError).toBe(true);
    expect((await call('save_competitors', { publicacion: 'MLA1110001', competencia: [{ titulo: 'x', relevado: '2026-02-30' }] })).isError).toBe(true);
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
    // Desde otro paso también se aprueba, sin mover la publicación.
    const again = await call('approve_title', { publicacion: 'MLA1110001', titulo: 'Kit Embrague Gol 1.6 8v Sachs' });
    expect(again.data).toMatchObject({ listo: true, pipeline: 'En pipeline · Imágenes' });
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

  it('investigación del producto: fabricante, aclaraciones, preguntas, dolores y objeciones', async () => {
    const m = await call('save_manufacturer_info', {
      publicacion: 'MLA1110001',
      sitio: 'https://fabricante.com',
      texto: 'Diámetro 200 mm\nPrecio de lista 777999',
    });
    expect(m.data.listo).toBe(true);
    expect((await call('save_manufacturer_info', { publicacion: 'MLA1110001', pagina_del_producto: 'fabricante.com/kit' })).isError).toBe(true);
    await call('save_manufacturer_info', { publicacion: 'MLA1110001', pagina_del_producto: 'https://fabricante.com/kit' });
    await call('save_image_clarifications', { publicacion: 'MLA1110001', texto: 'Sirve para **Gol 1.6**\n- No confundir con 1.4' });
    await call('save_store_knowledge', { publicacion: 'MLA1110001', texto: '- No incluye las juntas\n- La garantía vale con la factura del taller' });
    await call('save_buyer_questions', { publicacion: 'MLA1110001', propia: '¿Sirve para Gol 2012?', competencia: '¿Es original?' });
    await call('save_buyer_insights', { publicacion: 'MLA1110001', lista: 'dolores', accion: 'agregar', items: ['No sabe si le sirve'] });
    await call('save_buyer_insights', { publicacion: 'MLA1110001', lista: 'dolores', accion: 'agregar', items: ['Teme que no sea la medida'] });
    const obj = await call('save_buyer_insights', { publicacion: 'MLA1110001', lista: 'objeciones', accion: 'reemplazar', items: ['Duda de la calidad'] });
    expect(obj.data.objeciones).toEqual(['Duda de la calidad']);
    expect((await call('save_buyer_insights', { publicacion: 'MLA1110001', lista: 'dolores', accion: 'agregar', items: [] })).isError).toBe(true);

    const r = await db.productResearch.findUniqueOrThrow({ where: { productId } });
    expect(r).toMatchObject({
      manufacturerSite: 'https://fabricante.com',
      manufacturerProductUrl: 'https://fabricante.com/kit',
      clarifications: '<p>Sirve para <strong>Gol 1.6</strong></p><ul><li><p>No confundir con 1.4</p></li></ul>',
      storeKnowledge: '<ul><li><p>No incluye las juntas</p></li><li><p>La garantía vale con la factura del taller</p></li></ul>',
      competitorQuestions: '¿Es original?',
      updatedById: 'u1',
    });
    const mine = await call('get_publication', { publicacion: 'MLA1110001' });
    expect(mine.data.investigacion.preguntas).toEqual({ recibidas: [], propia: '¿Sirve para Gol 2012?', competencia: '¿Es original?' });
    expect(mine.data.ficha.publicaciones_que_la_comparten).toBe(2);

    // Lo ve también la otra publicación del mismo producto, sin la línea del
    // precio. Las preguntas propias no: son de cada publicación.
    const { data, text } = await call('get_publication', { publicacion: 'MLA1110002' });
    expect(text).not.toContain('777999');
    expect(data.investigacion).toMatchObject({
      fabricante: { sitio: 'https://fabricante.com', texto: 'Diámetro 200 mm', aviso: 'Se ocultó una línea que parecía un precio.', archivos: [] },
      aclaraciones_para_imagenes: 'Sirve para **Gol 1.6**\n- No confundir con 1.4',
      lo_que_sabe_la_tienda: '- No incluye las juntas\n- La garantía vale con la factura del taller',
      preguntas: { propia: null, competencia: '¿Es original?' },
      dolores: ['No sabe si le sirve', 'Teme que no sea la medida'],
      objeciones: ['Duda de la calidad'],
    });
  });

  it('preguntas y respuestas: son de la publicación y el interruptor no se toca desde acá', async () => {
    const saved = await call('save_publication_qa', {
      publicacion: 'MLA1110001',
      preguntas_frecuentes: '- ¿Trae juntas? No, se venden aparte.',
      reglas: 'Si preguntan por **otro motor**, que responda una persona.',
    });
    expect(saved.isError).toBeFalsy();
    // Lo que no se manda queda como está.
    await call('save_publication_qa', { publicacion: 'MLA1110001', reglas: 'Si preguntan por **otro motor**, que responda una persona.' });
    expect(await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1110001' }, select: { faq: true, answerRules: true, autoAnswer: true } })).toEqual({
      faq: '<ul><li><p>¿Trae juntas? No, se venden aparte.</p></li></ul>',
      answerRules: '<p>Si preguntan por <strong>otro motor</strong>, que responda una persona.</p>',
      autoAnswer: false,
    });
    expect((await call('get_publication', { publicacion: 'MLA1110001' })).data.preguntas_y_respuestas).toEqual({
      preguntas_frecuentes: '- ¿Trae juntas? No, se venden aparte.',
      cuando_responde_una_persona: 'Si preguntan por **otro motor**, que responda una persona.',
      claude_responde_solo: false,
    });
    // La otra publicación del mismo producto no las hereda.
    expect((await call('get_publication', { publicacion: 'MLA1110002' })).data.preguntas_y_respuestas.preguntas_frecuentes).toBeNull();
    // Vacío lo borra; sin nada, avisa.
    await call('save_publication_qa', { publicacion: 'MLA1110001', preguntas_frecuentes: '' });
    expect((await db.publication.findFirstOrThrow({ where: { externalId: 'MLA1110001' }, select: { faq: true } })).faq).toBeNull();
    expect((await call('save_publication_qa', { publicacion: 'MLA1110001' })).isError).toBe(true);
  });

  it('datos de catálogo: los campos con sus opciones, y solo valores válidos', async () => {
    await call('update_product_info', { publicacion: 'MLA1110001', origen: 'Brasil' });
    const before = await call('get_publication', { publicacion: 'MLA1110001' });
    expect(before.data.ficha.origen).toBe('Brasil');
    expect(before.data.datos_de_catalogo).toMatchObject({
      canal: 'Mercado Libre',
      categoria: 'Kits de Embrague (MLA373460)',
      categoria_elegida: 'por el tipo de producto',
      de_la_ficha: [
        { nombre: 'Marca', valor: 'Marca Uno' },
        { nombre: 'Número de pieza', valor: 'P-100' },
      ],
    });
    expect(before.data.datos_de_catalogo.campos).toContainEqual({
      campo: 'CLUTCH_TYPE',
      nombre: 'Tipo de embrague',
      tipo: 'opción',
      opciones: ['Multidisco', 'Bidisco', 'Monodisco'],
      valor: null,
    });

    const r = await call('save_catalog_data', {
      publicacion: 'MLA1110001',
      valores: { CLUTCH_TYPE: 'Monodisco', 'Incluye disco': 'Sí', OEM: ['A-1', 'B-2'] },
    });
    expect(r.data.datos_de_catalogo.campos.filter((c: { valor: string | null }) => c.valor)).toEqual([
      expect.objectContaining({ campo: 'CLUTCH_TYPE', valor: 'Monodisco' }),
      expect.objectContaining({ campo: 'INCLUDES_DISC', valor: 'Sí' }),
      expect.objectContaining({ campo: 'OEM', valor: 'A-1, B-2', varios_valores: true }),
    ]);
    const bad = await call('save_catalog_data', { publicacion: 'MLA1110001', valores: { CLUTCH_TYPE: 'Tridisco' } });
    expect(bad).toMatchObject({ isError: true, text: expect.stringContaining('no es una opción') });
    expect((await call('save_catalog_data', { publicacion: 'MLA1110001', valores: { BRAND: 'Otra' } })).text).toContain('sale de la ficha');
    expect((await call('save_catalog_data', { publicacion: 'MLA1110001' })).isError).toBe(true);

    // La bomba de agua tiene la suya; se puede cambiar a mano y volver a la del tipo de producto.
    const bomba = await call('save_catalog_data', { publicacion: 'MLA2220002', categoria: 'Bombas de Aceite' });
    expect(bomba.data.datos_de_catalogo).toMatchObject({ categoria: 'Bombas de Aceite (MLA60626)', categoria_elegida: 'a mano' });
    const back = await call('save_catalog_data', { publicacion: 'MLA2220002', categoria: null });
    expect(back.data.datos_de_catalogo).toMatchObject({ categoria: 'Bombas de Agua (MLA60598)', categoria_elegida: 'por el tipo de producto' });
  });

  it('combos: armar un combo con individuales y verlo en las publicaciones', async () => {
    const r = await call('update_product_info', {
      publicacion: 'MLA2220002',
      individual_o_combo: 'combo',
      productos_del_combo: [{ producto: 'p-100', cantidad: 2 }],
    });
    expect(r.data.productos_del_combo).toEqual([{ nombre: 'Kit de embrague Gol', cantidad: 2, numero_de_pieza: 'P-100' }]);
    const combo = await call('get_publication', { publicacion: 'MLA2220002' });
    expect(combo.data.ficha).toMatchObject({
      individual_o_combo: 'Combo',
      productos_del_combo: [{ nombre: 'Kit de embrague Gol', cantidad: 2, marca: 'Marca Uno', numero_de_pieza: 'P-100' }],
    });
    expect(combo.data.individual_o_combo).toBe('Combo');
    // "tipo" es solo el tipo de producto.
    expect(combo.data.ficha.tipo).not.toBe('Combo');
    const ws = await call('get_title_workspace', { publicacion: 'MLA2220002' });
    expect(ws.data.ficha).toMatchObject({
      individual_o_combo: 'Combo',
      productos_del_combo: [{ nombre: 'Kit de embrague Gol', cantidad: 2, marca: 'Marca Uno', numero_de_pieza: 'P-100' }],
    });
    const part = await call('get_publication', { publicacion: 'MLA1110001' });
    expect(part.data.ficha).toMatchObject({ individual_o_combo: 'Individual', forma_parte_de_combos: [{ nombre: 'Bomba de agua', cantidad: 2 }] });

    expect((await call('update_product_info', { publicacion: 'MLA1110001', individual_o_combo: 'combo' })).text).toContain('Forma parte de «Bomba de agua»');
    expect((await call('update_product_info', { publicacion: 'MLA2220002', productos_del_combo: [{ producto: 'no existe', cantidad: 1 }] })).text).toContain(
      'No encontré el producto «no existe»',
    );
    // Lo que falló no cambió nada.
    expect((await call('get_publication', { publicacion: 'MLA2220002' })).data.ficha.productos_del_combo).toHaveLength(1);

    const combos = await call('search_catalog', { individual_o_combo: ['combo'] });
    expect(combos.data.publicaciones.map((p: { codigo: string }) => p.codigo)).toEqual(['MLA2220002']);
    expect((await call('search_catalog', { individual_o_combo: ['individual'] })).data.total).toBe(2);
    const board = await call('get_pipeline_board', { individual_o_combo: ['combo'] });
    expect(board.isError).toBeFalsy();
  });

  it('save_technical_sheet: completa por nombre, borra con vacío y dice qué campos del tipo de producto faltan', async () => {
    const first = await call('save_technical_sheet', {
      publicacion: 'MLA1110001',
      datos: [
        { nombre: 'Diámetro del disco', valor: '200 mm' },
        { nombre: 'Cantidad de estrías', valor: '28' },
      ],
    });
    expect(first.data).toMatchObject({ listo: true, datos_cargados: 2 });
    // Es del producto: la otra publicación ve la misma ficha técnica.
    const other = await call('save_technical_sheet', {
      publicacion: 'MLA1110002',
      datos: [
        { nombre: 'diametro del DISCO', valor: '  210   mm ' },
        { nombre: 'Cantidad de estrías', valor: '' },
        { nombre: 'Material', valor: 'Acero' },
      ],
    });
    expect(other.data.ficha_tecnica).toEqual([
      { nombre: 'diametro del DISCO', valor: '210 mm' },
      { nombre: 'Material', valor: 'Acero' },
    ]);
    const expected = other.data.campos_esperados_por_el_tipo;
    expect(Array.isArray(expected)).toBe(true);
    expect(expected[0]).toMatchObject({ canal: 'Mercado Libre' });
    expect(expected[0].faltan.length).toBeGreaterThan(0);
    // Marca, número de pieza y origen salen de la ficha: no se piden en la ficha técnica.
    expect(expected[0].campos.map((c: { nombre: string }) => c.nombre)).not.toContain('Marca');

    const replaced = await call('save_technical_sheet', { publicacion: 'MLA1110001', accion: 'reemplazar', datos: [{ nombre: 'Peso', valor: '3,2 kg' }] });
    expect(replaced.data.ficha_tecnica).toEqual([{ nombre: 'Peso', valor: '3,2 kg' }]);
    expect((await call('save_technical_sheet', { publicacion: 'MLA1110001', datos: [{ nombre: '  ', valor: 'x' }] })).text).toContain('necesita un nombre');
    expect((await call('save_technical_sheet', { publicacion: 'MLA1110001', datos: [] })).isError).toBe(true);

    // Sin tipo de producto no hay campos esperados: lo dice en lugar de inventarlos.
    await db.product.updateMany({ where: { name: 'Bomba de agua' }, data: { productType: null } });
    const bomba = await call('save_technical_sheet', { publicacion: 'MLA2220002', datos: [{ nombre: 'Caudal', valor: '40 l/min' }] });
    expect(typeof bomba.data.campos_esperados_por_el_tipo).toBe('string');
  });

  it('save_kit_contents: es del producto, reemplaza el texto y vacío lo borra', async () => {
    const r = await call('save_kit_contents', { publicacion: 'MLA1110002', contenido: '  4 pistones, 4 juegos de aros, 4 pernos, 8 seguros ' });
    expect(r.data).toMatchObject({ listo: true, contenido_del_kit: '4 pistones, 4 juegos de aros, 4 pernos, 8 seguros' });
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).kitContents).toBe('4 pistones, 4 juegos de aros, 4 pernos, 8 seguros');
    expect((await call('get_publication', { publicacion: 'MLA1110001' })).data.ficha.contenido_del_kit).toBe('4 pistones, 4 juegos de aros, 4 pernos, 8 seguros');
    await call('save_kit_contents', { publicacion: 'MLA1110001', contenido: '' });
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).kitContents).toBeNull();
  });

  it('set_publication_title: pone el título sin aprobarlo ni mover el paso, con el mismo chequeo', async () => {
    await call('add_to_pipeline', { publicaciones: ['MLA1110001'] });
    const r = await call('set_publication_title', { publicacion: 'MLA1110001', titulo: '  Kit Embrague Volkswagen Gol 1.6 Marca Uno  ' });
    expect(r.data).toMatchObject({ listo: true, antes: 'Kit Embrague Gol', titulo: 'Kit Embrague Volkswagen Gol 1.6 Marca Uno', pipeline: 'En pipeline · Información' });
    expect(await state(kitId)).toMatchObject({ pipelineStep: 'INFO', title: 'Kit Embrague Volkswagen Gol 1.6 Marca Uno' });
    expect(await db.titleApproval.count()).toBe(0);

    const tooLong = await call('set_publication_title', { publicacion: 'MLA1110001', titulo: 'Kit '.repeat(20) });
    expect(tooLong.isError).toBe(true);
    expect(tooLong.text).toContain('No se guardó');
    expect((await state(kitId)).title).toBe('Kit Embrague Volkswagen Gol 1.6 Marca Uno');
    expect((await call('set_publication_title', { publicacion: 'MLA1110001', titulo: 'Kit Embrague Gol!!' })).isError).toBe(true);

    // Con ventas, el canal no deja cambiar el título.
    const locked = await call('set_publication_title', { publicacion: 'MLA2220002', titulo: 'Bomba de Agua Fiat Palio' });
    expect(locked.text).toContain('bloqueado');
    expect((await state(bombaId)).title).toBe('Bomba Agua Fiat');
  });

  it('create_publication con título: chequeado, y no crea nada si tiene errores', async () => {
    const bad = await call('create_publication', { producto: 'P-100', titulo: 'Kit '.repeat(20) });
    expect(bad.text).toContain('No se creó');
    expect(await db.publication.count()).toBe(3);
    const ok = await call('create_publication', { producto: 'P-100', titulo: 'Kit Embrague Gol Trend 1.6 Marca Uno' });
    expect(ok.data).toMatchObject({ listo: true, titulo: 'Kit Embrague Gol Trend 1.6 Marca Uno', producto: 'Kit de embrague Gol' });
    // Sin título, queda sin título: no toma el nombre del producto.
    const untitled = await call('create_publication', { producto: 'P-100' });
    expect(untitled.data.titulo).toBeNull();
    const board = (await call('get_pipeline_board', {})).data;
    expect(JSON.stringify(board)).not.toContain('"titulo":"Kit de embrague Gol"');
  });

  it('copy_publication_data: copia lo elegido desde otra del mismo producto', async () => {
    await call('save_competitors', {
      publicacion: 'MLA1110001',
      competencia: [{ titulo: 'Kit Embrague Otro', vendidos: 30, vendedor: 'Otro', precio_de_lista: 50000, cuotas_sin_interes: 3, relevado: '2026-10-02' }],
    });
    await call('save_buyer_questions', { publicacion: 'MLA1110001', propia: '¿Sirve para el Gol Trend?' });
    await call('set_main_searches', { publicacion: 'MLA1110001', busquedas: ['kit embrague gol'] });
    await call('save_title_seeds', { publicacion: 'MLA1110001', semillas: ['kit embrague gol'] });

    const r = await call('copy_publication_data', {
      publicacion: 'MLA1110002',
      desde: 'MLA1110001',
      copiar: ['competencia', 'preguntas_propias', 'busquedas_principales', 'semillas'],
    });
    expect(r.data).toMatchObject({
      listo: true,
      desde: { codigo: 'MLA1110001' },
      copiado: { competencia: 1, preguntas_propias: true, busquedas_principales: ['kit embrague gol'], semillas: ['kit embrague gol'] },
    });
    const copy = await db.publication.findUniqueOrThrow({ where: { id: copyId }, include: { competitors: true, titleWork: true } });
    expect(copy.ownQuestions).toBe('¿Sirve para el Gol Trend?');
    expect(copy.competitors.map((c) => c.title)).toEqual(['Kit Embrague Otro']);
    expect(copy.competitors[0]).toMatchObject({ sellerName: 'Otro', installments: 3 });
    expect(Number(copy.competitors[0].listPrice)).toBe(50000);
    expect(copy.competitors[0].surveyedAt?.toISOString().slice(0, 10)).toBe('2026-10-02');
    expect(copy.titleWork).toMatchObject({ seeds: ['kit embrague gol'], mainSearches: ['kit embrague gol'] });

    // Lo que la de origen no tiene no se toca.
    const back = await call('copy_publication_data', { publicacion: 'MLA1110001', desde: 'MLA1110002', copiar: ['competencia'] });
    expect(back.data.copiado).toEqual({ competencia: 1 });
    await db.competitorListing.deleteMany({ where: { publicationId: copyId } });
    const none = await call('copy_publication_data', { publicacion: 'MLA1110001', desde: 'MLA1110002', copiar: ['competencia'] });
    expect(none.data).toMatchObject({ listo: false, no_se_copio_porque_la_de_origen_no_tiene: ['la competencia'] });
    expect(await db.competitorListing.count({ where: { publicationId: kitId } })).toBe(1);

    expect((await call('copy_publication_data', { publicacion: 'MLA1110001', desde: 'MLA2220002', copiar: ['semillas'] })).text).toContain('mismo producto');
    expect((await call('copy_publication_data', { publicacion: 'MLA1110001', desde: 'MLA1110001', copiar: ['semillas'] })).text).toContain('la misma');
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

  it('set_product_cost: guarda el costo, uno solo o el de cada medida, y Claude lo ve', async () => {
    const single = await call('set_product_cost', { publicacion: 'MLA1110001', costo: 123456.78 });
    expect(single.data).toEqual({ guardado: true, medidas_cambiadas: 1, costo_de_reposicion_sin_iva: 123456.78 });
    expect(Number((await db.productCost.findFirstOrThrow({ where: { productId } })).cost)).toBe(123456.78);
    expect((await call('get_publication', { publicacion: 'MLA1110001' })).data.ficha.costo_de_reposicion_sin_iva).toBe(123456.78);
    expect((await call('set_product_cost', { publicacion: 'MLA1110001', medidas: [{ medida: 'STD', costo: 10 }] })).text).toContain('pasá el costo');

    // Con medidas: las que no se mandan quedan como estaban.
    const store = await db.store.findFirstOrThrow();
    const piston = await db.product.create({
      data: { accountId, name: 'Pistones de prueba', variants: { create: [{ sku: 'PI-00', measure: 'STD', position: 0 }, { sku: 'PI-50', measure: '0.50', position: 1 }] } },
    });
    await db.publication.create({ data: { productId: piston.id, storeId: store.id, externalId: 'MLA3330003', title: 'Pistones' } });
    const first = await call('set_product_cost', { publicacion: 'MLA3330003', medidas: [{ medida: 'STD', costo: 4321 }] });
    expect(first.data.costo_de_reposicion_sin_iva).toEqual([
      { medida: 'STD', costo: 4321 },
      { medida: '0.50', costo: null },
    ]);
    const both = await call('set_product_cost', { publicacion: 'MLA3330003', medidas: [{ medida: 'PI-50', costo: 1975.5 }] });
    expect(both.data).toEqual({
      guardado: true,
      medidas_cambiadas: 1,
      costo_de_reposicion_sin_iva: [
        { medida: 'STD', costo: 4321 },
        { medida: '0.50', costo: 1975.5 },
      ],
    });
    expect((await call('get_publication', { publicacion: 'MLA3330003' })).data.ficha.costo_de_reposicion_sin_iva).toEqual(both.data.costo_de_reposicion_sin_iva);
    const wrong = await call('set_product_cost', { publicacion: 'MLA3330003', medidas: [{ medida: '0.75', costo: 1 }] });
    expect(wrong.isError).toBe(true);
    expect(wrong.text).toContain('Medidas: STD, 0.50');
  });

  it('precios: ver el paso Precio, guardar un precio con los costos propios del producto y cambiar los de la cuenta', async () => {
    // Sin costo no se puede guardar.
    const empty = await call('get_price_step', { publicacion: 'MLA1110001' });
    expect(empty.data.pestanas).toHaveLength(1);
    expect(empty.data.pestanas[0]).toMatchObject({ publicacion_para_guardar: 'MLA1110001', costo_de_reposicion_sin_iva: null, hoy: { precio_publicado: 987654 } });
    expect((await call('save_price', { publicacion: 'MLA1110001', precio_publicado: 200000 })).text).toContain('Cargá el costo');

    await call('set_product_cost', { publicacion: 'MLA1110001', costo: 100000 });
    const step = await call('get_price_step', { publicacion: 'MLA1110001' });
    const tab = step.data.pestanas[0];
    expect(tab).toMatchObject({ costo_de_reposicion_sin_iva: 100000, de_donde_sale_el_costo: 'el del producto', hoy: { precio_publicado: 987654, cuotas: 'sin_cuotas', nivel: 'en el objetivo o arriba' } });
    expect(tab.precio_piso_sin_cuotas_ni_descuento).toBeGreaterThan(100000);
    expect(step.data.costos.de_la_cuenta).toMatchObject({ cargo_del_canal_pct: 14.3, iva_pct: 21 });
    expect(step.data.costos.propios_del_producto).toEqual({});
    expect(step.data.cuotas_que_se_pueden_usar).toContain('sin_cuotas');

    // Debajo del mínimo no guarda sin confirmar.
    const low = await call('save_price', { publicacion: 'MLA1110001', precio_publicado: 120000 });
    expect(low.isError).toBe(true);
    expect(low.text).toContain('debajo del mínimo');
    // Con un costo propio del producto y confirmando.
    const saved = await call('save_price', {
      publicacion: 'MLA1110001',
      precio_publicado: 250000,
      descuento_pct: 10,
      cuotas: 'sin_cuotas',
      costos_propios_del_producto: { publicidad_pct: 3 },
    });
    expect(saved.data).toMatchObject({ guardado: true, precio_final: 225000, nivel: expect.any(String) });
    const pub = await db.publication.findUniqueOrThrow({ where: { id: kitId }, include: { product: true } });
    expect([Number(pub.price), Number(pub.discount), pub.installments]).toEqual([250000, 10, 0]);
    expect(pub.product.pricingOverrides).toEqual({ adsPct: 3 });
    // get_publication muestra el precio y el último guardado.
    const seen = (await call('get_publication', { publicacion: 'MLA1110001' })).data.precio;
    expect(seen.en_la_app).toEqual({ precio_publicado: 250000, descuento_pct: 10, cuotas: 'Sin cuotas' });
    expect(seen.ultimo_guardado).toMatchObject({ precio_publicado: 250000, descuento_pct: 10, precio_final: 225000, quien: 'Persona' });
    // null vuelve al de la cuenta; lo que no se manda queda.
    await call('save_price', { publicacion: 'MLA1110001', precio_publicado: 250000, descuento_pct: 10, costos_propios_del_producto: { publicidad_pct: null, embalaje: 500 } });
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).pricingOverrides).toEqual({ packaging: 500 });
    await call('save_price', { publicacion: 'MLA1110001', precio_publicado: 260000 });
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).pricingOverrides).toEqual({ packaging: 500 });

    // Los de la cuenta: solo cambia lo que se manda; un plan de cuotas en null queda sin cargar.
    const before = await call('get_pricing_settings', {});
    expect(before.data.costos).toMatchObject({ cargo_del_canal_pct: 14.3, cuotas_3_pct: expect.any(Number) });
    const changed = await call('update_pricing_settings', { costos: { cargo_del_canal_pct: 15, cuotas_3_pct: null } });
    expect(changed.data.costos).toMatchObject({ cargo_del_canal_pct: 15, cuotas_3_pct: null, iva_pct: 21 });
    expect((await call('get_pricing_settings', {})).data.cargados_a_mano.sort()).toEqual(['cargo_del_canal_pct', 'cuotas_3_pct']);
    expect((await call('update_pricing_settings', { costos: { cargo_del_canal_pct: null } })).data.costos).toMatchObject({ cargo_del_canal_pct: 14.3, cuotas_3_pct: null });
    expect((await call('update_pricing_settings', { costos: { margen_minimo_pct: 90, margen_objetivo_pct: 50 } })).text).toContain('no puede ser menor');
    expect((await call('update_pricing_settings', { costos: {} })).isError).toBe(true);
    // Con 3 cuotas sin costo, no se puede guardar en 3 cuotas.
    expect((await call('save_price', { publicacion: 'MLA1110001', precio_publicado: 260000, cuotas: '3' })).text).toContain('Ajustes > Precios');
  });
});
