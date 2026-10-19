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
