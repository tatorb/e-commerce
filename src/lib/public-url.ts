// Dirección pública de la app. En Vercel sale de la dirección de producción;
// en una computadora, de BETTER_AUTH_URL.
export function publicAppUrl(): string {
  const url =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
  return url.replace(/\/+$/, '');
}
