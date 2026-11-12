import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';

// Las notas del equipo: de la familia, las edita cualquiera y a quien se
// menciona le llega un mail. El mail está simulado. Datos inventados.

const mails: { to: string; subject: string; key: string; text: string }[] = [];
vi.mock('@/lib/email', () => ({
  isEmailConfigured: () => true,
  sendEmail: async (m: { to: string; subject: string; key: string; text: string }) => {
    mails.push(m);
    return { ok: true };
  },
}));

const { addNote, deleteNote, editNote, listNotes, noteMentionMail, notesByCard, NoteError } = await import('@/lib/publication-notes');
const { NOTE_TOOLS } = await import('@/lib/mcp/note-tools');

const url = process.env.TEST_DATABASE_URL;

describe('el mail de una mención', () => {
  it('dice quién mencionó, en qué publicación y paso, el texto y el link', () => {
    const m = noteMentionMail({ person: 'Juani', author: 'Claude, por Ana', account: 'Prueba', publication: 'Subconjunto SP-1 · MLA1', step: 'Precio', text: 'Falta <b>la 0,50</b>', link: 'https://app/x' });
    expect(m.subject).toBe('Claude, por Ana te mencionó en una nota: Subconjunto SP-1 · MLA1');
    expect(m.text).toContain('Subconjunto SP-1 · MLA1, en el paso Precio');
    expect(m.html).toContain('Falta &lt;b&gt;la 0,50&lt;/b&gt;');
    expect(m.html).toContain('https://app/x');
  });
});

