import { MAX_BPM, MIN_BPM } from '../song/constants';

/**
 * Entrenador de tempo: sube (o baja) el BPM de `startBpm` a `endBpm`, `stepBpm` cada
 * `everyLoops` vueltas del bucle (o de la canción completa si no hay bucle de sección).
 * Módulo puro: sin React ni Strudel, para poder probar la secuencia aislada.
 * @see TASK-30 AC-4
 */
export interface TempoTrainerConfig {
  enabled: boolean;
  startBpm: number;
  endBpm: number;
  /** Cuántos BPM cambia cada paso (siempre positivo; la dirección sale de start → end). */
  stepBpm: number;
  /** Vueltas completas que se tocan antes de cada cambio. */
  everyLoops: number;
}

export const DEFAULT_TEMPO_TRAINER: TempoTrainerConfig = {
  enabled: false,
  startBpm: 80,
  endBpm: 120,
  stepBpm: 5,
  everyLoops: 4,
};

const clampBpm = (value: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
const clampInt = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

/** Deja una configuración (p. ej. recién leída de localStorage) dentro de rangos válidos. */
export function normalizeTempoTrainer(config: Partial<TempoTrainerConfig> | undefined): TempoTrainerConfig {
  const base = { ...DEFAULT_TEMPO_TRAINER, ...config };
  return {
    enabled: base.enabled === true,
    startBpm: clampInt(base.startBpm, MIN_BPM, MAX_BPM, DEFAULT_TEMPO_TRAINER.startBpm),
    endBpm: clampInt(base.endBpm, MIN_BPM, MAX_BPM, DEFAULT_TEMPO_TRAINER.endBpm),
    stepBpm: clampInt(base.stepBpm, 1, MAX_BPM - MIN_BPM, DEFAULT_TEMPO_TRAINER.stepBpm),
    everyLoops: clampInt(base.everyLoops, 1, 64, DEFAULT_TEMPO_TRAINER.everyLoops),
  };
}

/**
 * BPM que corresponde a la vuelta `loopIndex` (0 = primera). Nunca pasa de `endBpm`.
 * Con start 80, end 100, paso 10 y cada 2 vueltas: 80, 80, 90, 90, 100, 100, 100…
 */
export function trainerBpmForLoop(config: TempoTrainerConfig, loopIndex: number): number {
  const cfg = normalizeTempoTrainer(config);
  const steps = Math.max(0, Math.floor(loopIndex / cfg.everyLoops));
  const direction = cfg.endBpm >= cfg.startBpm ? 1 : -1;
  const raw = cfg.startBpm + direction * steps * cfg.stepBpm;
  return direction > 0 ? Math.min(cfg.endBpm, raw) : Math.max(cfg.endBpm, raw);
}

/** Lista de BPM distintos que recorre el entrenador, de inicial a final. */
export function trainerBpmSequence(config: TempoTrainerConfig): number[] {
  const cfg = normalizeTempoTrainer(config);
  const out = [cfg.startBpm];
  for (let loop = cfg.everyLoops; out[out.length - 1] !== cfg.endBpm; loop += cfg.everyLoops) {
    out.push(trainerBpmForLoop(cfg, loop));
  }
  return out;
}

/** BPM de la vuelta siguiente a `loopIndex`, o null si no cambia. */
export function nextTrainerBpm(config: TempoTrainerConfig, loopIndex: number): number | null {
  const current = trainerBpmForLoop(config, loopIndex);
  const next = trainerBpmForLoop(config, loopIndex + 1);
  return next === current ? null : next;
}
