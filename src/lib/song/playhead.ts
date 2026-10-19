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

/**
 * Con `.slow(4).cpm(bpm)` (ver compileSong) un ciclo del reloj de Strudel es una negra,
 * así que un compás 4/4 son 4 ciclos.
 */
export const CYCLES_PER_BAR = 4;

/** Convierte el tiempo del scheduler de Strudel (en ciclos) en compases desde el inicio del arreglo. */
export function cyclesToBars(cycles: number): number {
  return cycles / CYCLES_PER_BAR;
}

/**
 * Milisegundos hasta el siguiente cambio de compás, restando `leadMs` para que el código
 * nuevo ya esté evaluado cuando Strudel consulte el compás siguiente (BR-001: se cambia el
 * patrón sin parar el reloj). Devuelve 0 si ya no da tiempo; el cambio entra entonces en el
 * compás que siga.
 */
export function msUntilNextBar(timeCycles: number, bpm: number, leadMs = 150): number {
  if (!Number.isFinite(timeCycles) || timeCycles <= 0 || bpm <= 0) return 0;
  const intoBar = timeCycles % CYCLES_PER_BAR;
  const remainingCycles = intoBar === 0 ? 0 : CYCLES_PER_BAR - intoBar;
  const ms = remainingCycles * (60000 / bpm) - leadMs;
  return ms > 0 ? ms : 0;
}
