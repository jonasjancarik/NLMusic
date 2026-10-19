import { z } from 'zod';
import { parseSongInput } from '../llm/parseSongInput';
import { PushTokenError, ensurePushToken, isAuthorized } from './pushToken';
import type { SongHub } from './songHub';
import { MAX_PUSH_BODY_BYTES } from './types';

/**
 * Lógica de `POST /api/songs/push` (TASK-29 AC-1), separada de la ruta para poder probarla
 * con una cola y un archivo de token propios.
 *
 * Orden de las comprobaciones: primero lo barato y lo que no depende del body (cabeceras,
 * token), después el tamaño, y solo al final se parsea y valida la canción.
 */

const pushBodySchema = z
  .object({
    song: z.unknown(),
    name: z.string().min(1).max(64).optional(),
    autoplay: z.boolean().optional(),
  })
  .strict();

export interface PushDeps {
  hub: SongHub;
  tokenFile?: string;
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Defensa adicional, no la barrera principal: Next rellena `x-forwarded-for` con la IP del
 * socket solo si el cliente no la manda, así que una petición honesta desde la LAN llega con
 * su IP real y se rechaza aquí. Una falsificada pasa este filtro, pero no el del token.
 */
function forwardedFromOutside(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return false;
  return forwarded.split(',').some((part) => !LOOPBACK.has(part.trim().toLowerCase()));
}

/** Lee el body sin pasar de `limit` bytes aunque no haya Content-Length (chunked). */
async function readLimited(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function handlePush(request: Request, deps: PushDeps): Promise<Response> {
  // Una página web nunca debe poder empujar canciones: los navegadores mandan Origin en todo
  // POST y Sec-Fetch-Site en toda petición. (El fetch de Node manda Sec-Fetch-Mode, no estas.)
  if (request.headers.get('origin') || request.headers.get('sec-fetch-site')) {
    return json(403, { ok: false, error: 'Songs can only be sent from local tools (the NLMusic MCP or CLI), not from web pages.' });
  }
  if (forwardedFromOutside(request)) {
    return json(403, { ok: false, error: 'Songs can only be sent from this computer.' });
  }

  let token: string;
  try {
    token = ensurePushToken(deps.tokenFile);
  } catch (error) {
    const message = error instanceof PushTokenError ? error.message : 'Could not read the push token file.';
    return json(500, { ok: false, error: message });
  }
  if (!isAuthorized(request.headers.get('authorization'), token)) {
    return json(401, {
      ok: false,
      error: 'Missing or wrong push token. Send songs with the NLMusic MCP or CLI from the project folder (they read .nlmusic/push-token).',
    });
  }

  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json(415, { ok: false, error: 'Send the song as application/json.' });
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_PUSH_BODY_BYTES) {
    return json(413, { ok: false, error: `The request is too large (max ${MAX_PUSH_BODY_BYTES} bytes).` });
  }
  const text = await readLimited(request, MAX_PUSH_BODY_BYTES);
  if (text === null) {
    return json(413, { ok: false, error: `The request is too large (max ${MAX_PUSH_BODY_BYTES} bytes).` });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json(400, { ok: false, error: 'The body is not valid JSON.' });
  }
  const body = pushBodySchema.safeParse(raw);
  if (!body.success) {
    return json(400, {
      ok: false,
      error: 'Expected { song, name?, autoplay? }.',
      details: body.error.issues.map((issue) => `${issue.path.join('.') || '(body)'}: ${issue.message}`),
    });
  }
  if (body.data.song === undefined) {
    return json(400, { ok: false, error: 'Missing "song".' });
  }

  const parsed = parseSongInput(body.data.song);
  if (!parsed.ok) {
    return json(422, { ok: false, error: 'The song is not valid.', errors: parsed.errors });
  }

  const { id, tabs } = deps.hub.push({ song: parsed.song, name: body.data.name, autoplay: body.data.autoplay ?? false });
  return json(200, { ok: true, id, tabs, warnings: parsed.warnings });
}
