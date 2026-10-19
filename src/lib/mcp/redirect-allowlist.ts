// A dónde puede volver el permiso de la conexión con Claude. Sin esta lista,
// un link armado por otra persona podría mandar el código a cualquier lado.
// Valen las direcciones de Claude en la web, las de la propia computadora
// (Claude Code, Claude Desktop y programas de prueba) y las que se agreguen en
// MCP_OAUTH_REDIRECT_URIS, separadas por comas.

const KNOWN = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLoopback(raw: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false;
  }
}

export function isAllowedRedirectUri(raw: string, extra: string[] = extraRedirectUrisFromEnv()): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.username || u.password || u.hash) return false;
  // En la propia computadora: cualquier puerto y camino. El programa abre un
  // servidor local para recibir el código.
  if (LOOPBACK_HOSTS.has(u.hostname)) return u.protocol === 'http:' || u.protocol === 'https:';
  if (u.protocol !== 'https:' || u.search) return false;
  return new Set([...KNOWN, ...extra]).has(`${u.origin}${u.pathname}`);
}

export function extraRedirectUrisFromEnv(): string[] {
  return (process.env.MCP_OAUTH_REDIRECT_URIS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
