import { describe, expect, it } from 'vitest';
import { accessSummary, can, canSeeAccount, firstSection, parsePermissions, PRESETS, sectionFromPath, sectionLabel, TRAIN_BOT } from '@/domain/access';

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

  it('entrenar al bot: alcanza con el permiso propio, aunque solo vea el Pipeline', () => {
    expect(parsePermissions({ entrenar: 'read' })).toEqual({});
    const trainer = { isAdmin: false, permissions: { pipeline: 'read', entrenar: 'write' } as const };
    expect(can(trainer, TRAIN_BOT, 'write')).toBe(true);
    expect(can(trainer, 'pipeline', 'write')).toBe(false);
    // Quien cambia en el Pipeline o en Publicaciones ya puede.
    expect(can({ isAdmin: false, permissions: { publicaciones: 'write' } }, TRAIN_BOT, 'write')).toBe(true);
    expect(can({ isAdmin: false, permissions: { pipeline: 'read' } }, TRAIN_BOT, 'write')).toBe(false);
    // No tiene pantalla propia: no es el Pipeline ni el primer lugar que ve.
    expect(sectionFromPath('/a/prueba/pipeline/p1')).toBe('pipeline');
    expect(firstSection({ isAdmin: false, permissions: { entrenar: 'write' } })).toBe('tareas');
    expect(PRESETS.todo.permissions.entrenar).toBe('write');
    expect(PRESETS.ver.permissions.entrenar).toBeUndefined();
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
    // Sin nada más, sus tareas, que se ven siempre.
    expect(firstSection({ isAdmin: false, permissions: { subir: 'write' } })).toBe('tareas');
    expect(firstSection({ isAdmin: false, permissions: { importar: 'read' } })).toBe('importar');
    expect(sectionLabel('reglas')).toBe('Reglas de título');
    expect(sectionLabel('equipo')).toBe('Equipo');
  });
});
