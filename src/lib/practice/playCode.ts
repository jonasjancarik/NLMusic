import type { Song } from '@lib/types';
import { compileSong } from '../song/compileSong';
import { countInPattern, metronomePattern, type CountInBars, type MetronomeMode } from './click';
import { buildPracticeSong, practiceLoopBars, type DropPart } from './practiceSong';

/** Vueltas que dura el tramo principal tras la cuenta atrás (horas de práctica seguidas). */
const MAIN_LOOPS = 1000;

export interface PracticePlan {
  /** BPM con el que suena (entrenador de tempo). */
  bpm: number;
  loopSectionId?: string | null;
  droppedParts?: readonly DropPart[];
  metronome?: { mode: MetronomeMode; volume: number };
  countInBars?: CountInBars;
  /** Desplazamiento de la posición (compases); ver `Timeline`. */
  phaseBars?: number;
}

/** ¿Hace falta algo distinto del código normal de la canción? */
export function isPlainPlayback(plan: PracticePlan, songBpm: number): boolean {
  return (
    !plan.loopSectionId &&
    (plan.droppedParts?.length ?? 0) === 0 &&
    (plan.metronome?.mode ?? 'off') === 'off' &&
    !plan.countInBars &&
    !plan.phaseBars &&
    plan.bpm === songBpm
  );
}

/**
 * Código Strudel que se reproduce durante la práctica. Parte de `compileSong` de la canción
 * de práctica (bucle de sección, partes quitadas, BPM del entrenador) y le añade, solo para
 * sonar, el metrónomo y la cuenta atrás.
 *
 * La cuenta atrás es un tramo inicial del propio patrón (`arrange`): N compases de clic y
 * después la canción, así el reloj de Strudel no se toca y los cambios posteriores de
 * código (BR-001) mantienen la fase.
 * @see TASK-30
 */
export function buildPlayCode(song: Song, plan: PracticePlan): string {
  const practiceSong = buildPracticeSong(song, {
    loopSectionId: plan.loopSectionId,
    droppedParts: plan.droppedParts,
    bpm: plan.bpm,
  });
  const metronome = plan.metronome ?? { mode: 'off' as const, volume: 0 };
  const countIn = plan.countInBars ?? 0;
  const loopBars = Math.max(1, practiceLoopBars(song, plan.loopSectionId));

  const wrap = (body: string): string => {
    const main =
      metronome.mode === 'off' ? body : `stack(${body}, ${metronomePattern(metronome.mode, metronome.volume)})`;
    if (countIn <= 0) return main;
    return `arrange(\n  [${countIn}, ${countInPattern(metronome.volume || 0.5)}],\n  [${loopBars * MAIN_LOOPS}, ${main}]\n)`;
  };

  return compileSong(practiceSong, { wrap, phaseBars: plan.phaseBars });
}
