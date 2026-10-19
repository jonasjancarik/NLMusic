import type { SessionContext, Song, SongRepairRequest } from '@lib/types';
import { formatStepString, patternToSong } from '@lib/song';
import { DRUM_GUIDE } from './drumGuide';
import { SONG_RESPONSE_CONTRACT } from './songContract';
import { STRUDEL_INJECTION } from './strudelInjection';

const ROLE = `You are NLMusic, a drummer and arranger who writes drum parts and whole drum songs for a live-coding sequencer (Strudel). You invent every groove yourself, following the drum guide. You answer with JSON only.`;

/**
 * Bloques del prompt de sistema para canciones, de más general a más específico.
 * Son estáticos (nada por petición), así que el adaptador marca el último como cacheable
 * y los tres se reutilizan entre peticiones (TASK-27 AC-5, alineado con TASK-17).
 */
export function buildSongSystemBlocks(): string[] {
  return [`${ROLE}\n\n${SONG_RESPONSE_CONTRACT}`, DRUM_GUIDE, STRUDEL_INJECTION];
}

/** Canción que sirve de base al delta: la del contexto o el patrón anterior convertido. */
export function contextSong(context: SessionContext): Song | undefined {
  if (context.song) return context.song;
  if (context.previous) return patternToSong(context.previous);
  return undefined;
}

function describeSong(song: Song, activeSectionId: string | undefined): string[] {
  const hasContent = song.sections.some((section) => section.tracks.length > 0);
  if (!hasContent) {
    return ['Current song: empty (use replaceSong).'];
  }
  const selected = song.sections.some((s) => s.id === activeSectionId) ? activeSectionId : song.arrangement[0]?.sectionId;
  const arrangement = song.arrangement.map((item) => `${item.sectionId} ×${item.repeat}`).join(' → ');
  const lines = [
    'Current song (source of truth):',
    `  bpm: ${song.bpm}`,
    `  stepsPerBar: ${song.stepsPerBar}`,
    `  arrangement: ${arrangement}`,
    `  selected section: "${selected}" (track operations without sectionId apply here)`,
  ];
  for (const section of song.sections) {
    lines.push('', `Section "${section.id}" (name "${section.name}", ${section.bars} bars):`);
    if (section.tracks.length === 0) lines.push('  (no tracks)');
    for (const track of section.tracks) {
      const flags = [track.muted ? 'muted' : '', track.solo ? 'solo' : ''].filter(Boolean).join(', ');
      const params = track.params && Object.keys(track.params).length > 0 ? ` params ${JSON.stringify(track.params)}` : '';
      lines.push(
        `  - id "${track.id}" sample "${track.sample ?? track.tag ?? ''}" volume ${track.volume}${flags ? ` [${flags}]` : ''}${params}`,
        `    steps: ${formatStepString(track.steps, track.velocity, song.stepsPerBar)}`,
      );
    }
  }
  return lines;
}

/**
 * Mensaje de usuario con la petición y el estado actual.
 * - Grid: la canción completa en notación compacta, para que el LLM pueda referirse a
 *   secciones y pistas por id.
 * - Code mode: el código Strudel es la única fuente de verdad y solo vale replaceSong.
 * @see BR-004
 * @see BR-009
 */
export function buildSongUserPrompt(prompt: string, context: SessionContext): string {
  const lines: string[] = [`User request: ${prompt}`, ''];

  if (context.codeMode?.enabled) {
    lines.push(
      'SOURCE OF TRUTH: Strudel code (the user has edited the code directly).',
      'Section and track ids are NOT reliable. Use only replaceSong.',
      '',
      'Current Strudel code (what is actually playing):',
      context.codeMode.strudelCode,
      '',
      `BPM hint: ${context.codeMode.bpmHint}`,
    );
  } else {
    const song = contextSong(context);
    lines.push(...(song ? describeSong(song, context.activeSectionId) : ['Current song: empty (use replaceSong).']));
  }

  if (context.turns.length > 0) {
    lines.push('', 'Recent conversation:');
    context.turns.slice(-4).forEach((turn) => lines.push(`  ${turn.role}: ${turn.content}`));
  }

  return lines.join('\n');
}

/** Mensaje de corrección para el reintento: errores concretos y qué devolver. */
export function buildRepairPrompt(repair: SongRepairRequest): string {
  return [
    'Your previous response was rejected. Problems found:',
    ...repair.errors.map((error) => `- ${error}`),
    '',
    'Return the complete corrected JSON response for the original request (same format, all operations, not only the fixes). JSON only.',
  ].join('\n');
}
