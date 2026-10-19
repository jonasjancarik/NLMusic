import { z } from "zod";
import { MAX_TRACKS_PER_SECTION } from "@lib/song/constants";

const stepSchema = z.union([z.literal(0), z.literal(1)]);

/**
 * Parámetros de síntesis opcionales por pista.
 * @see BR-NEW-003 delayfeedback tiene tope 0.9 para evitar bucles infinitos de audio
 */
export const trackParamsSchema = z.object({
  synth: z.enum(['sample', 'sine', 'sawtooth', 'square', 'triangle']).optional(),
  note: z.string().optional(),
  attack: z.number().min(0).max(2).optional(),
  decay: z.number().min(0).max(0.5).optional(),
  sustain: z.number().min(0).max(1).optional(),
  release: z.number().min(0).max(2).optional(),
  filterType: z.enum(['lp', 'hp']).optional(),
  filterCutoff: z.number().min(20).max(20000).optional(),
  filterQ: z.number().min(0).max(20).optional(),
  room: z.number().min(0).max(1).optional(),
  delay: z.number().min(0).max(1).optional(),
  delaytime: z.number().min(0).max(1).optional(),
  delayfeedback: z.number().min(0).max(0.9).optional(),
  pan: z.number().min(0).max(1).optional(),
});

/**
 * Contrato mínimo de una pista aceptada desde el LLM.
 * `tag` permanece opcional para conservar compatibilidad con respuestas antiguas sin perderlo cuando sí llega.
 * @see BR-002
 */
const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tag: z.string().min(1).optional(),
  sample: z.string().min(1).optional(),
  steps: z.array(stepSchema).length(16),
  // TASK-24: dinámica por paso (0–1), una por paso
  velocity: z.array(z.number().min(0).max(1)).length(16).optional(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  solo: z.boolean(),
  params: trackParamsSchema.optional()
});

export const trackJsonSchema = z.object({
  bpm: z.number().int().min(60).max(220),
  // BR-006: el contrato validado nunca acepta más pistas que el límite por sección.
  tracks: z.array(trackSchema).min(1).max(MAX_TRACKS_PER_SECTION),
  strudelCode: z.string().optional()
});

export type ParsedTrackJSON = z.infer<typeof trackJsonSchema>;

// BR-004: schema de operaciones delta para actualizaciones incrementales
const addOperationSchema = z.object({
  type: z.literal('add'),
  track: trackSchema,
});

const updateOperationSchema = z.object({
  type: z.literal('update'),
  id: z.string().min(1),
  patch: trackSchema.omit({ id: true }).partial(),
});

const removeOperationSchema = z.object({
  type: z.literal('remove'),
  id: z.string().min(1),
});

const replaceOperationSchema = z.object({
  type: z.literal('replace'),
  tracks: z.array(trackSchema),
});

const patternOperationSchema = z.discriminatedUnion('type', [
  addOperationSchema,
  updateOperationSchema,
  removeOperationSchema,
  replaceOperationSchema,
]);

export const patternDeltaSchema = z.object({
  bpm: z.number().int().min(60).max(220).optional(),
  operations: z.array(patternOperationSchema).min(1),
});

export type ParsedPatternDelta = z.infer<typeof patternDeltaSchema>;

/**
 * Valida la respuesta cruda del LLM contra el schema del dominio.
 * @see BR-002 El LLM debe cumplir el schema definido
 * @see BR-006 Máximo MAX_TRACKS_PER_SECTION (8) pistas por sección
 */
export function validateTrackJson(input: unknown): ParsedTrackJSON {
  return trackJsonSchema.parse(input);
}

/**
 * Valida un delta de operaciones devuelto por el LLM.
 * @see BR-004 Las pistas se crean de forma secuencial
 */
export function validatePatternDelta(input: unknown): ParsedPatternDelta {
  return patternDeltaSchema.parse(input);
}
