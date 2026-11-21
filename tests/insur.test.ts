import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  appSlots,
  branchTargets,
  checkCost,
  depositOf,
  fichaChanges,
  fichaText,
  insurStock,
  matchArticle,
  measureHundredths,
  normPart,
  precodeMatches,
  skuHundredths,
  slotIndex,
  splitInsurCode,
  stockJumps,
} from '@/domain/insur';
import { stockSlots } from '@/domain/stock';
import type { ChannelOrder } from '@/channels/sales';
// La parte de la extensión que decide qué sale de Chrome.
import { clasificar, codigoSinMedida, costoDe, faltaFicha, fichaPermitida, normalizar, paraLaApp, proximaHora, stockDe, tandas } from '../extension-insur/lectura.js';

// El sistema de Insur: el cruce de cada artículo con una medida de la app, el
// stock con la fecha de corte y los controles del costo. Los códigos son los
// de Insur; los stocks, los costos y las ventas son inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { approveInsur, closeRun, DEFAULT_CUTOFF, doubtfulLinks, failRun, findSlot, insurCatalog, insurProductData, loadInsurScreen, openRun, parseArticles, receiveArticles, receiveUnmatched, saveInsurSettings, setInsurLink } =
  await import('@/lib/insur');
const { recordOrder } = await import('@/lib/stock');
const { saveBranch } = await import('@/lib/branches');
const { assignSaleBranch } = await import('@/lib/sale-branch');

