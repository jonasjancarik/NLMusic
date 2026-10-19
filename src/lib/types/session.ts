import type { Song, TrackJSON } from './audio';

export interface SessionTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Describe el estado del patrón cuando el editor Strudel fue editado manualmente
 * y el array `tracks` ya no es una representación fiable del audio actual.
 * En este modo el LLM debe tratar `strudelCode` como única fuente de verdad.
 *
 * @see BR-009 Editor y sistema de prompts comparten fuente de verdad coherente
 */
export interface CodeModeContext {
  enabled: true;
  strudelCode: string;
  bpmHint: number;
}

/**
 * Contexto conversacional enviado al adaptador LLM.
 * - En grid mode: `previous` contiene el snapshot fiable de tracks + bpm.
 * - En code mode: `codeMode` reemplaza a `previous` — los tracks están obsoletos.
 *
 * @see BR-004 Deltas incrementales solo sobre base fiable
 * @see BR-009 Fuente de verdad coherente entre editor y pipeline
 */
export interface SessionContext {
  turns: SessionTurn[];
  previous?: TrackJSON;
  codeMode?: CodeModeContext;
  language?: 'es' | 'en' | 'mixed';
  /**
   * Canción completa (TASK-27). Si existe, es la base de los deltas de canción y
   * `previous` se ignora. En code mode no se envía.
   * @see CAP-NLM-015
   */
  song?: Song;
  /** Sección que el usuario tiene seleccionada; destino por defecto de las operaciones de pista. */
  activeSectionId?: string;
}
