'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { addNote, deleteNote, editNote, NoteError, type NoteView } from '@/lib/publication-notes';

// Las notas del equipo sobre una publicación. Las escribe, edita y borra
// cualquiera que vea la publicación, en el pipeline o en Publicaciones.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Saved = Result<{ note: NoteView }>;
type Removed = Result<{ text: string }>;

const SECTIONS = ['pipeline', 'publicaciones'] as const;

async function guarded<T extends object>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await run()) };
  } catch (e) {
    if (e instanceof NoteError) return { ok: false, error: e.message };
    throw e;
  }
}

const clip = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s);
const mentions = (raw: unknown) => (Array.isArray(raw) ? raw.map(String).slice(0, 30) : []);

export async function addNoteAction(accountSlug: string, publicationId: string, text: string, mentionIds: string[] = []) {
  const id = String(publicationId);
  return act<Saved>(accountSlug, { section: SECTIONS, level: 'read', does: 'Escribió una nota', publicationId: id, targetLabel: clip(String(text ?? '')) }, async ({ user, account }) => {
    const r = await guarded(async () => ({ note: await addNote(prisma, { accountId: account.id, publicationId: id, authorId: user.id, input: { text: String(text ?? ''), mentionIds: mentions(mentionIds) } }) }));
    if (r.ok) revalidatePath(`/a/${account.slug}`, 'layout');
    return r;
  });
}

export async function editNoteAction(accountSlug: string, publicationId: string, noteId: string, text: string, mentionIds: string[] = []) {
  return act<Saved>(accountSlug, { section: SECTIONS, level: 'read', does: 'Editó una nota', publicationId: String(publicationId), targetLabel: clip(String(text ?? '')) }, async ({ user, account }) => {
    const r = await guarded(async () => ({ note: await editNote(prisma, { accountId: account.id, noteId: String(noteId), editorId: user.id, input: { text: String(text ?? ''), mentionIds: mentions(mentionIds) } }) }));
    if (r.ok) revalidatePath(`/a/${account.slug}`, 'layout');
    return r;
  });
}

export async function deleteNoteAction(accountSlug: string, publicationId: string, noteId: string) {
  const spec = { section: SECTIONS, level: 'read', does: 'Borró una nota', publicationId: String(publicationId), targetOf: (r: Removed) => (r.ok ? clip(r.text) : null) } as const;
  return act<Removed>(accountSlug, spec, async ({ account }) => {
    const r = await guarded(async () => ({ text: (await deleteNote(prisma, { accountId: account.id, noteId: String(noteId) })).text }));
    if (r.ok) revalidatePath(`/a/${account.slug}`, 'layout');
    return r;
  });
}
