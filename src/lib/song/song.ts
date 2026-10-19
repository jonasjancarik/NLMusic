import type { Section, Song, Track } from '@lib/types';
import { DEFAULT_SECTION_ID, DEFAULT_SECTION_NAME } from './constants';

/**
 * Convierte un patrón de un compás (formato anterior a TASK-24) en una canción
 * con una sola sección `main` de 1 compás que se repite. Suena igual que antes.
 * @see CAP-NLM-015
 */
export function patternToSong(pattern: { bpm: number; tracks: Track[] }): Song {
  return {
    bpm: pattern.bpm,
    stepsPerBar: 16,
    sections: [{ id: DEFAULT_SECTION_ID, name: DEFAULT_SECTION_NAME, bars: 1, tracks: pattern.tracks }],
    arrangement: [{ sectionId: DEFAULT_SECTION_ID, repeat: 1 }],
  };
}

export function findSection(song: Song, sectionId: string): Section | undefined {
  return song.sections.find((section) => section.id === sectionId);
}

/** Devuelve una canción nueva con las pistas de una sección sustituidas. */
export function replaceSectionTracks(song: Song, sectionId: string, tracks: Track[]): Song {
  return {
    ...song,
    sections: song.sections.map((section) => (section.id === sectionId ? { ...section, tracks } : section)),
  };
}

/** Número de compases que dura una vuelta completa del arreglo. */
export function totalBars(song: Song): number {
  return song.arrangement.reduce((sum, item) => {
    const section = findSection(song, item.sectionId);
    return sum + (section ? section.bars * item.repeat : 0);
  }, 0);
}

/**
 * Mantiene `velocity` coherente con `steps`: un paso que se activa con velocity 0
 * (valor residual de cuando estaba apagado) pasa a 1 para que no quede mudo.
 * Sin `velocity` no hace nada.
 */
export function reconcileVelocity(steps: (0 | 1)[], velocity: number[] | undefined): number[] | undefined {
  if (!velocity) return undefined;
  return steps.map((step, index) => {
    const value = velocity[index] ?? 1;
    return step === 1 && value === 0 ? 1 : value;
  });
}
