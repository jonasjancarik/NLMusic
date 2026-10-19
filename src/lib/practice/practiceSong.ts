import type { Song, Track } from '@lib/types';
import { findSection, totalBars } from '../song/song';
import { getDrumVoice } from '../song/drumVoices';

/**
 * Partes de la batería que se pueden quitar para tocarlas uno mismo (TASK-30 AC-5).
 * Se resuelven por la etiqueta (`tag`) de la voz de batería de cada pista.
 */
export const DROP_PARTS = ['kick', 'snare', 'hihat'] as const;
export type DropPart = (typeof DROP_PARTS)[number];

export function isDropPart(value: string): value is DropPart {
  return (DROP_PARTS as readonly string[]).includes(value);
}

/** Parte de batería a la que pertenece una pista, o undefined si no es kick/snare/hi-hat. */
export function trackDropPart(track: Pick<Track, 'sample'>): DropPart | undefined {
  const tag = getDrumVoice(track.sample ?? '')?.tag;
  return tag !== undefined && isDropPart(tag) ? tag : undefined;
}

export interface PracticeSongOptions {
  /** Sección que se repite en bucle; null/ausente o inexistente = canción completa. */
  loopSectionId?: string | null;
  /** Partes silenciadas solo en la reproducción (no cambian `steps` ni se guardan). */
  droppedParts?: readonly DropPart[];
  /** BPM con el que suena (entrenador de tempo); por defecto, el de la canción. */
  bpm?: number;
}

/**
 * Canción tal y como se va a reproducir en la práctica: una copia de la canción con el
 * arreglo reducido a la sección en bucle, las partes quitadas silenciadas y el BPM del
 * entrenador. No modifica la canción original (que es la que se guarda y se exporta a MIDI).
 */
export function buildPracticeSong(song: Song, options: PracticeSongOptions = {}): Song {
  const { loopSectionId, droppedParts = [], bpm } = options;
  const dropped = new Set<DropPart>(droppedParts);
  const looped = loopSectionId ? findSection(song, loopSectionId) : undefined;

  return {
    ...song,
    bpm: bpm ?? song.bpm,
    arrangement: looped ? [{ sectionId: looped.id, repeat: 1 }] : song.arrangement,
    sections:
      dropped.size === 0
        ? song.sections
        : song.sections.map((section) => ({
            ...section,
            tracks: section.tracks.map((track) => {
              const part = trackDropPart(track);
              return part && dropped.has(part) ? { ...track, muted: true } : track;
            }),
          })),
  };
}

/** Compases que dura una vuelta de lo que suena: la sección en bucle o la canción completa. */
export function practiceLoopBars(song: Song, loopSectionId?: string | null): number {
  const looped = loopSectionId ? findSection(song, loopSectionId) : undefined;
  return looped ? looped.bars : totalBars(song);
}

/** Compás (0-based) del arreglo en el que empieza por primera vez una sección, o 0 si no aparece. */
/** Compás (desde 0) en el que empieza el bloque `index` del arreglo. */
export function arrangementItemStartBar(song: Song, index: number): number {
  let start = 0;
  for (const item of song.arrangement.slice(0, Math.max(0, index))) {
    const section = findSection(song, item.sectionId);
    if (section) start += section.bars * item.repeat;
  }
  return start;
}

export function sectionStartBar(song: Song, sectionId: string): number {
  let start = 0;
  for (const item of song.arrangement) {
    const section = findSection(song, item.sectionId);
    if (!section) continue;
    if (item.sectionId === sectionId) return start;
    start += section.bars * item.repeat;
  }
  return 0;
}
