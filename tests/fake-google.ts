import { randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// Google simulado para las pruebas: permiso (OAuth), Drive con carpetas,
// subidas por partes, lista, papelera, miniaturas y lectura por pedazos.
// Guarda todo en memoria. También sirve para recorrer la app en el navegador:
//   npx tsx tests/fake-google.ts 4555

export type FakeFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  trashed: boolean;
  appProperties: Record<string, string>;
  data: Buffer;
  createdTime: string;
  videoMediaMetadata?: { width: number; height: number; durationMillis: string };
};

type Upload = { done?: FakeFile; meta: { name: string; parents: string[]; mimeType: string; appProperties?: Record<string, string> }; size: number; received: Buffer[]; got: number; origin: string | null; fields: string };

export type FakeGoogle = {
  url: string;
  files: Map<string, FakeFile>;
  // Lo que se pidió, para las pruebas: "POST /token refresh_token".
  calls: string[];
  // Las llaves que valen ahora.
  tokens: Set<string>;
  state: {
    email: string;
    // Lo que devuelve el próximo pedido de llaves con el código.
    nextScope: string;
    refreshFails: boolean;
    // Si la subida directa desde el navegador falla por CORS.
    cors: boolean;
    // Lo último que mandó el pedido de permiso.
    lastAuthCode: string | null;
  };
  addFile(f: Partial<FakeFile> & { name: string; parents: string[] }): FakeFile;
  close(): Promise<void>;
};

const id = () => randomBytes(9).toString('base64url');

// Como en el Drive: lo que está dentro de una carpeta en la papelera también está en la papelera.
function inTrash(file: FakeFile, all: Map<string, FakeFile>): boolean {
  let f: FakeFile | undefined = file;
  while (f) {
    if (f.trashed) return true;
    f = all.get(f.parents[0] ?? '');
  }
  return false;
}

function pick(file: FakeFile, base: string, all: Map<string, FakeFile>) {
  const out: Record<string, unknown> = {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    parents: file.parents,
    trashed: inTrash(file, all),
    createdTime: file.createdTime,
    webViewLink: `${base}/ver/${file.id}`,
    appProperties: file.appProperties,
  };
  if (file.mimeType !== 'application/vnd.google-apps.folder') out.size = String(file.data.length);
  if (file.videoMediaMetadata) out.videoMediaMetadata = file.videoMediaMetadata;
  if (file.mimeType.startsWith('video/')) out.thumbnailLink = `${base}/miniatura/${file.id}=s220`;
  return out;
}

/** Si el archivo cumple la búsqueda del Drive, con las formas que usa la app. */
function matches(file: FakeFile, q: string, all: Map<string, FakeFile>): boolean {
  for (const part of q.split(/\s+and\s+(?![^{]*\})/)) {
    const p = part.trim();
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^'([^']+)' in parents$/))) {
      if (!file.parents.includes(m[1])) return false;
    } else if (p === 'trashed=false') {
      if (inTrash(file, all)) return false;
    } else if ((m = p.match(/^mimeType contains '([^']+)'$/))) {
      if (!file.mimeType.includes(m[1])) return false;
    } else if ((m = p.match(/^mimeType='([^']+)'$/))) {
      if (file.mimeType !== m[1]) return false;
    } else if ((m = p.match(/^appProperties has \{ key='([^']+)' and value='((?:[^'\\]|\\.)*)' \}$/))) {
      if (file.appProperties[m[1]] !== m[2].replace(/\\(.)/g, '$1')) return false;
    } else {
      throw new Error(`Búsqueda que el Google simulado no entiende: ${p}`);
    }
  }
  return true;
}

