import type { SessionContext, Song, SongGeneration, SongLLMProvider, SongRepairRequest } from '@lib/types';
import { DEFAULT_SECTION_ID, compileSong, findSection, patternToSong, validateSong } from '@lib/song';
import { parseLlmJson } from './parseJson';
import { applySongDelta, parseSongDelta } from './songDelta';
import { contextSong } from './prompts/songPrompt';

/** Reintentos automáticos tras una salida inválida (TASK-27 AC-3: máx. 1–2). */
export const MAX_SONG_REPAIRS = 2;

const DEFAULT_BPM = 138;

export type InterpretSongResult =
  | { ok: true; song: Song; activeSectionId: string; warnings: string[] }
  | { ok: false; errors: string[] };

export type SongPipelineResult =
  | {
      ok: true;
      song: Song;
      strudelCode: string;
      activeSectionId: string;
      warnings: string[];
      /** Llamadas al modelo, incluidos los reintentos. */
      attempts: number;
    }
  | { ok: false; kind: 'invalid'; errors: string[]; attempts: number }
  | { ok: false; kind: 'provider'; error: string; attempts: number };

/**
 * Canción sobre la que se aplica el delta. En code mode sin canción fiable se parte de
 * una sección vacía con el BPM del código (solo se admite replaceSong/replace).
 * @see BR-009
 */
export function baseSongFor(context: SessionContext): Song {
  if (context.codeMode?.enabled && !context.song) {
    return patternToSong({ bpm: context.codeMode.bpmHint, tracks: [] });
  }
  return contextSong(context) ?? patternToSong({ bpm: DEFAULT_BPM, tracks: [] });
}

function selectedSectionFor(song: Song, context: SessionContext): string {
  const requested = context.activeSectionId;
  if (requested && findSection(song, requested)) return requested;
  return song.arrangement[0]?.sectionId ?? song.sections[0]?.id ?? DEFAULT_SECTION_ID;
}

/**
 * Convierte una respuesta del modelo en canción válida, o en la lista de errores concretos
 * que se le devolverán en el reintento. Puro: lo usan el pipeline, los tests y el eval.
 *
 * Pasos: JSON → forma del delta → guardas de code mode → aplicar → validateSong.
 * @see BR-002
 * @see BR-004
 * @see BR-006
 * @see BR-009
 */
export function interpretSongResponse(generation: SongGeneration, context: SessionContext): InterpretSongResult {
  let raw: unknown;
  try {
    raw = parseLlmJson(generation.text);
  } catch {
    return {
      ok: false,
      errors: [
        generation.truncated
          ? 'The response was cut off before the JSON ended. Send a shorter response: change only the sections that need it, or use fewer bars.'
          : 'The response is not valid JSON. Return one JSON object only.',
      ],
    };
  }

  const parsed = parseSongDelta(raw);
  if (!parsed.ok) return parsed;

  // BR-009/BR-004: en code mode los ids no son fiables; solo valen reemplazos completos.
  if (context.codeMode?.enabled && !context.song) {
    const unsafe = parsed.delta.operations.filter((op) => op.type !== 'replaceSong' && op.type !== 'replace');
    if (unsafe.length > 0) {
      return {
        ok: false,
        errors: [
          `In code mode only replaceSong is allowed, but the response used ${[...new Set(unsafe.map((op) => op.type))].join(', ')}. Rebuild the whole song with replaceSong.`,
        ],
      };
    }
  }

  const base = baseSongFor(context);
  const selected = selectedSectionFor(base, context);
  const applied = applySongDelta(base, parsed.delta, selected);
  if (applied.errors.length > 0) return { ok: false, errors: applied.errors };

  const validation = validateSong(applied.song);
  if (!validation.ok) return { ok: false, errors: validation.errors.map((error) => error.message) };

  const song = validation.song;
  const activeSectionId =
    [applied.touchedSectionId, selected].find((id) => id && findSection(song, id)) ??
    song.arrangement[0]?.sectionId ??
    song.sections[0].id;

  return { ok: true, song, activeSectionId, warnings: applied.warnings };
}

/**
 * Pipeline de canciones: genera → interpreta → si falla, reintenta con los errores
 * concretos (máx. MAX_SONG_REPAIRS) → compila a Strudel.
 *
 * - Salida inválida tras los reintentos → `kind: 'invalid'` (la UI pasa a ERROR con
 *   reintento manual, TASK-04).
 * - Error del proveedor (red, API) → `kind: 'provider'`; la ruta decide el fallback.
 *
 * @see BR-001 Compilar y sustituir el código no corta el audio
 * @see BR-003
 */
export async function runSongPipeline(
  provider: SongLLMProvider,
  prompt: string,
  context: SessionContext,
): Promise<SongPipelineResult> {
  let repair: SongRepairRequest | undefined;
  let errors: string[] = [];

  for (let attempt = 1; attempt <= MAX_SONG_REPAIRS + 1; attempt++) {
    let generation: SongGeneration;
    try {
      generation = await provider.generateSong(prompt, context, repair);
    } catch (error) {
      return {
        ok: false,
        kind: 'provider',
        error: error instanceof Error ? error.message : 'Unknown generation error',
        attempts: attempt,
      };
    }

    const result = interpretSongResponse(generation, context);
    if (result.ok) {
      return {
        ok: true,
        song: result.song,
        strudelCode: compileSong(result.song),
        activeSectionId: result.activeSectionId,
        warnings: result.warnings,
        attempts: attempt,
      };
    }
    errors = result.errors;
    repair = { previousOutput: generation.text, errors };
  }

  return { ok: false, kind: 'invalid', errors, attempts: MAX_SONG_REPAIRS + 1 };
}
