import { cyclesToBars } from '../song/playhead';

/**
 * Línea de tiempo de la reproducción: posición en compases (desde el inicio del arreglo)
 * en función del reloj del scheduler de Strudel:
 *   posición(t) = cyclesToBars(t, bpm, cps) + phaseBars
 * Cambiar de BPM o saltar a otra parte cambia `bpm` y `phaseBars`; calcularlos con
 * `retime` en un límite de compás mantiene el cambio exacto en ese compás (BR-001: el reloj
 * del scheduler nunca se toca, solo el patrón que se evalúa).
 * @see TASK-30 AC-1, AC-4
 */
export interface Timeline {
  bpm: number;
  phaseBars: number;
}

const EPSILON = 1e-6;

export function barsAt(timeline: Timeline, cycles: number, cps: number): number {
  return cyclesToBars(cycles, timeline.bpm, cps) + timeline.phaseBars;
}

/**
 * Siguiente límite de compás de la línea de tiempo actual: su número de compás (entero) y
 * el tiempo del scheduler (ciclos) en el que ocurre. Si ya estamos justo en un límite, es ese.
 */
export function nextBarBoundary(
  timeline: Timeline,
  cycles: number,
  cps: number,
): { bar: number; cycles: number } {
  const bar = Math.ceil(barsAt(timeline, cycles, cps) - EPSILON);
  return { bar, cycles: ((bar - timeline.phaseBars) * 240 * cps) / timeline.bpm };
}

/**
 * Línea de tiempo nueva con `bpm` que, en el instante `atCycles` del scheduler, está en el
 * compás `targetBar`. Con `targetBar` igual al compás actual en ese instante, el cambio de
 * tempo es continuo; con otro valor, además salta a esa parte de la canción.
 */
export function retimeAt(bpm: number, atCycles: number, cps: number, targetBar: number): Timeline {
  return { bpm, phaseBars: targetBar - cyclesToBars(atCycles, bpm, cps) };
}
