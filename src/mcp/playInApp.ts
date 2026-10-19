import { ensurePushToken, PushTokenError } from '../lib/live/pushToken';
import { PUSH_PATH } from '../lib/live/types';
import { songFromArgs, type Failure, type SongInput, type ToolContext } from './songTools';

/**
 * `play_in_app` (TASK-29 AC-4): envía una canción a la pestaña de NLMusic abierta.
 * Strudel solo suena en el navegador, así que el MCP no reproduce: entrega la canción al
 * servidor de la app (`/api/songs/push`, con el token de `.nlmusic/push-token`) y este la
 * reparte por SSE a las pestañas conectadas.
 */

export const DEFAULT_APP_URL = 'http://127.0.0.1:3000';
const TIMEOUT_MS = 5_000;

export function defaultAppUrl(): string {
  return (process.env.NLMUSIC_APP_URL || DEFAULT_APP_URL).replace(/\/+$/, '');
}

export type PlayInAppResult =
  | { ok: true; tabs: number; delivered: boolean; message: string; warnings: string[] }
  | Failure;

const fail = (...errors: string[]): Failure => ({ ok: false, errors });

export async function playInApp(
  ctx: ToolContext,
  args: { name?: string; song?: SongInput; autoplay?: boolean },
  fetchImpl: typeof fetch = fetch,
): Promise<PlayInAppResult> {
  const source = songFromArgs(ctx, args);
  if (!source.ok) return source;
  const appUrl = (ctx.appUrl ?? defaultAppUrl()).replace(/\/+$/, '');
  const saved = source.name ? ` It is saved as songs/${source.name}.json.` : ' Use save_song if you want to keep it.';

  let token: string;
  try {
    token = ensurePushToken(ctx.pushTokenFile);
  } catch (error) {
    return fail(error instanceof PushTokenError ? error.message : `Cannot read the push token: ${String(error)}`);
  }

  let response: Response;
  try {
    response = await fetchImpl(`${appUrl}${PUSH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ song: source.song, name: source.name, autoplay: args.autoplay ?? false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return fail(
      `NLMusic is not running at ${appUrl}. Start it with "npm run dev" in the project folder (or set NLMUSIC_APP_URL), open it in the browser, and try again.${saved}`,
    );
  }

  let body: { ok?: boolean; tabs?: number; warnings?: string[]; error?: string; errors?: string[] } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // respuesta sin JSON: se informa con el código de estado
  }

  if (response.status === 401) {
    return fail(
      `NLMusic at ${appUrl} rejected the push token. The app and this MCP server must run from the same project folder (they share .nlmusic/push-token), or both need the same NLMUSIC_PUSH_TOKEN_FILE.`,
    );
  }
  if (!response.ok || !body.ok) {
    return fail(...(body.errors ?? []), body.error ?? `NLMusic answered with HTTP ${response.status}.`);
  }

  const tabs = body.tabs ?? 0;
  const message =
    tabs > 0
      ? `Sent to ${tabs} open NLMusic tab${tabs === 1 ? '' : 's'}. The user sees a prompt to load it (or it loads automatically if they turned that on); if music is playing it comes in on the next bar.${args.autoplay ? '' : ' It will not start playing by itself unless autoplay is true.'}`
      : `No NLMusic tab is open, so nobody can hear it yet. The song is waiting in the app for 30 minutes: open ${appUrl} and it will be offered there.${saved}`;
  return { ok: true, tabs, delivered: tabs > 0, message, warnings: body.warnings ?? [] };
}
