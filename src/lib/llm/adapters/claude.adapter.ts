import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProvider,
  SessionContext,
  PatternDelta,
  SongGeneration,
  SongLLMProvider,
  SongRepairRequest,
} from "@lib/types";
import type { Track } from "@lib/types";
import { buildSystemPrompt } from "../prompts/systemPrompt";
import { buildRepairPrompt, buildSongSystemBlocks, buildSongUserPrompt } from "../prompts/songPrompt";
import { parseLlmJson } from "../parseJson";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
// Una canción en notación compacta ocupa ~2–4k tokens; margen para canciones largas
// sin pasar al streaming (por debajo de ~16k no hay riesgo de timeout HTTP).
const SONG_MAX_TOKENS = 12000;

interface ClaudeAdapterOptions {
  apiKey: string;
  model?: string;
}

/**
 * Convierte el formato viejo { bpm, tracks } al nuevo { operations: [replace] }.
 * Permite desplegar sin romper si el LLM no sigue las nuevas instrucciones.
 */
function normalizeToDelta(raw: unknown): PatternDelta {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("LLM returned non-object response.");
  }

  const obj = raw as Record<string, unknown>;

  // Ya tiene el formato nuevo con operations
  if (Array.isArray(obj.operations)) {
    return raw as PatternDelta;
  }

  // Tolerancia: formato viejo { bpm, tracks } → envolver como replace
  if (Array.isArray(obj.tracks)) {
    return {
      bpm: typeof obj.bpm === "number" ? obj.bpm : undefined,
      operations: [{ type: "replace", tracks: obj.tracks as Track[] }],
    };
  }

  throw new Error("LLM returned unexpected format (no 'operations' or 'tracks').");
}

/**
 * Construye el prompt de usuario con snapshot del patrón previo y turnos recientes.
 *
 * En grid mode usa `previous.tracks` como fuente de verdad para operaciones incrementales.
 * En code mode usa `codeMode.strudelCode` como fuente de verdad; los track ids no son fiables.
 *
 * @see BR-009 Editor y pipeline comparten fuente de verdad coherente
 * @see BR-004 Deltas incrementales solo sobre base fiable
 */
function buildUserPrompt(prompt: string, context: SessionContext): string {
  const lines: string[] = [`User request: ${prompt}`, ""];

  if (context.codeMode?.enabled) {
    // BR-009: en code mode el código Strudel es la única fuente de verdad
    lines.push(
      "SOURCE OF TRUTH: Strudel code (user has edited the code directly)",
      "Track ids in this context are NOT reliable — do NOT use add/update/remove.",
      "You MUST use 'replace' as the operation type.",
      "",
      "Current Strudel code (what is actually playing):",
      context.codeMode.strudelCode,
      "",
      `BPM hint: ${context.codeMode.bpmHint}`,
    );
  } else {
    const currentTracks = context.previous?.tracks ?? [];
    const currentBpm = context.previous?.bpm;

    const trackLines =
      currentTracks.length > 0
        ? currentTracks.map(
            (t) => `  - id: "${t.id}", name: "${t.name}", sample: "${t.sample ?? t.tag ?? ""}", volume: ${t.volume}`
          )
        : ["  (no tracks yet — use replace to create a fresh pattern)"];

    lines.push(
      "Current pattern state:",
      currentBpm ? `  BPM: ${currentBpm}` : "  BPM: (none)",
      "  Tracks:",
      ...trackLines,
    );
  }

  if (context.turns.length > 0) {
    lines.push("", "Recent conversation:");
    context.turns.slice(-4).forEach((t) => {
      lines.push(`  ${t.role}: ${t.content}`);
    });
  }

  return lines.join("\n");
}

export class ClaudeAdapter implements LLMProvider, SongLLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: ClaudeAdapterOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
  }

  // BR-004: devuelve PatternDelta en lugar de TrackJSON completo
  async generatePattern(prompt: string, context: SessionContext): Promise<PatternDelta> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1400,
      // Prompt caching: the system prompt is static, so mark it cacheable.
      // Minimum cacheable prefix is 1024 tokens on claude-sonnet-4-6 (the default model);
      // the current prompt is shorter, so it silently won't cache yet. Kept so caching
      // starts working as soon as the prompt grows past the threshold.
      system: [
        {
          type: "text" as const,
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(prompt, context) }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude response has no text block.");
    }

    const parsed = parseLlmJson(textBlock.text);
    return normalizeToDelta(parsed);
  }

  /**
   * Genera un delta de canción (TASK-27). Devuelve el texto crudo: el pipeline lo
   * parsea, lo valida y, si falla, vuelve a llamar con `repair`.
   *
   * - Sistema: contrato + guía de batería + params, estáticos; el último bloque lleva
   *   cache_control, así que se cachea todo el prefijo (supera el mínimo de 1024 tokens
   *   de claude-sonnet-4-6).
   * - Reintento: la conversación sigue con la salida rechazada como turno del asistente
   *   y los errores concretos como nuevo turno del usuario.
   * - Sin `temperature` (TASK-17).
   */
  async generateSong(prompt: string, context: SessionContext, repair?: SongRepairRequest): Promise<SongGeneration> {
    const blocks = buildSongSystemBlocks();
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildSongUserPrompt(prompt, context) }];
    if (repair) {
      messages.push(
        { role: "assistant", content: repair.previousOutput || "(empty response)" },
        { role: "user", content: buildRepairPrompt(repair) },
      );
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: SONG_MAX_TOKENS,
      system: blocks.map((text, index) => ({
        type: "text" as const,
        text,
        ...(index === blocks.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
      })),
      messages,
    });

    if (response.stop_reason === "refusal") {
      throw new Error("Claude declined to generate this song.");
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (!text) {
      throw new Error("Claude response has no text block.");
    }
    return { text, truncated: response.stop_reason === "max_tokens" };
  }
}
