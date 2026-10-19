import { getSongHub } from '@lib/live/songHub';
import { handleStream } from '@lib/live/streamResponse';

/** Canal SSE hacia la app abierta (TASK-29 AC-2). Decisión de acceso en `@lib/live/streamResponse`. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  return handleStream(request, getSongHub());
}
