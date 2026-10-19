import type { StateCreator } from "zustand";
import type { Song } from "@lib/types";
import { songTracks } from "../helpers";
import type { SessionStore } from "../sessionStore";

/** Estado de la conexión SSE con `/api/songs/stream` (TASK-29 AC-2). */
export type LiveConnection = "connecting" | "connected" | "offline";

/** Canción enviada por Claude (MCP) que espera a que el usuario la cargue. */
export interface LiveSong {
  id: string;
  song: Song;
  name?: string;
  autoplay: boolean;
}

/**
 * TASK-29: canciones enviadas en vivo desde el MCP. Todo lo de la tarea vive en este slice
 * (más una línea en `partialize`) para no chocar con otros cambios del store.
 */
export type LiveSlice = {
  liveConnection: LiveConnection;
  /** "Aceptar canciones enviadas automáticamente". Desactivado por defecto; se persiste. */
  autoAcceptSentSongs: boolean;
  pendingLiveSong: LiveSong | null;
  setLiveConnection: (connection: LiveConnection) => void;
  setAutoAcceptSentSongs: (enabled: boolean) => void;
  /**
   * Recibe una canción ya validada. La carga directamente si el ajuste está activo y no hay
   * ediciones manuales de código que perder; si no, la deja pendiente para el aviso.
   */
  receiveLiveSong: (song: LiveSong) => "loaded" | "pending";
  /** Carga la canción pendiente (el usuario pulsó "Cargar" y, si hacía falta, confirmó). */
  acceptLiveSong: () => void;
  dismissLiveSong: () => void;
};

export const createLiveSlice: StateCreator<
  SessionStore,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  LiveSlice
> = (set, get) => {
  // BR-001: loadSong no toca el transporte. Si ya suena, PlayControls aplica el código nuevo en
  // el siguiente compás; si está parado, solo arranca si quien envía pidió autoplay.
  const apply = (live: LiveSong) => {
    get().loadSong(live.song);
    set({ pendingLiveSong: null });
    if (live.autoplay && !get().isPlaying && songTracks(live.song.sections).length > 0) {
      get().setPlaying(true);
    }
  };

  return {
    liveConnection: "connecting",
    autoAcceptSentSongs: false,
    pendingLiveSong: null,

    setLiveConnection: (connection) => set({ liveConnection: connection }),
    setAutoAcceptSentSongs: (enabled) => set({ autoAcceptSentSongs: enabled }),

    receiveLiveSong: (live) => {
      const { autoAcceptSentSongs, isCodeManuallyEdited } = get();
      if (autoAcceptSentSongs && !isCodeManuallyEdited) {
        apply(live);
        return "loaded";
      }
      set({ pendingLiveSong: live });
      return "pending";
    },

    acceptLiveSong: () => {
      const pending = get().pendingLiveSong;
      if (pending) apply(pending);
    },

    dismissLiveSong: () => set({ pendingLiveSong: null }),
  };
};
