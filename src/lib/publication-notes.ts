import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { PipelineStep } from '@/generated/prisma/enums';
import { PIPELINE_STEP_LABEL } from '@/domain/pipeline';
import { titleOrUntitled } from '@/domain/publication-title';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { notify, wantsMail } from '@/lib/notifications';
import { publicAppUrl } from '@/lib/public-url';

// Las notas del equipo sobre una publicación: qué pasó, por qué se frenó, qué
// falta. Son de la familia: se escriben desde cualquier medida o forma de
// cobro y se leen juntas desde todas. Cualquiera las edita o las borra. A
// quien se menciona le llega un mail. Internas: nunca van al canal ni al bot
// de respuestas. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;
type AnyDb = PrismaClient | Prisma.TransactionClient;

export const NOTE_MAX = 4000;

export class NoteError extends Error {}

/** Las publicaciones cuyas notas se leen juntas: la familia entera, o la medida con sus formas de cobro. */
export type NoteGroup = { familyId: string | null; publicationIds: string[]; leadId: string };

export async function noteGroup(db: AnyDb, accountId: string, publicationId: string): Promise<NoteGroup> {
  const p = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      mainOptionId: true,
      familyId: true,
      family: { select: { leadId: true, members: { select: { id: true } } } },
      mainOption: { select: { familyId: true, family: { select: { leadId: true, members: { select: { id: true } } } } } },
    },
  });
  if (!p) throw new NoteError('La publicación no es de esta cuenta.');
  const familyId = p.familyId ?? p.mainOption?.familyId ?? null;
  const family = p.family ?? p.mainOption?.family ?? null;
  if (familyId && family) {
    const ids = family.members.map((m) => m.id);
    // Las formas de cobro sueltas de sus medidas también.
    const options = await db.publication.findMany({ where: { mainOptionId: { in: ids }, id: { notIn: ids } }, select: { id: true } });
    return { familyId, publicationIds: [...ids, ...options.map((o) => o.id)], leadId: family.leadId ?? p.id };
  }
  const main = p.mainOptionId ?? p.id;
  const options = await db.publication.findMany({ where: { mainOptionId: main }, select: { id: true } });
  return { familyId: null, publicationIds: [main, ...options.map((o) => o.id)], leadId: main };
}

const groupWhere = (g: NoteGroup): Prisma.PublicationNoteWhereInput => ({
  OR: [...(g.familyId ? [{ familyId: g.familyId }] : []), { publicationId: { in: g.publicationIds } }],
});

export type NoteView = {
  id: string;
  text: string;
  step: PipelineStep | null;
  stepLabel: string | null;
  author: string;
  authorId: string | null;
  viaClaude: boolean;
  createdAt: Date;
  editedBy: string | null;
  editedAt: Date | null;
  // En qué medida o forma de cobro se escribió, si no es la principal.
  writtenOn: { id: string; externalId: string | null; title: string } | null;
};

const NOTE_SELECT = {
  id: true,
  text: true,
  step: true,
  viaClaude: true,
  createdAt: true,
  editedAt: true,
  authorId: true,
  author: { select: { name: true } },
  editedBy: { select: { name: true } },
  publication: { select: { id: true, externalId: true, title: true } },
} satisfies Prisma.PublicationNoteSelect;

type NoteRow = Prisma.PublicationNoteGetPayload<{ select: typeof NOTE_SELECT }>;

/** Quién la escribió, en palabras: "Ana" o "Claude, por Ana". */
export const noteAuthor = (n: { viaClaude: boolean; author: { name: string } | null }) => {
  const who = n.author?.name ?? 'Alguien que ya no está';
  return n.viaClaude ? `Claude, por ${who}` : who;
};

function view(n: NoteRow, leadId: string): NoteView {
  return {
    id: n.id,
    text: n.text,
    step: n.step,
    stepLabel: n.step ? PIPELINE_STEP_LABEL[n.step] : null,
    author: noteAuthor(n),
    authorId: n.authorId,
    viaClaude: n.viaClaude,
    createdAt: n.createdAt,
    editedBy: n.editedAt ? (n.editedBy?.name ?? 'alguien') : null,
    editedAt: n.editedAt,
    writtenOn: n.publication.id === leadId ? null : { id: n.publication.id, externalId: n.publication.externalId, title: titleOrUntitled(n.publication.title) },
  };
}

/** Las notas de la familia de una publicación, la más nueva primero. */
export async function listNotes(db: AnyDb, args: { accountId: string; publicationId: string; take?: number }): Promise<NoteView[]> {
  const g = await noteGroup(db, args.accountId, args.publicationId);
  const rows = await db.publicationNote.findMany({
    where: { accountId: args.accountId, ...groupWhere(g) },
    orderBy: { createdAt: 'desc' },
    take: args.take ?? 200,
    select: NOTE_SELECT,
  });
  return rows.map((n) => view(n, g.leadId));
}

