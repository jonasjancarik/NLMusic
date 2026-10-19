import type { Section, Song, Track } from '@lib/types';
import { MAX_BARS, MAX_REPEAT, MIN_BARS, MIN_REPEAT } from './constants';
import { findSection, replaceSectionTracks } from './song';

// Ediciones puras de una canción (CAP-NLM-015, TASK-25). Cada función devuelve una canción
// nueva y mantiene los invariantes de validateSong por construcción: ids únicos, al menos
// una sección y un bloque de arreglo, sin bloques huérfanos y `steps`/`velocity` con
// longitud stepsPerBar × bars. Si la edición no procede devuelven la misma canción.

/** Niveles de dinámica de un paso activo (AC-3 de TASK-25). */
export type VelocityLevel = 'ghost' | 'normal' | 'accent';

export const VELOCITY_LEVELS: Record<VelocityLevel, number> = { ghost: 0.35, normal: 0.7, accent: 1 };
export const VELOCITY_ORDER: VelocityLevel[] = ['ghost', 'normal', 'accent'];

/** Clasifica un valor 0–1. Sin `velocity` el paso suena a 1, es decir, acento. */
export function velocityLevel(value: number | undefined): VelocityLevel {
  if (value === undefined || value >= 0.85) return 'accent';
  return value >= 0.5 ? 'normal' : 'ghost';
}

/** Siguiente nivel en el ciclo fantasma → normal → acento → fantasma (`direction` −1 va hacia atrás). */
export function stepVelocityLevel(level: VelocityLevel, direction: 1 | -1 = 1): VelocityLevel {
  const next = (VELOCITY_ORDER.indexOf(level) + direction + VELOCITY_ORDER.length) % VELOCITY_ORDER.length;
  return VELOCITY_ORDER[next];
}

/** Fija el nivel de un paso activo. Un paso apagado no cambia (no hay nada que sonar). */
export function setStepVelocity(track: Track, stepIndex: number, level: VelocityLevel): Track {
  if (track.steps[stepIndex] !== 1) return track;
  const velocity = track.steps.map((_, index) => track.velocity?.[index] ?? 1);
  velocity[stepIndex] = VELOCITY_LEVELS[level];
  return { ...track, velocity };
}

/** Recorta o rellena con silencio una pista hasta `length` pasos, manteniendo `velocity` alineada. */
export function resizeTrack(track: Track, length: number): Track {
  if (track.steps.length === length) return track;
  const steps = Array.from({ length }, (_, index) => track.steps[index] ?? 0) as (0 | 1)[];
  const velocity = track.velocity ? Array.from({ length }, (_, index) => track.velocity?.[index] ?? 1) : undefined;
  const { velocity: _previous, ...rest } = track;
  return velocity ? { ...rest, steps, velocity } : { ...rest, steps };
}

