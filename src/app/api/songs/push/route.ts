import { handlePush } from '@lib/live/pushRequest';
import { getSongHub } from '@lib/live/songHub';

/**
 * Entrada de canciones desde el MCP / la CLI hacia la pestaña abierta (TASK-29 AC-1).
 * Solo acepta peticiones con el token de `.nlmusic/push-token` (ver `@lib/live/pushToken`):
 * el servidor de desarrollo escucha en 0.0.0.0 y Next no expone la IP del socket.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handlePush(request, { hub: getSongHub() });
}