describe('el cruce con Insur, sin la base', () => {
  it('separa el código de Insur en número de pieza y medida', () => {
    expect(splitInsurCode('SP-169 STD', 'STD')).toEqual({ part: 'SP-169', measure: 'STD' });
    expect(splitInsurCode('SP-169 040', '040')).toEqual({ part: 'SP-169', measure: '040' });
    expect(splitInsurCode('317615 -030', '-030')).toEqual({ part: '317615', measure: '-030' });
    expect(splitInsurCode('101507 0.50', '0.50')).toEqual({ part: '101507', measure: '0.50' });
    // Sin medida, Insur manda "-" y el código es el número de pieza tal cual.
    expect(splitInsurCode('00269BRG', '-')).toEqual({ part: '00269BRG', measure: null });
    expect(splitInsurCode('510 0065 10', '-')).toEqual({ part: '510 0065 10', measure: null });
    expect(splitInsurCode('13210-PWA-000', '-')).toEqual({ part: '13210-PWA-000', measure: null });
  });

  it('normaliza los números de pieza: mayúsculas, sin espacios, puntos ni guiones', () => {
    expect(normPart('510 0065 10')).toBe('510006510');
    expect(normPart('13210-PWA-000')).toBe('13210PWA000');
    expect(normPart('sp-169')).toBe('SP169');
    expect(normPart('93.801.600-00')).toBe('9380160000');
    expect(normPart(null)).toBe('');
    // La extensión normaliza igual que la app.
    for (const code of ['510 0065 10', '13210-PWA-000', 'sp-169', '00269BRG']) expect(normalizar(code)).toBe(normPart(code));
  });

  it('traduce las medidas a un número, y no adivina las dudosas', () => {
    expect(measureHundredths('STD')).toBe(0);
    expect(measureHundredths('020')).toBe(20);
    expect(measureHundredths('030')).toBe(30);
    expect(measureHundredths('040')).toBe(40);
    expect(measureHundredths('060')).toBe(60);
    expect(measureHundredths('0.50')).toBe(50);
    expect(measureHundredths('-030')).toBe(-30);
    expect(measureHundredths('-060')).toBe(-60);
    // Como las escribe la app.
    expect(measureHundredths('0,50')).toBe(50);
    expect(measureHundredths('-0,30')).toBe(-30);
    expect(measureHundredths('+0,50')).toBe(50);
    // Dudosas: no se adivinan.
    for (const m of ['+4', '+8', '005', '013', '-411', '', '100']) expect(measureHundredths(m)).toBeNull();
  });

  it('lee la medida del final del SKU solo cuando no hay dudas', () => {
    const family = ['SP-169-00', 'SP-169-50'];
    expect(skuHundredths('SP-169-00', 'SP-169', family)).toBe(0);
    // Con un "-00" en la familia, el guion es un separador.
    expect(skuHundredths('SP-169-50', 'SP-169', family)).toBe(50);
    expect(skuHundredths('364632+50', '364632', ['364632+50'])).toBe(50);
    // Con un "+" en la familia, el guion es un menos.
    expect(skuHundredths('317615-30', '317615', ['317615-30', '317615+30'])).toBe(-30);
    // Sin nada que lo diga, no se adivina.
    expect(skuHundredths('317615-30', '317615', ['317615', '317615-30'])).toBeNull();
    // El final no es una medida si lo de antes no es el número de pieza.
    expect(skuHundredths('13210-PWA-000', 'OTRO', [])).toBeNull();
  });

  const products = [
    { id: 'sp169', partNumber: 'SP-169', variants: [{ sku: 'SP-169-00', measure: 'STD' }, { sku: 'SP-169-40', measure: '0,40' }, { sku: 'SP-169-60', measure: '0,60' }] },
    { id: 'aro', partNumber: '317615', variants: [{ sku: '317615', measure: 'STD' }, { sku: '317615-30', measure: '-0,30' }] },
    { id: 'coj', partNumber: '101507', variants: [{ sku: '101507-00', measure: null }, { sku: '101507-50', measure: null }] },
    { id: 'brg', partNumber: '00269BRG', variants: [] },
    { id: 'emb', partNumber: '510.0065.10', variants: [{ sku: '510006510', measure: null }] },
    { id: 'val', partNumber: '13210 PWA 000', variants: [] },
    { id: 'raro', partNumber: 'RX-1', variants: [{ sku: 'RX-1-A', measure: '+4' }, { sku: 'RX-1-B', measure: '+8' }] },
  ];
  const slots = appSlots(products.map((p) => ({ id: p.id, partNumber: p.partNumber, slots: stockSlots(p.variants) })));
  const index = slotIndex(slots);
  const keyOf = (id: string, i: number) => stockSlots(products.find((p) => p.id === id)!.variants)[i].key;
  const match = (code: string, measureName: string) => matchArticle({ code, measureName }, index);

  it('automático: número de pieza y medida coinciden con una sola medida de la app', () => {
    expect(match('SP-169 STD', 'STD')).toEqual({ kind: 'auto', productId: 'sp169', key: keyOf('sp169', 0) });
    expect(match('SP-169 040', '040')).toEqual({ kind: 'auto', productId: 'sp169', key: keyOf('sp169', 1) });
    expect(match('SP-169 060', '060')).toEqual({ kind: 'auto', productId: 'sp169', key: keyOf('sp169', 2) });
    expect(match('317615 -030', '-030')).toEqual({ kind: 'auto', productId: 'aro', key: keyOf('aro', 1) });
    // La medida de la app sale del final del SKU.
    expect(match('101507 0.50', '0.50')).toEqual({ kind: 'auto', productId: 'coj', key: keyOf('coj', 1) });
    expect(match('00269BRG', '-')).toEqual({ kind: 'auto', productId: 'brg', key: '' });
    expect(match('510 0065 10', '-')).toEqual({ kind: 'auto', productId: 'emb', key: '' });
    expect(match('13210-PWA-000', '-')).toEqual({ kind: 'auto', productId: 'val', key: '' });
  });

  it('dudoso: coincide el número de pieza pero no se puede asegurar la medida', () => {
    // La app no tiene esa medida.
    expect(match('SP-169 020', '020')).toMatchObject({ kind: 'doubtful', reason: 'El producto de la app no tiene la medida "020".' });
    // Una medida que no se traduce.
    expect(match('SP-169 005', '005')).toMatchObject({ kind: 'doubtful', reason: 'La medida "005" de Insur no se puede traducir sin dudas.' });
    expect(match('RX-1 +4', '+4')).toMatchObject({ kind: 'doubtful', candidates: [{ productId: 'raro' }, { productId: 'raro' }] });
    // Insur no dice la medida y la app tiene varias.
    expect(match('SP-169', '-')).toMatchObject({ kind: 'doubtful', reason: 'El artículo de Insur no dice la medida y el producto de la app tiene varias.' });
    // Insur tiene medida y la app no.
    expect(match('00269BRG STD', 'STD')).toMatchObject({ kind: 'doubtful', candidates: [{ productId: 'brg', key: '' }] });
    // No se sabe si "-30" es separador o menos, y la ficha no lo dice.
    const loose = slotIndex(appSlots([{ id: 'x', partNumber: '317615', slots: stockSlots([{ sku: '317615', measure: null }, { sku: '317615-30', measure: null }]) }]));
    expect(matchArticle({ code: '317615 -030', measureName: '-030' }, loose)).toMatchObject({ kind: 'doubtful' });
    // Dos productos con el mismo número de pieza.
    const twice = slotIndex(appSlots([{ id: 'a', partNumber: 'ZZ-1', slots: stockSlots([]) }, { id: 'b', partNumber: 'ZZ 1', slots: stockSlots([]) }]));
    expect(matchArticle({ code: 'ZZ-1', measureName: '-' }, twice)).toMatchObject({ kind: 'doubtful', reason: 'Hay más de un producto en la app con ese número de pieza.' });
  });

  it('cuando en la medida de la ficha está escrito el SKU, la medida sale del final del SKU', () => {
    // Como los cojinetes: número de pieza con guion, SKU con barra, y el SKU repetido en la medida.
    const variants = ['00', '10', '20', '40', '50'].map((m) => ({ sku: `10070/4-${m}`, measure: `10070/4-${m}` }));
    const cojinetes = slotIndex(appSlots([{ id: 'c', partNumber: '10070-4', slots: stockSlots(variants) }]));
    const key = (i: number) => stockSlots(variants)[i].key;
    expect(normPart('10070/4')).toBe(normPart('10070-4'));
    expect(normalizar('10070/4-10')).toBe(normPart('10070/4-10'));
    expect(matchArticle({ code: '10070-4 STD', measureName: 'STD' }, cojinetes)).toEqual({ kind: 'auto', productId: 'c', key: key(0) });
    expect(matchArticle({ code: '10070-4 010', measureName: '010' }, cojinetes)).toEqual({ kind: 'auto', productId: 'c', key: key(1) });
    expect(matchArticle({ code: '10070-4 050', measureName: '050' }, cojinetes)).toEqual({ kind: 'auto', productId: 'c', key: key(4) });
    // La app no tiene la 0,30: dudoso, con su motivo.
    expect(matchArticle({ code: '10070-4 030', measureName: '030' }, cojinetes)).toMatchObject({ kind: 'doubtful', reason: 'El producto de la app no tiene la medida "030".' });
  });

  it('sin producto en la app', () => {
    expect(match('IN-855 0.50', '0.50')).toEqual({ kind: 'none' });
    expect(match('NO-ESTA', '-')).toEqual({ kind: 'none' });
  });

  it('el precodigo de la ficha de Insur confirma el cruce', () => {
    expect(precodeMatches('SP-169', 'SP-169')).toBe(true);
    expect(precodeMatches('sp 169', 'SP-169')).toBe(true);
    expect(precodeMatches('IN-855', 'SP-855')).toBe(false);
    expect(precodeMatches(null, 'SP-169')).toBe(false);
    expect(precodeMatches('', '')).toBe(false);
  });

  it('el stock: Córdoba más Santa Fe, menos las ventas desde el corte, nunca menos de 0', () => {
    expect(insurStock({ cordoba: 3, santaFe: 2, sold: 0 })).toBe(5);
    expect(insurStock({ cordoba: 3, santaFe: 2, sold: 2 })).toBe(3);
    expect(insurStock({ cordoba: 1, santaFe: 0, sold: 4 })).toBe(0);
    // Un depósito en negativo vale 0 (SP-169 060 en -1).
    expect(insurStock({ cordoba: -1, santaFe: 2, sold: 0 })).toBe(2);
    expect(stockJumps(10, 61)).toBe(true);
    expect(stockJumps(10, 60)).toBe(false);
    expect(stockJumps(null, 51)).toBe(true);
  });

  it('en cada sucursal queda lo de Insur menos lo que salió de ella', () => {
    // Una venta Flex salió de Córdoba y otra espera sucursal: entre las dos suman el stock más la que espera.
    expect(branchTargets([3, 2], [1, 0], 0, 3 + 1)).toEqual([2, 2]);
    // Lo vendido sin sucursal conocida sale de la que más tiene.
    expect(branchTargets([1, 4], [0, 0], 2, 3)).toEqual([1, 2]);
    // Ninguna queda en negativo: lo que le falta a una sale de la otra.
    expect(branchTargets([0, 3], [1, 0], 0, 2)).toEqual([0, 2]);
    // Se vendió más de lo que hay: todo en 0.
    expect(branchTargets([1, 0], [3, 0], 0, 0)).toEqual([0, 0]);
    expect(depositOf('Córdoba')).toBe('cordoba');
    expect(depositOf('Santa Fe')).toBe('santaFe');
    expect(depositOf('Rosario')).toBeNull();
  });

  it('los controles del costo', () => {
    expect(checkCost({ cost: null, suspicious: true, current: 100 })).toMatchObject({ apply: false });
    expect(checkCost({ cost: 0, suspicious: false, current: 100 })).toMatchObject({ apply: false });
    expect(checkCost({ cost: -5, suspicious: false, current: 100 })).toMatchObject({ apply: false });
    // Mayor que el precio del proveedor: lo marca la extensión, sin mandar ese precio.
    expect(checkCost({ cost: 120, suspicious: true, current: 100 })).toEqual({ apply: false, reason: 'El costo de Insur es mayor que su precio del proveedor.', against: 'near' });
    // Contra el costo de la app, sin montos: sirve para ver si el de Insur está en otra moneda.
    expect(checkCost({ cost: 0.5, suspicious: true, current: 700 })).toMatchObject({ against: 'lower' });
    expect(checkCost({ cost: 9000, suspicious: true, current: 700 })).toMatchObject({ against: 'higher' });
    expect(checkCost({ cost: 9000, suspicious: true, current: null })).toMatchObject({ against: 'none' });
    expect(checkCost({ cost: 100, suspicious: false, current: 100 })).toEqual({ apply: true, cost: 100, changed: false, big: false });
    expect(checkCost({ cost: 125.456, suspicious: false, current: 100 })).toEqual({ apply: true, cost: 125.46, changed: true, big: false });
    // Más de 30 %: se aplica igual y queda marcado.
    expect(checkCost({ cost: 131, suspicious: false, current: 100 })).toMatchObject({ apply: true, changed: true, big: true });
    expect(checkCost({ cost: 60, suspicious: false, current: 100 })).toMatchObject({ apply: true, big: true });
    expect(checkCost({ cost: 60, suspicious: false, current: null })).toMatchObject({ apply: true, changed: true, big: false });
  });

  it('la ficha: sin precios, y lo que cambió contra la lectura anterior', () => {
    expect(fichaText('  LE FALTA CRAPODINA ')).toBe('LE FALTA CRAPODINA');
    expect(fichaText(['STD', '0.50'])).toBe('STD\n0.50');
    expect(fichaText([{ codigo: 'IN-855 0.50', precioFinal: 9, margenEmpresa: 2 }])).toBe('[{"codigo":"IN-855 0.50"}]');
    expect(fichaText(null)).toBeNull();
    expect(fichaChanges({ detail: 'a', observations: null, vehicles: 'v' }, { detail: 'a ', observations: 'LE FALTA CRAPODINA', vehicles: 'v' })).toEqual([
      { field: 'observations', before: null, after: 'LE FALTA CRAPODINA' },
    ]);
  });
});

