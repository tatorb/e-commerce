// Lo que corre Vercel en cada publicación: aplica las migraciones pendientes,
// carga los datos iniciales (sin duplicar) y arma la app.
import { execSync } from 'node:child_process';

const hasDatabase =
  process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!hasDatabase) {
  console.error(
    '\nFalta la base de datos. En Vercel, entrá al proyecto, pestaña Storage, agregá Neon y volvé a publicar.\n',
  );
  process.exit(1);
}
if (!process.env.BETTER_AUTH_SECRET) {
  console.error(
    '\nFalta BETTER_AUTH_SECRET, la clave secreta del login. Agregala en Settings › Environment Variables y volvé a publicar.\n',
  );
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npx prisma migrate deploy');
run('npx prisma db seed');
run('npx next build');
