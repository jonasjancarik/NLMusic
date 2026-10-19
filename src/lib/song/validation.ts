import { z } from 'zod';
import type { Song } from '@lib/types';
import { trackParamsSchema } from '@lib/llm/validation';
import {
  MAX_BARS,
  MAX_BPM,
  MAX_REPEAT,
  MAX_TRACKS_PER_SECTION,
  MIN_BARS,
  MIN_BPM,
  MIN_REPEAT,
} from './constants';

/**
 * Error de validación de una canción. `message` ya incluye dónde está el problema
 * (sección, pista, campo) y qué se esperaba, para que el LLM (TASK-27) y el MCP
 * (TASK-28) puedan corregir su salida sin adivinar.
 */
export interface SongValidationError {
  /** Ruta tipo JSON, p. ej. `sections[1].tracks[0].steps` */
  path: string;
  sectionId?: string;
  trackId?: string;
  message: string;
}

export type SongValidationResult =
  | { ok: true; song: Song; errors: [] }
  | { ok: false; errors: SongValidationError[] };

const songTrackSchema = z.object({
  id: z.string().min(1, 'id must be a non-empty string'),
  name: z.string().min(1, 'name must be a non-empty string'),
  tag: z.string().min(1).optional(),
  sample: z.string().min(1).optional(),
  // Length is checked against stepsPerBar × bars below, with a clearer message.
  steps: z.array(z.union([z.literal(0), z.literal(1)], 'each step must be 0 or 1')),
  velocity: z
    .array(
      z
        .number('each velocity must be a number between 0 and 1')
        .min(0, 'velocity values must be between 0 and 1')
        .max(1, 'velocity values must be between 0 and 1'),
    )
    .optional(),
  volume: z.number().min(0, 'volume must be between 0 and 1').max(1, 'volume must be between 0 and 1'),
  muted: z.boolean(),
  solo: z.boolean(),
  params: trackParamsSchema.optional(),
});

const sectionSchema = z.object({
  id: z.string().min(1, 'section id must be a non-empty string'),
  name: z.string().min(1, 'section name must be a non-empty string'),
  bars: z
    .number()
    .int(`bars must be a whole number from ${MIN_BARS} to ${MAX_BARS}`)
    .min(MIN_BARS, `bars must be from ${MIN_BARS} to ${MAX_BARS}`)
    .max(MAX_BARS, `bars must be from ${MIN_BARS} to ${MAX_BARS}`),
  // The per-section limit is checked below so the message can name the section.
  tracks: z.array(songTrackSchema),
});

const arrangementItemSchema = z.object({
  sectionId: z.string().min(1, 'sectionId must be a non-empty string'),
  repeat: z
    .number()
    .int(`repeat must be a whole number from ${MIN_REPEAT} to ${MAX_REPEAT}`)
    .min(MIN_REPEAT, `repeat must be from ${MIN_REPEAT} to ${MAX_REPEAT}`)
    .max(MAX_REPEAT, `repeat must be from ${MIN_REPEAT} to ${MAX_REPEAT}`),
});

export const songSchema = z.object({
  bpm: z
    .number()
    .int(`bpm must be a whole number from ${MIN_BPM} to ${MAX_BPM}`)
    .min(MIN_BPM, `bpm must be from ${MIN_BPM} to ${MAX_BPM}`)
    .max(MAX_BPM, `bpm must be from ${MIN_BPM} to ${MAX_BPM}`),
  stepsPerBar: z.union([z.literal(16), z.literal(12)], 'stepsPerBar must be 16 or 12'),
  sections: z.array(sectionSchema).min(1, 'a song needs at least one section'),
  arrangement: z.array(arrangementItemSchema).min(1, 'the arrangement needs at least one item'),
});

type PathSegment = PropertyKey;

function formatPath(path: readonly PathSegment[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc ? `${acc}.${String(segment)}` : String(segment);
  }, '');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function idAt(list: unknown, index: PathSegment | undefined): string | undefined {
  if (!Array.isArray(list) || typeof index !== 'number') return undefined;
  const id = asRecord(list[index])?.id;
  return typeof id === 'string' && id ? id : undefined;
}