describe('la extensión, sin Chrome', () => {
  const articulo = (extra: Record<string, unknown> = {}) => ({
    id: 7,
    codigo: 'SP-169 060',
    codigoBarra: null,
    detalle: 'Subconjunto',
    medidaNombre: '060',
    marcaNombre: 'Marca Uno',
    rubroNombre: 'Subconjuntos',
    precioProveedor: 200,
    precioCosto: 150,
    precioLista: 300,
    precioFinal: 363,
    alicuotaIva: 21,
    factorArticulo: 1.5,
    stockTotal: 9,
    stock: [
      { depositoId: 1, depositoNombre: 'Santa Fe', stockReal: 2, stockMinimo: 0 },
      { depositoId: 2, depositoNombre: 'Cordoba', stockReal: -1, stockMinimo: 0 },
      { depositoId: 3, depositoNombre: 'Rosario', stockReal: 8, stockMinimo: 0 },
    ],
    ...extra,
  });

  it('el stock: Córdoba y Santa Fe, sin Rosario, y un negativo vale 0', () => {
    expect(stockDe(articulo())).toEqual({ cordoba: 0, santaFe: 2 });
    expect(stockDe({ stock: null })).toEqual({ cordoba: 0, santaFe: 0 });
  });

  it('a la app no viaja ningún precio que no sea el costo', () => {
    const sent = paraLaApp(articulo(), true);
    expect(sent).toEqual({ id: 7, codigo: 'SP-169 060', medida: '060', marca: 'Marca Uno', rubro: 'Subconjuntos', detalle: 'Subconjunto', stock_cordoba: 0, stock_santa_fe: 2, costo: 150, costo_sospechoso: false });
    expect(JSON.stringify(sent)).not.toMatch(/200|300|363|precio|factor/i);
    // Para el listado de los que no tienen producto, tampoco el costo.
    expect(paraLaApp(articulo(), false)).not.toHaveProperty('costo');
  });

  it('el costo sospechoso: vacío, 0, negativo o mayor que el precio del proveedor', () => {
    expect(costoDe(articulo())).toEqual({ costo: 150, sospechoso: false, veces: null });
    expect(costoDe(articulo({ precioCosto: 250 }))).toEqual({ costo: 250, sospechoso: true, veces: 'hasta 2' });
    // Un costo cientos de veces mayor que el precio del proveedor: están en monedas distintas.
    expect(costoDe(articulo({ precioCosto: 280000 }))).toMatchObject({ sospechoso: true, veces: 'más de 100' });
    expect(paraLaApp(articulo({ precioCosto: 280000 }), true)).toMatchObject({ costo_veces_proveedor: 'más de 100' });
    expect(costoDe(articulo({ precioCosto: 0 }))).toEqual({ costo: null, sospechoso: true, veces: null });
    expect(costoDe(articulo({ precioCosto: -3 }))).toEqual({ costo: null, sospechoso: true, veces: null });
    expect(costoDe(articulo({ precioCosto: null }))).toEqual({ costo: null, sospechoso: true, veces: null });
  });

  it('manda solo lo que tiene cruce, o su número de pieza en la app, o stock y una marca que la app tiene', () => {
    const catalogo = { claves: new Set(['SP169', '00269BRG']), marcas: new Set(['MARCA UNO']), cruces: new Map([[99, {}]]) };
    expect(codigoSinMedida('SP-169 060', '060')).toBe('SP-169');
    expect(clasificar(articulo(), catalogo)).toBe('candidato');
    expect(clasificar(articulo({ id: 8, codigo: '00269BRG', medidaNombre: '-' }), catalogo)).toBe('candidato');
    // Con cruce, aunque el código ya no coincida.
    expect(clasificar(articulo({ id: 99, codigo: 'OTRO', medidaNombre: '-' }), catalogo)).toBe('candidato');
    // Sin producto: solo con stock en Córdoba o Santa Fe y de una marca de la app.
    expect(clasificar(articulo({ id: 9, codigo: 'XX-1', medidaNombre: '-' }), catalogo)).toBe('sin_producto');
    expect(clasificar(articulo({ id: 9, codigo: 'XX-1', medidaNombre: '-', marcaNombre: 'Otra' }), catalogo)).toBeNull();
    // El stock de Rosario no cuenta.
    expect(clasificar(articulo({ id: 9, codigo: 'XX-1', medidaNombre: '-', stock: [{ depositoNombre: 'Rosario', stockReal: 5 }] }), catalogo)).toBeNull();
  });

  it('de la ficha salen solo los datos permitidos', () => {
    const ficha = fichaPermitida({
      success: true,
      data: { id: 7, precodigo: 'IN-855', detalleArticuloId: 41, detalle: '89.00mm', bocas: '4', observaciones: 'LE FALTA CRAPODINA', lineaNombre: 'Liviano', listadoVehiculos: 'Renault MASTER', listadoMedidas: [{ codigo: 'IN-855 0.50', precioFinal: 9 }], precioCosto: 1, precioProveedor: 2, precioLista: 3, precioFinal: 4, factor: 5, factorArticulo: 6, margenEmpresa: 7 },
    });
    expect(ficha).toEqual({ precodigo: 'IN-855', detalle_articulo_id: 41, detalle: '89.00mm', bocas: '4', observaciones: 'LE FALTA CRAPODINA', linea: 'Liviano', vehiculos: 'Renault MASTER', medidas: [{ codigo: 'IN-855 0.50' }] });
    expect(JSON.stringify(ficha)).not.toMatch(/precio|factor|margen/i);
  });

  it('cuándo se lee la ficha: la primera vez, cada tantos días y si cambia el detalle', () => {
    const now = Date.parse('2026-11-21T10:00:00Z');
    const sent = { detalle: 'Subconjunto' };
    expect(faltaFicha(sent, undefined, 7, now)).toBe(2);
    expect(faltaFicha(sent, { ficha_leida: null }, 7, now)).toBe(2);
    expect(faltaFicha(sent, { ficha_leida: '2026-11-20T10:00:00Z', detalle: 'Subconjunto' }, 7, now)).toBe(0);
    expect(faltaFicha(sent, { ficha_leida: '2026-11-10T10:00:00Z', detalle: 'Subconjunto' }, 7, now)).toBe(1);
    expect(faltaFicha(sent, { ficha_leida: '2026-11-20T10:00:00Z', detalle: 'Otro' }, 7, now)).toBe(1);
    expect(faltaFicha(sent, { ignorado: true }, 7, now)).toBe(0);
  });

  it('las tandas no parten las medidas de un mismo número de pieza, y la hora de la corrida diaria', () => {
    const list = ['A STD', 'A 040', 'B STD', 'B 040', 'C STD'].map((codigo) => ({ codigo, medida: codigo.split(' ')[1] }));
    expect(tandas(list, 1, 10).map((t) => t.map((a) => a.codigo))).toEqual([['A STD', 'A 040'], ['B STD', 'B 040'], ['C STD']]);
    expect(tandas(list, 1, 1)).toHaveLength(5);
    const now = new Date(2026, 10, 21, 7, 0).getTime();
    expect(new Date(proximaHora('06:40', now)).getDate()).toBe(22);
    expect(new Date(proximaHora('08:15', now)).getHours()).toBe(8);
  });
});

