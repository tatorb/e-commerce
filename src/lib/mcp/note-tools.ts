import { z } from 'zod';
import { can } from '@/domain/access';
import { addNote, deleteNote, editNote, listNotes, NoteError, NOTE_MAX, type NoteView } from '@/lib/publication-notes';
import { resolvePeople } from './task-tools';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication, when, type AccountRef, type McpContext } from './tool';

// Las notas del equipo desde Claude: leerlas, escribirlas, editarlas y
// borrarlas. Son de la familia y las edita cualquiera. Claude no las guarda
// sin que la persona confirme el texto.

const ASK_FIRST =
  'Antes de guardar, mostrale a la persona el texto y esperá que confirme: nunca la guardes sin su sí.';

/** Que la persona vea el pipeline o las publicaciones: con eso puede escribir, editar y borrar notas. */
function seeOnly(ctx: McpContext) {
  if (!can(ctx.access, ['pipeline', 'publicaciones'], 'read')) throw new McpToolError('El usuario de la persona no ve el pipeline ni las publicaciones.');
}

const asToolError = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (e) {
    if (e instanceof NoteError) throw new McpToolError(e.message);
    throw e;
  }
};

function noteOut(n: NoteView, account: AccountRef) {
  return {
    id: n.id,
    texto: n.text,
    quien: n.author,
    cuando: when(n.createdAt, account),
    ...(n.stepLabel ? { en_el_paso: n.stepLabel } : {}),
    ...(n.writtenOn ? { desde: n.writtenOn.externalId ?? n.writtenOn.title } : {}),
    ...(n.editedBy ? { editada_por: n.editedBy } : {}),
  };
}

/** A quiénes menciona, y el texto con su @Nombre si no lo tenía. */
async function mentionsOf(ctx: McpContext, accountId: string, text: string, refs: string[] | undefined) {
  if (!refs || refs.length === 0) return { text, ids: [] as string[] };
  const ids = await resolvePeople(ctx, accountId, refs);
  const people = await ctx.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const missing = people.filter((p) => !text.includes(`@${p.name}`)).map((p) => `@${p.name}`);
  return { text: missing.length > 0 ? `${missing.join(' ')} ${text}` : text, ids };
}

const mentionArg = z
  .array(z.string().min(1).max(200))
  .max(10)
  .optional()
  .describe('Las personas a mencionar, por nombre o email: les llega un mail con la nota. "yo" es la persona que conectó a Claude.');

const listTool = defineTool({
  name: 'list_notes',
  section: ['pipeline', 'publicaciones'],
  title: 'Ver las notas del equipo de una publicación',
  description:
    'Las notas del equipo sobre una publicación y su familia (se ven desde todas sus medidas y formas de cobro), la más nueva primero: qué pasó, qué falta o por qué se frenó, quién la escribió, cuándo y en qué paso del pipeline. Leelas antes de trabajar una publicación, para seguir donde quedó. get_publication ya trae las últimas.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const notes = await asToolError(() => listNotes(ctx.db, { accountId: account.id, publicationId: id }));
    return { notas: notes.map((n) => noteOut(n, account)) };
  },
});

const addTool = defineTool({
  name: 'add_note',
  section: ['pipeline', 'publicaciones'],
  title: 'Escribir una nota del equipo en una publicación',
  description: `Deja una nota del equipo en una publicación, que queda en su familia y la ven todas las personas y sus Claude: qué se hizo, qué falta, por qué se frenó o una observación. Queda a nombre de la persona, como "Claude, por <persona>", con el paso del pipeline donde está. Con mencionar, a esas personas les llega un mail. Cuando terminás de trabajar una publicación o algo queda a medias, preguntale a la persona si quiere dejar una nota para el que sigue y proponele el texto: corto, con lo hecho, lo pendiente y el porqué. ${ASK_FIRST} Las notas son internas: nunca van al canal ni a las respuestas a compradores.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    texto: z.string().min(1).max(NOTE_MAX),
    mencionar: mentionArg,
  }),
  readOnly: false,
  // Las notas las escribe cualquiera que vea las publicaciones, aunque no pueda cambiarlas.
  own: true,
  async run(ctx, args) {
    seeOnly(ctx);
    if (!ctx.userId) throw new McpToolError('Para escribir una nota hace falta saber quién la escribe.');
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const m = await mentionsOf(ctx, account.id, args.texto, args.mencionar);
    const note = await asToolError(() =>
      addNote(ctx.db, { accountId: account.id, publicationId: id, authorId: ctx.userId, viaClaude: true, input: { text: m.text, mentionIds: m.ids }, baseUrl: ctx.baseUrl }),
    );
    return { guardada: true, nota: noteOut(note, account), ...(m.ids.length > 0 ? { mail_a: args.mencionar } : {}) };
  },
});

const editTool = defineTool({
  name: 'edit_note',
  section: ['pipeline', 'publicaciones'],
  title: 'Editar una nota del equipo',
  description: `Cambia el texto de una nota del equipo, de quien sea: reemplaza el texto entero. Queda anotado quién la editó. A las personas que se mencionan por primera vez les llega un mail. El id sale de list_notes o get_publication. ${ASK_FIRST}`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    nota: z.string().min(1).describe('El id de la nota.'),
    texto: z.string().min(1).max(NOTE_MAX).describe('El texto nuevo, entero.'),
    mencionar: mentionArg,
  }),
  readOnly: false,
  own: true,
  async run(ctx, args) {
    seeOnly(ctx);
    const account = await resolveAccount(ctx, args.cuenta);
    await resolvePublication(ctx, account.id, args.publicacion);
    const m = await mentionsOf(ctx, account.id, args.texto, args.mencionar);
    const note = await asToolError(() =>
      editNote(ctx.db, { accountId: account.id, noteId: args.nota, editorId: ctx.userId, input: { text: m.text, mentionIds: m.ids }, baseUrl: ctx.baseUrl }),
    );
    return { guardada: true, nota: noteOut(note, account) };
  },
});

const deleteTool = defineTool({
  name: 'delete_note',
  section: ['pipeline', 'publicaciones'],
  title: 'Borrar una nota del equipo',
  description: 'Borra una nota del equipo, de quien sea. No se puede deshacer: antes, mostrale a la persona qué nota vas a borrar y esperá que confirme.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, nota: z.string().min(1).describe('El id de la nota.') }),
  readOnly: false,
  destructive: true,
  own: true,
  async run(ctx, args) {
    seeOnly(ctx);
    const account = await resolveAccount(ctx, args.cuenta);
    await resolvePublication(ctx, account.id, args.publicacion);
    const r = await asToolError(() => deleteNote(ctx.db, { accountId: account.id, noteId: args.nota }));
    return { borrada: true, texto: r.text };
  },
});

export const NOTE_TOOLS = [listTool, addTool, editTool, deleteTool];