function uniqueSectionId(song: Song): string {
  const used = new Set(song.sections.map((section) => section.id));
  let n = song.sections.length + 1;
  while (used.has(`section-${n}`)) n += 1;
  return `section-${n}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export interface SectionEditResult {
  song: Song;
  /** Sección creada, para que la UI pueda seleccionarla. */
  sectionId: string;
}

/**
 * Añade una sección de 1 compás al final de la canción y del arreglo. Conserva las pistas
 * (voces, volumen, params) de `templateSectionId` pero con los pasos vacíos, para empezar a
 * escribir el patrón sobre el mismo kit.
 */
export function addSection(song: Song, name: string, templateSectionId?: string): SectionEditResult {
  const template = (templateSectionId ? findSection(song, templateSectionId) : undefined) ?? song.sections[0];
  const sectionId = uniqueSectionId(song);
  const tracks = (template?.tracks ?? []).map((track) => {
    const { velocity: _velocity, ...rest } = resizeTrack(track, song.stepsPerBar * MIN_BARS);
    return { ...rest, steps: Array(song.stepsPerBar * MIN_BARS).fill(0) as (0 | 1)[] };
  });
  const section: Section = { id: sectionId, name: name.trim() || sectionId, bars: MIN_BARS, tracks };
  return {
    sectionId,
    song: {
      ...song,
      sections: [...song.sections, section],
      arrangement: [...song.arrangement, { sectionId, repeat: MIN_REPEAT }],
    },
  };
}

/** Copia una sección entera y coloca un bloque con la copia justo después del último uso del original. */
export function duplicateSection(song: Song, sectionId: string, name: string): SectionEditResult {
  const source = findSection(song, sectionId);
  if (!source) return { song, sectionId };
  const copyId = uniqueSectionId(song);
  const copy: Section = {
    ...source,
    id: copyId,
    name: name.trim() || copyId,
    tracks: source.tracks.map((track) => ({
      ...track,
      steps: [...track.steps],
      ...(track.velocity ? { velocity: [...track.velocity] } : {}),
    })),
  };
  const sourceIndex = song.sections.findIndex((section) => section.id === sectionId);
  const sections = [...song.sections.slice(0, sourceIndex + 1), copy, ...song.sections.slice(sourceIndex + 1)];
  const lastUse = song.arrangement.map((item) => item.sectionId).lastIndexOf(sectionId);
  const insertAt = lastUse === -1 ? song.arrangement.length : lastUse + 1;
  const arrangement = [
    ...song.arrangement.slice(0, insertAt),
    { sectionId: copyId, repeat: MIN_REPEAT },
    ...song.arrangement.slice(insertAt),
  ];
  return { song: { ...song, sections, arrangement }, sectionId: copyId };
}

export function renameSection(song: Song, sectionId: string, name: string): Song {
  const trimmed = name.trim();
  if (!trimmed || !findSection(song, sectionId)) return song;
  return { ...song, sections: song.sections.map((s) => (s.id === sectionId ? { ...s, name: trimmed } : s)) };
}

/**
 * Elimina una sección y todos sus bloques del arreglo (BR-007: destructivo, sin deshacer).
 * Devuelve la misma canción si es la única sección. Si el arreglo se quedaría vacío (las demás
 * secciones no estaban en él), añade la primera sección que queda para que la canción siga sonando.
 */
export function removeSection(song: Song, sectionId: string): Song {
  if (song.sections.length <= 1 || !findSection(song, sectionId)) return song;
  const sections = song.sections.filter((section) => section.id !== sectionId);
  let arrangement = song.arrangement.filter((item) => item.sectionId !== sectionId);
  if (arrangement.length === 0) arrangement = [{ sectionId: sections[0].id, repeat: MIN_REPEAT }];
  return { ...song, sections, arrangement };
}

/** Cambia la duración de una sección en compases y ajusta los pasos de todas sus pistas. */
export function setSectionBars(song: Song, sectionId: string, bars: number): Song {
  const section = findSection(song, sectionId);
  if (!section) return song;
  const next = clamp(bars, MIN_BARS, MAX_BARS);
  if (next === section.bars) return song;
  const length = song.stepsPerBar * next;
  return {
    ...song,
    sections: song.sections.map((s) =>
      s.id === sectionId ? { ...s, bars: next, tracks: s.tracks.map((track) => resizeTrack(track, length)) } : s,
    ),
  };
}

export function addArrangementItem(song: Song, sectionId: string): Song {
  if (!findSection(song, sectionId)) return song;
  return { ...song, arrangement: [...song.arrangement, { sectionId, repeat: MIN_REPEAT }] };
}

/** Quita un bloque del arreglo. El último bloque no se puede quitar: una canción sin arreglo no suena. */
export function removeArrangementItem(song: Song, index: number): Song {
  if (song.arrangement.length <= 1 || index < 0 || index >= song.arrangement.length) return song;
  return { ...song, arrangement: song.arrangement.filter((_, i) => i !== index) };
}

export function moveArrangementItem(song: Song, from: number, to: number): Song {
  const { length } = song.arrangement;
  if (from === to || from < 0 || to < 0 || from >= length || to >= length) return song;
  const arrangement = [...song.arrangement];
  const [item] = arrangement.splice(from, 1);
  arrangement.splice(to, 0, item);
  return { ...song, arrangement };
}

export function setArrangementRepeat(song: Song, index: number, repeat: number): Song {
  const item = song.arrangement[index];
  if (!item) return song;
  const next = clamp(repeat, MIN_REPEAT, MAX_REPEAT);
  if (next === item.repeat) return song;
  return { ...song, arrangement: song.arrangement.map((it, i) => (i === index ? { ...it, repeat: next } : it)) };
}

export function setArrangementSection(song: Song, index: number, sectionId: string): Song {
  const item = song.arrangement[index];
  if (!item || item.sectionId === sectionId || !findSection(song, sectionId)) return song;
  return { ...song, arrangement: song.arrangement.map((it, i) => (i === index ? { ...it, sectionId } : it)) };
}

/** Atajo para reemplazar las pistas de una sección ajustando su longitud al compás de la sección. */
export function fitTracksToSection(song: Song, sectionId: string, tracks: Track[]): Song {
  const section = findSection(song, sectionId);
  if (!section) return song;
  const length = song.stepsPerBar * section.bars;
  return replaceSectionTracks(song, sectionId, tracks.map((track) => resizeTrack(track, length)));
}