describe.skipIf(!url)('el sistema de Insur en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  const userId = 'persona';
  const now = new Date('2026-11-21T10:00:00Z');
  const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE insur_sync_runs, insur_article_data, insur_article_links, insur_settings, tasks, branch_stock, branches, stock_movements, channel_sales, product_costs, product_stock, channel_sync_changes, channel_copies, sales, channel_connections, publications, product_variants, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'insur', name: 'Cuenta de prueba' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    await db.user.create({ data: { id: userId, email: 'persona@ejemplo.com', name: 'Persona', isAdmin: true } });
    accountId = account.id;
    storeId = store.id;
  });

  /** Un producto con sus medidas; con stock, ya lleva stock en la app. */
  const product = async (name: string, partNumber: string, variants: { sku: string; measure: string | null }[], stock?: number[]) => {
    const p = await db.product.create({
      data: { accountId, name, partNumber, brand: 'Marca Uno', stockSince: stock ? new Date('2026-11-01T00:00:00Z') : null, variants: { create: variants.map((v, i) => ({ ...v, position: i })) } },
    });
    const slots = stockSlots(variants);
    if (stock) await db.productStock.createMany({ data: slots.map((s, i) => ({ productId: p.id, key: s.key, label: s.label, quantity: stock[i] ?? 0 })) });
    return { id: p.id, keys: slots.map((s) => s.key) };
  };
  const sp169 = () =>
    product('Subconjunto SP-169', 'SP-169', [{ sku: 'SP-169-00', measure: 'STD' }, { sku: 'SP-169-40', measure: '0,40' }, { sku: 'SP-169-60', measure: '0,60' }], [9, 9, 9]);

  type Sent = { id: number; codigo: string; medida: string; cba?: number; sf?: number; costo?: number | null; sospechoso?: boolean; precodigo?: string | null };
  const articles = (list: Sent[]) =>
    parseArticles(
      list.map((a) => ({
        id: a.id,
        codigo: a.codigo,
        medida: a.medida,
        marca: 'Marca Uno',
        rubro: 'Rubro',
        detalle: `Detalle de ${a.codigo}`,
        stock_cordoba: a.cba ?? 0,
        stock_santa_fe: a.sf ?? 0,
        costo: a.costo === undefined ? 100 : a.costo,
        costo_sospechoso: a.sospechoso === true,
        ...(a.precodigo !== undefined ? { ficha: { precodigo: a.precodigo, detalle_articulo_id: 41, detalle: 'Ficha', observaciones: 'LE FALTA CRAPODINA', vehiculos: 'Renault MASTER' } } : {}),
      })),
    );
  /** Una corrida entera con esos artículos. */
  const run = async (list: Sent[], opts: { preview?: boolean; at?: Date } = {}) => {
    const at = opts.at ?? now;
    const opened = await openRun(db, { accountId, userId, origin: 'boton', preview: opts.preview === true, read: 48380, now: at });
    await receiveArticles(db, { accountId, runId: opened.runId, userId, articles: articles(list), now: at });
    return closeRun(db, { accountId, runId: opened.runId, userId, durationMs: 400_000, pendingFichas: 0, fichaFields: ['precodigo', 'precioCosto'], now: at });
  };
  const links = async () => Object.fromEntries((await db.insurArticleLink.findMany({ select: { code: true, status: true } })).map((l) => [l.code, l.status]));
  const stockOf = async (productId: string) => Object.fromEntries((await db.productStock.findMany({ where: { productId } })).map((s) => [s.label, s.quantity]));
  const costsOf = async (productId: string) => Object.fromEntries((await db.productCost.findMany({ where: { productId } })).map((c) => [c.key, Number(c.cost)]));

  const order = (orderId: string, listingId: string, quantity: number, extra: Partial<ChannelOrder> = {}): ChannelOrder => ({
    orderId,
    sellerId: '7',
    orderedAt: '2026-11-20T10:00:00.000-03:00',
    counts: true,
    cancelled: false,
    delivered: false,
    lines: [{ listingId, variationId: null, sku: null, quantity }],
    ...extra,
  });

  it('el catálogo para la extensión: las claves para cruzar, las marcas y los cruces, sin precios', async () => {
    const p = await sp169();
    await db.productCost.create({ data: { productId: p.id, key: p.keys[0], cost: 777.77 } });
    await run([{ id: 1, codigo: 'SP-169 STD', medida: 'STD', precodigo: 'SP-169' }]);
    const c = await insurCatalog(db, accountId);
    expect(c.modo_prueba).toBe(true);
    expect(c.claves).toEqual(['SP169', 'SP16900', 'SP16940', 'SP16960']);
    expect(c.marcas).toEqual(['MARCA UNO']);
    expect(c.cruces).toEqual([expect.objectContaining({ id: 1, codigo: 'SP-169 STD', estado: 'automático', detalle: 'Detalle de SP-169 STD' })]);
    expect(c.cruces[0].ficha_leida).not.toBeNull();
    expect(JSON.stringify(c)).not.toContain('777');
  });

  it('la primera corrida es de prueba: cruza y arma el resumen sin cambiar nada; aprobada, las siguientes corrigen', async () => {
    const p = await sp169();
    const list: Sent[] = [
      { id: 1, codigo: 'SP-169 STD', medida: 'STD', cba: 3, sf: 2, costo: 150, precodigo: 'SP-169' },
      { id: 2, codigo: 'SP-169 040', medida: '040', cba: 0, sf: 70, costo: 150, precodigo: 'SP-169' },
      // Un depósito en negativo vale 0.
      { id: 3, codigo: 'SP-169 060', medida: '060', cba: -1, sf: 0, costo: 250, sospechoso: true, precodigo: 'SP-169' },
    ];
    const first = await run(list);
    expect(first).toMatchObject({ preview: true, status: 'DONE', read: 48380, received: 3, linked: 3, stockChanges: 3, costChanges: 2, suspicious: 1, durationMs: 400_000 });
    expect(await links()).toEqual({ 'SP-169 STD': 'AUTO', 'SP-169 040': 'AUTO', 'SP-169 060': 'AUTO' });
    // Nada cambió.
    expect(await stockOf(p.id)).toEqual({ STD: 9, '0,40': 9, '0,60': 9 });
    expect(await costsOf(p.id)).toEqual({});
    expect(first.summary.changes.map((c) => [c.code, c.before, c.after, c.jump, c.cost])).toEqual([
      ['SP-169 STD', 9, 5, false, 'changed'],
      ['SP-169 040', 9, 70, true, 'changed'],
      ['SP-169 060', 9, 0, false, null],
    ]);
    expect(first.summary.suspicious).toEqual([
      { code: 'SP-169 060', product: 'Subconjunto SP-169', measure: '0,60', reason: 'El costo de Insur es mayor que su precio del proveedor. La app no tiene un costo cargado para comparar.' },
    ]);
    expect(first.summary.suspiciousAgainst).toEqual({ near: 0, lower: 0, higher: 0, none: 1 });
    expect(first.summary.fichaFields).toEqual(['precodigo', 'precioCosto']);
    // Ni el resumen ni los cruces guardan un precio.
    const saved = JSON.stringify([await db.insurSyncRun.findMany(), await db.insurArticleLink.findMany(), await db.insurArticleData.findMany()]);
    expect(saved).not.toMatch(/150|250/);

    await approveInsur(db, { accountId, userId, now });
    const second = await run(list, { at: later(60) });
    expect(second).toMatchObject({ preview: false, stockChanges: 3, costChanges: 2, suspicious: 1 });
    expect(await stockOf(p.id)).toEqual({ STD: 5, '0,40': 70, '0,60': 0 });
    // El costo sospechoso no se aplica.
    expect(await costsOf(p.id)).toEqual({ [p.keys[0]]: 150, [p.keys[1]]: 150 });
    const moves = await db.stockMovement.findMany({ where: { productId: p.id }, orderBy: { id: 'asc' }, select: { kind: true, delta: true, after: true, note: true, userId: true } });
    expect(moves).toContainEqual({ kind: 'MANUAL', delta: -4, after: 5, note: 'Sistema de Insur.', userId });
    expect(moves).toHaveLength(3);
    // Otra corrida igual no cambia nada.
    const third = await run(list, { at: later(120) });
    expect(third).toMatchObject({ stockChanges: 0, costChanges: 0 });
    expect(await db.stockMovement.count({ where: { productId: p.id } })).toBe(3);
    // Con "Solo mostrar" tampoco cambia, aunque ya esté aprobada.
    await run([{ ...list[0], cba: 1, sf: 0 }, list[1], list[2]], { preview: true, at: later(180) });
    expect((await stockOf(p.id)).STD).toBe(5);
  });

  it('el cruce se confirma con el precodigo de la ficha; si no coincide, queda dudoso y no se toca', async () => {
    const p = await sp169();
    const brg = await product('Rodamiento 00269BRG', '00269BRG', [], [4]);
    await approveInsur(db, { accountId, userId, now });
    // Sin la ficha leída todavía, queda por confirmar y no se corrige.
    await run([{ id: 1, codigo: 'SP-169 STD', medida: 'STD', cba: 1, sf: 1 }, { id: 5, codigo: '00269BRG', medida: '-', cba: 2, sf: 0 }]);
    expect(await links()).toEqual({ 'SP-169 STD': 'PENDING', '00269BRG': 'PENDING' });
    expect((await stockOf(p.id)).STD).toBe(9);
    // Llega la ficha: una coincide y la otra no.
    const r = await run(
      [
        { id: 1, codigo: 'SP-169 STD', medida: 'STD', cba: 1, sf: 1, precodigo: 'SP-169' },
        { id: 5, codigo: '00269BRG', medida: '-', cba: 2, sf: 0, precodigo: 'IN-269' },
      ],
      { at: later(60) },
    );
    expect(await links()).toEqual({ 'SP-169 STD': 'AUTO', '00269BRG': 'DOUBTFUL' });
    expect(r).toMatchObject({ linked: 1, stockChanges: 1 });
    expect((await stockOf(p.id)).STD).toBe(2);
    expect(await stockOf(brg.id)).toEqual({ '': 4 });
    const doubt = await doubtfulLinks(db, accountId);
    expect(doubt.total).toBe(1);
    expect(doubt.links[0]).toMatchObject({ code: '00269BRG', reason: 'El precodigo de Insur (IN-269) no coincide con el número de pieza de la ficha (00269BRG).', candidates: [{ productId: brg.id, key: '', product: 'Rodamiento 00269BRG' }] });
    // Las corridas siguientes usan la tabla: no hace falta volver a mandar la ficha.
    await run([{ id: 1, codigo: 'SP-169 STD', medida: 'STD', cba: 4, sf: 1 }, { id: 5, codigo: '00269BRG', medida: '-', cba: 2, sf: 0 }], { at: later(120) });
    expect((await stockOf(p.id)).STD).toBe(5);
    expect(await links()).toEqual({ 'SP-169 STD': 'AUTO', '00269BRG': 'DOUBTFUL' });
  });

  it('con dos productos con el mismo número de pieza, cruza con el que está publicado; si no se puede elegir, queda dudoso', async () => {
    const live = await product('Subconjunto Tik', 'TIK2R800700', [{ sku: 'TIK-00', measure: 'STD' }, { sku: 'TIK-50', measure: '0,50 mm' }], [1, 1]);
    const copy = await product('Subconjunto (pistones + aros) TIK2R800700', 'TIK2R800700', [], [1]);
    const list: Sent[] = [{ id: 40, codigo: 'TIK2R800700 STD', medida: 'STD', cba: 3, sf: 0, precodigo: 'TIK2R800700' }];
    // Ninguno publicado: no se puede elegir.
    await run(list);
    expect(await links()).toEqual({ 'TIK2R800700 STD': 'DOUBTFUL' });
    expect((await doubtfulLinks(db, accountId)).links[0].candidates.map((c) => c.productId).sort()).toEqual([live.id, live.id, copy.id].sort());
    // Uno solo publicado: va ese.
    await db.publication.create({ data: { productId: live.id, storeId, externalId: 'MLA77', title: 'Subconjunto Tik' } });
    await run(list, { at: later(60) });
    expect(await db.insurArticleLink.findFirstOrThrow({ where: { insurId: 40 } })).toMatchObject({ status: 'AUTO', productId: live.id, key: live.keys[0] });
  });

  it('un dudoso se confirma a mano o se ignora, con vista previa; confirmado, la corrida siguiente lo corrige', async () => {
    const p = await sp169();
    await approveInsur(db, { accountId, userId, now });
    // "005" no se traduce: dudoso. "020" no existe en la app: dudoso.
    const list: Sent[] = [
      { id: 10, codigo: 'SP-169 005', medida: '005', cba: 6, sf: 0, costo: 90, precodigo: 'SP-169' },
      { id: 11, codigo: 'SP-169 020', medida: '020', cba: 1, sf: 0, precodigo: 'SP-169' },
      { id: 12, codigo: 'NO-ESTA', medida: '-', cba: 1, sf: 0 },
    ];
    const r = await run(list);
    expect(r).toMatchObject({ received: 3, linked: 0, stockChanges: 0 });
    // Lo que no tiene producto no deja cruce.
    expect(await links()).toEqual({ 'SP-169 005': 'DOUBTFUL', 'SP-169 020': 'DOUBTFUL' });
    const slot = await findSlot(db, { accountId, product: 'sp 169', measure: '0,40' });
    expect(slot).toEqual({ productId: p.id, key: p.keys[1] });
    await expect(findSlot(db, { accountId, product: 'SP-169' })).rejects.toThrow('El producto tiene medidas: falta la medida.');
    // La vista previa no cambia nada.
    expect(await setInsurLink(db, { accountId, link: 'SP-169 005', choice: slot, userId, preview: true })).toMatchObject({ status: 'CONFIRMED', product: 'Subconjunto SP-169', measure: '0,40', before: 'DOUBTFUL' });
    expect((await links())['SP-169 005']).toBe('DOUBTFUL');
    await setInsurLink(db, { accountId, link: 'SP-169 005', choice: slot, userId });
    await setInsurLink(db, { accountId, link: '11', choice: { ignore: true }, userId });
    expect(await links()).toEqual({ 'SP-169 005': 'CONFIRMED', 'SP-169 020': 'IGNORED' });
    // Dos artículos no van a la misma medida.
    await run([...list, { id: 13, codigo: 'SP-169 040', medida: '040', cba: 9, sf: 9, precodigo: 'SP-169' }], { at: later(60) });
    expect((await links())['SP-169 040']).toBe('DOUBTFUL');
    expect(await stockOf(p.id)).toMatchObject({ '0,40': 6 });
    expect((await costsOf(p.id))[p.keys[1]]).toBe(90);
    await expect(setInsurLink(db, { accountId, link: 'SP-169 040', choice: slot, userId })).rejects.toThrow('Esa medida ya está cruzada con el artículo SP-169 005 de Insur.');
  });

  it('lo que tiene cruce y no aparece no se toca y queda en la lista; si cambia el código, pasa a dudoso', async () => {
    const p = await sp169();
    await approveInsur(db, { accountId, userId, now });
    const list: Sent[] = [
      { id: 1, codigo: 'SP-169 STD', medida: 'STD', cba: 1, sf: 0, precodigo: 'SP-169' },
      { id: 2, codigo: 'SP-169 040', medida: '040', cba: 2, sf: 0, precodigo: 'SP-169' },
    ];
    await run(list);
    expect(await stockOf(p.id)).toMatchObject({ STD: 1, '0,40': 2 });
    const r = await run([{ id: 1, codigo: 'SP-169 STD-X', medida: '-', cba: 7, sf: 0 }], { at: later(60) });
    expect(r.summary.missing).toEqual([{ code: 'SP-169 040', product: 'Subconjunto SP-169', measure: '0,40', reason: 'No apareció en la lectura de Insur: su stock y su costo no se tocaron.' }]);
    expect(await links()).toEqual({ 'SP-169 STD-X': 'DOUBTFUL', 'SP-169 040': 'DOUBTFUL' });
    expect((await db.insurArticleLink.findFirstOrThrow({ where: { insurId: 1 } })).reason).toBe('El código de Insur cambió de "SP-169 STD" a "SP-169 STD-X".');
    // Ninguno de los dos se tocó.
    expect(await stockOf(p.id)).toMatchObject({ STD: 1, '0,40': 2 });
    // Vuelve a aparecer con el mismo código: se cruza solo de nuevo.
    await run(list, { at: later(120) });
    expect(await links()).toEqual({ 'SP-169 STD': 'AUTO', 'SP-169 040': 'AUTO' });
  });

  it('el stock resta las ventas del canal desde la fecha de corte, sin las canceladas ni las de antes', async () => {
    const brg = await product('Rodamiento 00269BRG', '00269BRG', [], [20]);
    const pub = await db.publication.create({ data: { productId: brg.id, storeId, externalId: 'MLA1', title: 'Rodamiento' } });
    await db.channelCopy.create({ data: { publicationId: pub.id, readAt: new Date(), status: 'PAUSED', stockInChannel: false } });
    await approveInsur(db, { accountId, userId, now });
    expect((await loadInsurScreen(db, accountId)).settings.cutoffAt).toEqual(DEFAULT_CUTOFF);
    // Antes del corte: Insur ya la tiene descontada.
    await recordOrder(db, { storeId, order: order('1', 'MLA1', 5, { orderedAt: '2026-11-17T20:00:00.000-03:00' }), flex: false });
    // Después del corte: dos que cuentan y una cancelada.
    await recordOrder(db, { storeId, order: order('2', 'MLA1', 2), flex: false });
    await recordOrder(db, { storeId, order: order('3', 'MLA1', 1), flex: false });
    await recordOrder(db, { storeId, order: order('4', 'MLA1', 4), flex: false });
    await recordOrder(db, { storeId, order: order('4', 'MLA1', 4, { cancelled: true, counts: false }), flex: false });
    const screen = await loadInsurScreen(db, accountId);
    expect(screen.sales).toEqual({ sales: 2, units: 3 });
    const list: Sent[] = [{ id: 5, codigo: '00269BRG', medida: '-', cba: 6, sf: 4, precodigo: '00269BRG' }];
    const r = await run(list);
    expect(r.summary.sales).toEqual({ sales: 2, units: 3 });
    // 6 + 4 de Insur, menos 3 vendidas desde el corte.
    expect(await stockOf(brg.id)).toEqual({ '': 7 });
    // Si se vendió más de lo que dice Insur, 0.
    await run([{ ...list[0], cba: 1, sf: 1 }], { at: later(60) });
    expect(await stockOf(brg.id)).toEqual({ '': 0 });
    // Insur hace un conteo y se mueve la fecha de corte: ya no se resta nada.
    await saveInsurSettings(db, { accountId, cutoffAt: new Date('2026-11-21T03:00:00Z') });
    await run([{ ...list[0], cba: 1, sf: 1 }], { at: later(120) });
    expect(await stockOf(brg.id)).toEqual({ '': 2 });
    await expect(saveInsurSettings(db, { accountId, fichaEveryDays: 0 })).rejects.toThrow('un número de 1 a 90');
  });

  it('con sucursales, cada depósito de Insur va a su sucursal, menos lo que salió de ella', async () => {
    const brg = await product('Rodamiento 00269BRG', '00269BRG', [], [10]);
    const pub = await db.publication.create({ data: { productId: brg.id, storeId, externalId: 'MLA1', title: 'Rodamiento' } });
    await db.channelCopy.create({ data: { publicationId: pub.id, readAt: new Date(), status: 'PAUSED', stockInChannel: false } });
    const cba = (await saveBranch(db, { accountId, branch: { name: 'Córdoba' } })).branch;
    const sf = (await saveBranch(db, { accountId, branch: { name: 'Santa Fe' } })).branch;
    await db.branch.update({ where: { id: cba.id }, data: { flex: true } });
    await approveInsur(db, { accountId, userId, now });
    const inBranches = async () => Object.fromEntries((await db.branchStock.findMany({ where: { productId: brg.id }, select: { quantity: true, branch: { select: { name: true } } } })).map((x) => [x.branch.name, x.quantity]));
    // Una venta Flex sale de Córdoba; otra espera que alguien elija la sucursal.
    await recordOrder(db, { storeId, order: order('1', 'MLA1', 1), flex: true });
    await recordOrder(db, { storeId, order: order('2', 'MLA1', 2), flex: false });
    const list: Sent[] = [{ id: 5, codigo: '00269BRG', medida: '-', cba: 5, sf: 4, precodigo: '00269BRG' }];
    const r = await run(list);
    // 5 + 4 − 3 vendidas = 6 en total. Córdoba 5 − 1; Santa Fe 4; las 2 que esperan sucursal se descuentan aparte.
    expect(await stockOf(brg.id)).toEqual({ '': 6 });
    expect(await inBranches()).toEqual({ Córdoba: 4, 'Santa Fe': 4 });
    expect(r.summary.changes[0]).toMatchObject({ code: '00269BRG', after: 6, branches: 'Córdoba 4 · Santa Fe 4' });
    // Se elige Santa Fe para la que esperaba: el total no cambia y la corrida siguiente no toca nada.
    const sale = await db.channelSale.findFirstOrThrow({ where: { orderId: '2' } });
    await assignSaleBranch(db, { accountId, saleId: sale.id, branchId: sf.id, userId });
    expect(await inBranches()).toEqual({ Córdoba: 4, 'Santa Fe': 2 });
    const again = await run(list, { at: later(60) });
    expect(again.stockChanges).toBe(0);
    expect(await stockOf(brg.id)).toEqual({ '': 6 });
    // Sin las dos sucursales con su nombre, no carga.
    await db.branch.update({ where: { id: sf.id }, data: { name: 'Depósito' } });
    const opened = await openRun(db, { accountId, userId, origin: 'diaria', preview: false, read: 1, now: later(120) });
    await expect(receiveArticles(db, { accountId, runId: opened.runId, userId, articles: articles(list), now: later(120) })).rejects.toThrow('hacen falta una que se llame Córdoba y otra Santa Fe');
  });

  it('un producto que todavía no lleva stock empieza con todas sus medidas cruzadas, o no empieza', async () => {
    const p = await product('Aro 317615', '317615', [{ sku: '317615', measure: 'STD' }, { sku: '317615-30', measure: '-0,30' }]);
    await approveInsur(db, { accountId, userId, now });
    const std: Sent = { id: 20, codigo: '317615 STD', medida: 'STD', cba: 3, sf: 0, costo: 80, precodigo: '317615' };
    const r = await run([std]);
    expect(r.stockChanges).toBe(0);
    expect(r.summary.skipped[0].reason).toContain('no todas sus medidas están cruzadas');
    expect(await stockOf(p.id)).toEqual({});
    // El costo sí se carga.
    expect(await costsOf(p.id)).toEqual({ [p.keys[0]]: 80 });
    await run([std, { id: 21, codigo: '317615 -030', medida: '-030', cba: 0, sf: 2, costo: 80, precodigo: '317615' }], { at: later(60) });
    expect(await stockOf(p.id)).toEqual({ STD: 3, '-0,30': 2 });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stockSince).not.toBeNull();
  });

  it('los datos de la ficha de Insur por medida, solo referencia, con sus avisos', async () => {
    const p = await sp169();
    await run([{ id: 1, codigo: 'SP-169 STD', medida: 'STD', precodigo: 'SP-169' }, { id: 11, codigo: 'SP-169 020', medida: '020', precodigo: 'SP-169' }]);
    const before = await db.product.findUniqueOrThrow({ where: { id: p.id }, select: { specs: true, notes: true, kitContents: true } });
    // Cambian las observaciones en la lectura siguiente.
    const opened = await openRun(db, { accountId, userId, origin: 'boton', preview: false, read: 1, now: later(60) });
    const changed = parseArticles([{ id: 1, codigo: 'SP-169 STD', medida: 'STD', stock_cordoba: 0, stock_santa_fe: 0, costo: 1, ficha: { precodigo: 'SP-169', detalle_articulo_id: 41, detalle: 'Ficha', observaciones: 'COMPLETO', vehiculos: 'Renault MASTER', medidas: [{ codigo: 'SP-169 STD', precioFinal: 5 }] } }]);
    await receiveArticles(db, { accountId, runId: opened.runId, userId, articles: changed, now: later(60) });
    const data = await insurProductData(db, { accountId, productId: p.id });
    expect(data!.rows.map((r) => [r.code, r.statusLabel, r.measure])).toEqual([
      ['SP-169 STD', 'automático', 'STD'],
      ['SP-169 020', 'dudoso', null],
    ]);
    expect(data!.rows[0].ficha).toMatchObject({ precode: 'SP-169', detailGroupId: '41', observations: 'COMPLETO', vehicles: 'Renault MASTER', measures: '[{"codigo":"SP-169 STD"}]' });
    expect(data!.rows[0].ficha!.changes).toEqual([{ field: 'observations', before: 'LE FALTA CRAPODINA', after: 'COMPLETO' }]);
    expect(data!.warnings).toEqual([
      'La medida 0,40 no tiene un artículo de Insur cruzado.',
      'La medida 0,60 no tiene un artículo de Insur cruzado.',
      'En SP-169 STD cambió las observaciones desde la lectura anterior. Antes: "LE FALTA CRAPODINA". Ahora: "COMPLETO".',
      'Insur tiene el artículo SP-169 020 y no está cruzado con ninguna medida de la app: El producto de la app no tiene la medida "020".',
    ]);
    // El número de pieza de la ficha deja de coincidir con el precodigo.
    await db.product.update({ where: { id: p.id }, data: { partNumber: 'SP-170' } });
    expect((await insurProductData(db, { accountId, productId: p.id }))!.warnings[0]).toBe('El número de pieza de la ficha (SP-170) no coincide con el precodigo de Insur (SP-169).');
    // Nada de Insur se copió a la ficha del producto.
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id }, select: { specs: true, notes: true, kitContents: true } })).toEqual(before);
  });

  it('desde Claude: la última corrida con sus listas, los datos de Insur de la publicación y confirmar un dudoso, sin precios', async () => {
    const { TOOLS } = await import('@/lib/mcp/server');
    const ctx = { db, userId, access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    const call = async (name: string, args: Record<string, unknown>) => {
      const tool = TOOLS.find((t) => t.name === name)!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lo que devuelve cada herramienta es distinto
      return (await tool.run(ctx, tool.input.parse(args))) as Record<string, any>;
    };
    const p = await sp169();
    await run([
      { id: 1, codigo: 'SP-169 STD', medida: 'STD', cba: 3, sf: 2, costo: 4321, precodigo: 'SP-169' },
      { id: 10, codigo: 'SP-169 005', medida: '005', cba: 6, sf: 0, costo: 4321, precodigo: 'SP-169' },
    ]);
    const sync = await call('get_insur_sync', { cuenta: 'insur' });
    expect(sync).toMatchObject({ modo_prueba: true, cruces: { automaticos: 1, dudosos: 1 }, ultima_corrida: { estado: 'terminada', solo_mostrar: true, cruzados: 1, cambios_de_stock: 1, cambios_de_costo: 1 } });
    expect(sync.ultima_corrida.cambios).toEqual([{ codigo_insur: 'SP-169 STD', producto: 'Subconjunto SP-169', medida: 'STD', stock_antes: 9, stock_despues: 5, costo: 'cambió' }]);
    expect(sync.dudosos[0]).toMatchObject({ codigo_insur: 'SP-169 005', articulo: 10, motivo: 'La medida "005" de Insur no se puede traducir sin dudas.' });
    expect(sync.dudosos[0].medidas_candidatas).toHaveLength(3);
    expect(JSON.stringify(sync)).not.toContain('4321');
    // Solo una lista.
    expect(await call('get_insur_sync', { listas: ['no_aparecio'] })).not.toHaveProperty('dudosos');
    // Confirmar, primero con vista previa.
    const preview = await call('set_insur_link', { articulo: 'SP-169 005', accion: 'confirmar', producto: 'SP-169', medida: '0,60', vista_previa: true });
    expect(preview).toMatchObject({ vista_previa: true, queda: 'confirmado', producto: 'Subconjunto SP-169', medida: '0,60' });
    expect((await links())['SP-169 005']).toBe('DOUBTFUL');
    expect(await call('set_insur_link', { articulo: '10', accion: 'confirmar', producto: p.id, medida: '0,60' })).toMatchObject({ guardado: true, queda: 'confirmado' });
    expect((await links())['SP-169 005']).toBe('CONFIRMED');
    await expect(call('set_insur_link', { articulo: 'NO-ESTA', accion: 'ignorar' })).rejects.toThrow('No hay un artículo de Insur "NO-ESTA" entre los cruces.');
    await expect(call('set_insur_link', { articulo: '10', accion: 'confirmar' })).rejects.toThrow('Para confirmar hace falta el producto.');
    // En la publicación, los datos de Insur del producto, solo de referencia.
    const pub = await db.publication.create({ data: { productId: p.id, storeId, externalId: 'MLA900', title: 'Subconjunto' } });
    const got = await call('get_publication', { publicacion: pub.id });
    expect(got.ficha.datos_de_insur.articulos.map((a: { codigo_insur: string; cruce: string }) => [a.codigo_insur, a.cruce])).toEqual([
      ['SP-169 STD', 'automático'],
      ['SP-169 005', 'confirmado'],
    ]);
    expect(got.ficha.datos_de_insur.articulos[0]).toMatchObject({ medida: 'STD', precodigo: 'SP-169', observaciones: 'LE FALTA CRAPODINA', vehiculos: 'Renault MASTER', stock_en_insur: { cordoba: 3, santa_fe: 2 } });
    expect(got.ficha.datos_de_insur.avisos).toEqual(['La medida 0,40 no tiene un artículo de Insur cruzado.']);
    expect(JSON.stringify(got.ficha.datos_de_insur)).not.toContain('4321');
  });

  it('los que no tienen producto en la app quedan en el listado, y una corrida cortada queda anotada', async () => {
    await sp169();
    const opened = await openRun(db, { accountId, userId, origin: 'diaria', preview: false, read: 100, now });
    await receiveUnmatched(db, { accountId, runId: opened.runId, total: 40, articles: articles([{ id: 30, codigo: 'XX-1', medida: '-', cba: 2, sf: 1, costo: 55 }]) });
    const done = await closeRun(db, { accountId, runId: opened.runId, userId, now });
    expect(done.summary.unmatched).toEqual([{ code: 'XX-1', detail: 'Detalle de XX-1', brand: 'Marca Uno', category: 'Rubro', measure: null, stock: 3 }]);
    expect(done.summary.unmatchedTotal).toBe(40);
    expect(await db.insurArticleLink.count()).toBe(0);
    await failRun(db, { accountId, userId, origin: 'diaria', error: 'Entrá a Insur y volvé a iniciar sesión.', now: later(60) });
    const screen = await loadInsurScreen(db, accountId);
    expect(screen.last).toMatchObject({ status: 'FAILED', origin: 'diaria', errors: ['Entrá a Insur y volvé a iniciar sesión.'] });
    expect(screen.lastDone).toMatchObject({ status: 'DONE' });
    // Una corrida que quedó abierta se da por cortada al abrir otra.
    const left = await openRun(db, { accountId, userId, origin: 'boton', preview: false, read: 1, now: later(120) });
    await openRun(db, { accountId, userId, origin: 'boton', preview: false, read: 1, now: later(180) });
    expect((await db.insurSyncRun.findUniqueOrThrow({ where: { id: left.runId } })).status).toBe('FAILED');
  });
});
