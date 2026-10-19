export type TrackTag = 'kick' | 'snare' | 'hihat' | 'clap' | 'perc' | string;

/**
 * Parámetros de síntesis opcionales por pista (CAP-NLM-014).
 * Contrato compartido entre compilador, LLM y UI de acordeón.
 * @see BR-NEW-001 Un Track sin params es válido y se compila como siempre
 */
export interface TrackParams {
  // Synth
  synth?: 'sample' | 'sine' | 'sawtooth' | 'square' | 'triangle';
  /** Mini-notation de Strudel, p. ej. "c2" o "<c2 eb2 f2>". Solo aplica con synth oscilador. */
  note?: string;

  // Envelope ADSR
  attack?: number;   // 0–2 s
  decay?: number;    // 0–0.5 s
  sustain?: number;  // 0–1
  release?: number;  // 0–2 s

  // Filter
  filterType?: 'lp' | 'hp';
  filterCutoff?: number; // 20–20000 Hz
  filterQ?: number;      // 0–20

  // Effects
  room?: number;          // 0–1
  delay?: number;         // 0–1
  delaytime?: number;     // 0–1 s
  delayfeedback?: number; // 0–0.9 (BR-NEW-003: nunca >= 1)
  pan?: number;           // 0–1 (0=izq, 0.5=centro, 1=der)
}

export interface Track {
  id: string;
  name: string;
  tag?: TrackTag;
  sample?: string;
  steps: (0 | 1)[];
  /**
   * Dinámica por paso (0–1), misma longitud que `steps` (TASK-24).
   * Si falta, cada paso activo suena con velocity 1. Se multiplica por `volume`.
   */
  velocity?: number[];
  volume: number;
  muted: boolean;
  solo: boolean;
  params?: TrackParams;
}

export interface TrackJSON {
  bpm: number;
  tracks: Track[];
  strudelCode?: string;
}

/** Pasos por compás: 16 = semicorcheas, 12 = feel ternario (tresillos de corchea). 4/4 fijo en v1. */
export type StepsPerBar = 16 | 12;

/**
 * Sección de una canción (intro, verso, estribillo…). Cada pista tiene
 * `stepsPerBar * bars` pasos.
 * @see CAP-NLM-015
 */
export interface Section {
  id: string;
  name: string;
  /** 1–16 compases */
  bars: number;
  /** Máximo MAX_TRACKS_PER_SECTION (BR-006) */
  tracks: Track[];
}

/** Bloque del arreglo: una sección repetida `repeat` veces (1–16). */
export interface ArrangementItem {
  sectionId: string;
  repeat: number;
}

/**
 * Canción completa: secciones + orden de reproducción.
 * Un patrón antiguo (`TrackJSON`) equivale a una canción con una sección `main` de 1 compás.
 * @see CAP-NLM-015
 */
export interface Song {
  bpm: number;
  /** v1: no se puede cambiar una vez creada la canción; hay que sustituir la canción entera. */
  stepsPerBar: StepsPerBar;
  sections: Section[];
  arrangement: ArrangementItem[];
}

// BR-004: incremental operations so the LLM can add/update/remove/replace tracks
export type PatternOperation =
  | { type: 'add';     track: Track }
  | { type: 'update';  id: string; patch: Partial<Omit<Track, 'id'>> }
  | { type: 'remove';  id: string }
  | { type: 'replace'; tracks: Track[] };

export interface PatternDelta {
  bpm?: number;
  operations: PatternOperation[];
}
