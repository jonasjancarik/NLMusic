import type { Song } from '../types';

/** Lo que viaja por `/api/songs/stream` (evento SSE `song`). */
export interface LiveSongMessage {
  id: string;
  song: Song;
  /** Nombre de la canción guardada en songs/, si vino de ahí. */
  name?: string;
  /** Arrancar la reproducción si estaba parada. */
  autoplay: boolean;
  sentAt: string;
}

export const PUSH_PATH = '/api/songs/push';
export const STREAM_PATH = '/api/songs/stream';
/** Tope del body de `/api/songs/push`. Una canción grande (8 secciones × 8 pistas × 4 compases) ocupa ~60 KB. */
export const MAX_PUSH_BODY_BYTES = 256 * 1024;
