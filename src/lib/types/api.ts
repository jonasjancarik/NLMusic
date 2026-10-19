import type { PatternDelta } from './audio';
import type { SessionContext } from './session';

export interface LLMProvider {
  generatePattern(prompt: string, context: SessionContext): Promise<PatternDelta>;
}

/** Petición de corrección: la salida anterior y los errores concretos que tuvo (TASK-27 AC-3). */
export interface SongRepairRequest {
  previousOutput: string;
  errors: string[];
}

/** Texto crudo devuelto por el modelo; el pipeline lo parsea y valida. */
export interface SongGeneration {
  text: string;
  /** El modelo se quedó sin tokens de salida y el JSON puede estar cortado. */
  truncated?: boolean;
}

/** Proveedor de canciones: devuelve un delta de canción en JSON (ver prompts/songContract.ts). */
export interface SongLLMProvider {
  generateSong(prompt: string, context: SessionContext, repair?: SongRepairRequest): Promise<SongGeneration>;
}
