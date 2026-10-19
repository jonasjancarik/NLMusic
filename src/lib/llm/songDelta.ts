import { z } from 'zod';
import type { ArrangementItem, PatternOperation, Section, Song, StepsPerBar, Track } from '@lib/types';
import { findSection, getDrumVoice, isDrumVoiceId, parseStepString } from '@lib/song';
import { trackParamsSchema } from './validation';
import { applyDelta } from './applyDelta';

/**
 * Delta de canción devuelto por el LLM (TASK-27 AC-2). El texto que lo explica al modelo
 * está en `prompts/songContract.ts`.
 *
 * Las pistas llegan con `steps` en notación compacta ("x...X.g.") o como array 0/1;
 * aquí se normalizan a `Track` y después la canción resultante pasa por `validateSong`.
 * Los errores van en inglés porque se devuelven al LLM en el reintento.
 */

const stepsInputSchema = z.union([z.string(), z.array(z.union([z.literal(0), z.literal(1)]))], {
  error: 'steps must be a step string like "x...x..." or an array of 0/1',
});

const trackInputSchema = z.object({
  id: z.string().min(1, 'track id must be a non-empty string'),
  name: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  sample: z.string().min(1).optional(),
  steps: stepsInputSchema,
  velocity: z.array(z.number().min(0).max(1)).optional(),
  volume: z.number().min(0).max(1).optional(),
  muted: z.boolean().optional(),
  solo: z.boolean().optional(),
  params: trackParamsSchema.optional(),
});

const trackPatchSchema = trackInputSchema.omit({ id: true }).partial();

const sectionInputSchema = z.object({
  id: z.string().min(1, 'section id must be a non-empty string'),
  name: z.string().min(1).optional(),
  bars: z.number('bars must be a number'),
  tracks: z.array(trackInputSchema),
});

const arrangementSchema = z
  .array(z.object({ sectionId: z.string().min(1), repeat: z.number('repeat must be a number') }))
  .min(1, 'the arrangement needs at least one item');

const sectionRef = z.string().min(1).optional();

const songOperationSchema = z.discriminatedUnion(
  'type',
  [
    z.object({
      type: z.literal('replaceSong'),
      song: z.object({
        bpm: z.number().optional(),
        stepsPerBar: z.union([z.literal(16), z.literal(12)]).optional(),
        sections: z.array(sectionInputSchema).min(1, 'a song needs at least one section'),
        arrangement: arrangementSchema,
      }),
    }),
    z.object({ type: z.literal('addSection'), section: sectionInputSchema }),
    z.object({
      type: z.literal('updateSection'),
      sectionId: z.string().min(1),
      name: z.string().min(1).optional(),
      bars: z.number().optional(),
      tracks: z.array(trackInputSchema).optional(),
    }),
    z.object({ type: z.literal('removeSection'), sectionId: z.string().min(1) }),
    z.object({ type: z.literal('setArrangement'), arrangement: arrangementSchema }),
    z.object({ type: z.literal('add'), sectionId: sectionRef, track: trackInputSchema }),
    z.object({ type: z.literal('update'), sectionId: sectionRef, id: z.string().min(1), patch: trackPatchSchema }),
    z.object({ type: z.literal('remove'), sectionId: sectionRef, id: z.string().min(1) }),
    z.object({ type: z.literal('replace'), sectionId: sectionRef, tracks: z.array(trackInputSchema) }),
  ],
  {
    error:
      'unknown operation type; use replaceSong, addSection, updateSection, removeSection, setArrangement, add, update, remove or replace',
  },
);

const songResponseSchema = z.object({
  bpm: z.number('bpm must be a number').optional(),
  operations: z.array(songOperationSchema).min(1, 'operations needs at least one operation'),
});

type TrackInput = z.infer<typeof trackInputSchema>;
type SectionInput = z.infer<typeof sectionInputSchema>;
type RawSongOperation = z.infer<typeof songOperationSchema>;

/** Operación ya normalizada (pistas como `Track`). */
export type SongOperation =
  | { type: 'replaceSong'; song: { bpm?: number; stepsPerBar?: StepsPerBar; sections: Section[]; arrangement: ArrangementItem[] } }
  | { type: 'addSection'; section: Section }
  | { type: 'updateSection'; sectionId: string; name?: string; bars?: number; tracks?: Track[] }
  | { type: 'removeSection'; sectionId: string }
  | { type: 'setArrangement'; arrangement: ArrangementItem[] }
  | (PatternOperation & { sectionId?: string });

export interface SongDelta {
  bpm?: number;
  operations: SongOperation[];
}

export type ParseSongDeltaResult = { ok: true; delta: SongDelta } | { ok: false; errors: string[] };

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc ? `${acc}.${String(segment)}` : String(segment);
  }, '');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Tolerancia con formatos cercanos: `{ bpm, tracks }` (contrato de un solo patrón
 * anterior) se trata como `replace` de la sección seleccionada, y una canción suelta
 * `{ sections, arrangement }` como `replaceSong`.
 */
function coerceResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.operations)) return raw;
  if (Array.isArray(obj.sections)) {
    const { bpm, ...song } = obj;
    return { bpm, operations: [{ type: 'replaceSong', song }] };
  }
  if (Array.isArray(obj.tracks)) {
    return { bpm: obj.bpm, operations: [{ type: 'replace', tracks: obj.tracks }] };
  }
  return raw;
}

interface StepsResult {
  steps?: (0 | 1)[];
  velocity?: number[];
  error?: string;
}

function readSteps(input: TrackInput['steps'], velocity: number[] | undefined): StepsResult {
  if (Array.isArray(input)) return { steps: input, velocity };
  const parsed = parseStepString(input);
  if (!parsed.ok) return { error: parsed.error };
  return { steps: parsed.steps, velocity: parsed.velocity };
}

function checkSample(sample: string | undefined, label: string, errors: string[]): void {
  if (sample !== undefined && !isDrumVoiceId(sample)) {
    errors.push(`${label} › sample: "${sample}" is not a drum voice; use one of the voice ids from the drum guide`);
  }
}

function toTrack(input: TrackInput, label: string, errors: string[]): Track | undefined {
  const where = `${label} › track "${input.id}"`;
  checkSample(input.sample, where, errors);
  const steps = readSteps(input.steps, input.velocity);
  if (steps.error || !steps.steps) {
    errors.push(`${where} › steps: ${steps.error}`);
    return undefined;
  }
  const voice = input.sample ? getDrumVoice(input.sample) : undefined;
  const tag = input.tag ?? voice?.tag;
  return {
    id: input.id,
    name: input.name ?? voice?.name ?? capitalize(input.id),
    ...(tag ? { tag } : {}),
    ...(input.sample ? { sample: input.sample } : {}),
    steps: steps.steps,
    ...(steps.velocity ? { velocity: steps.velocity } : {}),
    volume: input.volume ?? 0.8,
    muted: input.muted ?? false,
    solo: input.solo ?? false,
    ...(input.params ? { params: input.params } : {}),
  };
}

function toTracks(inputs: TrackInput[], label: string, errors: string[]): Track[] {
  return inputs.flatMap((input) => toTrack(input, label, errors) ?? []);
}

function toSection(input: SectionInput, errors: string[]): Section {
  return {
    id: input.id,
    name: input.name ?? capitalize(input.id),
    bars: input.bars,
    tracks: toTracks(input.tracks, `Section "${input.id}"`, errors),
  };
}

function toPatch(
  patch: z.infer<typeof trackPatchSchema>,
  label: string,
  errors: string[],
): Partial<Omit<Track, 'id'>> {
  const { steps: rawSteps, velocity: rawVelocity, ...rest } = patch;
  checkSample(rest.sample, label, errors);
  if (rawSteps === undefined) {
    return rawVelocity ? { ...rest, velocity: rawVelocity } : rest;
  }
  const steps = readSteps(rawSteps, rawVelocity);
  if (steps.error || !steps.steps) {
    errors.push(`${label} › steps: ${steps.error}`);
    return rest;
  }
  // Pasos nuevos sustituyen también la dinámica (o la quitan si no hay acentos).
  return { ...rest, steps: steps.steps, velocity: steps.velocity };
}

function normalizeOperation(op: RawSongOperation, errors: string[]): SongOperation {
  const sectionLabel = (sectionId?: string) => (sectionId ? `Section "${sectionId}"` : 'Selected section');
  switch (op.type) {
    case 'replaceSong':
      return {
        type: 'replaceSong',
        song: {
          bpm: op.song.bpm,
          stepsPerBar: op.song.stepsPerBar,
          sections: op.song.sections.map((section) => toSection(section, errors)),
          arrangement: op.song.arrangement,
        },
      };
    case 'addSection':
      return { type: 'addSection', section: toSection(op.section, errors) };
    case 'updateSection':
      return {
        type: 'updateSection',
        sectionId: op.sectionId,
        ...(op.name ? { name: op.name } : {}),
        ...(op.bars !== undefined ? { bars: op.bars } : {}),
        ...(op.tracks ? { tracks: toTracks(op.tracks, sectionLabel(op.sectionId), errors) } : {}),
      };
    case 'removeSection':
    case 'setArrangement':
      return op;
    case 'add': {
      const track = toTrack(op.track, sectionLabel(op.sectionId), errors);
      return { type: 'add', sectionId: op.sectionId, track: track ?? ({} as Track) };
    }
    case 'update':
      return {
        type: 'update',
        sectionId: op.sectionId,
        id: op.id,
        patch: toPatch(op.patch, `${sectionLabel(op.sectionId)} › track "${op.id}"`, errors),
      };
    case 'remove':
      return op;
    case 'replace':
      return { type: 'replace', sectionId: op.sectionId, tracks: toTracks(op.tracks, sectionLabel(op.sectionId), errors) };
  }
}

