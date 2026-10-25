import { describe, expect, it } from 'vitest';
import { accessSummary, can, canSeeAccount, firstSection, parsePermissions, PRESETS, sectionLabel } from '@/domain/access';

// Permisos por sección y cuentas que ve cada usuario.

describe('permisos', () => {
  it('limpia lo guardado: sin secciones desconocidas ni niveles que la sección no tiene', () => {
    expect(parsePermissions({ pipeline: 'write', registro: 'write', subir: 'read', inventada: 'write', productos: 'mucho' })).toEqual({
      pipeline: 'write',
      // Registro solo se mira.
      registro: 'read',
    });
    expect(parsePermissions({ subir: 'write' })).toEqual({ subir: 'write' });
    expect(parsePermissions(null)).toEqual({});
    expect(parsePermissions(['pipeline'])).toEqual({});
  });

  it('cambiar incluye ver; alcanza con poder en una de las secciones; el administrador puede todo', () => {
    const editor = { isAdmin: false, permissions: { pipeline: 'write', publicaciones: 'read' } as const };
    expect(can(editor, 'pipeline', 'read')).toBe(true);
    expect(can(editor, 'pipeline', 'write')).toBe(true);
    expect(can(editor, 'publicaciones', 'read')).toBe(true);
    expect(can(editor, 'publicaciones', 'write')).toBe(false);
    expect(can(editor, 'subir', 'write')).toBe(false);
    expect(can(editor, ['publicaciones', 'pipeline'], 'write')).toBe(true);
    expect(can(editor, 'conexion', 'read')).toBe(false);
    expect(can({ isAdmin: true, permissions: {} }, 'conexion', 'write')).toBe(true);
  });

  it('cada usuario ve solo sus cuentas; el administrador, todas', () => {
    expect(canSeeAccount({ isAdmin: false, accountIds: ['a1'] }, 'a1')).toBe(true);
    expect(canSeeAccount({ isAdmin: false, accountIds: ['a1'] }, 'a2')).toBe(false);
    expect(canSeeAccount({ isAdmin: true, accountIds: [] }, 'a2')).toBe(true);
  });

  it('los atajos, el resumen y el primer lugar que ve', () => {
    expect(PRESETS.todo.permissions).toMatchObject({ pipeline: 'write', registro: 'read', subir: 'write' });
    expect(PRESETS.ver.permissions).toMatchObject({ pipeline: 'read', registro: 'read' });
    expect(PRESETS.ver.permissions.subir).toBeUndefined();
    expect(accessSummary({ isAdmin: true, permissions: {} })).toBe('Administrador');
    expect(accessSummary({ isAdmin: false, permissions: {} })).toBe('Sin permisos');
    expect(accessSummary({ isAdmin: false, permissions: { pipeline: 'write', registro: 'read' } })).toBe('Ve 2 secciones y cambia en 1');
    expect(accessSummary({ isAdmin: false, permissions: { preguntas: 'read' } })).toBe('Solo ve 1 sección');
    expect(firstSection({ isAdmin: false, permissions: { subir: 'write', preguntas: 'read' } })).toBe('preguntas');
    expect(firstSection({ isAdmin: false, permissions: { subir: 'write' } })).toBeNull();
    expect(sectionLabel('reglas')).toBe('Reglas de título');
    expect(sectionLabel('equipo')).toBe('Equipo');
  });
});