/** "Section "verse" › track "kick"" (o con índice si falta el id) para prefijar mensajes. */
function describeLocation(input: unknown, path: readonly PathSegment[]): {
  label: string;
  sectionId?: string;
  trackId?: string;
  field: string;
} {
  const root = asRecord(input);
  if (path[0] === 'sections' && typeof path[1] === 'number') {
    const sections = root?.sections;
    const sectionId = idAt(sections, path[1]);
    let label = sectionId ? `Section "${sectionId}"` : `Section #${path[1] + 1}`;
    let trackId: string | undefined;
    let rest = path.slice(2);
    if (path[2] === 'tracks' && typeof path[3] === 'number') {
      const tracks = Array.isArray(sections) ? asRecord(sections[path[1]])?.tracks : undefined;
      trackId = idAt(tracks, path[3]);
      label += trackId ? ` › track "${trackId}"` : ` › track #${path[3] + 1}`;
      rest = path.slice(4);
    }
    return { label, sectionId, trackId, field: formatPath(rest) };
  }
  if (path[0] === 'arrangement' && typeof path[1] === 'number') {
    return { label: `Arrangement item #${path[1] + 1}`, field: formatPath(path.slice(2)) };
  }
  return { label: 'Song', field: formatPath(path) };
}

function makeError(input: unknown, path: readonly PathSegment[], problem: string): SongValidationError {
  const { label, sectionId, trackId, field } = describeLocation(input, path);
  return {
    path: formatPath(path),
    ...(sectionId ? { sectionId } : {}),
    ...(trackId ? { trackId } : {}),
    message: `${label}${field ? ` › ${field}` : ''}: ${problem}`,
  };
}

function findDuplicates(ids: string[]): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  ids.forEach((id, index) => positions.set(id, [...(positions.get(id) ?? []), index]));
  return new Map([...positions].filter(([, indexes]) => indexes.length > 1));
}

/**
 * Valida una canción completa (estructura + reglas entre campos) y devuelve todos los
 * errores encontrados, no solo el primero.
 *
 * Reglas además del esquema:
 * - `steps.length === stepsPerBar * bars` y `velocity` (si existe) de la misma longitud
 * - ids de sección únicos; ids de pista únicos dentro de cada sección
 * - como mucho MAX_TRACKS_PER_SECTION pistas por sección (BR-006)
 * - cada bloque del arreglo apunta a una sección existente
 *
 * @see CAP-NLM-015
 * @see BR-006
 */
export function validateSong(input: unknown): SongValidationResult {
  const parsed = songSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => makeError(input, issue.path, issue.message)),
    };
  }

  const song = parsed.data as Song;
  const errors: SongValidationError[] = [];

  for (const [id, indexes] of findDuplicates(song.sections.map((section) => section.id))) {
    errors.push(
      makeError(song, ['sections', indexes[1]], `section id "${id}" is used by ${indexes.length} sections; section ids must be unique`),
    );
  }

  song.sections.forEach((section, sectionIndex) => {
    const expectedSteps = song.stepsPerBar * section.bars;

    if (section.tracks.length > MAX_TRACKS_PER_SECTION) {
      errors.push(
        makeError(
          song,
          ['sections', sectionIndex, 'tracks'],
          `has ${section.tracks.length} tracks; the limit is ${MAX_TRACKS_PER_SECTION} per section (BR-006)`,
        ),
      );
    }

    for (const [id, indexes] of findDuplicates(section.tracks.map((track) => track.id))) {
      errors.push(
        makeError(
          song,
          ['sections', sectionIndex, 'tracks', indexes[1]],
          `track id "${id}" appears ${indexes.length} times in this section; track ids must be unique within a section`,
        ),
      );
    }

    section.tracks.forEach((track, trackIndex) => {
      const base = ['sections', sectionIndex, 'tracks', trackIndex];
      if (track.steps.length !== expectedSteps) {
        errors.push(
          makeError(
            song,
            [...base, 'steps'],
            `has ${track.steps.length} steps but must have ${expectedSteps} (stepsPerBar ${song.stepsPerBar} × ${section.bars} bars)`,
          ),
        );
      }
      if (track.velocity && track.velocity.length !== track.steps.length) {
        errors.push(
          makeError(
            song,
            [...base, 'velocity'],
            `has ${track.velocity.length} values but must have one per step (${track.steps.length})`,
          ),
        );
      }
    });
  });

  const sectionIds = song.sections.map((section) => section.id);
  song.arrangement.forEach((item, index) => {
    if (!sectionIds.includes(item.sectionId)) {
      errors.push(
        makeError(
          song,
          ['arrangement', index, 'sectionId'],
          `section "${item.sectionId}" does not exist; available sections: ${sectionIds.map((id) => `"${id}"`).join(', ')}`,
        ),
      );
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, song, errors: [] };
}
