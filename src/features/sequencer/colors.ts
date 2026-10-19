import type { Track } from '@lib/types';

/**
 * Colores de la interfaz para voces de batería y secciones. Solo presentación: el modelo de
 * canción no guarda colores.
 */

const VOICE_COLORS: Record<string, string> = {
  bd: '#00ffc8',
  sd: '#ffaa00',
  rim: '#ffd166',
  cp: '#ff6fae',
  hh: '#b482ff',
  oh: '#d6b8ff',
  rd: '#4cc9ff',
  cr: '#8fe3ff',
  lt: '#ff7a59',
  mt: '#ff9474',
  ht: '#ffb199',
};

const TAG_COLORS: Record<string, string> = {
  kick: VOICE_COLORS.bd,
  snare: VOICE_COLORS.sd,
  hihat: VOICE_COLORS.hh,
  clap: VOICE_COLORS.cp,
};

const FALLBACK = '#9aa4b2';

/** Color de una pista: por su sample de batería y, si no lo tiene, por su etiqueta. */
export function trackColor(track: Pick<Track, 'sample' | 'tag'>): string {
  return (track.sample && VOICE_COLORS[track.sample]) || (track.tag && TAG_COLORS[track.tag]) || FALLBACK;
}

const SECTION_COLORS = ['#00ffc8', '#b482ff', '#ffaa00', '#ff6fae', '#4cc9ff', '#a3e635', '#ff7a59', '#f5f5f5'];

/** Color estable de una sección según su posición en la lista de secciones. */
export function sectionColor(index: number): string {
  return SECTION_COLORS[((index % SECTION_COLORS.length) + SECTION_COLORS.length) % SECTION_COLORS.length];
}

/** `#rrggbb` → `rgba(r,g,b,alpha)` para fondos y bordes translúcidos. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
