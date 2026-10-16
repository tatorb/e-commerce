import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Las migraciones usan la conexión directa, sin pool. Neon la publica como
// DATABASE_URL_UNPOOLED; en local alcanza con DATABASE_URL.
const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: migrationUrl ? { url: migrationUrl } : undefined,
});
