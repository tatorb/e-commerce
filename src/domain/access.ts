// Permisos: qué cuentas ve cada usuario y qué puede en cada sección de la app.
// Los administradores pueden todo. Sin la base de datos, para poder probarlo solo.

export type Level = 'read' | 'write';

type SectionSpec = {
  label: string;
  // Lo que se puede elegir para la sección. Registro solo se mira; subir a
  // los canales solo se hace.
  levels: readonly Level[];
  hint?: string;
  // Cada persona ve y mueve lo suyo aunque no tenga el permiso, como sus tareas.
  own?: boolean;
};

export const SECTIONS = {
  pipeline: { label: 'Pipeline', levels: ['read', 'write'], hint: 'El tablero y cada paso: título, fotos, descripción, precio.' },
  productos: { label: 'Productos', levels: ['read', 'write'], hint: 'La ficha y la investigación de cada producto.' },
  captura: {
    label: 'Registro de productos',
    levels: ['read', 'write'],
    hint: 'Sacar y subir las fotos y los videos de cada producto desde el celular, siguiendo un protocolo. Con "Ve" solo mira lo que se registró.',
  },
  publicaciones: { label: 'Publicaciones', levels: ['read', 'write'], hint: 'La lista y la página de cada publicación.' },
  subir: {
    label: 'Subir a los canales',
    levels: ['write'],
    hint: 'Mandar los cambios desde Por subir, crear publicaciones en el canal, pausarlas, finalizarlas y republicarlas.',
  },
  preguntas: { label: 'Preguntas', levels: ['read', 'write'], hint: 'Ver y responder las preguntas de los compradores.' },
  entrenar: {
    label: 'Entrenar al bot',
    levels: ['write'],
    hint: 'En el paso Preguntas y respuestas y en la página de cada publicación: probar preguntas y corregir las preguntas frecuentes y cuándo responde una persona. Para llegar a esas pantallas hace falta ver el Pipeline o Publicaciones.',
  },
  tareas: {
    label: 'Tareas',
    levels: ['read', 'write'],
    hint: 'Ver las tareas de todos, y crearlas y editarlas. Las que tiene asignadas las ve y les cambia el estado siempre.',
    own: true,
  },
  importar: { label: 'Importar', levels: ['read', 'write'] },
  sincronizacion: { label: 'Sincronización', levels: ['read', 'write'] },
  registro: { label: 'Registro', levels: ['read'] },
  estandar: { label: 'Estándar', levels: ['read', 'write'] },
  imagenes: { label: 'Imágenes', levels: ['read', 'write'] },
  reglas: { label: 'Reglas de título', levels: ['read', 'write'] },
  descripciones: { label: 'Descripciones', levels: ['read', 'write'] },
  precios: { label: 'Precios', levels: ['read', 'write'] },
  respuestas: { label: 'Respuestas', levels: ['read', 'write'] },
  protocolos: {
    label: 'Protocolos de fotos',
    levels: ['read', 'write'],
    hint: 'Los pasos, las explicaciones y las ilustraciones que sigue el operario en Registro de productos.',
  },
  conexion: { label: 'Conexión', levels: ['read', 'write'], hint: 'La conexión de cada tienda con su canal.' },
} as const satisfies Record<string, SectionSpec>;

export type Section = keyof typeof SECTIONS;

export const SECTION_KEYS = Object.keys(SECTIONS) as Section[];

// Las del menú Ajustes, para agruparlas en la pantalla de permisos.
export const SETTINGS_SECTIONS: readonly Section[] = ['estandar', 'imagenes', 'reglas', 'descripciones', 'precios', 'respuestas', 'protocolos', 'conexion'];

/** Lo que se puede elegir en la sección. */
export function levelsOf(section: Section): readonly Level[] {
  return SECTIONS[section].levels;
}

export function isSection(value: unknown): value is Section {
  return typeof value === 'string' && value in SECTIONS;
}

export type Permissions = Partial<Record<Section, Level>>;

export type Access = {
  isAdmin: boolean;
  permissions: Permissions;
  // Las cuentas que ve. Los administradores ven todas.
  accountIds: readonly string[];
};

/** Los permisos guardados, sin secciones desconocidas ni niveles que la sección no tiene. */
export function parsePermissions(raw: unknown): Permissions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Permissions = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isSection(key)) continue;
    const levels = levelsOf(key);
    if (value === 'write' && levels.includes('write')) out[key] = 'write';
    // Donde solo se puede hacer, como subir, "ver" no significa nada.
    else if ((value === 'read' || value === 'write') && levels.includes('read')) out[key] = 'read';
  }
  return out;
}

