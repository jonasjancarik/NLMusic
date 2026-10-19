import type { StateCreator } from "zustand";
import type { ArrangementItem, Section, Song, StepsPerBar, Track, TrackJSON, TrackParams } from "@lib/types";
import {
  DEFAULT_SECTION_ID,
  MAX_TRACKS_PER_SECTION,
  addArrangementItem,
  addSection,
  duplicateSection,
  findSection,
  fitTracksToSection,
  moveArrangementItem,
  patternToSong,
  reconcileVelocity,
  removeArrangementItem,
  removeSection,
  renameSection,
  setArrangementRepeat,
  setArrangementSection,
  setSectionBars,
  setStepVelocity,
  validateSong,
} from "@lib/song";
import type { VelocityLevel } from "@lib/song";
import { deriveUiState, compileCode, selectSong, songTracks } from "../helpers";
import type { SessionStore } from "../sessionStore";

export const defaultKickTrack: Track = {
  id: "kick-1",
  name: "Kick",
  tag: "kick",
  steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] as (0 | 1)[],
  volume: 0.8,
  muted: false,
  solo: false,
};

export const initialTracks: Track[] = [defaultKickTrack];
export const initialBpm = 138;
export const initialSong: Song = patternToSong({ bpm: initialBpm, tracks: initialTracks });

export type TracksSlice = {
  /** Espejo de las pistas de la sección activa; lo que editan el grid y el LLM. */
  tracks: Track[];
  bpm: number;
  /** v1: fijo una vez creada la canción; solo cambia sustituyendo la canción con loadSong. */
  stepsPerBar: StepsPerBar;
  /** Fuente de verdad de la canción (CAP-NLM-015). */
  sections: Section[];
  arrangement: ArrangementItem[];
  activeSectionId: string;
  loadSong: (song: Song) => void;
  setActiveSection: (sectionId: string) => void;
  setTracks: (tracks: Track[]) => void;
  setBpm: (bpm: number) => void;
  toggleStep: (trackId: string, stepIndex: number) => void;
  setVolume: (trackId: string, volume: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, patch: Partial<Track>) => boolean;
  updateTrackParams: (id: string, patch: Partial<TrackParams>) => void;
  deleteTrack: (id: string) => void;
  loadPattern: (pattern: TrackJSON) => void;
  syncCodePattern: (pattern: TrackJSON, code: string) => void;
  // TASK-25: edición de secciones, arreglo y velocidad. Ninguna llama al LLM (BR-008);
  // todas recompilan el código de la canción (BR-009) y no tocan el transporte (BR-001).
  setStepVelocity: (trackId: string, stepIndex: number, level: VelocityLevel) => void;
  addSection: (name: string) => void;
  duplicateSection: (sectionId: string, name: string) => void;
  renameSection: (sectionId: string, name: string) => void;
  deleteSection: (sectionId: string) => void;
  setSectionBars: (sectionId: string, bars: number) => void;
  addArrangementItem: (sectionId: string) => void;
  removeArrangementItem: (index: number) => void;
  moveArrangementItem: (from: number, to: number) => void;
  setArrangementRepeat: (index: number, repeat: number) => void;
  setArrangementSection: (index: number, sectionId: string) => void;
};

/**
 * Escribe las pistas de la sección activa (y opcionalmente el BPM) en la canción y
 * recompila. Todas las acciones que cambian pistas pasan por aquí para que `tracks`
 * y `sections` no se desincronicen.
 * @see BR-009
 */
function commitTracks(state: SessionStore, tracks: Track[], bpm: number = state.bpm) {
  const sections = state.sections.map((section) =>
    section.id === state.activeSectionId ? { ...section, tracks } : section,
  );
  return {
    tracks,
    bpm,
    sections,
    currentCode: compileCode(selectSong({ ...state, bpm, sections })),
    isCodeManuallyEdited: false,
  };
}

/** Hay algo que sonar en alguna sección (no solo en la activa). */
function songHasTracks(sections: Section[]): boolean {
  return songTracks(sections).length > 0;
}

