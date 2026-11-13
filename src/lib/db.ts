import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { TRANSACTION_OPTIONS } from '@/lib/transaction-options';

// Un solo cliente por proceso. En desarrollo Next recarga módulos y, sin
// esto, cada recarga abriría conexiones nuevas.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Neon en Vercel carga DATABASE_URL; algunas configuraciones usan POSTGRES_URL.
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL: la base de datos no está conectada.');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }), transactionOptions: TRANSACTION_OPTIONS });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
