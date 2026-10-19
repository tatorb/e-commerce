import { z } from 'zod';
import { READ_TOOLS } from './read-tools';
import { MCP_INSTRUCTIONS } from './instructions';
import { McpToolError, type McpContext, type McpTool } from './tool';

// El protocolo MCP resuelto a mano: mensajes JSON-RPC, una respuesta por
// pedido, sin conexión abierta. Así anda bien en Vercel.

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'ecommerce-studio-mrb', title: 'E-commerce Studio MRB', version: '1.0.0' };

export const TOOLS: McpTool[] = [...READ_TOOLS];

export type RpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const result = (id: RpcMessage['id'], value: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result: value });
export const rpcError = (id: RpcMessage['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

export function toolList() {
  return TOOLS.map((t) => {
    const schema = z.toJSONSchema(t.input, { io: 'input' }) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: schema,
      annotations: { title: t.title, readOnlyHint: t.readOnly, openWorldHint: false },
    };
  });
}

function zodMessage(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

async function callTool(ctx: McpContext, name: string, rawArgs: unknown) {
  const tool = TOOLS.find((t) => t.name === name)!;
  const started = Date.now();
  const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });
  try {
    const parsed = tool.input.safeParse(rawArgs ?? {});
    if (!parsed.success) return text(`Datos inválidos: ${zodMessage(parsed.error)}`, true);
    const out = await tool.run(ctx, parsed.data);
    // El registro dice qué herramienta se usó, nunca los datos.
    console.info(`[mcp] ${name} ${Date.now() - started} ms`);
    return text(JSON.stringify(out));
  } catch (e) {
    if (e instanceof McpToolError) return text(e.message, true);
    console.error(`[mcp] ${name} falló: ${e instanceof Error ? e.name : 'error'}`);
    return text('Algo falló en la app al hacer esto. Probá de nuevo en un rato.', true);
  }
}

/** Responde un mensaje. Devuelve null para las notificaciones, que no llevan respuesta. */
export async function handleRpc(msg: RpcMessage, ctx: McpContext): Promise<object | null> {
  const { id, method, params } = msg ?? {};
  if (typeof method !== 'string') return rpcError(id, -32600, 'Pedido inválido');
  switch (method) {
    case 'initialize': {
      const asked = typeof params?.protocolVersion === 'string' ? params.protocolVersion : null;
      return result(id, {
        protocolVersion: asked && SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: MCP_INSTRUCTIONS,
      });
    }
    case 'ping':
      return result(id, {});
    case 'tools/list':
      return result(id, { tools: toolList() });
    case 'tools/call': {
      const name = typeof params?.name === 'string' ? params.name : null;
      if (!name || !TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `Herramienta desconocida: ${name ?? '(sin nombre)'}`);
      return result(id, await callTool(ctx, name, params?.arguments));
    }
    case 'resources/list':
      return result(id, { resources: [] });
    case 'prompts/list':
      return result(id, { prompts: [] });
    default:
      if (method.startsWith('notifications/') || id === undefined) return null;
      return rpcError(id, -32601, `Método no soportado: ${method}`);
  }
}