describe.skipIf(!url)('notas de las publicaciones', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let otherAccount = '';
  const ids: Record<string, string> = {};

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    mails.length = 0;
    await db.$executeRawUnsafe('TRUNCATE publication_notes, listing_families, publications, products, stores, channels, user_accounts, accounts, users CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    otherAccount = (await db.account.create({ data: { slug: 'otra', name: 'Otra' } })).id;
    await db.user.createMany({
      data: [
        { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true },
        { id: 'juani', name: 'Juani', email: 'juani@prueba.com' },
        { id: 'zoe', name: 'Zoe', email: 'zoe@prueba.com' },
      ],
    });
    await db.userAccount.create({ data: { userId: 'juani', accountId } });
    const storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    const productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-1' } })).id;
    const pub = (externalId: string, extra: Record<string, unknown> = {}) =>
      db.publication.create({ data: { productId, storeId, externalId, title: `Subconjunto ${externalId}`, ...extra }, select: { id: true } });
    ids.lead = (await pub('MLA1', { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE' })).id;
    ids.other = (await pub('MLA2')).id;
    ids.option = (await pub('MLA3', { mainOptionId: ids.lead })).id;
    ids.loose = (await pub('MLA9')).id;
    ids.looseOption = (await pub('MLA10', { mainOptionId: ids.loose })).id;
    const family = await db.listingFamily.create({ data: { storeId, productId, leadId: ids.lead } });
    ids.family = family.id;
    await db.publication.updateMany({ where: { id: { in: [ids.lead, ids.other] } }, data: { familyId: family.id } });
  });

  it('una nota escrita en una medida se ve desde toda la familia y sus formas de cobro, con el paso donde estaba', async () => {
    const n = await addNote(db, { accountId, publicationId: ids.other, authorId: 'ana', input: { text: '  Falta la foto de la 0,50  ' } });
    expect(n).toMatchObject({ text: 'Falta la foto de la 0,50', author: 'Ana', step: 'PRICE', stepLabel: 'Precio', writtenOn: { externalId: 'MLA2' } });
    for (const id of [ids.lead, ids.other, ids.option]) {
      expect((await listNotes(db, { accountId, publicationId: id })).map((x) => x.text)).toEqual(['Falta la foto de la 0,50']);
    }
    // Una publicación suelta tiene las suyas, con sus formas de cobro.
    expect(await listNotes(db, { accountId, publicationId: ids.loose })).toEqual([]);
    await addNote(db, { accountId, publicationId: ids.looseOption, authorId: 'juani', viaClaude: true, input: { text: 'Sin cuotas pendiente' } });
    const loose = await listNotes(db, { accountId, publicationId: ids.loose });
    expect(loose).toMatchObject([{ author: 'Claude, por Juani', step: null, viaClaude: true }]);
    // De otra cuenta no.
    await expect(listNotes(db, { accountId: otherAccount, publicationId: ids.lead })).rejects.toBeInstanceOf(NoteError);
  });

  it('cualquiera la edita o la borra, y no acepta una nota vacía', async () => {
    const n = await addNote(db, { accountId, publicationId: ids.lead, authorId: 'ana', input: { text: 'Primera' } });
    const e = await editNote(db, { accountId, noteId: n.id, editorId: 'juani', input: { text: 'Primera, corregida' } });
    expect(e).toMatchObject({ text: 'Primera, corregida', author: 'Ana', editedBy: 'Juani' });
    await expect(addNote(db, { accountId, publicationId: ids.lead, authorId: 'ana', input: { text: '   ' } })).rejects.toThrow('Escribí la nota');
    await expect(editNote(db, { accountId: otherAccount, noteId: n.id, editorId: 'ana', input: { text: 'x' } })).rejects.toThrow('no existe');
    await deleteNote(db, { accountId, noteId: n.id });
    expect(await listNotes(db, { accountId, publicationId: ids.lead })).toEqual([]);
  });

  it('a quien se menciona le llega un mail una sola vez, y solo si ve la cuenta', async () => {
    const n = await addNote(db, { accountId, publicationId: ids.lead, authorId: 'ana', input: { text: '@Juani mirá el precio', mentionIds: ['juani'] }, baseUrl: 'https://app' });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: 'juani@prueba.com', key: `nota-${n.id}-juani` });
    expect(mails[0].text).toContain(`https://app/a/prueba/pipeline/${ids.lead}`);
    // Al editarla no se repite; a quien se suma, sí.
    await editNote(db, { accountId, noteId: n.id, editorId: 'juani', input: { text: '@Juani @Ana mirá el precio', mentionIds: ['juani', 'ana'] } });
    expect(mails.map((m) => m.to)).toEqual(['juani@prueba.com', 'ana@prueba.com']);
    // Zoe no ve la cuenta.
    await expect(addNote(db, { accountId, publicationId: ids.lead, authorId: 'ana', input: { text: '@Zoe', mentionIds: ['zoe'] } })).rejects.toThrow('no ve esta cuenta');
  });

  it('el tablero cuenta las notas de cada tarjeta y muestra la última', async () => {
    await addNote(db, { accountId, publicationId: ids.other, authorId: 'ana', input: { text: 'Vieja' }, });
    await new Promise((r) => setTimeout(r, 5));
    await addNote(db, { accountId, publicationId: ids.option, authorId: 'juani', input: { text: 'Nueva' } });
    await addNote(db, { accountId, publicationId: ids.looseOption, authorId: 'juani', input: { text: 'Suelta' } });
    const cards = await notesByCard(db, accountId, [ids.lead, ids.loose]);
    expect(cards[ids.lead]).toMatchObject({ count: 2, last: { text: 'Nueva', author: 'Juani' } });
    expect(cards[ids.loose]).toMatchObject({ count: 1 });
  });

  it('Claude escribe la nota a nombre de la persona, menciona por nombre, la edita y la borra; sin ver publicaciones, no', async () => {
    const tool = (name: string) => NOTE_TOOLS.find((t) => t.name === name)!;
    const ctx = { db, userId: 'ana', access: { isAdmin: false, permissions: { pipeline: 'read' as const }, accountIds: [accountId] }, baseUrl: 'https://app' };
    const run = (name: string, args: Record<string, unknown>, c: unknown = ctx) => tool(name).run(c as never, tool(name).input.parse({ cuenta: 'prueba', ...args }));
    const added = (await run('add_note', { publicacion: ids.other, texto: 'Dejé el precio listo, falta la descripción.', mencionar: ['Juani'] })) as { nota: { id: string; texto: string; quien: string } };
    expect(added.nota).toMatchObject({ texto: '@Juani Dejé el precio listo, falta la descripción.', quien: 'Claude, por Ana' });
    expect(mails.map((m) => m.to)).toEqual(['juani@prueba.com']);
    const listed = (await run('list_notes', { publicacion: ids.lead })) as { notas: { id: string }[] };
    expect(listed.notas.map((n) => n.id)).toEqual([added.nota.id]);
    await run('edit_note', { publicacion: ids.lead, nota: added.nota.id, texto: 'Precio y descripción listos.' });
    expect((await listNotes(db, { accountId, publicationId: ids.lead }))[0]).toMatchObject({ text: 'Precio y descripción listos.', editedBy: 'Ana' });
    await run('delete_note', { publicacion: ids.lead, nota: added.nota.id });
    expect(await listNotes(db, { accountId, publicationId: ids.lead })).toEqual([]);
    const blind = { ...ctx, access: { ...ctx.access, permissions: {} } };
    await expect(run('add_note', { publicacion: ids.lead, texto: 'x' }, blind)).rejects.toThrow('no ve el pipeline');
  });
});
