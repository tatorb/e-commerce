import { z } from 'zod';
import { findSlot, insurProductData, InsurError, loadInsurScreen, setInsurLink, type InsurRunView } from '@/lib/insur';
import { McpToolError, accountArg, defineTool, resolveAccount } from './tool';

// El sistema de Insur desde Claude: ver la última corrida de la extensión con
// sus listas, y confirmar o ignorar un cruce dudoso. La lectura la corre la
// extensión de Chrome, no Claude. Nada de acá trae precios.

const LISTS = ['dudosos', 'sin_producto', 'no_aparecio', 'sospechosos', 'cambios', 'no_cargados'] as const;

function runForClaude(run: InsurRunView, lists: readonly (typeof LISTS)[number][], max: number) {
  const s = run.summary;
  const wants = (l: (typeof LISTS)[number]) => lists.includes(l);
  return {
    estado: run.status === 'DONE' ? 'terminada' : run.status === 'FAILED' ? 'cortada' : 'en curso',
    origen: run.origin === 'diaria' ? 'diaria' : 'botón',
    solo_mostrar: run.preview,
    empezo: run.startedAt.toISOString(),
    duracion_segundos: run.durationMs === null ? null : Math.round(run.durationMs / 1000),
    articulos_leidos_en_insur: run.read,
    articulos_recibidos: run.received,
    cruzados: run.linked,
    cambios_de_stock: run.stockChanges,
    cambios_de_costo: run.costChanges,
    costos_sospechosos: run.suspicious,
    stock_que_cambio_mas_de_50: s.jumps,
    costos_que_cambiaron_mas_de_30_por_ciento: s.bigCosts,
    ventas_restadas: s.sales ? { ventas: s.sales.sales, unidades: s.sales.units } : null,
    fichas_que_quedaron_para_la_proxima: s.pendingFichas,
    // Los nombres de los campos que trae Insur, sin valores: para saber qué hay, por ejemplo la moneda.
    campos_del_listado_de_insur: s.listFields,
    campos_de_la_ficha_de_insur: s.fichaFields,
    costos_sospechosos_contra_el_costo_de_la_app: {
      parecidos: s.suspiciousAgainst.near,
      mas_de_30_por_ciento_menores: s.suspiciousAgainst.lower,
      mas_de_30_por_ciento_mayores: s.suspiciousAgainst.higher,
      sin_costo_en_la_app: s.suspiciousAgainst.none,
    },
    ...(s.sync ? { subida_al_canal: { cantidades_subidas: s.sync.sent, no_se_pudo: s.sync.failed, ...(s.sync.pending ? { aviso: 'Quedaron cantidades por subir: las termina la pasada de cada hora.' } : {}) } } : {}),
    errores: run.errors,
    ...(wants('cambios')
      ? {
          cambios: s.changes.slice(0, max).map((c) => ({
            codigo_insur: c.code,
            producto: c.product,
            ...(c.measure ? { medida: c.measure } : {}),
            ...(c.stockChanged ? { stock_antes: c.before, stock_despues: c.after, ...(c.branches ? { por_sucursal: c.branches } : {}), ...(c.jump ? { cambio_mas_de_50: true } : {}) } : {}),
            ...(c.cost === 'changed' || c.cost === 'big' ? { costo: c.cost === 'big' ? 'cambió más de 30 %' : 'cambió' } : {}),
          })),
          cambios_en_total: s.changesTotal,
        }
      : {}),
    ...(wants('sospechosos') ? { costos_sospechosos_no_aplicados: s.suspicious.slice(0, max).map((x) => ({ codigo_insur: x.code, producto: x.product, ...(x.measure ? { medida: x.measure } : {}), motivo: x.reason })) } : {}),
    ...(wants('no_aparecio') ? { no_aparecio_en_insur: s.missing.slice(0, max).map((x) => ({ codigo_insur: x.code, producto: x.product, ...(x.measure ? { medida: x.measure } : {}) })) } : {}),
    ...(wants('no_cargados') ? { no_cargados: s.skipped.slice(0, max).map((x) => ({ codigo_insur: x.code, producto: x.product, motivo: x.reason })) } : {}),
    ...(wants('sin_producto')
      ? {
          sin_producto_en_la_app: s.unmatched.slice(0, max).map((x) => ({ codigo_insur: x.code, detalle: x.detail, marca: x.brand, rubro: x.category, ...(x.measure ? { medida: x.measure } : {}), stock_cordoba_mas_santa_fe: x.stock })),
          sin_producto_en_total: s.unmatchedTotal,
        }
      : {}),
  };
}

