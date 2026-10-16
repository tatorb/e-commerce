import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Datos iniciales. Se puede correr las veces que haga falta: si ya existen,
// no los duplica ni los pisa. No carga productos ni datos del cliente.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;
if (!connectionString) throw new Error('Falta DATABASE_URL.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const mercadolibre = await prisma.channel.upsert({
    where: { kind: 'MERCADOLIBRE' },
    update: {},
    create: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' },
  });

  const insur = await prisma.account.upsert({
    where: { slug: 'insur' },
    update: {},
    create: { slug: 'insur', name: 'Insur' },
  });

  await prisma.store.upsert({
    where: {
      accountId_channelId_name: {
        accountId: insur.id,
        channelId: mercadolibre.id,
        name: 'INSURMOTOR',
      },
    },
    update: {},
    create: {
      accountId: insur.id,
      channelId: mercadolibre.id,
      name: 'INSURMOTOR',
      externalSellerId: '363689851',
      applyMethod: 'MANUAL',
    },
  });

  console.log('Datos iniciales listos: cuenta Insur, canal Mercado Libre, tienda INSURMOTOR.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
