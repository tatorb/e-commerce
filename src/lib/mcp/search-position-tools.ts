import { z } from 'zod';
import { ConnectError } from '@/channels/connect';
import { ResearchError } from '@/channels/research';
import { measureSearchPositions } from '@/lib/research';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication, when } from './tool';

// La posición de una publicación en las búsquedas, medida desde el servidor de
// la app con la API oficial del canal: sin la sesión del vendedor, que
// personaliza los resultados.

const measureTool = defineTool({
  name: 'measure_search_positions',
  section: 'pipeline',
  title: 'Medir la posición en las búsquedas',
  description:
    'Mide dónde aparece la publicación en sus búsquedas principales (las del paso Título), desde el servidor de la app con la API oficial del canal y la llave de la tienda conectada, no con la sesión del vendedor en el navegador, que personaliza los resultados. Busca cualquier código de la familia, de sus opciones de venta y del producto del canal, en las primeras 3 páginas. Por cada búsqueda guarda la página, la posición, con qué código apareció, si es orgánico y la fecha, como save_search_position, y devuelve los primeros 5 y la medición anterior, para ver el antes y el después de cambiar el título. La API oficial no trae la publicidad: lo que encuentra es orgánico. El histórico se ve en get_title_workspace.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    busquedas: z.array(z.string().min(1)).max(10).optional().describe('Otras búsquedas en vez de las principales, hasta 10.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    let r;
    try {
      r = await measureSearchPositions(ctx.db, { accountId: account.id, publicationId: id, queries: args.busquedas });
    } catch (e) {
      if (e instanceof ResearchError || e instanceof ConnectError) throw new McpToolError(e.message);
      throw e;
    }
    const ours = new Set(r.codes);
    return {
      codigos_buscados: r.codes,
      busquedas: r.searches.map((s) => ({
        busqueda: s.query,
        ...(s.error
          ? { error: s.error }
          : {
              aparece: s.found ? { pagina: s.found.page, posicion: s.found.position, con_el_codigo: s.found.code, organico: s.found.organic } : 'No aparece en las primeras 3 páginas.',
              primeros_5: s.top.map((t, i) => ({
                puesto: i + 1,
                codigo: t.code,
                titulo: t.title,
                vendedor: t.seller,
                es_nuestra: ours.has(t.code) || (t.productCode !== null && ours.has(t.productCode)),
              })),
            }),
        antes: s.before ? { pagina: s.before.page, posicion: s.before.position, fecha: when(s.before.at, account) } : null,
      })),
    };
  },
});

export const SEARCH_POSITION_TOOLS = [measureTool];
