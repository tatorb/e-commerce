import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { requestDescription, type DescriptionInput, type DescriptionResult } from '@/ai/descriptions';
import { ProposalError } from '@/ai/request';
import { comboParts } from '@/domain/combos';
import { loadContent } from '@/domain/content';
import { contactFound, contactList } from '@/domain/contact';
import { checkDescription, composeDescription, splitDescription, toConfirmMarks } from '@/domain/descriptions';
import { parseNameValueList } from '@/domain/name-value';
import { isUniqueViolation } from '@/domain/publications';
import { richTextToMarkdown, withoutPrices } from '@/domain/research';
import { DraftError, saveDraft } from '@/lib/channel-push';
import { loadCombo } from '@/lib/queries/combos';

// La descripción de cada publicación desde el paso Descripción: Claude
// propone el cuerpo con la ficha y la investigación, la persona lo corrige y
// se guarda en el borrador, con el encabezado y el pie fijos de la cuenta.
// Del borrador se sube al canal desde la publicación o desde Por subir.
// Recibe la base y el pedido a Claude por parámetro para poder probarlo.

type Db = PrismaClient;
type Requester = (input: DescriptionInput) => Promise<DescriptionResult>;

export class DescriptionError extends Error {}

// Las preguntas más nuevas de la publicación que recibe Claude.
const QUESTIONS = 60;
const SETTING_MAX = 5000;

const json = (v: unknown) => v as Prisma.InputJsonValue;
const text = (v: string | null | undefined) => (v ?? '').replace(/\r\n?/g, '\n').trim() || null;
const noPrices = (v: string | null) => withoutPrices(v).text?.trim() || null;

export async function loadDescriptionSettings(db: Db, accountId: string) {
  return db.descriptionSettings.findUnique({ where: { accountId } });
}

export type DescriptionSettingsInput = { header: string; footer: string; guidelines: string };

/** Guarda el encabezado, el pie y lo que Claude tiene que saber. El encabezado y el pie van en todas las descripciones: tampoco pueden tener contacto ni HTML. */
export async function saveDescriptionSettings(db: Db, accountId: string, input: DescriptionSettingsInput): Promise<void> {
  const data = { header: text(input.header), footer: text(input.footer), guidelines: text(input.guidelines) };
  for (const [label, value] of [
    ['El encabezado', data.header],
    ['El pie', data.footer],
    ['Lo que Claude tiene que saber', data.guidelines],
  ] as const) {
    if (value && value.length > SETTING_MAX) throw new DescriptionError(`${label} puede tener hasta ${SETTING_MAX.toLocaleString('es-AR')} caracteres.`);
  }
  for (const [label, value] of [
    ['encabezado', data.header],
    ['pie', data.footer],
  ] as const) {
    if (!value) continue;
    const found = contactFound(value);
    if (found.length > 0) throw new DescriptionError(`Sacá ${contactList(found)} del ${label}: el canal no los acepta.`);
    const problems = checkDescription(value).filter((p) => p.includes('HTML'));
    if (problems.length > 0) throw new DescriptionError(`En el ${label}: ${problems[0]}`);
  }
  await db.descriptionSettings.upsert({ where: { accountId }, create: { accountId, ...data }, update: data });
}

async function publicationFor(db: Db, accountId: string, publicationId: string) {
  const pub = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      productId: true,
      title: true,
      description: true,
      attributes: true,
      store: { select: { name: true, channel: { select: { kind: true, name: true } } } },
    },
  });
  if (!pub) throw new DescriptionError('La publicación no es de esta cuenta.');
  return pub;
}