/**
 * Un patrón de 16 pasos (LLM o parser de código) que entra en una sección de varios compases
 * se completa con silencio hasta la longitud de la sección, para que la canción siga siendo válida.
 */
function fitToActiveSection(state: SessionStore, tracks: Track[]): Track[] {
  const section = findSection(selectSong(state), state.activeSectionId);
  if (!section || section.bars === 1) return tracks;
  const song = fitTracksToSection(selectSong(state), section.id, tracks);
  return findSection(song, section.id)?.tracks ?? tracks;
}

/**
 * Sustituye la estructura de la canción (secciones y arreglo) y recompila. Una canción que
 * no pasa validateSong se descarta entera, así que una edición no puede dejar el audio ni el
 * código en un estado inválido.
 * @see CAP-NLM-015
 */
function commitSong(state: SessionStore, song: Song, activeSectionId: string = state.activeSectionId) {
  if (!validateSong(song).ok) return state;
  const active = findSection(song, activeSectionId) ?? song.sections[0];
  return {
    sections: song.sections,
    arrangement: song.arrangement,
    activeSectionId: active.id,
    tracks: active.tracks,
    currentCode: compileCode(song),
    isCodeManuallyEdited: false,
  };
}

/**
 * Slice de pistas y BPM con acciones de edición y sincronización de código.
 * Incluye transiciones que afectan transporte/UI cuando cambian las pistas.
 */
export const createTracksSlice: StateCreator<
  SessionStore,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  TracksSlice