const getInsurSyncTool = defineTool({
  name: 'get_insur_sync',
  section: 'productos',
  title: 'Ver la última lectura del sistema de Insur',
  description:
    'La última corrida de la extensión de Chrome "Insur → E-commerce", que lee el stock, el costo y la ficha de cada artículo del sistema de Insur y corrige la app: fecha, origen (botón o diaria), duración, artículos leídos, cruzados, cambios de stock y de costo, costos sospechosos y errores. Con sus listas: los cruces dudosos para confirmar (con las medidas candidatas), los artículos sin producto en la app, las medidas con cruce que no aparecieron en Insur, los costos sospechosos que no se aplicaron y los cambios. También la fecha de corte y cuántas ventas del canal se están restando: el stock de cada medida es Córdoba más Santa Fe en Insur, menos las ventas del canal desde esa fecha. Si la cuenta está en modo prueba, ninguna corrida cambia nada hasta que una persona la aprueba en la pantalla Sistema de Insur. Nunca trae precios: de los costos solo dice si cambian. Esta herramienta no corre la lectura: la corre la extensión.',
  input: z.object({
    cuenta: accountArg,
    listas: z.array(z.enum(LISTS)).optional().describe('Qué listas traer. Sin mandar, todas.'),
    maximo: z.number().int().min(1).max(500).optional().describe('Cuántas filas de cada lista. Por defecto 100.'),
  }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const lists = args.listas?.length ? args.listas : LISTS;
    const max = args.maximo ?? 100;
    const screen = await loadInsurScreen(ctx.db, account.id);
    return {
      cuenta: account.slug,
      modo_prueba: screen.settings.approvedAt === null,
      ...(screen.settings.approvedAt === null ? { aviso: 'La cuenta está en modo prueba: las corridas no cambian nada hasta que una persona toca Aplicar en la pantalla Sistema de Insur.' } : {}),
      fecha_de_corte: screen.settings.cutoffAt.toISOString(),
      ventas_del_canal_que_se_restan_hoy: { ventas: screen.sales.sales, unidades: screen.sales.units },
      cruces: { automaticos: screen.links.auto, confirmados: screen.links.confirmed, por_confirmar_con_la_ficha: screen.links.pending, dudosos: screen.links.doubtful, ignorados: screen.links.ignored },
      ultima_corrida: screen.last ? runForClaude(screen.last, lists, max) : null,
      ...(screen.lastDone ? { ultima_corrida_terminada: runForClaude(screen.lastDone, lists, max) } : {}),
      ...(lists.includes('dudosos')
        ? {
            dudosos: screen.doubtful.links.slice(0, max).map((l) => ({
              articulo: l.insurId,
              codigo_insur: l.code,
              ...(l.measureName ? { medida_de_insur: l.measureName } : {}),
              detalle: l.detail,
              motivo: l.reason,
              stock_cordoba_mas_santa_fe: l.stock,
              medidas_candidatas: l.candidates.map((c) => ({ producto: c.productId, nombre: c.product, ...(c.measure ? { medida: c.measure } : {}), sku: c.sku })),
            })),
            dudosos_en_total: screen.doubtful.total,
          }
        : {}),
    };
  },
});

