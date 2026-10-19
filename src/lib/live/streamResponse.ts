import type { SongHub } from './songHub';
import type { LiveSongMessage } from './types';

/**
 * Respuesta SSE de `GET /api/songs/stream` (TASK-29 AC-2).
 *
 * Acceso: el stream no pide token. Solo lleva canciones ya validadas que alguien con el token
 * envió a propósito, que es lo mismo que la app ya muestra a quien la abre; y así una pestaña
 * abierta desde el móvil (LAN/Tailscale) también puede recibirlas. No se mandan cabeceras
 * CORS, así que otra web abierta en el navegador no puede leerlo. El número de clientes está
 * limitado (`MAX_SUBSCRIBERS`) para que no sirva para agotar el servidor.
 */

export const HEARTBEAT_MS = 15_000;
/** Espera que sugiere el servidor al navegador antes de reconectar. */
export const RETRY_MS = 3_000;

const encoder = new TextEncoder();

export function formatSongEvent(message: LiveSongMessage): string {
  return `id: ${message.id}\nevent: song\ndata: ${JSON.stringify(message)}\n\n`;
}

export function handleStream(request: Request, hub: SongHub): Response {
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      const subscription = hub.subscribe((message) => send(formatSongEvent(message)), request.headers.get('last-event-id') ?? new URL(request.url).searchParams.get('lastEventId'));
      if (!subscription) {
        send(`retry: ${RETRY_MS * 10}\nevent: busy\ndata: {}\n\n`);
        controller.close();
        return;
      }
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        subscription.unsubscribe();
        cleanup = () => {};
      };
      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });

      send(`retry: ${RETRY_MS}\nevent: ready\ndata: {}\n\n`);
      for (const message of subscription.replay) send(formatSongEvent(message));
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
