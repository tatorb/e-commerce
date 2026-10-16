import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db';

export const PASSWORD_MIN = 8;

// Login con email y contraseña. Los usuarios se guardan en nuestra base.
// Todo pasa por acciones del servidor (src/lib/auth/actions.ts): la app no
// expone las rutas HTTP de Better Auth, así nadie puede registrarse solo.
export const auth = betterAuth({
  appName: 'E-commerce Studio MRB',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: {
    allowedHosts: ['localhost:3000', '*.vercel.app', 'e-commerce.studiomrb.com'],
    fallback: process.env.BETTER_AUTH_URL,
  },
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // Better Auth llama "account" a las credenciales; acá "Account" es la
  // cuenta del cliente, por eso la tabla se llama distinto.
  account: { modelName: 'authAccount' },
  user: { modelName: 'user' },
  session: {
    modelName: 'session',
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  verification: { modelName: 'verification' },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN,
    // Al dar de alta a otra persona no se abre una sesión a su nombre.
    autoSignIn: false,
  },
  disabledPaths: ['/sign-up/email'],
  plugins: [nextCookies()],
});