const setInsurLinkTool = defineTool({
  name: 'set_insur_link',
  section: 'productos',
  title: 'Confirmar o ignorar un cruce con Insur',
  description:
    'Dice a qué medida de un producto de la app va un artículo del sistema de Insur que quedó dudoso (get_insur_sync, dudosos), o lo ignora para que no vuelva a aparecer. Confirmado, las corridas siguientes de la extensión corrigen el stock y el costo de esa medida con los de Insur, sin revisión: usala solo con lo que te dice la persona, y antes mostrale qué vas a cruzar con vista_previa y esperá que confirme. Una medida lleva un solo artículo de Insur. No cambia stock ni costo en el momento: lo hace la corrida siguiente.',
  input: z.object({
    cuenta: accountArg,
    articulo: z.string().min(1).max(200).describe('El artículo de Insur: su código (por ejemplo "SP-169 040") o su número de artículo.'),
    accion: z.enum(['confirmar', 'ignorar']),
    producto: z.string().min(1).max(200).optional().describe('Para confirmar: el producto de la app, por su id (como viene en medidas_candidatas), su número de pieza o el SKU de la medida.'),
    medida: z.string().min(1).max(80).optional().describe('Para confirmar, si el producto tiene medidas: la medida ("STD", "0,50") o su SKU.'),
    vista_previa: z.boolean().optional().describe('true: solo dice qué haría, sin guardar.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    try {
      if (args.accion === 'confirmar' && !args.producto) throw new McpToolError('Para confirmar hace falta el producto.');
      const choice = args.accion === 'ignorar' ? ({ ignore: true } as const) : await findSlot(ctx.db, { accountId: account.id, product: args.producto!, measure: args.medida });
      const r = await setInsurLink(ctx.db, { accountId: account.id, link: args.articulo, choice, userId: ctx.userId, preview: args.vista_previa === true });
      return {
        ...(args.vista_previa ? { vista_previa: true } : { guardado: true }),
        articulo: r.insurId,
        codigo_insur: r.code,
        queda: r.status === 'IGNORED' ? 'ignorado' : 'confirmado',
        ...(r.product ? { producto: r.product, ...(r.measure ? { medida: r.measure } : {}) } : {}),
        ...(r.status === 'CONFIRMED' ? { aviso: 'El stock y el costo de esa medida se corrigen con los de Insur en la corrida siguiente de la extensión.' } : {}),
      };
    } catch (e) {
      if (e instanceof InsurError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

/** Los datos de Insur de un producto como los ve Claude en get_publication. Null si la cuenta no usa el sistema de Insur. */
export async function insurDataForClaude(db: Parameters<typeof insurProductData>[0], args: { accountId: string; productId: string }) {
  const data = await insurProductData(db, args);
  if (!data) return null;
  return {
    nota: 'Datos del sistema de Insur, solo de referencia: no son parte de la ficha y no van al canal.',
    articulos: data.rows.map((r) => ({
      codigo_insur: r.code,
      cruce: r.statusLabel,
      ...(r.measure ? { medida: r.measure } : {}),
      ...(r.reason ? { motivo: r.reason } : {}),
      stock_en_insur: { cordoba: r.stockCordoba, santa_fe: r.stockSantaFe },
      ...(r.ficha
        ? {
            precodigo: r.ficha.precode,
            detalle_articulo_id: r.ficha.detailGroupId,
            detalle: r.ficha.detail,
            bocas: r.ficha.bocas,
            observaciones: r.ficha.observations,
            linea: r.ficha.line,
            vehiculos: r.ficha.vehicles,
            medidas: r.ficha.measures,
            leido: r.ficha.readAt.toISOString(),
          }
        : { aviso: 'Todavía no se leyó su ficha de Insur.' }),
    })),
    avisos: data.warnings,
  };
}

export const INSUR_TOOLS = [getInsurSyncTool, setInsurLinkTool];
