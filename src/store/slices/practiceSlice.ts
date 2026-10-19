import type { StateCreator } from "zustand";
import {
  DEFAULT_METRONOME_VOLUME,
  DEFAULT_TEMPO_TRAINER,
  isDropPart,
  normalizeTempoTrainer,
  type CountInBars,
  type DropPart,
  type MetronomeMode,
  type TempoTrainerConfig,
} from "@lib/practice";
import type { SessionStore } from "../sessionStore";

/**
 * TASK-30: herramientas de práctica. Las preferencias (cuenta atrás, metrónomo, entrenador)
 * se guardan; el bucle, las partes quitadas y el estado de la sesión de práctica son
 * efímeros y nunca forman parte de la canción (ni de su MIDI).
 */
export type PracticeSlice = {
  // --- Preferencias persistidas ---
  countInBars: CountInBars;
  metronomeMode: MetronomeMode;
  metronomeVolume: number;
  tempoTrainer: TempoTrainerConfig;
  setCountInBars: (bars: CountInBars) => void;
  setMetronomeMode: (mode: MetronomeMode) => void;
  setMetronomeVolume: (volume: number) => void;
  setTempoTrainer: (patch: Partial<TempoTrainerConfig>) => void;

  // --- Estado efímero ---
  /** Sección que se repite en bucle (null = canción completa). */
  loopSectionId: string | null;
  droppedParts: DropPart[];
  /** BPM del entrenador mientras suena (null = el de la canción). */
  practiceBpm: number | null;
  /** Desplazamiento de la posición en compases (ver `Timeline`). */
  practicePhaseBars: number;
  /** Compases de cuenta atrás de la reproducción en curso (fijos hasta parar). */
  practiceCountInBars: CountInBars;
  setLoopSection: (sectionId: string | null) => void;
  toggleDroppedPart: (part: DropPart) => void;
  clearDroppedParts: () => void;
  beginPractice: () => void;
  endPractice: () => void;
  /** Cambio de tempo y/o de fase de la reproducción en curso, a la vez. */
  retimePractice: (patch: { bpm?: number | null; phaseBars?: number; loopSectionId?: string | null }) => void;
};

const clampVolume = (volume: number) =>
  Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_METRONOME_VOLUME;

export const createPracticeSlice: StateCreator<
  SessionStore,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  PracticeSlice
> = (set, get) => ({
  countInBars: 0,
  metronomeMode: "off",
  metronomeVolume: DEFAULT_METRONOME_VOLUME,
  tempoTrainer: DEFAULT_TEMPO_TRAINER,
  loopSectionId: null,
  droppedParts: [],
  practiceBpm: null,
  practicePhaseBars: 0,
  practiceCountInBars: 0,

  setCountInBars: (bars) => set({ countInBars: bars }),
  setMetronomeMode: (mode) => set({ metronomeMode: mode }),
  setMetronomeVolume: (volume) => set({ metronomeVolume: clampVolume(volume) }),
  setTempoTrainer: (patch) => set((state) => ({ tempoTrainer: normalizeTempoTrainer({ ...state.tempoTrainer, ...patch }) })),

  // BR-001: solo cambian datos de reproducción; el transporte decide cuándo entran (siguiente compás).
  setLoopSection: (sectionId) => set({ loopSectionId: sectionId }),
  toggleDroppedPart: (part) =>
    set((state) => ({
      droppedParts:
        isDropPart(part) && state.droppedParts.includes(part)
          ? state.droppedParts.filter((p) => p !== part)
          : [...state.droppedParts, part],
    })),
  clearDroppedParts: () => set({ droppedParts: [] }),

  beginPractice: () => {
    const { tempoTrainer, countInBars } = get();
    set({
      practiceBpm: tempoTrainer.enabled ? tempoTrainer.startBpm : null,
      practicePhaseBars: 0,
      practiceCountInBars: countInBars,
    });
  },
  endPractice: () => set({ practiceBpm: null, practicePhaseBars: 0, practiceCountInBars: 0 }),

  retimePractice: (patch) =>
    set((state) => ({
      practiceBpm: patch.bpm === undefined ? state.practiceBpm : patch.bpm,
      practicePhaseBars: patch.phaseBars ?? state.practicePhaseBars,
      loopSectionId: patch.loopSectionId === undefined ? state.loopSectionId : patch.loopSectionId,
    })),
});
