/**
 * Límites del modelo de canción (CAP-NLM-015).
 * @see BR-006 Máximo de pistas por sección
 */
export const MAX_TRACKS_PER_SECTION = 8;

export const MIN_BARS = 1;
export const MAX_BARS = 16;
export const MIN_REPEAT = 1;
export const MAX_REPEAT = 16;
export const MIN_BPM = 60;
export const MAX_BPM = 220;

export const STEPS_PER_BAR_OPTIONS = [16, 12] as const;

/** Sección a la que se migra un patrón antiguo y sobre la que trabaja la UI de un solo patrón. */
export const DEFAULT_SECTION_ID = 'main';
export const DEFAULT_SECTION_NAME = 'Main';
