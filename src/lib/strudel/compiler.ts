import type { Track, TrackJSON, TrackParams } from '@lib/types';
import { getDrumVoice, soundToVoice, voiceToSound } from '@lib/song/drumVoices';

// Pure module (no React, window or Zustand): imported by the app, and by the
// CLI/MCP server in TASK-28. Moved here from src/features/audio in TASK-24.

export interface CompilableTrack {
  sample?: string;
  tag?: string;
  steps: number[];
  /** TASK-24: per-step dynamics 0–1, multiplied by gain in superdough */
  velocity?: number[];
  volume: number;
  muted: boolean;
  solo: boolean;
  params?: TrackParams;
}

interface CompilableTrackJson {
  bpm: number;
  tracks: CompilableTrack[];
}

const SAMPLE_TO_TAG: Record<string, string> = {
  bd: 'kick',
  sd: 'snare',
  hh: 'hihat',
  cp: 'clap',
  perc: 'perc',
};

function inferTagFromSample(sample: string): string {
  return SAMPLE_TO_TAG[sample] ?? getDrumVoice(sample)?.tag ?? 'perc';
}

function inferNameFromSample(sample: string, tag: string, index: number): string {
  if (sample === 'perc') return 'Perc';
  const voice = getDrumVoice(sample);
  if (voice) return voice.name;
  return `${tag.charAt(0).toUpperCase()}${tag.slice(1)} ${index + 1}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitTopLevelArgs(source: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let quoteChar = '';
  let escaped = false;

  for (const char of source) {
    current += char;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (inString) {
      if (char === quoteChar) {
        inString = false;
        quoteChar = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quoteChar = char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      continue;
    }

    if (char === ',' && depth === 0) {
      parts.push(current.slice(0, -1).trim());
      current = '';
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

// TASK-20: tracks con params caen a código-manual (deuda conocida):
// el regex de parseTrackExpression solo reconoce s("...").gain(n), así que cualquier
// cadena adicional (.room(), .lpf(), note().s()...) devuelve null.
function parseTrackExpression(source: string, previousTrack: Track | undefined, index: number): Track | null {
  const match = source.match(
    /^s\(\s*"((?:[^"\\]|\\.)*)"\s*\)\.gain\(\s*(-?\d+(?:\.\d+)?)\s*\)(?:\.velocity\(\s*"([^"]*)"\s*\))?$/,
  );
  if (!match) {
    return null;
  }

  const pattern = match[1];
  const gain = Number(match[2]);
  const tokens = pattern.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 16) {
    return null;
  }

  const soundingTokens = tokens.filter((token) => token !== '~');
  const distinctTokens = [...new Set(soundingTokens)];
  if (distinctTokens.length > 1) {
    return null;
  }

  let velocity: number[] | undefined;
  if (match[3] !== undefined) {
    const velocityTokens = match[3].trim().split(/\s+/).filter(Boolean);
    if (velocityTokens.length !== 16) return null;
    velocity = velocityTokens.map((token) => (token === '~' ? 0 : Number(token)));
    if (velocity.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) return null;
  }

  // TASK-24: Strudel sounds map back to drum voice ids (e.g. "ho" → "oh")
  const sample = soundToVoice(distinctTokens[0] ?? previousTrack?.sample ?? previousTrack?.tag ?? 'perc');
  const tag = inferTagFromSample(sample);
  const previousSample = previousTrack?.sample ?? (previousTrack ? resolveSample(previousTrack) : undefined);
  const shouldReuseName = previousTrack && previousSample === sample;

  return {
    id: previousTrack?.id ?? `${tag}-${index + 1}`,
    name: shouldReuseName ? previousTrack.name : inferNameFromSample(sample, tag, index),
    tag,
    sample: SAMPLE_TO_TAG[sample] ? undefined : sample,
    steps: tokens.map((token) => (token === '~' ? 0 : 1)) as (0 | 1)[],
    ...(velocity ? { velocity } : {}),
    volume: Math.max(0, Math.min(1, Number.isFinite(gain) ? gain : 0)),
    muted: gain <= 0,
    solo: false,
  };
}

/**
 * Best-effort reverse parser for the Strudel subset emitted by compileToStrudel.
 * Returns null when the code cannot be represented in the 16-step grid.
 *
 * @see BR-009 Grid/editor sync when code stays within the supported subset
 */
export function parseStrudelToTrackJson(code: string, previousTracks: Track[] = []): TrackJSON | null {
  const trimmed = code.trim();
  const shellMatch = trimmed.match(/^(.*?)\.slow\(\s*4\s*\)\.cpm\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*$/s);
  if (!shellMatch) {
    return null;
  }

  const body = shellMatch[1].trim();
  const bpm = Number(shellMatch[2]);
  if (!Number.isFinite(bpm)) {
    return null;
  }

  if (body === 'silence') {
    return { bpm, tracks: [] };
  }

  const stackMatch = body.match(new RegExp(`^stack\\((([\\s\\S]*))\\)$`.replace('(([\\s\\S]*))', '([\\s\\S]*)')));
  if (!stackMatch) {
    return null;
  }

  const expressions = splitTopLevelArgs(stackMatch[1]);
  const tracks = expressions.map((expression, index) => parseTrackExpression(expression, previousTracks[index], index));
  if (tracks.some((track) => track === null)) {
    return null;
  }

  return { bpm, tracks: tracks as Track[] };
}

function stepsToPattern(sample: string, steps: number[]): string {
  return steps.map((step) => (step === 1 ? sample : "~")).join(" ");
}

function resolveSample(track: CompilableTrack): string {
  if (track.sample) {
    return track.sample;
  }

  if (track.tag === 'kick') return 'bd';
  if (track.tag === 'snare') return 'sd';
  if (track.tag === 'hihat') return 'hh';
  if (track.tag === 'clap') return 'cp';
  return 'perc';
}

const MAX_DELAY_FEEDBACK = 0.9; // BR-NEW-003: >= 1 crea un bucle infinito de audio

/**
 * Traduce TrackParams a métodos Strudel encadenados.
 * Orden fijo: ADSR → filtro → room → delay/delaytime/delayfeedback → pan
 * (el gain lo añade el llamador antes). Los campos undefined no emiten nada; 0 sí.
 *
 * @see BR-NEW-003 delayfeedback se trunca a 0.9
 */
export function buildParamsChain(params: TrackParams | undefined): string {
  if (!params) return '';
  const parts: string[] = [];

  if (params.attack !== undefined) parts.push(`.attack(${params.attack})`);
  if (params.decay !== undefined) parts.push(`.decay(${params.decay})`);
  if (params.sustain !== undefined) parts.push(`.sustain(${params.sustain})`);
  if (params.release !== undefined) parts.push(`.release(${params.release})`);

  if (params.filterCutoff !== undefined) {
    const isHp = params.filterType === 'hp';
    parts.push(`.${isHp ? 'hpf' : 'lpf'}(${params.filterCutoff})`);
    // Resonance method must match the filter: hpq for hpf, lpq for lpf.
    if (params.filterQ !== undefined) parts.push(`.${isHp ? 'hpq' : 'lpq'}(${params.filterQ})`);
  }

  if (params.room !== undefined) parts.push(`.room(${params.room})`);

  // delaytime/delayfeedback only make sense with a delay send
  if (params.delay !== undefined) {
    parts.push(`.delay(${params.delay})`);
    if (params.delaytime !== undefined) parts.push(`.delaytime(${params.delaytime})`);
    if (params.delayfeedback !== undefined) {
      parts.push(`.delayfeedback(${Math.min(params.delayfeedback, MAX_DELAY_FEEDBACK)})`);
    }
  }

  if (params.pan !== undefined) parts.push(`.pan(${params.pan})`);

  return parts.join('');
}

// Temporal contract:
// - cpm(bpm) sets 1 cycle = 1 quarter note (negra) at the given BPM
// - Our 16-step sequencer = 16 sixteenth notes = 4 quarter notes = 1 bar
// - .slow(4) stretches 16 elements across 4 cycles (4 beats = 1 bar)
// - Result: each element = 1 sixteenth note, properly timed

/**
 * Compila el estado del secuenciador a código Strudel ejecutable.
 * Mantiene todas las pistas dentro de stack() y silencia con gain(0)
 * para evitar reconfiguraciones de voces al alternar mute/solo.
 *
 * @param trackJson - Patrón actual con bpm y pistas normalizadas.
 * @returns Código Strudel listo para evaluar en el motor de audio.
 * @see BR-001 El audio no se interrumpe al mutear/solear pistas
 */
export function compileToStrudel(trackJson: CompilableTrackJson): string {
  const hasSolo = trackJson.tracks.some((t) => t.solo);
  const stackCode = compileTrackStack(trackJson.tracks, (track) => track.muted || (hasSolo && !track.solo));
  return `${stackCode}.slow(4).cpm(${trackJson.bpm.toFixed(2)})`;
}

/**
 * Compila una lista de pistas a `stack(...)` (o `silence` si está vacía). Todas las
 * pistas deben tener el mismo número de pasos: el stack ocupa un ciclo antes de los
 * `.slow()` que añada el llamador. Compartido por compileToStrudel y compileSong.
 *
 * @param isSilenced - decide qué pistas suenan con gain(0) (mute/solo)
 * @see BR-001 Las pistas silenciadas siguen en el stack para no reconfigurar voces
 */
export function compileTrackStack<T extends CompilableTrack>(
  tracks: T[],
  isSilenced: (track: T) => boolean,
): string {
  const codeBlocks = tracks.map((track) => compileTrackExpression(track, isSilenced(track)));
  return codeBlocks.length > 0 ? `stack(${codeBlocks.join(", ")})` : 'silence';
}

/**
 * Expresión Strudel de una pista: patrón, gain (volumen o 0 si está silenciada),
 * velocity por paso (TASK-24) y cadena de params (TASK-20).
 * superdough multiplica gain × velocity, así que volumen y dinámica se combinan.
 */
export function compileTrackExpression(track: CompilableTrack, silenced: boolean): string {
  // BR-001: muted/non-solo tracks stay in the stack with gain(0) so Strudel
  // never restructures the voice graph — avoids clicks and pops on toggle
  const gain = silenced ? 0 : track.volume;
  const params = track.params;
  const velocity = buildVelocityCall(track);
  const chain = buildParamsChain(params);

  // BR-NEW-002: note only applies to oscillator synths; the steps become the gate.
  if (params?.synth && params.synth !== 'sample') {
    const note = params.note ?? 'c3';
    const gate = track.steps.map((step) => (step === 1 ? 'x' : '~')).join(' ');
    return `note("${note}").s("${params.synth}").struct("${gate}").gain(${gain.toFixed(2)})${velocity}${chain}`;
  }

  const pattern = stepsToPattern(voiceToSound(resolveSample(track)), track.steps);
  return `s("${pattern}").gain(${gain.toFixed(2)})${velocity}${chain}`;
}

/**
 * `.velocity("…")` alineado paso a paso con el patrón; los pasos inactivos van como `~`.
 * Sin `velocity` en la pista no se emite nada (el código de pistas antiguas no cambia).
 */
function buildVelocityCall(track: CompilableTrack): string {
  if (!track.velocity) return '';
  const values = track.steps.map((step, index) => {
    if (step !== 1) return '~';
    const value = track.velocity?.[index] ?? 1;
    return String(Math.round(Math.max(0, Math.min(1, value)) * 100) / 100);
  });
  return `.velocity("${values.join(' ')}")`;
}
