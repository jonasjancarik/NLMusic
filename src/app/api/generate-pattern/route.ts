import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ClaudeAdapter } from '@lib/llm/adapters/claude.adapter';
import { runSongPipeline } from '@lib/llm/songPipeline';
import { fallbackPattern } from '@lib/llm/fallbackPattern';
import { contextSong } from '@lib/llm/prompts/songPrompt';
import type { SessionContext } from '@lib/types';
import { trackParamsSchema } from '@lib/llm/validation';
import { MAX_TRACKS_PER_SECTION, compileSong, patternToSong, validateSong } from '@lib/song';

/**
 * Límite del código Strudel aceptado. Una canción de varias secciones compila a mucho
 * más que un patrón de un compás (TASK-24 dejó 5000, que no alcanza).
 */
const MAX_STRUDEL_CODE_CHARS = 100_000;
/** Límite del JSON de la canción enviada como contexto (BR-011: payload acotado). */
const MAX_SONG_JSON_CHARS = 200_000;

/**
 * Snapshot acotado de pistas previas aceptado por la API.
 * Replica solo el subset que el pipeline necesita para evitar payloads arbitrarios o desproporcionados.
 * @see BR-011
 */
const previousTrackSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  tag: z.string().max(50).optional(),
  sample: z.string().max(100).optional(),
  steps: z.array(z.union([z.literal(0), z.literal(1)])).length(16),
  // TASK-24: sin velocity/params aquí, zod los descartaba y el delta los borraba al volver
  velocity: z.array(z.number().min(0).max(1)).length(16).optional(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  solo: z.boolean(),
  params: trackParamsSchema.optional(),
});

/**
 * Valida el body completo antes de tocar el provider o el pipeline.
 * Los límites mantienen el contrato acotado y evitan abusos de tamaño en turns, tracks y código Strudel.
 * @see BR-002
 * @see BR-011
 */
const requestBodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  context: z.object({
    turns: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(500),
    })).max(40).optional(),
    previous: z.object({
      bpm: z.number().int().min(60).max(220),
      tracks: z.array(previousTrackSchema).max(MAX_TRACKS_PER_SECTION),
      strudelCode: z.string().max(MAX_STRUDEL_CODE_CHARS).optional(),
    }).optional(),
    codeMode: z.object({
      enabled: z.literal(true),
      strudelCode: z.string().max(MAX_STRUDEL_CODE_CHARS),
      bpmHint: z.number().int().min(60).max(220),
    }).optional(),
    language: z.enum(['es', 'en', 'mixed']).optional(),
    // TASK-27: canción completa; se valida con validateSong más abajo.
    song: z.unknown().optional(),
    activeSectionId: z.string().min(1).max(100).optional(),
  }).optional(),
});

/**
 * Genera un patrón musical y devuelve un contrato API explícito.
 * Un fallback válido responde con ok=true para no bloquear reproducción;
 * solo errores reales de request/configuración responden con ok=false.
 *
 * @see BR-002 La respuesta aplicada debe cumplir schema válido
 * @see BR-011 La API key nunca se expone al cliente
 */
export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Body inválido' },
        { status: 400 }
      );
    }

    const parsed = requestBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Body inválido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { prompt, context } = parsed.data;

    // BR-010: prompt vacío o solo espacios no avanza al pipeline LLM
    if (!prompt.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Prompt inválido' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // BR-011: sin key de servidor no se puede proxear la llamada al proveedor
      return NextResponse.json(
        { ok: false, error: 'Servidor no configurado: ANTHROPIC_API_KEY faltante' },
        { status: 500 }
      );
    }

    // TASK-27: la canción del contexto debe ser válida; si no, el delta no tendría base fiable.
    let song: SessionContext['song'];
    if (context?.song !== undefined && !context.codeMode) {
      if (JSON.stringify(context.song).length > MAX_SONG_JSON_CHARS) {
        return NextResponse.json({ ok: false, error: 'Body inválido: canción demasiado grande' }, { status: 400 });
      }
      const validation = validateSong(context.song);
      if (!validation.ok) {
        return NextResponse.json(
          { ok: false, error: 'Body inválido: canción no válida', details: validation.errors },
          { status: 400 },
        );
      }
      song = validation.song;
    }

    const model = process.env.ANTHROPIC_MODEL;
    const provider = new ClaudeAdapter({ apiKey, model });

    /**
     * Normaliza el contexto para que el pipeline reciba una sola fuente de verdad.
     * En modo código se descartan `previous` y `song` porque pueden haber quedado
     * obsoletos respecto al editor.
     * @see BR-009
     */
    const sessionContext: SessionContext = {
      turns: context?.turns ?? [],
      previous: context?.codeMode ? undefined : context?.previous,
      codeMode: context?.codeMode,
      language: context?.language ?? 'mixed',
      song,
      activeSectionId: context?.activeSectionId,
    };

    const result = await runSongPipeline(provider, prompt, sessionContext);

    if (result.ok) {
      // LLM success — include any delta warnings (BR-005/BR-006)
      return NextResponse.json({
        ok: true,
        source: 'llm' as const,
        song: result.song,
        activeSectionId: result.activeSectionId,
        strudelCode: result.strudelCode,
        warnings: result.warnings,
      });
    }

    if (result.kind === 'invalid') {
      // AC-3: tras los reintentos automáticos, ERROR con reintento manual (TASK-04).
      // La canción actual se queda como está y sigue sonando (BR-001).
      console.warn('[API] generate-pattern: invalid song after retries', result.errors);
      return NextResponse.json(
        {
          ok: false,
          error: `La IA no consiguió una canción válida tras ${result.attempts} intentos. Prueba otra vez o reformula la petición.`,
          details: result.errors,
        },
        { status: 422 },
      );
    }

    // EC-001/EC-002: si falla el proveedor y no hay nada que conservar, cargar el patrón
    // de fallback para no bloquear la reproducción. Si ya hay una canción, no se sustituye:
    // perderla por un fallo de red sería peor que mostrar el error con reintento.
    const current = contextSong(sessionContext);
    const hasContent = current?.sections.some((section) => section.tracks.length > 0) ?? false;
    if (hasContent || sessionContext.codeMode) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    const fallbackSong = patternToSong(fallbackPattern());
    return NextResponse.json({
      ok: true,
      source: 'fallback' as const,
      song: fallbackSong,
      activeSectionId: fallbackSong.arrangement[0].sectionId,
      strudelCode: compileSong(fallbackSong),
      warning: result.error,
    });
  } catch (error) {
    console.error('[API] generate-pattern error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
