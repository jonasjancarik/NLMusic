import type { Language } from "@lib/i18n";
import type { Song, Track } from "@lib/types";
import { findSection, patternToSong } from "@lib/song";
import { COUNT_IN_OPTIONS, METRONOME_MODES, normalizeTempoTrainer } from "@lib/practice";
import type { EditorMode } from "./helpers";
import { compileCode } from "./helpers";
import type { SessionStore } from "./sessionStore";

/**
 * Versión del estado persistido en localStorage.
 * - 0 (sin versión): `{ bpm, tracks, ... }` — un único patrón de 16 pasos.
 * - 1 (TASK-24): `{ song, activeSectionId, ... }` — canción por secciones.
 */
export const PERSIST_VERSION = 1;

/**
 * Subconjunto persistido en localStorage para rehidratación de sesión.
 * Excluye estado efímero de UI/transporte para evitar incoherencias al recargar.
 * `tracks` y `bpm` del store no se guardan: se derivan de `song` al rehidratar.
 */
export interface PersistedState {
  song: Song;
  activeSectionId: string;
  turns: { role: "user" | "assistant"; content: string }[];
  editorMode: EditorMode;
  highlightingEnabled: boolean;
  hapVisualizationEnabled: boolean;
  language: Language;
  delayTimeMode: SessionStore["delayTimeMode"];
  // TASK-30: preferencias de práctica (opcionales: estados guardados antes no las tienen).
  countInBars?: SessionStore["countInBars"];
  metronomeMode?: SessionStore["metronomeMode"];
  metronomeVolume?: SessionStore["metronomeVolume"];
  tempoTrainer?: SessionStore["tempoTrainer"];
}

/** Forma persistida antes de TASK-24 (versión 0). */
export interface PersistedStateV0 extends Omit<PersistedState, "song" | "activeSectionId"> {
  bpm: number;
  tracks: Track[];
}

/**
 * Migra el estado persistido de versiones anteriores. Un patrón v0 pasa a ser una
 * canción con una sección `main` de 1 compás, que compila al mismo código Strudel.
 * @see TASK-24 AC-2
 */
export function migratePersistedState(persisted: unknown, version: number): PersistedState {
  if (version >= PERSIST_VERSION || !persisted || typeof persisted !== "object") {
    return persisted as PersistedState;
  }
  const { bpm, tracks, ...rest } = persisted as Partial<PersistedStateV0>;
  const song = Array.isArray(tracks) && typeof bpm === "number" ? patternToSong({ bpm, tracks }) : undefined;
  // Sin patrón válido no inventamos canción: merge conservará la canción inicial.
  return { ...rest, ...(song ? { song, activeSectionId: song.sections[0].id } : {}) } as PersistedState;
}

/** TASK-30: valores de práctica guardados que ya no son válidos vuelven a los de por defecto. */
function sanitizePracticePrefs(saved: Partial<PersistedState>, current: SessionStore) {
  return {
    countInBars: COUNT_IN_OPTIONS.includes(saved.countInBars as never) ? saved.countInBars : current.countInBars,
    metronomeMode: METRONOME_MODES.includes(saved.metronomeMode as never) ? saved.metronomeMode : current.metronomeMode,
    metronomeVolume:
      typeof saved.metronomeVolume === "number" && saved.metronomeVolume >= 0 && saved.metronomeVolume <= 1
        ? saved.metronomeVolume
        : current.metronomeVolume,
    tempoTrainer: normalizeTempoTrainer(saved.tempoTrainer),
  };
}

function isUsableSong(song: unknown): song is Song {
  const candidate = song as Partial<Song> | undefined;
  return (
    !!candidate &&
    typeof candidate.bpm === "number" &&
    Array.isArray(candidate.sections) &&
    candidate.sections.length > 0 &&
    Array.isArray(candidate.arrangement)
  );
}

/**
 * Combina el estado persistido con el inicial: reparte la canción en los campos del
 * store, deriva `tracks` de la sección activa y recompila `currentCode` para que
 * Play reproduzca la sesión guardada (antes se quedaba el código del patrón inicial).
 */
export function mergePersistedState(persisted: unknown, current: SessionStore): SessionStore {
  const { song, activeSectionId, ...rest } = (persisted ?? {}) as Partial<PersistedState>;
  const merged = { ...current, ...rest, ...sanitizePracticePrefs(rest, current) } as SessionStore;
  if (!isUsableSong(song)) return merged;

  const active =
    findSection(song, activeSectionId ?? "") ??
    findSection(song, song.arrangement[0]?.sectionId ?? "") ??
    song.sections[0];

  return {
    ...merged,
    bpm: song.bpm,
    stepsPerBar: song.stepsPerBar,
    sections: song.sections,
    arrangement: song.arrangement,
    activeSectionId: active.id,
    tracks: active.tracks,
    currentCode: compileCode(song),
    isCodeManuallyEdited: false,
  };
}