async function body(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

export async function startFakeGoogle(port = 0): Promise<FakeGoogle> {
  const files = new Map<string, FakeFile>();
  const uploads = new Map<string, Upload>();
  const codes = new Map<string, { scope: string }>();
  const refreshTokens = new Set<string>();
  const tokens = new Set<string>();
  const calls: string[] = [];
  const state: FakeGoogle['state'] = {
    email: 'martin@studiomrb.com',
    nextScope: 'https://www.googleapis.com/auth/drive',
    refreshFails: false,
    cors: true,
    lastAuthCode: null,
  };
  let base = '';

  const addFile: FakeGoogle['addFile'] = (f) => {
    const file: FakeFile = {
      id: f.id ?? id(),
      name: f.name,
      mimeType: f.mimeType ?? 'video/mp4',
      parents: f.parents,
      trashed: f.trashed ?? false,
      appProperties: f.appProperties ?? {},
      data: f.data ?? Buffer.alloc(0),
      createdTime: f.createdTime ?? new Date().toISOString(),
      videoMediaMetadata: f.videoMediaMetadata,
    };
    files.set(file.id, file);
    return file;
  };

  const json = (res: http.ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(value));
  };
  const fail = (res: http.ServerResponse, status: number, reason: string, headers: Record<string, string> = {}) =>
    json(res, status, { error: { code: status, message: reason, errors: [{ reason }] } }, headers);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const raw = await body(req);
    calls.push(`${req.method} ${url.pathname}${url.pathname === '/token' ? ` ${new URLSearchParams(raw.toString()).get('grant_type')}` : ''}`);

    // ── Para recorrer la app: agregar un archivo como desde la Mac y cortar el CORS ──
    if (url.pathname === '/__agregar' && req.method === 'POST') {
      const file = addFile({ name: url.searchParams.get('name') ?? 'video.mp4', parents: [url.searchParams.get('parent') ?? 'root'], mimeType: url.searchParams.get('mime') ?? 'video/mp4', data: raw });
      return json(res, 200, { id: file.id });
    }
    if (url.pathname === '/__cors' && req.method === 'POST') {
      state.cors = url.searchParams.get('on') !== '0';
      return json(res, 200, { cors: state.cors });
    }

    // ── Permiso ──
    if (url.pathname === '/auth' && req.method === 'GET') {
      // Como si la persona aceptara: vuelve a la app con un código.
      const code = id();
      codes.set(code, { scope: state.nextScope });
      state.lastAuthCode = code;
      const back = new URL(url.searchParams.get('redirect_uri')!);
      back.searchParams.set('code', code);
      back.searchParams.set('state', url.searchParams.get('state') ?? '');
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      const p = new URLSearchParams(raw.toString());
      if (p.get('client_secret') !== 'secreto-del-cliente-123') return json(res, 401, { error: 'invalid_client' });
      if (p.get('grant_type') === 'authorization_code') {
        const c = codes.get(p.get('code') ?? '');
        if (!c || !p.get('code_verifier')) return json(res, 400, { error: 'invalid_grant' });
        codes.delete(p.get('code')!);
        const access = `acc-${id()}`;
        const refresh = `ref-${id()}`;
        tokens.add(access);
        refreshTokens.add(refresh);
        return json(res, 200, { access_token: access, refresh_token: refresh, expires_in: 3599, scope: c.scope, token_type: 'Bearer' });
      }
      if (p.get('grant_type') === 'refresh_token') {
        if (state.refreshFails || !refreshTokens.has(p.get('refresh_token') ?? '')) return json(res, 400, { error: 'invalid_grant' });
        const access = `acc-${id()}`;
        tokens.add(access);
        return json(res, 200, { access_token: access, expires_in: 3599, scope: 'https://www.googleapis.com/auth/drive', token_type: 'Bearer' });
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }
    if (url.pathname === '/revoke' && req.method === 'POST') {
      refreshTokens.delete(url.searchParams.get('token') ?? '');
      return json(res, 200, {});
    }
    if (url.pathname.startsWith('/miniatura/')) {
      if (!tokens.has((req.headers.authorization ?? '').replace('Bearer ', ''))) return fail(res, 401, 'authError');
      res.writeHead(200, { 'Content-Type': 'image/png' });
      // Un PNG de 1 × 1.
      return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    }

    // ── Subidas por partes: la dirección de la subida es la llave ──
    if (url.pathname === '/upload/drive/v3/files' && url.searchParams.get('upload_id')) {
      const up = uploads.get(url.searchParams.get('upload_id')!);
      const cors: Record<string, string> =
        state.cors && up?.origin && req.headers.origin === up.origin
          ? { 'Access-Control-Allow-Origin': up.origin, 'Access-Control-Expose-Headers': 'Range', 'Access-Control-Allow-Methods': 'PUT', 'Access-Control-Allow-Headers': 'Content-Range, Content-Type' }
          : {};
      if (req.method === 'OPTIONS') {
        res.writeHead(state.cors ? 204 : 403, cors);
        return res.end();
      }
      if (!up) return fail(res, 404, 'notFound', cors);
      const range = String(req.headers['content-range'] ?? '');
      // Como Google: preguntar por una subida terminada devuelve el archivo.
      if (up.done) return json(res, 200, pick(up.done, base, files), cors);
      const m = range.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
      if (m) {
        const start = Number(m[1]);
        if (start !== up.got) return fail(res, 400, 'badRange', cors);
        up.received.push(raw);
        up.got += raw.length;
      } else if (!/^bytes \*\/\d+$/.test(range)) return fail(res, 400, 'badRange', cors);
      if (up.got < up.size) {
        res.writeHead(308, { ...cors, ...(up.got > 0 ? { Range: `bytes=0-${up.got - 1}` } : {}) });
        return res.end();
      }
      const file = addFile({
        name: up.meta.name,
        parents: up.meta.parents,
        mimeType: up.meta.mimeType,
        appProperties: up.meta.appProperties,
        data: Buffer.concat(up.received),
      });
      up.done = file;
      return json(res, 200, pick(file, base, files), cors);
    }

    // ── El resto pide la llave ──
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    if (!tokens.has(token)) return fail(res, 401, 'authError');

    if (url.pathname === '/upload/drive/v3/files' && req.method === 'POST' && url.searchParams.get('uploadType') === 'resumable') {
      const uploadId = id();
      uploads.set(uploadId, {
        meta: JSON.parse(raw.toString()),
        size: Number(req.headers['x-upload-content-length']),
        received: [],
        got: 0,
        origin: (req.headers.origin as string) ?? null,
        fields: url.searchParams.get('fields') ?? '',
      });
      res.writeHead(200, { Location: `${base}/upload/drive/v3/files?uploadType=resumable&upload_id=${uploadId}` });
      return res.end();
    }
    if (url.pathname === '/drive/v3/about') return json(res, 200, { user: { emailAddress: state.email } });
    if (url.pathname === '/drive/v3/files' && req.method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const found = [...files.values()].filter((f) => matches(f, q, files)).map((f) => pick(f, base, files));
      return json(res, 200, { files: found });
    }
    if (url.pathname === '/drive/v3/files' && req.method === 'POST') {
      const meta = JSON.parse(raw.toString());
      const file = addFile({ name: meta.name, mimeType: meta.mimeType, parents: meta.parents, appProperties: meta.appProperties });
      return json(res, 200, { id: file.id });
    }
    const fm = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fm) {
      const file = files.get(decodeURIComponent(fm[1]));
      if (!file) return fail(res, 404, 'notFound');
      if (req.method === 'PATCH') {
        Object.assign(file, JSON.parse(raw.toString()));
        return json(res, 200, { id: file.id });
      }
      if (url.searchParams.get('alt') === 'media') {
        const r = String(req.headers.range ?? '').match(/^bytes=(\d+)-(\d*)$/);
        const start = r ? Number(r[1]) : 0;
        const end = r && r[2] ? Math.min(Number(r[2]), file.data.length - 1) : file.data.length - 1;
        if (start >= file.data.length) return fail(res, 416, 'rangeNotSatisfiable');
        res.writeHead(r ? 206 : 200, {
          'Content-Type': file.mimeType,
          'Content-Length': String(end - start + 1),
          ...(r ? { 'Content-Range': `bytes ${start}-${end}/${file.data.length}` } : {}),
        });
        return res.end(file.data.subarray(start, end + 1));
      }
      return json(res, 200, pick(file, base, files));
    }
    return fail(res, 404, 'notFound');
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: base,
    files,
    calls,
    tokens,
    state,
    addFile,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// Corrido solo: un Google simulado para recorrer la app.
if (process.argv[1]?.endsWith('fake-google.ts')) {
  const port = Number(process.argv[2] ?? 4555);
  startFakeGoogle(port).then((g) => console.log(`Google simulado en ${g.url}`));
}