/**
 * Valida la forma de la respuesta del LLM y la normaliza a `SongDelta`.
 * Devuelve todos los errores encontrados, cada uno con su ubicación.
 * @see BR-002
 */
export function parseSongDelta(raw: unknown): ParseSongDeltaResult {
  const parsed = songResponseSchema.safeParse(coerceResponse(raw));
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const path = formatPath(issue.path);
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }
  const errors: string[] = [];
  const operations = parsed.data.operations.map((op) => normalizeOperation(op, errors));
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, delta: { bpm: parsed.data.bpm, operations } };
}

export interface ApplySongDeltaResult {
  song: Song;
  /** Avisos para el usuario (BR-005/BR-006): no impiden aplicar el delta. */
  warnings: string[];
  /** Referencias imposibles; se devuelven al LLM en el reintento. */
  errors: string[];
  /** Sección a mostrar después: la última que tocó el delta, si alguna. */
  touchedSectionId?: string;
}

/**
 * Aplica un delta de canción de forma inmutable. Las secciones que el delta no toca
 * conservan exactamente sus datos (BR-004). El resultado se valida aparte con validateSong.
 * @see BR-004
 * @see BR-005
 * @see BR-006
 */
export function applySongDelta(base: Song, delta: SongDelta, selectedSectionId: string): ApplySongDeltaResult {
  let song: Song = base;
  const warnings: string[] = [];
  const errors: string[] = [];
  let touchedSectionId: string | undefined;

  const missing = (sectionId: string) =>
    `section "${sectionId}" does not exist; current sections: ${song.sections.map((s) => `"${s.id}"`).join(', ') || '(none)'}`;

  for (const op of delta.operations) {
    switch (op.type) {
      case 'replaceSong':
        song = {
          bpm: op.song.bpm ?? delta.bpm ?? song.bpm,
          stepsPerBar: op.song.stepsPerBar ?? 16,
          sections: op.song.sections,
          arrangement: op.song.arrangement,
        };
        touchedSectionId = op.song.arrangement[0]?.sectionId;
        break;
      case 'addSection':
        if (findSection(song, op.section.id)) {
          errors.push(`addSection: section "${op.section.id}" already exists; use updateSection to change it`);
        } else {
          song = { ...song, sections: [...song.sections, op.section] };
          touchedSectionId = op.section.id;
        }
        break;
      case 'updateSection': {
        const section = findSection(song, op.sectionId);
        if (!section) {
          errors.push(`updateSection: ${missing(op.sectionId)}`);
          break;
        }
        const next: Section = {
          ...section,
          ...(op.name ? { name: op.name } : {}),
          ...(op.bars !== undefined ? { bars: op.bars } : {}),
          ...(op.tracks ? { tracks: op.tracks } : {}),
        };
        song = { ...song, sections: song.sections.map((s) => (s.id === op.sectionId ? next : s)) };
        touchedSectionId = op.sectionId;
        break;
      }
      case 'removeSection':
        if (!findSection(song, op.sectionId)) {
          errors.push(`removeSection: ${missing(op.sectionId)}`);
          break;
        }
        song = {
          ...song,
          sections: song.sections.filter((s) => s.id !== op.sectionId),
          arrangement: song.arrangement.filter((item) => item.sectionId !== op.sectionId),
        };
        if (touchedSectionId === op.sectionId) touchedSectionId = undefined;
        break;
      case 'setArrangement':
        song = { ...song, arrangement: op.arrangement };
        break;
      default: {
        // Operaciones de pista: reutilizan applyDelta sobre la sección indicada.
        const sectionId = op.sectionId ?? selectedSectionId;
        const section = findSection(song, sectionId);
        if (!section) {
          errors.push(`${op.type}: ${missing(sectionId)}`);
          break;
        }
        const { sectionId: _ignored, ...patternOp } = op;
        const result = applyDelta({ bpm: song.bpm, tracks: section.tracks }, { operations: [patternOp as PatternOperation] });
        warnings.push(...result.warnings);
        song = {
          ...song,
          sections: song.sections.map((s) => (s.id === sectionId ? { ...s, tracks: result.next.tracks } : s)),
        };
        touchedSectionId = sectionId;
      }
    }
  }

  if (delta.bpm !== undefined) song = { ...song, bpm: delta.bpm };

  const arranged = new Set(song.arrangement.map((item) => item.sectionId));
  for (const section of song.sections) {
    if (!arranged.has(section.id)) {
      warnings.push(`La sección "${section.name}" no está en el arreglo y no sonará.`);
    }
  }

  return { song, warnings, errors, touchedSectionId };
}
