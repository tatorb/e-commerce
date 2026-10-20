import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Al navegar dentro de la app, Next arma solo la página nueva y no el marco
// con el menú: el control de sesión del marco no alcanza. Cada página de una
// cuenta tiene que pedir la sesión ella misma, con requireAccount.

const ROOT = join(__dirname, '..', 'src', 'app', 'a', '[cuenta]');

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === 'page.tsx' ? [path] : [];
  });
}

describe('páginas de una cuenta', () => {
  it('cada una pide la sesión ella misma', () => {
    const found = pages(ROOT);
    expect(found.length).toBeGreaterThan(10);
    for (const path of found) {
      const code = readFileSync(path, 'utf8');
      // La de entrada solo redirige al pipeline, sin datos.
      if (path === join(ROOT, 'page.tsx')) {
        expect(code).not.toMatch(/prisma|queries/);
        continue;
      }
      expect(code, path).toContain('await requireAccount(cuenta)');
      expect(code, path).not.toContain('getAccountBySlug');
    }
  });
});
