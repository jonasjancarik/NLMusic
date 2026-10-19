import { MAX_BARS, MAX_BPM, MAX_REPEAT, MAX_TRACKS_PER_SECTION, MIN_BARS, MIN_BPM, MIN_REPEAT } from '../lib/song/constants';
import { DRUM_GUIDE } from '../lib/llm/prompts/drumGuide';

/**
 * Texto de `get_song_guide` (TASK-28 AC-2): formato de la canción + la guía de batería
 * de la app (TASK-27), la misma que recibe el LLM de la API. Sin React/Next.
 */
export const SONG_FORMAT = `# Song format (for validate_song, save_song, export_midi and export_strudel)

Pass ONE JSON object:
{
  "bpm": ${MIN_BPM}..${MAX_BPM},
  "stepsPerBar": 16 | 12,
  "sections": [ Section, ... ],
  "arrangement": [ { "sectionId": string, "repeat": ${MIN_REPEAT}..${MAX_REPEAT} }, ... ]
}

Section: { "id": "verse", "name": "Verse", "bars": ${MIN_BARS}..${MAX_BARS}, "tracks": [ Track, ... up to ${MAX_TRACKS_PER_SECTION} ] }
Track:   { "id": "kick", "sample": <drum voice id>, "steps": "x...|x...", "volume": 0..1, "muted"?: boolean, "solo"?: boolean }

- "steps" is a step string with exactly stepsPerBar × bars steps for its section (see the drum guide below). A 0/1 array plus an optional "velocity" array also works.
- "name" (section and track), "volume", "muted" and "solo" are optional; defaults are filled in. "sample" must be one of the voice ids below.
- Every section id used in the arrangement must exist, section ids must be unique, track ids must be unique within a section.
- The examples below are shown as app responses ({ "bpm", "operations": [ { "type": "replaceSong", "song": {...} } ] }). The tools accept that wrapper too, but plain song objects are simpler: use the "song" part.
- When validate_song fails, every error names the section and track and what is wrong. Fix exactly those and validate again.
`;

export function buildSongGuide(): string {
  return `${SONG_FORMAT}\n${DRUM_GUIDE}`;
}
