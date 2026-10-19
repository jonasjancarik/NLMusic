/**
 * Clics de práctica (TASK-30 AC-2, AC-3): patrones Strudel de un compás (1 ciclo = 1 compás
 * antes del `.slow(4)`) con sonidos propios de sintetizador. No son pistas de la canción:
 * solo existen en el código que se manda a reproducir, nunca en `Song`, así que la
 * exportación MIDI no los ve.
 */
export type MetronomeMode = 'off' | 'quarter' | 'eighth';
export type CountInBars = 0 | 1 | 2;

export const METRONOME_MODES: readonly MetronomeMode[] = ['off', 'quarter', 'eighth'];
export const COUNT_IN_OPTIONS: readonly CountInBars[] = [0, 1, 2];
export const DEFAULT_METRONOME_VOLUME = 0.5;

const clampVolume = (volume: number) => (Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_METRONOME_VOLUME);
// Los sintetizadores suenan fuerte frente a las muestras de batería: escala el volumen de 0–1.
const gainOf = (volume: number) => (clampVolume(volume) * 0.6).toFixed(2);

/** Metrónomo de un compás: negras o corcheas, con el primer tiempo más agudo. */
export function metronomePattern(mode: Exclude<MetronomeMode, 'off'>, volume: number): string {
  const notes = mode === 'quarter' ? 'c6 g5 g5 g5' : 'c6 g5 g5 g5 g5 g5 g5 g5';
  return `note("${notes}").s("triangle").decay(0.05).sustain(0).gain(${gainOf(volume)})`;
}

/** Clic de la cuenta atrás: un compás de negras con un timbre distinto al del metrónomo. */
export function countInPattern(volume: number): string {
  return `note("e6 c6 c6 c6").s("square").decay(0.03).sustain(0).lpf(3500).gain(${gainOf(volume)})`;
}
