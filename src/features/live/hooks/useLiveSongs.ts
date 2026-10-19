'use client';

import { useEffect } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { validateSong } from '@lib/song';
import { STREAM_PATH } from '@lib/live/types';

/** Espera máxima entre reintentos cuando el navegador da la conexión por perdida. */
export const MAX_RECONNECT_MS = 30_000;
const FIRST_RECONNECT_MS = 1_000;

/**
 * Suscribe la app a las canciones que envía Claude por el MCP (TASK-29 AC-2/AC-3).
 *
 * EventSource reconecta solo mientras puede (`readyState` CONNECTING). Si la da por cerrada
 * (servidor caído, respuesta no SSE) abrimos otra con espera creciente y pasamos el último id
 * visto para que el servidor reenvíe lo que se perdió. Lo que llega se vuelve a validar aquí:
 * el canal no es de confianza por sí mismo.
 */
export function useLiveSongs(url: string = STREAM_PATH): void {
  useEffect(() => {
    const { setLiveConnection } = useSessionStore.getState();
    if (typeof EventSource === 'undefined') {
      setLiveConnection('offline');
      return;
    }

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let lastId: string | null = null;
    let disposed = false;
    const seen = new Set<string>();

    const onSong = (event: MessageEvent<string>) => {
      let message: unknown;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const { id, song, name, autoplay } = (message ?? {}) as Record<string, unknown>;
      if (typeof id !== 'string' || seen.has(id)) return;
      const checked = validateSong(song);
      if (!checked.ok) {
        console.warn('[NLMusic] ignored an invalid song from Claude', checked.errors);
        return;
      }
      seen.add(id);
      lastId = id;
      useSessionStore.getState().receiveLiveSong({
        id,
        song: checked.song,
        name: typeof name === 'string' ? name.slice(0, 64) : undefined,
        autoplay: autoplay === true,
      });
    };

    const connect = () => {
      if (disposed) return;
      setLiveConnection('connecting');
      const target = lastId ? `${url}?lastEventId=${encodeURIComponent(lastId)}` : url;
      const current = new EventSource(target);
      source = current;
      current.addEventListener('open', () => {
        attempts = 0;
        setLiveConnection('connected');
      });
      current.addEventListener('song', onSong as EventListener);
      current.addEventListener('error', () => {
        if (disposed || source !== current) return;
        setLiveConnection('offline');
        // CONNECTING: el navegador ya reintenta por su cuenta. CLOSED: nos toca a nosotros.
        if (current.readyState === EventSource.CLOSED) {
          const wait = Math.min(MAX_RECONNECT_MS, FIRST_RECONNECT_MS * 2 ** attempts);
          attempts += 1;
          timer = setTimeout(connect, wait);
        }
      });
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [url]);
}
