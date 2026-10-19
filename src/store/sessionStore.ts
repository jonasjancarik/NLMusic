import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { selectSong } from "./helpers";
import {
  PERSIST_VERSION,
  mergePersistedState,
  migratePersistedState,
  type PersistedState,
} from "./persistence";
import { createTracksSlice, type TracksSlice } from "./slices/tracksSlice";
import { createAudioSlice, type AudioSlice } from "./slices/audioSlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";
import { createSessionSlice, type SessionSlice } from "./slices/sessionSlice";
import { createEditorSlice, type EditorSlice } from "./slices/editorSlice";
import { createLiveSlice, type LiveSlice } from "./slices/liveSlice";

// Re-export types that consumers import from this module
export type { UiState, EditorMode } from "./helpers";

/**
 * Estado unificado de sesión construido por composición de slices.
 * Mantiene estable la API pública para consumidores de useSessionStore.
 */
export type SessionStore = TracksSlice & AudioSlice & UiSlice & SessionSlice & EditorSlice & LiveSlice;

export const useSessionStore = create<SessionStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createTracksSlice(...args),
        ...createAudioSlice(...args),
        ...createUiSlice(...args),
        ...createSessionSlice(...args),
        ...createEditorSlice(...args),
        ...createLiveSlice(...args),
      }),
      {
        name: "nlmusic-session",
        // TASK-24: v1 persists the whole song; v0 ({ bpm, tracks }) is migrated on load.
        version: PERSIST_VERSION,
        migrate: migratePersistedState,
        merge: mergePersistedState,
        // TASK-12/TASK-13: editor preferences and language persist between sessions.
        partialize: (state): PersistedState => ({
          song: selectSong(state),
          activeSectionId: state.activeSectionId,
          turns: state.turns.slice(-40),
          editorMode: state.editorMode,
          highlightingEnabled: state.highlightingEnabled,
          hapVisualizationEnabled: state.hapVisualizationEnabled,
          language: state.language,
          delayTimeMode: state.delayTimeMode,
          // TASK-29
          autoAcceptSentSongs: state.autoAcceptSentSongs,
        }),
      },
    ),
  ),
);
