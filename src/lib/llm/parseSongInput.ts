import type { Song } from '../types';
import { interpretSongResponse } from './songPipeline';

/**
 * Validación compartida de una canción que llega desde fuera de la app: el MCP y la CLI
 * (TASK-28) y `/api/songs/push` (TASK-29). Usa el mismo camino que una respuesta del LLM
 * (delta replaceSong + validateSong), así que lo que pasa aquí es lo que la app sabe tocar.
 * Los errores no lanzan: nombran sección y pista para que quien escribe pueda corregir.
 */

export type Failure = { ok: false; errors: string[] };

export type ParsedSong = { ok: true; song: Song; warnings: string[] } | Failure;

/** Entrada de canción: objeto, o texto JSON. */
export type SongInput = unknown;

export function parseSongInput(input: SongInput): ParsedSong {
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (error) {
      return { ok: false, errors: [`The song is not valid JSON: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['The song must be a JSON object with bpm, stepsPerBar, sections and arrangement.'] };
  }
  const result = interpretSongResponse({ text: JSON.stringify(raw) }, { turns: [] });
  if (!result.ok) return { ok: false, errors: result.errors };
  return { ok: true, song: result.song, warnings: result.warnings };
}
