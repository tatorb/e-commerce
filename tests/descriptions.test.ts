import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { buildDescriptionRequest, DESCRIPTION_INSTRUCTIONS, type DescriptionInput, type DescriptionResult } from '@/ai/descriptions';
import { ProposalError } from '@/ai/request';
import { checkDescription, composeDescription, splitDescription, toConfirmMarks } from '@/domain/descriptions';
import { checkAnswer } from '@/domain/answers';
import { descriptionInput, loadDescriptionStep, proposeDescription, saveDescription, saveDescriptionSettings } from '@/lib/descriptions';

// La descripción de las publicaciones: reglas, encabezado y pie, la propuesta
// de Claude simulada y el guardado en el borrador. Datos de prueba.

describe('reglas de la descripción', () => {
  it('no deja guardar con [A CONFIRMAR], HTML, contacto ni más de 50.000 caracteres', () => {
    expect(checkDescription('KIT DE EMBRAGUE\n- Trae disco y placa.')).toEqual([]);
    expect(checkDescription('Sirve para [A CONFIRMAR: el motor].')).toEqual(['Confirmá o sacá lo marcado con [A CONFIRMAR].']);
    expect(checkDescription('<p>Hola</p>')).toEqual(['Sacá el HTML: el canal acepta solo texto.']);
    expect(checkDescription('Escribinos por WhatsApp o a ventas@tienda.com')).toEqual(['Sacá links, mails y datos de contacto: el canal no los acepta en la descripción.']);
    expect(checkDescription('x'.repeat(50_001))[0]).toContain('hasta 50.000');
    // Los códigos de los repuestos no son teléfonos, y "< 5 mm" no es HTML.
    expect(checkDescription('Código 4567891234. Juego < 5 mm.')).toEqual([]);
  });

  it('las respuestas siguen revisando el contacto igual que antes', () => {
    expect(checkAnswer('Hola, llamanos al 11 5555 5555')).toEqual(['Sacá datos de contacto: el canal no los acepta en las respuestas.']);
  });

  it('lista lo marcado para confirmar, sin repetir', () => {
    expect(toConfirmMarks('[A CONFIRMAR: motor] y [A CONFIRMAR: años] y [A CONFIRMAR: motor]')).toEqual(['[A CONFIRMAR: motor]', '[A CONFIRMAR: años]']);
  });

  it('arma la descripción con el encabezado y el pie, y la vuelve a separar', () => {
    const frame = { header: 'INSUR', footer: 'Hacemos factura A y B.' };
    const full = composeDescription({ ...frame, body: '  Cuerpo\r\ncon dos líneas  ' });
    expect(full).toBe('INSUR\n\nCuerpo\ncon dos líneas\n\nHacemos factura A y B.');
    expect(splitDescription(full, frame)).toEqual({ body: 'Cuerpo\ncon dos líneas', framed: true });
    // Una descripción vieja, sin el encabezado: el cuerpo es todo.
    expect(splitDescription('Texto viejo', frame)).toEqual({ body: 'Texto viejo', framed: false });
    expect(splitDescription(null, frame)).toEqual({ body: '', framed: true });
    expect(composeDescription({ header: null, body: 'Solo cuerpo', footer: ' ' })).toBe('Solo cuerpo');
  });
});

const content = {
  title: null,
  description: null,
  brand: 'SKF',
  partNumber: 'PD-1',
  productType: 'Kit de embrague',
  engineSystem: null,
  line: null,
  origin: 'Brasil',
  warranty: '6 meses',
  kitContents: 'Disco, placa y rulemán',
  notes: 'NOTA INTERNA QUE NO VA',
  measures: [],
  specs: [{ name: 'Diámetro', value: '200 mm' }],
  compatibilities: [{ vehicleBrand: 'Ford', model: 'Ka', engine: '1.6', yearFrom: 2008, yearTo: 2013, note: null }],
  photos: [],
  videos: [],
} as unknown as DescriptionInput['content'];