/** Lo que recibe Claude para proponer la descripción. */
export async function descriptionInput(db: Db, accountId: string, publicationId: string): Promise<DescriptionInput> {
  const pub = await publicationFor(db, accountId, publicationId);
  const [settings, content, combo, research, insights, questions] = await Promise.all([
    loadDescriptionSettings(db, accountId),
    loadContent(db, pub.productId, pub.id),
    loadCombo(db, pub.productId).then(comboParts),
    db.productResearch.findUnique({ where: { productId: pub.productId }, select: { manufacturerText: true, clarifications: true } }),
    db.buyerInsight.findMany({ where: { productId: pub.productId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { kind: true, text: true } }),
    db.buyerQuestion.findMany({
      where: { publicationId: pub.id, text: { not: '' } },
      orderBy: { askedAt: 'desc' },
      take: QUESTIONS,
      select: { text: true, answer: true },
    }),
  ]);
  const frame = { header: settings?.header ?? null, footer: settings?.footer ?? null };
  return {
    channelName: pub.store.channel.name,
    storeName: pub.store.name,
    guidelines: settings?.guidelines ?? null,
    ...frame,
    publication: {
      title: pub.title,
      // Sin el encabezado ni el pie: Claude escribe solo el cuerpo.
      currentDescription: noPrices(splitDescription(pub.description, frame).body),
      catalog: parseNameValueList(pub.attributes),
    },
    // Las notas son internas: no van a Claude.
    content: { ...content, notes: null },
    combo,
    research: {
      manufacturer: noPrices(research?.manufacturerText ?? null),
      clarifications: noPrices(richTextToMarkdown(research?.clarifications ?? null)),
      pains: insights.filter((i) => i.kind === 'PAIN').map((i) => i.text),
      objections: insights.filter((i) => i.kind === 'OBJECTION').map((i) => i.text),
    },
    // Las respuestas que nombran precios no pasan.
    questions: questions.map((q) => ({ question: q.text, answer: q.answer && withoutPrices(q.answer).hidden === 0 ? q.answer : null })),
  };
}

export type ProposeResult = { ok: true; costUsd: number } | { ok: false; error: string; costUsd: number };

/** Pide a Claude el cuerpo de la descripción y lo guarda como la última propuesta. No toca el borrador. */
export async function proposeDescription(
  db: Db,
  args: { accountId: string; publicationId: string; userId: string | null },
  request: Requester = requestDescription,
): Promise<ProposeResult> {
  let input: DescriptionInput;
  try {
    input = await descriptionInput(db, args.accountId, args.publicationId);
  } catch (e) {
    if (e instanceof DescriptionError) return { ok: false, error: e.message, costUsd: 0 };
    throw e;
  }
  let r: DescriptionResult;
  try {
    r = await request(input);
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.message, costUsd: e.usage?.costUsd ?? 0 };
    throw e;
  }
  const clean = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  const body = r.output.description.replace(/\r\n?/g, '\n').trim();
  const listed = clean(r.output.toConfirm);
  const marks = toConfirmMarks(body);
  const data = {
    text: body,
    // Si marcó en el texto sin listarlo, valen las marcas.
    toConfirm: json(listed.length > 0 || marks.length === 0 ? listed : marks),
    usedData: json(clean(r.output.usedData)),
    model: r.model,
    usage: json(r.usage),
    createdById: args.userId,
  };
  const update = () =>
    db.descriptionDraft.update({
      where: { publicationId: args.publicationId },
      data: { ...data, costUsd: { increment: r.usage.costUsd }, attempts: { increment: 1 } },
    });
  const existing = await db.descriptionDraft.findUnique({ where: { publicationId: args.publicationId }, select: { publicationId: true } });
  if (existing) await update();
  else {
    try {
      await db.descriptionDraft.create({ data: { publicationId: args.publicationId, ...data, costUsd: r.usage.costUsd } });
    } catch (e) {
      // Otro pedido la propuso a la vez: queda la última.
      if (!isUniqueViolation(e)) throw e;
      await update();
    }
  }
  return { ok: true, costUsd: r.usage.costUsd };
}

/**
 * Guarda la descripción en el borrador de la publicación: el cuerpo, con el
 * encabezado y el pie de la cuenta si se pide. No se guarda con lo marcado
 * [A CONFIRMAR], contacto ni HTML.
 */
export async function saveDescription(
  db: Db,
  args: { accountId: string; publicationId: string; body: string; withFrame: boolean },
): Promise<{ text: string; warnings: string[] }> {
  const pub = await publicationFor(db, args.accountId, args.publicationId);
  const settings = await loadDescriptionSettings(db, args.accountId);
  const full = composeDescription({
    header: args.withFrame ? (settings?.header ?? null) : null,
    body: args.body,
    footer: args.withFrame ? (settings?.footer ?? null) : null,
  });
  if (!full) throw new DescriptionError('La descripción está vacía.');
  const problems = checkDescription(full);
  if (problems.length > 0) throw new DescriptionError(problems.join(' '));
  try {
    const { warnings } = await saveDraft(db, { accountId: args.accountId, publicationId: pub.id, field: 'description', value: full });
    return { text: full, warnings };
  } catch (e) {
    if (e instanceof DraftError) throw new DescriptionError(e.message);
    throw e;
  }
}

/** Lo que muestra el paso Descripción. */
export async function loadDescriptionStep(db: Db, args: { accountId: string; publicationId: string }) {
  const pub = await db.publication.findFirstOrThrow({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: {
      description: true,
      externalId: true,
      store: { select: { channel: { select: { name: true } } } },
      channelCopy: { select: { description: true, descriptionReadAt: true, readAt: true } },
      descriptionDraft: { include: { createdBy: { select: { name: true } } } },
    },
  });
  const settings = await loadDescriptionSettings(db, args.accountId);
  const frame = { header: settings?.header ?? null, footer: settings?.footer ?? null };
  const split = splitDescription(pub.description, frame);
  const d = pub.descriptionDraft;
  return {
    channelName: pub.store.channel.name,
    header: frame.header,
    footer: frame.footer,
    hasGuidelines: Boolean(settings?.guidelines),
    // Lo que tiene hoy el borrador de la app.
    saved: pub.description,
    body: split.body,
    framed: split.framed,
    // Lo último que se leyó del canal.
    inChannel: pub.channelCopy ? { text: pub.channelCopy.description, readAt: pub.channelCopy.descriptionReadAt ?? pub.channelCopy.readAt } : null,
    published: pub.externalId !== null,
    proposal: d
      ? {
          text: d.text,
          toConfirm: (d.toConfirm as string[]) ?? [],
          usedData: (d.usedData as string[]) ?? [],
          costUsd: d.costUsd,
          attempts: d.attempts,
          at: d.updatedAt,
          by: d.createdBy?.name ?? null,
        }
      : null,
  };
}

export type DescriptionStepData = Awaited<ReturnType<typeof loadDescriptionStep>>;
