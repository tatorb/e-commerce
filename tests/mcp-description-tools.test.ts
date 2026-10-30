import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { composeDescription, withoutFrame } from '@/domain/descriptions';
import type { McpContext } from '@/lib/mcp/tool';

// Claude en el paso Descripción: ver lo que hay y cargar descripciones. Datos inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { handleRpc, toolList } = await import('@/lib/mcp/server');

const frame = { header: 'REPUESTOS DEL SUR', footer: 'Gracias por tu compra.' };

describe('el cuerpo sin el encabezado ni el pie', () => {
  it('saca los que trae, cada uno por su lado, para no repetirlos', () => {
    expect(withoutFrame('REPUESTOS DEL SUR\n\nCuerpo\n\nGracias por tu compra.', frame)).toBe('Cuerpo');
    expect(withoutFrame('REPUESTOS DEL SUR\n\nCuerpo', frame)).toBe('Cuerpo');
    expect(withoutFrame('Cuerpo\r\n\r\nGracias por tu compra.  ', frame)).toBe('Cuerpo');
    expect(withoutFrame(' Cuerpo ', { header: null, footer: null })).toBe('Cuerpo');
  });

  it('ver es solo lectura y cargar pisa lo que había', () => {
    const tools = new Map(toolList().map((t) => [t.name, t.annotations]));
    expect(tools.get('get_description_step')).toMatchObject({ readOnlyHint: true });
    expect(tools.get('save_description')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });
});

describe.skipIf(!url)('descripciones por Claude', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const admin: McpContext = { db, userId: 'u1', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
  let accountId = '';
  let stdId = '';
  let halfId = '';
  let pumpId = '';
  let newId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE activity_logs, description_drafts, description_settings, listing_families, channel_copies, publications, products, stores, channels, accounts, users CASCADE',
    );
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    await db.descriptionSettings.create({ data: { accountId, ...frame, guidelines: 'Tuteo. Sin precios.' } });

    const piston = await db.product.create({
      data: {
        accountId,
        name: 'Subconjunto SP-900',
        variants: { create: [{ sku: 'SP-900-00', measure: 'STD', position: 0 }, { sku: 'SP-900-50', measure: '0.50', position: 1 }] },
      },
    });
    const pub = (productId: string, externalId: string | null, title: string, extra = {}) =>
      db.publication.create({ data: { productId, storeId: store.id, externalId, title, ...extra } });
    stdId = (await pub(piston.id, 'MLA9100001', 'Subconjunto Pistón SP-900', { variantKey: 'STD' })).id;
    halfId = (await pub(piston.id, 'MLA9100002', 'Subconjunto Pistón SP-900', { variantKey: '0.50' })).id;
    await db.listingFamily.create({
      data: { storeId: store.id, productId: piston.id, channelFamilyId: 'FAM-1', leadId: stdId, members: { connect: [{ id: stdId }, { id: halfId }] } },
    });

    const pump = await db.product.create({ data: { accountId, name: 'Bomba de agua BA-1' } });
    const old = composeDescription({ ...frame, body: 'Cuerpo viejo' });
    pumpId = (await pub(pump.id, 'MLA9200001', 'Bomba de Agua BA-1', { description: old })).id;
    await db.channelCopy.create({ data: { publicationId: pumpId, readAt: new Date(), status: 'ACTIVE', description: old } });
    newId = (await pub(pump.id, null, 'Bomba de Agua BA-1 Nueva')).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function call(name: string, args: Record<string, unknown> = {}, ctx: McpContext = admin) {
    const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)) as {
      result: { content: { text: string }[]; isError?: boolean };
    };
    const text = r.result.content[0].text;
    return { text, isError: r.result.isError === true, data: r.result.isError ? null : JSON.parse(text) };
  }
  const descriptionOf = async (id: string) => (await db.publication.findUniqueOrThrow({ where: { id }, select: { description: true } })).description;

  it('get_description_step: lo guardado, lo del canal, el encabezado, el pie y las pautas', async () => {
    const r = await call('get_description_step', { publicacion: 'MLA9200001' });
    expect(r.data).toMatchObject({
      codigo: 'MLA9200001',
      canal: 'Mercado Libre',
      publicada: true,
      encabezado: frame.header,
      pie: frame.footer,
      pautas_de_la_cuenta: 'Tuteo. Sin precios.',
      guardada: { cuerpo: 'Cuerpo viejo', con_encabezado_y_pie: true },
      en_el_canal: { texto: composeDescription({ ...frame, body: 'Cuerpo viejo' }) },
      igual_que_en_el_canal: true,
      propuesta_de_la_app: null,
    });
    expect(r.data.reglas).toContain('50.000');
    expect(r.data).not.toHaveProperty('familia');

    const family = await call('get_description_step', { publicacion: 'MLA9100002' });
    expect(family.data).toMatchObject({ guardada: null, en_el_canal: null, igual_que_en_el_canal: null });
    expect(family.data.familia).toContain('2 medidas (MLA9100001, MLA9100002)');
  });

  it('save_description: con el encabezado y el pie sin repetirlos, en toda la familia, y queda en Por subir', async () => {
    const r = await call('save_description', {
      descripciones: [
        { publicacion: 'MLA9100001', descripcion: 'REPUESTOS DEL SUR\n\nSubconjunto con pistón, aros y perno.\nMedida a elegir.' },
        { publicacion: 'MLA9100002', descripcion: 'Otra para la misma familia.' },
        { publicacion: 'MLA9200001', descripcion: 'Bomba de agua con junta incluida.' },
        { publicacion: newId, descripcion: 'Bomba de agua nueva.' },
        { publicacion: 'MLA9999999', descripcion: 'No está en la cuenta.' },
      ],
    });
    expect(r.isError).toBe(false);
    const [std, half, pump, fresh, missing] = r.data.resultados;
    expect(std).toMatchObject({ publicacion: 'MLA9100001', resultado: 'guardada', familia: 'Se guardó en sus 2 medidas.', con_encabezado_y_pie: true });
    expect(std.por_subir).toContain('Quedó en Por subir');
    expect(half).toMatchObject({ resultado: 'no_se_guardo' });
    expect(half.motivo).toContain('misma familia que MLA9100001');
    expect(pump).toMatchObject({ resultado: 'guardada' });
    expect(fresh.por_subir).toContain('Todavía no está en el canal');
    expect(missing).toMatchObject({ publicacion: 'MLA9999999', resultado: 'no_se_guardo' });
    expect(r.data).toMatchObject({ guardadas: 3, aviso: expect.any(String) });

    const expected = 'REPUESTOS DEL SUR\n\nSubconjunto con pistón, aros y perno.\nMedida a elegir.\n\nGracias por tu compra.';
    expect(await descriptionOf(stdId)).toBe(expected);
    expect(await descriptionOf(halfId)).toBe(expected);
    expect(await descriptionOf(pumpId)).toBe(composeDescription({ ...frame, body: 'Bomba de agua con junta incluida.' }));
    // Queda en la actividad de la persona, una vez por publicación, hecho por Claude.
    expect(await db.activityLog.count({ where: { userId: 'u1', via: 'CLAUDE', summary: 'Guardó la descripción' } })).toBe(3);

    // La misma otra vez: no cambia nada ni suma a la actividad.
    const again = await call('save_description', { descripciones: [{ publicacion: 'MLA9100002', descripcion: 'Subconjunto con pistón, aros y perno.\nMedida a elegir.' }] });
    expect(again.data.resultados[0]).toMatchObject({ resultado: 'sin_cambios' });
    expect(again.data).not.toHaveProperty('aviso');
    expect(await db.activityLog.count({ where: { via: 'CLAUDE' } })).toBe(3);

    // Igual a la del canal: no hay nada por subir.
    const back = await call('save_description', { descripciones: [{ publicacion: 'MLA9200001', descripcion: 'Cuerpo viejo' }] });
    expect(back.data.resultados[0].por_subir).toContain('igual a la del canal');

    // Sin el encabezado y el pie: queda el texto tal cual.
    await call('save_description', { descripciones: [{ publicacion: 'MLA9200001', descripcion: 'Solo el cuerpo.' }], con_encabezado_y_pie: false });
    expect(await descriptionOf(pumpId)).toBe('Solo el cuerpo.');
  });

  it('no guarda lo que el canal rechaza, y dice por qué', async () => {
    const r = await call('save_description', {
      descripciones: [
        { publicacion: 'MLA9200001', descripcion: 'Sirve para [A CONFIRMAR: motor 1.4].' },
        { publicacion: 'MLA9100001', descripcion: '<p>Con <b>junta</b></p>' },
        { publicacion: newId, descripcion: 'Escribinos por WhatsApp o a ventas@tienda.com' },
      ],
    });
    const [toConfirm, html, contact] = r.data.resultados;
    expect(toConfirm).toMatchObject({ resultado: 'no_se_guardo', motivo: 'Confirmá o sacá lo marcado con [A CONFIRMAR].' });
    expect(html.motivo).toContain('Sacá el HTML');
    expect(contact.motivo).toContain('datos de contacto');
    expect(r.data).toMatchObject({ guardadas: 0 });
    expect(await descriptionOf(pumpId)).toBe(composeDescription({ ...frame, body: 'Cuerpo viejo' }));
    expect(await descriptionOf(stdId)).toBeNull();
    expect(await db.activityLog.count()).toBe(0);
  });

  it('sin permiso para cambiar el Pipeline ni Publicaciones, puede ver pero no cargar', async () => {
    const reader: McpContext = { ...admin, access: { isAdmin: false, permissions: { pipeline: 'read' }, accountIds: [accountId] } };
    expect((await call('get_description_step', { publicacion: 'MLA9200001' }, reader)).isError).toBe(false);
    const r = await call('save_description', { descripciones: [{ publicacion: 'MLA9200001', descripcion: 'Texto.' }] }, reader);
    expect(r.isError).toBe(true);
    expect(r.text).toContain('permiso');
    expect(await descriptionOf(pumpId)).toBe(composeDescription({ ...frame, body: 'Cuerpo viejo' }));
  });
});
