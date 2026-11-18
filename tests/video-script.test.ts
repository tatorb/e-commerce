import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { buildVideoScriptRequest, VIDEO_SCRIPT_INSTRUCTIONS, type VideoScriptInput, type VideoScriptResult } from '@/ai/video-script';
import { ProposalError } from '@/ai/request';
import { cleanScriptLines, countWords, scriptSeconds, scriptWordBudget } from '@/domain/video-edit';
import { loadVideoScript, proposeVideoScript, saveVideoScript, scriptLinesOf, scriptShownOf, VideoScriptError } from '@/lib/video-script';

// Datos inventados.

const LINES = ['Camisas de cilindro para motor Fiat uno punto siete diésel.', 'Sirven para Uno, Duna y Fiorino con ese motor.', 'Vienen las cuatro, en medida estándar.'];

describe('el guión del clip', () => {
  it('se limpia: sin frases vacías ni espacios de más', () => {
    expect(cleanScriptLines(['  Hola   mundo ', '', '   ', 'Chau.'])).toEqual(['Hola mundo', 'Chau.']);
    expect(cleanScriptLines(null)).toEqual([]);
    expect(cleanScriptLines('texto')).toEqual([]);
    expect(cleanScriptLines([1, 'Sirve.', null])).toEqual(['Sirve.']);
    expect(countWords('  uno   dos tres ')).toBe(3);
  });

  it('se estima cuánto lleva decirlo, con sus pausas', () => {
    expect(scriptSeconds([])).toBe(0);
    // Las palabras, a 2,3 por segundo, más dos pausas y el aire del principio y del final.
    const words = LINES.reduce((n, l) => n + countWords(l), 0);
    expect(words).toBe(25);
    expect(scriptSeconds(LINES)).toBeCloseTo(25 / 2.3 + 2 * 0.4 + 1.2);
    expect(scriptSeconds([...LINES, '  '])).toBeCloseTo(scriptSeconds(LINES));
  });

  it('las palabras que entran en un clip crecen con su duración', () => {
    expect(scriptWordBudget(40)).toBeGreaterThan(scriptWordBudget(30));
    expect(scriptWordBudget(40)).toBe(Math.floor((40 - 1.2 - 6 * 0.4) * 2.3));
    // Un guión con las palabras justas entra en el clip.
    const exact = Array.from({ length: 7 }, (_, i) => Array.from({ length: i < 6 ? 12 : scriptWordBudget(40) - 72 }, () => 'palabra').join(' '));
    expect(scriptSeconds(exact)).toBeLessThanOrEqual(40);
    expect(scriptWordBudget(3)).toBe(10);
  });

  it('las instrucciones piden certezas y no relatar el video', () => {
    expect(VIDEO_SCRIPT_INSTRUCTIONS).toContain('La voz NO relata lo que se ve');
    expect(VIDEO_SCRIPT_INSTRUCTIONS).toContain('Con qué es compatible');
    expect(VIDEO_SCRIPT_INSTRUCTIONS).toContain('Con qué NO es compatible');
    expect(VIDEO_SCRIPT_INSTRUCTIONS).toContain('No inventes nada');
    expect(VIDEO_SCRIPT_INSTRUCTIONS).toContain('Nunca digas precios');
    expect(VIDEO_SCRIPT_INSTRUCTIONS).not.toContain('—');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('el guión del clip en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const userId = 'u1';
  let accountId = '';
  let productId = '';
  let publicationId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE video_account_settings, video_scripts, product_research, compatibilities, publications, stores, channels, products, accounts, users CASCADE');
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    await db.user.create({ data: { id: userId, name: 'Persona', email: 'persona@example.com' } });
    const product = await db.product.create({ data: { accountId, name: 'Camisa 384675', productType: 'Camisa de cilindro', brand: 'Esteem', kitContents: '4 camisas' } });
    productId = product.id;
    await db.compatibility.create({ data: { productId, vehicleBrand: 'Fiat', model: 'Uno', engine: '1.7 diésel' } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    publicationId = (await db.publication.create({ data: { productId, storeId: store.id, externalId: 'MLA1', title: 'Kit 4 Camisas Fiat 1.7 Diesel' } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('se guarda escrito a mano, se corrige y se borra', async () => {
    expect(await loadVideoScript(db, productId)).toBeNull();
    const saved = await saveVideoScript(db, { accountId, productId, lines: ['  Camisas  para Fiat. ', '', 'Vienen cuatro.'], userId });
    expect(saved).toMatchObject({ lines: ['Camisas para Fiat.', 'Vienen cuatro.'], source: 'persona', updatedBy: 'Persona' });
    expect(saved!.seconds).toBeCloseTo(scriptSeconds(['Camisas para Fiat.', 'Vienen cuatro.']));
    expect(await scriptLinesOf(db, productId)).toEqual(['Camisas para Fiat.', 'Vienen cuatro.']);
    await saveVideoScript(db, { accountId, productId, lines: ['Otra cosa.'], userId });
    expect(await scriptLinesOf(db, productId)).toEqual(['Otra cosa.']);
    expect(await db.videoScript.count()).toBe(1);
    // Con todas las frases vacías, se borra.
    expect(await saveVideoScript(db, { accountId, productId, lines: ['', '  '], userId })).toBeNull();
    expect(await scriptLinesOf(db, productId)).toBeNull();
  });

  it('no se guarda si es de otra cuenta, si es muy largo para el clip o si tiene demasiadas frases', async () => {
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra' } });
    await expect(saveVideoScript(db, { accountId: other.id, productId, lines: LINES, userId })).rejects.toThrow('no es de esta cuenta');
    const long = Array.from({ length: 10 }, () => 'Una frase larga de unas quince palabras que no termina nunca y sigue y sigue.');
    await expect(saveVideoScript(db, { accountId, productId, lines: long, userId, rules: { maxSeconds: 60 } })).rejects.toThrow('el clip puede durar hasta 60');
    await expect(saveVideoScript(db, { accountId, productId, lines: Array.from({ length: 15 }, () => 'Frase.'), userId })).rejects.toThrow('hasta 14 frases');
    await expect(saveVideoScript(db, { accountId, productId, lines: ['x'.repeat(401)], userId })).rejects.toThrow(VideoScriptError);
    expect(await db.videoScript.count()).toBe(0);
  });

  it('Claude lo propone con la información de la publicación y las palabras que entran en el clip', async () => {
    await db.publication.update({ where: { id: publicationId }, data: { faq: '<p>¿Sirve para el turbo? No.</p>' } });
    const asked: VideoScriptInput[] = [];
    const request = async (input: VideoScriptInput): Promise<VideoScriptResult> => {
      asked.push(input);
      return { output: { lineas: [...LINES, '  '].map((voz) => ({ voz, subtitulo: voz })) }, usage: { costUsd: 0.012 } as VideoScriptResult['usage'], model: 'claude' };
    };
    const r = await proposeVideoScript(db, { accountId, publicationId, clipSeconds: 40, userId }, request);
    expect(r).toMatchObject({ ok: true, costUsd: 0.012, script: { lines: LINES, source: 'claude' } });
    expect(asked[0].maxWords).toBe(scriptWordBudget(40));
    expect(asked[0].faq).toContain('¿Sirve para el turbo? No.');
    expect(asked[0].info.content.compatibilities).toMatchObject([{ vehicleBrand: 'Fiat', model: 'Uno', engine: '1.7 diésel' }]);

    // El pedido lleva las instrucciones fijas, los datos y el tope de palabras.
    const built = buildVideoScriptRequest(asked[0]);
    expect(built.system[0].text).toBe(VIDEO_SCRIPT_INSTRUCTIONS);
    const text = built.messages[0].content;
    expect(text).toContain('"modelo": "Uno"');
    expect(text).toContain('¿Sirve para el turbo? No.');
    expect(text).toContain(`como mucho, ${scriptWordBudget(40)} palabras`);

    // Ya hay guión: no lo pisa sin confirmar.
    expect(await proposeVideoScript(db, { accountId, publicationId, clipSeconds: 40, userId }, request)).toEqual({ ok: false, error: 'Ya hay un guión: confirmá que querés reemplazarlo.', costUsd: 0 });
    expect(asked).toHaveLength(1);
    // Una vez corregido a mano, queda marcado.
    await saveVideoScript(db, { accountId, productId, lines: [LINES[0]], userId });
    expect((await loadVideoScript(db, productId))?.source).toBe('persona');
    expect(await proposeVideoScript(db, { accountId, publicationId, clipSeconds: 40, userId, replace: true }, request)).toMatchObject({ ok: true });
    expect((await loadVideoScript(db, productId))?.lines).toEqual(LINES);
  });

  it('cada frase puede escribirse en el subtítulo distinto de como se dice, y Claude recibe las reglas y los ejemplos de la cuenta', async () => {
    // Una persona corrigió el guión de otro producto del mismo tipo: es el ejemplo.
    const other = await db.product.create({ data: { accountId, name: 'Camisa 384999', productType: (await db.product.findUniqueOrThrow({ where: { id: productId } })).productType } });
    await saveVideoScript(db, { accountId, productId: other.id, lines: ['Para motor uno punto tres.', 'Es Esteem.'], shown: ['Para motor 1.3.', 'Es Esteem.'], userId });
    expect(await loadVideoScript(db, other.id)).toMatchObject({ lines: ['Para motor uno punto tres.', 'Es Esteem.'], shown: ['Para motor 1.3.', ''], source: 'persona' });
    await db.videoAccountSettings.create({ data: { accountId, values: { scriptRules: 'Decí kit, no juego.' } } });

    const asked: VideoScriptInput[] = [];
    const r = await proposeVideoScript(db, { accountId, publicationId, clipSeconds: 40, userId }, async (input) => {
      asked.push(input);
      return { output: { lineas: [{ voz: 'Camisas para Fiat uno punto siete.', subtitulo: 'Camisas para Fiat 1.7.' }, { voz: 'Vienen cuatro.', subtitulo: 'Vienen cuatro.' }] }, usage: { costUsd: 0.01 } as VideoScriptResult['usage'], model: 'claude' };
    });
    expect(r).toMatchObject({ ok: true, script: { lines: ['Camisas para Fiat uno punto siete.', 'Vienen cuatro.'], shown: ['Camisas para Fiat 1.7.', ''] } });
    expect(asked[0].accountRules).toBe('Decí kit, no juego.');
    expect(asked[0].examples).toEqual([{ producto: 'Camisa 384999', frases: [{ voz: 'Para motor uno punto tres.', subtitulo: 'Para motor 1.3.' }, { voz: 'Es Esteem.', subtitulo: 'Es Esteem.' }] }]);
    // El pedido a la Mac lleva los dos textos mientras el guión no cambie.
    expect(await scriptShownOf(db, productId, ['Camisas para Fiat uno punto siete.', 'Vienen cuatro.'])).toEqual(['Camisas para Fiat 1.7.', '']);
    expect(await scriptShownOf(db, productId, ['Otra cosa.'])).toBeNull();
    // Al sacar una frase, su texto para el subtítulo se va con ella.
    await saveVideoScript(db, { accountId, productId, lines: ['', 'Vienen cuatro.'], shown: ['Camisas para Fiat 1.7.', 'Vienen 4.'], userId });
    expect(await loadVideoScript(db, productId)).toMatchObject({ lines: ['Vienen cuatro.'], shown: ['Vienen 4.'] });
  });

  it('si Claude se pasa del largo, se le sacan frases del final; si no responde o no dice nada, no se guarda', async () => {
    const long = Array.from({ length: 12 }, (_, i) => `Frase número ${i + 1} con unas quince palabras para que el guión entero quede demasiado largo.`);
    const r = await proposeVideoScript(db, { accountId, publicationId, clipSeconds: 40, userId, rules: { maxSeconds: 60 } }, async () => ({
      output: { lineas: long.map((voz) => ({ voz, subtitulo: voz })) },
      usage: { costUsd: 0.02 } as VideoScriptResult['usage'],
      model: 'claude',
    }));
    expect(r.ok).toBe(true);
    const lines = (await scriptLinesOf(db, productId))!;
    expect(lines.length).toBeLessThan(12);
    expect(lines[0]).toBe(long[0]);
    expect(scriptSeconds(lines)).toBeLessThanOrEqual(60);

    await db.videoScript.deleteMany();
    const failing = async (): Promise<VideoScriptResult> => {
      throw new ProposalError('Claude está recibiendo demasiados pedidos. Probá de nuevo en un minuto.');
    };
    expect(await proposeVideoScript(db, { accountId, publicationId, clipSeconds: 40, userId }, failing)).toEqual({ ok: false, error: 'Claude está recibiendo demasiados pedidos. Probá de nuevo en un minuto.', costUsd: 0 });
    const empty = await proposeVideoScript(db, { accountId, publicationId, clipSeconds: 40, userId }, async () => ({ output: { lineas: [{ voz: ' ', subtitulo: '' }] }, usage: { costUsd: 0.01 } as VideoScriptResult['usage'], model: 'claude' }));
    expect(empty).toMatchObject({ ok: false, costUsd: 0.01 });
    expect(await db.videoScript.count()).toBe(0);
    await expect(proposeVideoScript(db, { accountId, publicationId: 'no-existe', clipSeconds: 40, userId }, failing)).rejects.toThrow('no es de esta cuenta');
  });
});
