import type { Song, Track } from "@lib/types";
import { compileSong } from "@lib/song";

export type UiState = "idle" | "loading" | "playing" | "paused" | "error";
export type EditorMode = "advanced" | "simple";
export type ActiveTab = "sequencer" | "code" | "config";

/**
 * Deriva el estado UI estable a partir de presencia de pistas y transporte.
 * Evita estados imposibles al recomputar desde la fuente de verdad del store.
 */
export function deriveUiState(tracks: Track[], isPlaying: boolean): UiState {
  if (tracks.length === 0) return "idle";
  return isPlaying ? "playing" : "paused";
}

/**
 * Compila la canción completa a Strudel de forma determinista.
 * Se reutiliza en slices para mantener coherencia grid <-> código. Una canción de
 * una sección de 1 compás produce el mismo código que el compilador de patrones.
 * @see BR-009
 */
export function compileCode(song: Song): string {
  return compileSong(song);
}

/** Campos del store que forman la canción. */
export interface SongFields {
  bpm: number;
  stepsPerBar: Song["stepsPerBar"];
  sections: Song["sections"];
  arrangement: Song["arrangement"];
}

/**
 * Reconstruye la canción desde el store. `sections` es la fuente de verdad;
 * `tracks` del store es un espejo de la sección activa.
 * @see CAP-NLM-015
 */
export function selectSong(state: SongFields): Song {
  return {
    bpm: state.bpm,
    stepsPerBar: state.stepsPerBar,
    sections: state.sections,
    arrangement: state.arrangement,
  };
}
