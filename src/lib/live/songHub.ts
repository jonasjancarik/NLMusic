import crypto from 'node:crypto';
import type { LiveSongMessage } from './types';

/**
 * Cola en memoria entre `/api/songs/push` y `/api/songs/stream` (TASK-29).
 *
 * - Vive en `globalThis` para sobrevivir a los hot reloads de `next dev` y para que las dos
 *   rutas (módulos distintos) compartan la misma instancia.
 * - Dos pestañas abiertas: v1 envía a todas las conectadas (cada una muestra su aviso).
 * - Si no hay ninguna pestaña, la canción espera (máx. `PENDING_TTL_MS`) y la recibe la
 *   próxima que se conecte. Solo se guardan las últimas `MAX_ITEMS`.
 * - Los ids llevan un prefijo por arranque del servidor: tras un reinicio, el `Last-Event-ID`
 *   de una pestaña vieja no esconde canciones nuevas.
 */

export const MAX_ITEMS = 10;
export const PENDING_TTL_MS = 30 * 60 * 1000;
/** Tope de pestañas/clientes SSE simultáneos: el stream es público dentro de la red. */
export const MAX_SUBSCRIBERS = 16;

export type Subscriber = (message: LiveSongMessage) => void;

interface Item {
  seq: number;
  message: LiveSongMessage;
  createdAt: number;
  delivered: boolean;
}

export interface SongHub {
  push(input: Omit<LiveSongMessage, 'id' | 'sentAt'>): { id: string; tabs: number };
  /** Devuelve null si ya hay demasiados suscriptores. */
  subscribe(subscriber: Subscriber, lastEventId?: string | null): { replay: LiveSongMessage[]; unsubscribe: () => void } | null;
  subscriberCount(): number;
}

export function createSongHub(now: () => number = Date.now): SongHub {
  const bootId = crypto.randomBytes(4).toString('hex');
  const subscribers = new Set<Subscriber>();
  let items: Item[] = [];
  let seq = 0;

  const prune = () => {
    const cutoff = now() - PENDING_TTL_MS;
    items = items.filter((item) => item.createdAt >= cutoff).slice(-MAX_ITEMS);
  };

  const parseSeq = (lastEventId?: string | null): number | null => {
    const match = /^([0-9a-f]{8})-(\d+)$/.exec(lastEventId ?? '');
    return match && match[1] === bootId ? Number(match[2]) : null;
  };

  return {
    push(input) {
      prune();
      seq += 1;
      const message: LiveSongMessage = { ...input, id: `${bootId}-${seq}`, sentAt: new Date(now()).toISOString() };
      const tabs = subscribers.size;
      items.push({ seq, message, createdAt: now(), delivered: tabs > 0 });
      for (const subscriber of subscribers) subscriber(message);
      return { id: message.id, tabs };
    },

    subscribe(subscriber, lastEventId) {
      if (subscribers.size >= MAX_SUBSCRIBERS) return null;
      prune();
      const after = parseSeq(lastEventId);
      // Reconexión: lo que se perdió mientras tanto. Conexión nueva: lo que nadie recibió.
      const replayItems = after !== null ? items.filter((item) => item.seq > after) : items.filter((item) => !item.delivered);
      for (const item of replayItems) item.delivered = true;
      subscribers.add(subscriber);
      return {
        replay: replayItems.map((item) => item.message),
        unsubscribe: () => {
          subscribers.delete(subscriber);
        },
      };
    },

    subscriberCount: () => subscribers.size,
  };
}

const globalForHub = globalThis as typeof globalThis & { __nlmusicSongHub?: SongHub };

export function getSongHub(): SongHub {
  globalForHub.__nlmusicSongHub ??= createSongHub();
  return globalForHub.__nlmusicSongHub;
}