function cleanText(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').trim() : '';
  if (!text) throw new NoteError('Escribí la nota.');
  if (text.length > NOTE_MAX) throw new NoteError(`La nota es muy larga: hasta ${NOTE_MAX.toLocaleString('es-AR')} caracteres.`);
  return text;
}

/** Las personas mencionadas que ven la cuenta y están activas. */
async function mentionable(db: AnyDb, accountId: string, ids: string[]): Promise<{ id: string; name: string; email: string }[]> {
  const unique = [...new Set(ids.filter((x) => typeof x === 'string' && x))];
  if (unique.length === 0) return [];
  const people = await db.user.findMany({
    where: { id: { in: unique }, disabledAt: null, OR: [{ isAdmin: true }, { accounts: { some: { accountId } } }] },
    select: { id: true, name: true, email: true },
  });
  if (people.length !== unique.length) throw new NoteError('Alguna de las personas mencionadas no está activa o no ve esta cuenta.');
  return people;
}

export type NoteInput = { text: string; mentionIds?: string[] };

/** Escribe una nota en la familia de la publicación, en el paso donde está. Avisa por mail a las personas mencionadas. */
export async function addNote(
  db: Db,
  args: { accountId: string; publicationId: string; authorId: string | null; viaClaude?: boolean; input: NoteInput; baseUrl?: string },
): Promise<NoteView> {
  const text = cleanText(args.input.text);
  const g = await noteGroup(db, args.accountId, args.publicationId);
  const people = await mentionable(db, args.accountId, args.input.mentionIds ?? []);
  const where = await db.publication.findUniqueOrThrow({ where: { id: g.leadId }, select: { pipelineStatus: true, pipelineStep: true } });
  const created = await db.publicationNote.create({
    data: {
      accountId: args.accountId,
      // Las que se escriben desde la pantalla quedan en la principal; desde Claude, en la que se nombró.
      publicationId: args.publicationId,
      familyId: g.familyId,
      text,
      step: where.pipelineStatus === 'IN_PIPELINE' ? where.pipelineStep : null,
      authorId: args.authorId,
      viaClaude: args.viaClaude ?? false,
    },
    select: { id: true },
  });
  await mailMentions(db, created.id, people, args.baseUrl);
  const row = await db.publicationNote.findUniqueOrThrow({ where: { id: created.id }, select: NOTE_SELECT });
  return view(row, g.leadId);
}

async function findNote(db: AnyDb, accountId: string, noteId: string) {
  const n = await db.publicationNote.findFirst({ where: { id: String(noteId), accountId }, select: { id: true, publicationId: true } });
  if (!n) throw new NoteError('La nota no existe o ya se borró.');
  return n;
}

/** Cambia el texto de una nota, de quien sea. Avisa a las personas que se mencionan por primera vez. */
export async function editNote(
  db: Db,
  args: { accountId: string; noteId: string; editorId: string | null; input: NoteInput; now?: Date; baseUrl?: string },
): Promise<NoteView> {
  const n = await findNote(db, args.accountId, args.noteId);
  const text = cleanText(args.input.text);
  const people = await mentionable(db, args.accountId, args.input.mentionIds ?? []);
  await db.publicationNote.update({ where: { id: n.id }, data: { text, editedById: args.editorId, editedAt: args.now ?? new Date() } });
  await mailMentions(db, n.id, people, args.baseUrl);
  const g = await noteGroup(db, args.accountId, n.publicationId);
  const row = await db.publicationNote.findUniqueOrThrow({ where: { id: n.id }, select: NOTE_SELECT });
  return view(row, g.leadId);
}

/** Borra una nota, de quien sea. Devuelve su texto, para el registro. */
export async function deleteNote(db: Db, args: { accountId: string; noteId: string }): Promise<{ text: string; publicationId: string }> {
  const n = await findNote(db, args.accountId, args.noteId);
  const row = await db.publicationNote.delete({ where: { id: n.id }, select: { text: true, publicationId: true } });
  return row;
}

// ───────────────────────────── El tablero ─────────────────────────────

export type CardNotes = { count: number; last: { text: string; author: string; at: Date } };

/**
 * Cuántas notas tiene cada tarjeta del tablero y la última. Una tarjeta es la
 * principal de su familia, o la principal de sus formas de cobro.
 */