/** Si puede ver (read) o cambiar (write) en la sección, o en alguna de las secciones. Cambiar incluye ver. */
export function can(access: Pick<Access, 'isAdmin' | 'permissions'>, section: Section | readonly Section[], level: Level): boolean {
  if (access.isAdmin) return true;
  const list = typeof section === 'string' ? [section] : section;
  return list.some((s) => {
    const has = access.permissions[s];
    return has === 'write' || (level === 'read' && has === 'read');
  });
}

export function canSeeAccount(access: Pick<Access, 'isAdmin' | 'accountIds'>, accountId: string): boolean {
  return access.isAdmin || access.accountIds.includes(accountId);
}

/** Atajos para no marcar sección por sección. */
export const PRESETS = {
  todo: { label: 'Todo', permissions: Object.fromEntries(SECTION_KEYS.map((s) => [s, levelsOf(s).includes('write') ? 'write' : 'read'])) as Permissions },
  ver: {
    label: 'Solo ver todo',
    permissions: Object.fromEntries(SECTION_KEYS.filter((s) => levelsOf(s).includes('read')).map((s) => [s, 'read'])) as Permissions,
  },
  nada: { label: 'Nada', permissions: {} as Permissions },
} as const;

export type PresetKey = keyof typeof PRESETS;

export const LEVEL_LABEL = { none: 'No la ve', read: 'Ve', write: 'Ve y cambia' } as const;

/** Para la lista de usuarios: "Administrador", "Ve 5 secciones y cambia 3", "Sin permisos". */
export function accessSummary(a: Pick<Access, 'isAdmin' | 'permissions'>): string {
  if (a.isAdmin) return 'Administrador';
  const levels = Object.values(a.permissions);
  const writes = levels.filter((l) => l === 'write').length;
  if (levels.length === 0) return 'Sin permisos';
  const sees = levels.length;
  return writes > 0 ? `Ve ${sees} ${sees === 1 ? 'sección' : 'secciones'} y cambia en ${writes}` : `Solo ve ${sees} ${sees === 1 ? 'sección' : 'secciones'}`;
}

// ───────────────────────────── Actividad ─────────────────────────────

// Equipo no es una sección con permisos: solo la manejan los administradores.
export const TEAM_SECTION = 'equipo';

export function sectionLabel(section: string | null): string {
  if (!section) return '';
  if (section === TEAM_SECTION) return 'Equipo';
  return isSection(section) ? SECTIONS[section].label : section;
}

// La dirección de cada sección dentro de una cuenta. Subir y Entrenar al bot no tienen pantalla propia.
const WITHOUT_SCREEN: readonly Section[] = ['subir', 'entrenar'];
export const SECTION_PATH: Record<Section, string> = {
  pipeline: 'pipeline',
  productos: 'productos',
  captura: 'registro-productos',
  publicaciones: 'publicaciones',
  subir: 'publicaciones',
  preguntas: 'preguntas',
  entrenar: 'pipeline',
  tareas: 'tareas',
  importar: 'importar',
  sincronizacion: 'sincronizacion',
  registro: 'registro',
  estandar: 'estandar',
  imagenes: 'imagenes',
  reglas: 'reglas-titulo',
  descripciones: 'descripciones',
  precios: 'precios',
  respuestas: 'respuestas',
  protocolos: 'protocolos',
  conexion: 'conexion',
};

/** La sección de una dirección de la app, por ejemplo /a/insur/pipeline/123. Null fuera de las secciones. */
export function sectionFromPath(pathname: string | null): Section | null {
  const segment = pathname?.match(/^\/a\/[^/]+\/([^/?#]+)/)?.[1];
  if (!segment) return null;
  return SECTION_KEYS.find((s) => !WITHOUT_SCREEN.includes(s) && SECTION_PATH[s] === segment) ?? null;
}

/**
 * Quién puede entrenar al bot de una publicación (las preguntas frecuentes,
 * cuándo responde una persona y las pruebas): quien cambia en el Pipeline o
 * en Publicaciones, o quien tiene Entrenar al bot.
 */
export const TRAIN_BOT: readonly Section[] = ['pipeline', 'publicaciones', 'entrenar'];

/** Si cada persona ve lo suyo en la sección aunque no tenga el permiso. */
export const isOwnSection = (section: Section) => (SECTIONS[section] as SectionSpec).own === true;

/** El primer lugar que puede ver dentro de una cuenta, para la portada. Sin permisos, sus tareas. */
export function firstSection(access: Pick<Access, 'isAdmin' | 'permissions'>): Section {
  return SECTION_KEYS.find((s) => !WITHOUT_SCREEN.includes(s) && can(access, s, 'read')) ?? 'tareas';
}
