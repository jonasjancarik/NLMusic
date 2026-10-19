/**
 * Lista cerrada de voces de batería (TASK-24 AC-6) y el sonido Strudel que usa cada una.
 *
 * Spike (oct. 2026, @strudel/web 1.3.0, banco `github:tidalcycles/dirt-samples`, el único
 * que carga `useStrudel`): se revisó el `strudel.json` del banco y la duración de los WAV.
 * - Existen con el mismo nombre: bd, sd, cp, hh (índice 0 = hi-hat cerrado), lt, mt, ht.
 * - No existen `rim`, `oh`, `rd` ni un crash real bajo `cr`:
 *   - rim → `rm` (RIM0.wav, rimshot TR-909, 0,04 s)
 *   - oh  → `ho` (HHOD0.wav, hi-hat abierto TR-909, 0,25 s)
 *   - rd  → `cr` (RIDED0.wav: la carpeta `cr` contiene rides TR-909, 1,2 s)
 *   - cr  → `hh:1` (001_hh3crash.wav, crash de 1,9 s del kit `hh`)
 * Si en el futuro se carga `tidal-drum-machines`, basta con cambiar `sound` aquí
 * (p. ej. `.bank("RolandTR909")`); el resto del sistema usa el id de voz.
 *
 * `midi` es la nota General MIDI de batería (canal 10) que usa la exportación MIDI (TASK-26):
 * única fuente del mapa. Una voz nueva debe declarar aquí también su nota.
 *
 * El id de voz es lo que guarda `Track.sample` y lo que usará la exportación MIDI (TASK-26).
 */
export const DRUM_VOICES = [
  { id: 'bd', name: 'Kick', tag: 'kick', sound: 'bd', midi: 36 },
  { id: 'sd', name: 'Snare', tag: 'snare', sound: 'sd', midi: 38 },
  { id: 'rim', name: 'Rimshot', tag: 'perc', sound: 'rm', midi: 37 },
  { id: 'cp', name: 'Clap', tag: 'clap', sound: 'cp', midi: 39 },
  { id: 'hh', name: 'Hi-Hat', tag: 'hihat', sound: 'hh', midi: 42 },
  { id: 'oh', name: 'Open Hi-Hat', tag: 'hihat', sound: 'ho', midi: 46 },
  { id: 'rd', name: 'Ride', tag: 'perc', sound: 'cr', midi: 51 },
  { id: 'cr', name: 'Crash', tag: 'perc', sound: 'hh:1', midi: 49 },
  { id: 'lt', name: 'Low Tom', tag: 'perc', sound: 'lt', midi: 41 },
  { id: 'mt', name: 'Mid Tom', tag: 'perc', sound: 'mt', midi: 47 },
  { id: 'ht', name: 'High Tom', tag: 'perc', sound: 'ht', midi: 50 },
] as const;

export type DrumVoiceId = (typeof DRUM_VOICES)[number]['id'];
export type DrumVoice = (typeof DRUM_VOICES)[number];

export const DRUM_VOICE_IDS: readonly DrumVoiceId[] = DRUM_VOICES.map((voice) => voice.id);

const VOICE_BY_ID = new Map<string, DrumVoice>(DRUM_VOICES.map((voice) => [voice.id, voice]));
// `rd` usa el sonido `cr`, así que el mapa inverso solo se consulta con sonidos, nunca con ids.
const VOICE_BY_SOUND = new Map<string, DrumVoice>(DRUM_VOICES.map((voice) => [voice.sound, voice]));

export function isDrumVoiceId(value: string): value is DrumVoiceId {
  return VOICE_BY_ID.has(value);
}

export function getDrumVoice(id: string): DrumVoice | undefined {
  return VOICE_BY_ID.get(id);
}

/**
 * Traduce un id de voz al sonido Strudel. Cualquier otro valor (samples libres de
 * pistas antiguas o del LLM, p. ej. "perc") se deja tal cual.
 */
export function voiceToSound(sample: string): string {
  return VOICE_BY_ID.get(sample)?.sound ?? sample;
}

/** Inverso de `voiceToSound` para el parser de código → grid. */
export function soundToVoice(sound: string): string {
  return VOICE_BY_SOUND.get(sound)?.id ?? sound;
}

/** Nota General MIDI (canal 10) de una voz, o undefined si el id no es una voz de batería. */
export function voiceToMidiNote(id: string): number | undefined {
  return VOICE_BY_ID.get(id)?.midi;
}
