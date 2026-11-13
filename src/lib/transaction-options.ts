// Cuánto puede durar un guardado que se hace todo junto o nada (una
// transacción). El de Prisma, 5 segundos, no alcanza para guardar en todas las
// medidas de una familia y sus formas de cobro: con la base lejos del servidor,
// cada consulta tarda y la transacción vencía a mitad de camino.
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 45_000 } as const;
