import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sectionFromPath } from '@/domain/access';

// Al navegar dentro de la app, Next arma solo la página nueva y no el marco
// con el menú: el control de sesión del marco no alcanza. Cada página de una
// cuenta tiene que pedir la sesión y el permiso de su sección ella misma, con
// requireAccount, y cada acción tiene que pasar por act.

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
      expect(code, path).toContain('await requireAccount(cuenta');
      expect(code, path).not.toContain('getAccountBySlug');
    }
  });

  it('cada una pide poder ver su sección', () => {
    for (const path of pages(ROOT)) {
      const folder = path.slice(ROOT.length + 1).split('/')[0];
      if (folder === 'page.tsx' || folder === 'sin-permiso') continue;
      const code = readFileSync(path, 'utf8');
      const asked = code.match(/requireAccount\(cuenta, '(\w+)'\)/)?.[1];
      expect(asked, path).toBe(sectionFromPath(`/a/x/${folder}`));
    }
  });
});

describe('acciones de una cuenta', () => {
  function actionFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return actionFiles(path);
      return name.endsWith('actions.ts') ? [path] : [];
    });
  }

  it('cada una revisa los permisos antes de hacer algo', () => {
    const files = actionFiles(ROOT);
    expect(files.length).toBeGreaterThan(20);
    for (const path of files) {
      const code = readFileSync(path, 'utf8');
      const parts = code.split(/export async function /).slice(1);
      expect(parts.length, path).toBeGreaterThan(0);
      for (const part of parts) {
        const name = part.slice(0, part.indexOf('('));
        const body = part.slice(0, part.search(/\n}\n/));
        expect(/\bact(<[^>]+>)?\(accountSlug/.test(body), `${path} ${name}`).toBe(true);
      }
    }
  });
});
