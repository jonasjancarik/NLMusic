import { buildPlayCode, isPlainPlayback, type PracticePlan, type Timeline } from "@lib/practice";
import { selectSong } from "./helpers";
import type { SessionStore } from "./sessionStore";

/** BPM con el que suena ahora: el del entrenador de tempo o, si no hay, el de la canción. */
export function effectiveBpm(state: Pick<SessionStore, "bpm" | "practiceBpm">): number {
  return state.practiceBpm ?? state.bpm;
}

/** Línea de tiempo (BPM y fase) del código de práctica actual. */
export function selectTimeline(state: Pick<SessionStore, "bpm" | "practiceBpm" | "practicePhaseBars">): Timeline {
  return { bpm: effectiveBpm(state), phaseBars: state.practicePhaseBars };
}

export function selectPracticePlan(state: SessionStore): PracticePlan {
  return {
    bpm: effectiveBpm(state),
    loopSectionId: state.loopSectionId,
    droppedParts: state.droppedParts,
    metronome: { mode: state.metronomeMode, volume: state.metronomeVolume },
    countInBars: state.practiceCountInBars,
    phaseBars: state.practicePhaseBars,
  };
}

/**
 * Código que se manda a Strudel. Sin nada de práctica activo es exactamente `currentCode`;
 * con práctica, es la canción compilada con bucle, partes quitadas, clics y tempo del
 * entrenador. `currentCode` y la canción guardada no cambian (BR-008, BR-009).
 * En modo código (edición manual) se reproduce el código tal cual.
 * @see TASK-30
 */
export function selectPlayCode(state: SessionStore): string {
  if (state.isCodeManuallyEdited) return state.currentCode;
  const plan = selectPracticePlan(state);
  if (isPlainPlayback(plan, state.bpm)) return state.currentCode;
  return buildPlayCode(selectSong(state), plan);
}
