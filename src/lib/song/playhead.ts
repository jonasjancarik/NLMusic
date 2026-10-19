import type { Song } from '@lib/types';
import { findSection } from './song';

export interface PlayheadPosition {
  /** Índice del bloque del arreglo que suena. */
  itemIndex: number;
  sectionId: string;
  /** Compás dentro de la sección (0-based). */
  barInSection: number;
  /** Compás dentro de la vuelta completa del arreglo (0-based). */
  barInSong: number;
  /** Paso dentro del compás (0-based). */
  stepInBar: number;
}

/**
 * Convierte una posición en compases (fraccionaria, desde el inicio del arreglo) en el
 * bloque, sección, compás y paso que están sonando. El arreglo se repite en bucle.
 * Devuelve null si la canción no tiene compases.
 * @see CAP-NLM-015
 */
export function locatePlayhead(song: Song, bars: number): PlayheadPosition | null {
  const blocks = song.arrangement
    .map((item, itemIndex) => ({ item, itemIndex, section: findSection(song, item.sectionId) }))
    .filter((block) => block.section !== undefined);
  const total = blocks.reduce((sum, { item, section }) => sum + item.repeat * (section?.bars ?? 0), 0);
  if (total <= 0 || !Number.isFinite(bars)) return null;

  const looped = ((bars % total) + total) % total;
  const barInSong = Math.floor(looped);
  const stepInBar = Math.floor((looped - barInSong) * song.stepsPerBar);

  let start = 0;
  for (const { item, itemIndex, section } of blocks) {
    const length = item.repeat * (section?.bars ?? 0);
    if (barInSong < start + length) {
      return {
        itemIndex,
        sectionId: item.sectionId,
        barInSection: (barInSong - start) % (section?.bars ?? 1),
        barInSong,
        stepInBar,
      };
    }
    start += length;
  }
  return null;
}

/** Ciclos por segundo por defecto del scheduler de Strudel. */
export const DEFAULT_CPS = 0.5;

/**
 * Ciclos por segundo reales del scheduler (`getCps` global de Strudel si existe).
 * La canción compilada es `….slow(4).cpm(bpm)`: el scheduler siempre corre a su cps y
 * el BPM se aplica acelerando el patrón, así que el tiempo del scheduler solo se
 * convierte en compases conociendo el BPM y el cps.
 */
export function schedulerCps(): number {
  const getCps = (globalThis as { getCps?: () => number }).getCps;
  const value = typeof getCps === 'function' ? getCps() : DEFAULT_CPS;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_CPS;
}

/**
 * Convierte el tiempo del scheduler de Strudel (en ciclos) en compases 4/4 desde el inicio
 * del arreglo: el patrón va `bpm / 60 / cps` veces más rápido que el reloj y un compás
 * son 4 ciclos del patrón lento.
 */
export function cyclesToBars(cycles: number, bpm: number, cps: number = DEFAULT_CPS): number {
  return (cycles * bpm) / (240 * cps);
}

/**
 * Milisegundos hasta el siguiente cambio de compás, restando `leadMs` para que el código
 * nuevo ya esté evaluado cuando Strudel consulte el compás siguiente (BR-001: se cambia el
 * patrón sin parar el reloj). Devuelve 0 si no se conoce la posición o ya no da tiempo; el
 * cambio entra entonces en cuanto se evalúa.
 * @param barPosition - compases desde el inicio del arreglo (ver cyclesToBars)
 */
export function msUntilNextBar(barPosition: number, bpm: number, leadMs = 150): number {
  if (!Number.isFinite(barPosition) || barPosition <= 0 || bpm <= 0) return 0;
  const intoBar = barPosition % 1;
  const remaining = intoBar === 0 ? 0 : 1 - intoBar;
  const ms = remaining * (240000 / bpm) - leadMs;
  return ms > 0 ? ms : 0;
}
