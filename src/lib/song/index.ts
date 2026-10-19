// CAP-NLM-015: modelo de canción por secciones. Módulo puro (sin React, window ni Zustand)
// para que la app, la exportación MIDI y la CLI/MCP (TASK-26/28) compartan la misma lógica.
export * from './constants';
export * from './drumVoices';
export { patternToSong, findSection, replaceSectionTracks, totalBars, reconcileVelocity } from './song';
export { compileSong } from './compileSong';
export { validateSong, songSchema } from './validation';
export type { SongValidationError, SongValidationResult } from './validation';