export async function notesByCard(db: AnyDb, accountId: string, cardIds: string[]): Promise<Record<string, CardNotes>> {
  if (cardIds.length === 0) return {};
  const cards = new Set(cardIds);
  const [notes, families] = await Promise.all([
    db.publicationNote.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        text: true,
        createdAt: true,
        viaClaude: true,
        familyId: true,
        author: { select: { name: true } },
        publication: { select: { id: true, familyId: true, mainOptionId: true, mainOption: { select: { familyId: true } } } },
      },
    }),
    db.listingFamily.findMany({ where: { product: { accountId } }, select: { id: true, leadId: true } }),
  ]);
  const leadOf = new Map(families.map((f) => [f.id, f.leadId]));
  const out: Record<string, CardNotes> = {};
  for (const n of notes) {
    const p = n.publication;
    const fam = n.familyId ?? p.familyId ?? p.mainOption?.familyId ?? null;
    const card = (fam ? leadOf.get(fam) : null) ?? p.mainOptionId ?? p.id;
    if (!cards.has(card)) continue;
    const c = out[card];
    if (c) c.count++;
    else out[card] = { count: 1, last: { text: n.text, author: noteAuthor(n), at: n.createdAt } };
  }
  return out;
}

// ───────────────────────────── El mail de la mención ─────────────────────────────

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** El mail a quien mencionan en una nota. Sin la base, para poder probarlo solo. */
export function noteMentionMail(d: { person: string; author: string; account: string; publication: string; step: string | null; text: string; link: string }) {
  const subject = `${d.author} te mencionó en una nota: ${d.publication}`.slice(0, 180);
  const where = d.step ? `${d.publication}, en el paso ${d.step}` : d.publication;
  const text = [`Hola ${d.person},`, '', `${d.author} te mencionó en una nota de ${where} (${d.account}):`, '', d.text, '', `Abrir: ${d.link}`].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917;max-width:560px;font-size:15px;line-height:1.5">
    <p style="margin:0 0 12px">Hola ${escape(d.person)},</p>
    <p style="margin:0 0 12px">${escape(d.author)} te mencionó en una nota de <strong>${escape(where)}</strong> (${escape(d.account)}):</p>
    <blockquote style="margin:0 0 20px;padding:10px 14px;border-left:3px solid #d6d3d1;background:#fafaf9;white-space:pre-wrap">${escape(d.text)}</blockquote>
    <p style="margin:0 0 20px"><a href="${escape(d.link)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Abrir la publicación</a></p>
  </div>`;
  return { subject, text, html };
}

/** Manda el mail a las personas mencionadas que todavía no lo recibieron por esta nota. */
async function mailMentions(db: Db, noteId: string, people: { id: string; name: string; email: string }[], baseUrl = publicAppUrl()): Promise<void> {
  if (people.length === 0) return;
  const n = await db.publicationNote.findUniqueOrThrow({
    where: { id: noteId },
    select: {
      text: true,
      step: true,
      viaClaude: true,
      mentionedIds: true,
      author: { select: { name: true } },
      account: { select: { id: true, slug: true, name: true } },
      publication: { select: { id: true, title: true, externalId: true, family: { select: { leadId: true } } } },
    },
  });
  const pending = people.filter((p) => !n.mentionedIds.includes(p.id));
  if (pending.length === 0) return;
  const target = n.publication.family?.leadId ?? n.publication.id;
  const link = `${baseUrl}/a/${n.account.slug}/pipeline/${target}`;
  const publication = [titleOrUntitled(n.publication.title), n.publication.externalId].filter(Boolean).join(' · ');
  await notify(db, {
    userIds: pending.map((p) => p.id),
    accountId: n.account.id,
    kind: 'nota',
    title: `${noteAuthor(n)} te mencionó en ${publication}`,
    body: n.text,
    link: `/a/${n.account.slug}/pipeline/${target}`,
    key: `nota:${noteId}`,
    mail: false,
  });
  const sent: string[] = [];
  for (const p of pending) {
    if (!isEmailConfigured()) break;
    // Eligió no recibir el mail de las menciones.
    if (!(await wantsMail(db, p.id, 'nota'))) {
      sent.push(p.id);
      continue;
    }
    const mail = noteMentionMail({
      person: p.name,
      author: noteAuthor(n),
      account: n.account.name,
      publication,
      step: n.step ? PIPELINE_STEP_LABEL[n.step] : null,
      text: n.text,
      link,
    });
    const r = await sendEmail({ to: p.email, ...mail, key: `nota-${noteId}-${p.id}` });
    if (r.ok) sent.push(p.id);
    else console.warn(`[notas] no salió un mail: ${r.error}`);
  }
  if (sent.length > 0) await db.publicationNote.update({ where: { id: noteId }, data: { mentionedIds: { push: sent } } });
}