> = (set, get) => ({
  tracks: initialTracks,
  bpm: initialBpm,
  stepsPerBar: initialSong.stepsPerBar,
  sections: initialSong.sections,
  arrangement: initialSong.arrangement,
  activeSectionId: DEFAULT_SECTION_ID,

  // BR-001: sustituir la canción no toca el transporte; Strudel cambia de patrón
  // sin cortar y conserva la fase del reloj.
  /**
   * Sustituye la canción completa (ya validada con validateSong).
   * La sección activa pasa a ser la primera del arreglo.
   * @see CAP-NLM-015
   */
  loadSong: (song) =>
    set((state) => {
      const active = findSection(song, song.arrangement[0]?.sectionId ?? "") ?? song.sections[0];
      const tracks = active?.tracks ?? [];
      const nextIsPlaying = songTracks(song.sections).length > 0 ? state.isPlaying : false;
      return {
        bpm: song.bpm,
        stepsPerBar: song.stepsPerBar,
        sections: song.sections,
        arrangement: song.arrangement,
        activeSectionId: active?.id ?? DEFAULT_SECTION_ID,
        tracks,
        currentCode: compileCode(song),
        isCodeManuallyEdited: false,
        isPlaying: nextIsPlaying,
        uiState: deriveUiState(songTracks(song.sections), nextIsPlaying),
      };
    }),

  /**
   * Cambia la sección que muestran el grid y el LLM. No recompila: el código
   * siempre es la canción entera. No-op si la sección no existe.
   */
  setActiveSection: (sectionId) =>
    set((state) => {
      const section = state.sections.find((s) => s.id === sectionId);
      if (!section) return state;
      return { activeSectionId: sectionId, tracks: section.tracks };
    }),

  // EC-007: al eliminar la última pista forzamos IDLE y detenemos reproducción.
  /**
   * Reemplaza todas las pistas y recalcula transporte, UI y código derivado.
   * Si no quedan pistas, fuerza parada para evitar estado PLAYING inválido.
   * @see EC-007
   */
  setTracks: (tracks) =>
    set((state) => {
      const committed = commitTracks(state, tracks);
      const hasTracks = songHasTracks(committed.sections);
      const nextIsPlaying = hasTracks ? state.isPlaying : false;
      return {
        ...committed,
        isPlaying: nextIsPlaying,
        uiState: deriveUiState(songTracks(committed.sections), nextIsPlaying),
      };
    }),

  setBpm: (bpm) =>
    set((state) => {
      const clamped = Math.min(220, Math.max(60, bpm));
      return commitTracks(state, state.tracks, clamped);
    }),

  toggleStep: (trackId, stepIndex) =>
    set((state) => {
      const tracks = state.tracks.map((track) => {
        if (track.id !== trackId) return track;
        const steps = track.steps.map((value, index) => {
          if (index !== stepIndex) return value;
          return value === 1 ? 0 : 1;
        }) as (0 | 1)[];
        const velocity = reconcileVelocity(steps, track.velocity);
        return velocity ? { ...track, steps, velocity } : { ...track, steps };
      });
      return commitTracks(state, tracks);
    }),

  setVolume: (trackId, volume) =>
    set((state) => {
      const tracks = state.tracks.map((track) =>
        track.id === trackId
          ? { ...track, volume: Math.max(0, Math.min(1, volume)) }
          : track,
      );
      return commitTracks(state, tracks);
    }),

  toggleMute: (trackId) =>
    set((state) => {
      const tracks = state.tracks.map((track) =>
        track.id === trackId ? { ...track, muted: !track.muted } : track,
      );
      return commitTracks(state, tracks);
    }),

  toggleSolo: (trackId) =>
    set((state) => {
      const target = state.tracks.find((track) => track.id === trackId);
      if (!target) return state;
      const shouldUnsolo = target.solo;
      const tracks = state.tracks.map((track) => {
        if (shouldUnsolo) {
          return track.id === trackId ? { ...track, solo: false } : track;
        }
        return track.id === trackId
          ? { ...track, solo: true }
          : { ...track, solo: false };
      });
      return commitTracks(state, tracks);
    }),

  addTrack: (track) =>
    set((state) => {
      if (state.tracks.length >= MAX_TRACKS_PER_SECTION) return state; // BR-006
      return commitTracks(state, [...state.tracks, track]);
    }),

  // BR-004: modifica pista por id; devuelve false si no existe (BR-005)
  /**
   * Aplica un patch parcial por id y reporta si la pista objetivo no existe.
   * Permite al flujo de prompt distinguir "no-op" por referencia inválida.
   * @see BR-005
   */
  updateTrack: (id, patch) => {
    const { tracks } = get();
    if (!tracks.some((t) => t.id === id)) return false;
    const nextTracks = tracks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    set((state) => commitTracks(state, nextTracks));
    return true;
  },

  // TASK-20: merge de params; no-op si la pista no existe. No toca el transporte (BR-001).
  /**
   * Fusiona un patch parcial sobre los params de la pista y recompila el código.
   * @see BR-001
   */
  updateTrackParams: (id, patch) =>
    set((state) => {
      if (!state.tracks.some((t) => t.id === id)) return state;
      const tracks = state.tracks.map((t) =>
        t.id === id ? { ...t, params: { ...t.params, ...patch } } : t,
      );
      return commitTracks(state, tracks);
    }),

  // EC-007/EC-008: al quedar 0 pistas, el transporte debe caer a IDLE.
  /**
   * Elimina una pista y ajusta transporte/UI cuando era la última activa.
   * Mantiene coherente el estado global en PLAYING y PAUSED.
   * @see EC-007
   * @see EC-008
   */
  deleteTrack: (id) =>
    set((state) => {
      const nextTracks = state.tracks.filter((t) => t.id !== id);
      const committed = commitTracks(state, nextTracks);
      const hasTracks = songHasTracks(committed.sections);
      const nextIsPlaying = hasTracks ? state.isPlaying : false;
      return {
        ...committed,
        isPlaying: nextIsPlaying,
        uiState: deriveUiState(songTracks(committed.sections), nextIsPlaying),
      };
    }),

  // FIX-6: reusar código ya compilado por usePatternGen para evitar doble compilación
  /**
   * Carga un patrón del LLM en la sección activa respetando el límite de pistas.
   * Reutiliza strudelCode precompilado solo si la canción es esa única sección de
   * 1 compás (si no, el código precompilado no incluiría el resto de la canción).
   * @see BR-006
   */
  loadPattern: (pattern) =>
    set((state) => {
      const nextTracks = fitToActiveSection(state, pattern.tracks.slice(0, MAX_TRACKS_PER_SECTION)); // BR-006 defensa
      const committed = commitTracks(state, nextTracks, pattern.bpm);
      const isSingleBar =
        state.sections.length === 1 &&
        state.arrangement.length === 1 &&
        state.sections[0].bars === 1 &&
        state.stepsPerBar === 16;
      return {
        ...committed,
        currentCode: (isSingleBar && pattern.strudelCode) || committed.currentCode,
        isPlaying: nextTracks.length > 0,
        uiState: nextTracks.length > 0 ? "playing" : "idle",
        lastError: null,
      };
    }),

  // BR-009: el grid vuelve a reflejar el código — limpiar la marca de edición manual
  /**
   * Sincroniza tracks + código cuando el parser reconstruye el patrón desde editor.
   * Limpia modo manual para reactivar coherencia bidireccional grid/código.
   * @see BR-009
   */
  syncCodePattern: (pattern, code) =>
    set((state) => {
      const nextTracks = fitToActiveSection(state, pattern.tracks.slice(0, MAX_TRACKS_PER_SECTION)); // BR-006 cap defensivo
      const nextIsPlaying = nextTracks.length > 0 ? state.isPlaying : false;
      return {
        ...commitTracks(state, nextTracks, pattern.bpm),
        currentCode: code,
        isPlaying: nextIsPlaying,
        uiState: deriveUiState(nextTracks, nextIsPlaying),
      };
    }),

  // --- TASK-25: secciones, arreglo y velocidad (juntas para facilitar el merge con TASK-27) ---

  setStepVelocity: (trackId, stepIndex, level) =>
    set((state) => {
      const tracks = state.tracks.map((track) =>
        track.id === trackId ? setStepVelocity(track, stepIndex, level) : track,
      );
      return commitTracks(state, tracks);
    }),

  addSection: (name) =>
    set((state) => {
      const { song, sectionId } = addSection(selectSong(state), name, state.activeSectionId);
      return commitSong(state, song, sectionId);
    }),

  duplicateSection: (sectionId, name) =>
    set((state) => {
      const { song, sectionId: copyId } = duplicateSection(selectSong(state), sectionId, name);
      return commitSong(state, song, copyId);
    }),

  renameSection: (sectionId, name) =>
    set((state) => commitSong(state, renameSection(selectSong(state), sectionId, name))),

  // BR-007: eliminar una sección es destructivo; también elimina sus bloques del arreglo.
  deleteSection: (sectionId) =>
    set((state) => {
      const before = selectSong(state);
      const song = removeSection(before, sectionId);
      if (song === before) return state;
      const index = before.sections.findIndex((section) => section.id === sectionId);
      const fallback = song.sections[Math.max(0, index - 1)] ?? song.sections[0];
      const nextActive = state.activeSectionId === sectionId ? fallback.id : state.activeSectionId;
      return commitSong(state, song, nextActive);
    }),

  setSectionBars: (sectionId, bars) =>
    set((state) => commitSong(state, setSectionBars(selectSong(state), sectionId, bars))),

  addArrangementItem: (sectionId) =>
    set((state) => commitSong(state, addArrangementItem(selectSong(state), sectionId))),

  removeArrangementItem: (index) =>
    set((state) => commitSong(state, removeArrangementItem(selectSong(state), index))),

  moveArrangementItem: (from, to) =>
    set((state) => commitSong(state, moveArrangementItem(selectSong(state), from, to))),

  setArrangementRepeat: (index, repeat) =>
    set((state) => commitSong(state, setArrangementRepeat(selectSong(state), index, repeat))),

  setArrangementSection: (index, sectionId) =>
    set((state) => commitSong(state, setArrangementSection(selectSong(state), index, sectionId))),
});