describe('el pedido a Claude', () => {
  const input: DescriptionInput = {
    channelName: 'Mercado Libre',
    storeName: 'TIENDA',
    guidelines: 'Nombrar la marca primero.',
    header: 'INSUR',
    footer: 'Factura A y B.',
    publication: { title: 'Kit de embrague Ford Ka', currentDescription: 'Texto actual', catalog: [{ name: 'Marca', value: 'SKF' }] },
    content,
    combo: null,
    research: { manufacturer: 'Del fabricante', clarifications: null, pains: ['No saben si sirve para el 1.0'], objections: [] },
    questions: [{ question: '¿Sirve para Ka 1.0?', answer: 'No, solo 1.6.' }],
  };

  it('manda la ficha y la investigación, sin las notas internas, con las instrucciones en la caché', () => {
    const req = buildDescriptionRequest(input);
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.system[0]).toMatchObject({ text: DESCRIPTION_INSTRUCTIONS, cache_control: { type: 'ephemeral' } });
    expect(req.system[1].text).toContain('Nombrar la marca primero.');
    expect(req.system[1].text).toContain('para no repetirlo:\nINSUR');
    const user = req.messages[0].content;
    expect(user).toContain('"numero_de_pieza": "PD-1"');
    expect(user).toContain('No saben si sirve para el 1.0');
    expect(user).toContain('¿Sirve para Ka 1.0?');
    expect(user).toContain('Texto actual');
    expect(user).not.toContain('NOTA INTERNA');
    expect(DESCRIPTION_INSTRUCTIONS).not.toContain('—');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('la descripción en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let publicationId = '';
  let productId = '';
  let seen: DescriptionInput | null = null;

  const usage = { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.05 };
  const claude =
    (description: string, toConfirm: string[] = []) =>
    async (input: DescriptionInput): Promise<DescriptionResult> => {
      seen = input;
      return { output: { description, toConfirm, usedData: ['Compatibilidades de la ficha'] }, usage, model: 'claude-opus-5-5' } as unknown as DescriptionResult;
    };

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE description_drafts, description_settings, product_research, buyer_insights, buyer_questions, channel_copies, publications, products, stores, channels, accounts, users CASCADE',
    );
    seen = null;
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    const product = await db.product.create({
      data: { accountId: account.id, name: 'Kit de embrague PD-1', brand: 'SKF', partNumber: 'PD-1', notes: 'Costo interno 1000' },
    });
    const pub = await db.publication.create({
      data: { productId: product.id, storeId: store.id, externalId: 'MLA1', title: 'Kit de embrague', description: 'INSUR\n\nTexto viejo\n$ 25.000 de lista' },
    });
    await db.productResearch.create({ data: { productId: product.id, manufacturerText: 'Diámetro 200 mm\nPrecio de lista $ 9.999', clarifications: '<p>El rulemán viene <strong>aparte</strong></p>' } });
    await db.buyerInsight.create({ data: { productId: product.id, kind: 'PAIN', text: 'No saben si sirve para el 1.0', position: 0 } });
    await db.buyerQuestion.createMany({
      data: [
        { storeId: store.id, externalId: '1', listingId: 'MLA1', publicationId: pub.id, text: '¿Sirve para Ka 1.0?', status: 'ANSWERED', askedAt: new Date(), readAt: new Date(), answer: 'No, solo para el 1.6.' },
        { storeId: store.id, externalId: '2', listingId: 'MLA1', publicationId: pub.id, text: '¿Precio por mayor?', status: 'ANSWERED', askedAt: new Date(), readAt: new Date(), answer: 'Sale $ 20.000 cada uno.' },
      ],
    });
    accountId = account.id;
    publicationId = pub.id;
    productId = product.id;
  });

  it('el encabezado y el pie no pueden tener contacto ni HTML', async () => {
    await expect(saveDescriptionSettings(db, accountId, { header: 'Visitanos en www.tienda.com', footer: '', guidelines: '' })).rejects.toThrow('Sacá links del encabezado');
    await expect(saveDescriptionSettings(db, accountId, { header: '', footer: '<b>Hola</b>', guidelines: '' })).rejects.toThrow('HTML');
    await saveDescriptionSettings(db, accountId, { header: ' INSUR ', footer: 'Factura A y B.', guidelines: '' });
    expect(await db.descriptionSettings.findUniqueOrThrow({ where: { accountId } })).toMatchObject({ header: 'INSUR', footer: 'Factura A y B.', guidelines: null });
  });

  it('a Claude le llegan los datos sin precios ni notas, y el cuerpo sin el encabezado', async () => {
    await saveDescriptionSettings(db, accountId, { header: 'INSUR', footer: '', guidelines: 'Marca primero.' });
    const input = await descriptionInput(db, accountId, publicationId);
    expect(input.publication.currentDescription).toBe('Texto viejo');
    expect(input.research.manufacturer).toBe('Diámetro 200 mm');
    expect(input.research.clarifications).toBe('El rulemán viene **aparte**');
    expect(input.research.pains).toEqual(['No saben si sirve para el 1.0']);
    expect(input.questions).toEqual(
      expect.arrayContaining([
        { question: '¿Sirve para Ka 1.0?', answer: 'No, solo para el 1.6.' },
        { question: '¿Precio por mayor?', answer: null },
      ]),
    );
    expect(JSON.stringify(input)).not.toContain('Costo interno');
    expect(input.guidelines).toBe('Marca primero.');
  });

  it('guarda la propuesta con su costo, la siguiente suma, y no toca el borrador', async () => {
    expect(await proposeDescription(db, { accountId, publicationId, userId: null }, claude('KIT DE EMBRAGUE\nSirve para [A CONFIRMAR: años]'))).toEqual({ ok: true, costUsd: 0.05 });
    let d = await db.descriptionDraft.findUniqueOrThrow({ where: { publicationId } });
    // Lo marcó sin listarlo: valen las marcas.
    expect(d).toMatchObject({ attempts: 1, costUsd: 0.05, toConfirm: ['[A CONFIRMAR: años]'], usedData: ['Compatibilidades de la ficha'] });
    await proposeDescription(db, { accountId, publicationId, userId: null }, claude('Otra', ['Los años']));
    d = await db.descriptionDraft.findUniqueOrThrow({ where: { publicationId } });
    expect(d).toMatchObject({ text: 'Otra', attempts: 2, costUsd: 0.1, toConfirm: ['Los años'] });
    expect((await db.publication.findUniqueOrThrow({ where: { id: publicationId } })).description).toContain('Texto viejo');
    expect(seen).not.toBeNull();
  });

  it('si Claude falla, lo dice con lo que gastó', async () => {
    const r = await proposeDescription(db, { accountId, publicationId, userId: null }, async () => {
      throw new ProposalError('La respuesta de Claude quedó cortada. Probá de nuevo.', { ...usage, costUsd: 0.02 } as never);
    });
    expect(r).toEqual({ ok: false, error: 'La respuesta de Claude quedó cortada. Probá de nuevo.', costUsd: 0.02 });
    expect(await db.descriptionDraft.count()).toBe(0);
  });

  it('guarda en el borrador con el encabezado y el pie, y no deja guardar lo que el canal rechaza', async () => {
    await saveDescriptionSettings(db, accountId, { header: 'INSUR', footer: 'Factura A y B.', guidelines: '' });
    await expect(saveDescription(db, { accountId, publicationId, body: 'Sirve para [A CONFIRMAR: años]', withFrame: true })).rejects.toThrow('[A CONFIRMAR]');
    await expect(saveDescription(db, { accountId, publicationId, body: 'Ver www.otro.com', withFrame: true })).rejects.toThrow('links');
    const r = await saveDescription(db, { accountId, publicationId, body: 'KIT DE EMBRAGUE\n- Disco y placa', withFrame: true });
    expect(r.text).toBe('INSUR\n\nKIT DE EMBRAGUE\n- Disco y placa\n\nFactura A y B.');
    expect((await db.publication.findUniqueOrThrow({ where: { id: publicationId } })).description).toBe(r.text);

    const step = await loadDescriptionStep(db, { accountId, publicationId });
    expect(step).toMatchObject({ body: 'KIT DE EMBRAGUE\n- Disco y placa', framed: true, header: 'INSUR', footer: 'Factura A y B.', proposal: null });
  });

  it('de otra cuenta no se puede proponer ni guardar', async () => {
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    expect(await proposeDescription(db, { accountId: other.id, publicationId, userId: null }, claude('x'))).toMatchObject({ ok: false, error: expect.stringContaining('no es de esta cuenta') });
    await expect(saveDescription(db, { accountId: other.id, publicationId, body: 'Hola', withFrame: false })).rejects.toThrow('no es de esta cuenta');
    expect(productId).toBeTruthy();
  });
});
