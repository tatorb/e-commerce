import { execSync } from 'node:child_process';

// Si hay una base de prueba, le aplica las migraciones antes de correr.
// Sin TEST_DATABASE_URL, las pruebas que usan base se saltean.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
  });
}
