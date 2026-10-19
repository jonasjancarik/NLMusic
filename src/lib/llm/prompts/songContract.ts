/**
 * Contrato de salida de canciones para el LLM (TASK-27 AC-2), como texto de prompt.
 *
 * Decisión: el LLM devuelve un **delta de canción** (operaciones), no siempre la canción
 * completa. `replaceSong` cubre canciones nuevas y el modo código; el resto de operaciones
 * tocan solo lo que cambia, de modo que "haz el estribillo más denso" no reescribe (ni
 * estropea) las demás secciones (BR-004) y la respuesta cuesta menos tokens. Las
 * operaciones de pista de antes (add/update/remove/replace) siguen siendo válidas y se
 * aplican a la sección seleccionada, así que el flujo de un solo patrón no cambia.
 *
 * Importaciones relativas y sin React/Next: TASK-28 lo importa desde Node.
 */
import {
  MAX_BARS,
  MAX_BPM,
  MAX_REPEAT,
  MAX_TRACKS_PER_SECTION,
  MIN_BARS,
  MIN_BPM,
  MIN_REPEAT,
} from '../../song/constants';

export const SONG_RESPONSE_CONTRACT = `## Response format
Return exactly one JSON object and nothing else (no markdown fences, no comments, no prose):
{
  "bpm": number (optional, ${MIN_BPM}..${MAX_BPM}; include it only to set or change the tempo),
  "operations": [ ...Operation ] (at least one)
}

## Track object
{ "id": string (unique within its section, e.g. "kick", "snare", "hihat"), "name": string (optional), "sample": voice id from the drum guide, "steps": step string, "volume": number 0..1, "muted": boolean (optional, default false), "solo": boolean (optional, default false), "params": object (optional, see "Track synth params") }
"steps" is a step string (see the drum guide) with exactly stepsPerBar × bars steps for the section it belongs to.

## Section object
{ "id": string (short and lowercase: "intro", "verse", "chorus", "bridge", "break", "outro", "verse-2"), "name": string, "bars": ${MIN_BARS}..${MAX_BARS}, "tracks": [ ...Track ] (at most ${MAX_TRACKS_PER_SECTION}) }

## Operations
Song level:
1. replaceSong: a whole new song.
   { "type": "replaceSong", "song": { "stepsPerBar": 16 | 12, "sections": [ ...Section ], "arrangement": [ { "sectionId": string, "repeat": ${MIN_REPEAT}..${MAX_REPEAT} }, ... ] } }
2. addSection: { "type": "addSection", "section": Section }. Send setArrangement too, or the new section will not play.
3. updateSection: { "type": "updateSection", "sectionId": string, "name"?: string, "bars"?: number, "tracks"?: [ ...Track ] }
   "tracks" replaces every track of that section. If you change "bars", also send "tracks" with the new length.
4. removeSection: { "type": "removeSection", "sectionId": string } (it is also taken out of the arrangement)
5. setArrangement: { "type": "setArrangement", "arrangement": [ { "sectionId": string, "repeat": number }, ... ] } (the complete new order)
Track level, inside one section ("sectionId" is optional and defaults to the selected section):
6. add: { "type": "add", "sectionId"?: string, "track": Track }
7. update: { "type": "update", "sectionId"?: string, "id": track id, "patch": { any Track fields except id } }
8. remove: { "type": "remove", "sectionId"?: string, "id": track id }
9. replace: { "type": "replace", "sectionId"?: string, "tracks": [ ...Track ] }

## Choosing operations
- A new song, a new style, "start over", or a current song that is only a single empty or one-bar pattern and a request for a song or a groove: replaceSong.
- A change to one part ("make the chorus denser", "add a fill before the chorus", "more ghost notes in the verse"): change only that section with update, add, remove or updateSection. Never resend sections that do not change.
- A change to the form ("add a bridge", "end with the chorus twice"): addSection or removeSection plus setArrangement.
- A request about a sound or a single track that names no section ("louder snare", "add reverb to the hi-hat") applies to the selected section; one about the whole song ("faster", "more energy everywhere") changes every affected section.
- A tempo change is only the top-level "bpm".
- stepsPerBar can only change with replaceSong.

## Code mode (the context says "SOURCE OF TRUTH: Strudel code")
The user edited the Strudel code by hand, so section and track ids are not reliable. Use only replaceSong and rebuild the whole song from the code plus the request.

## Hard rules
- At most ${MAX_TRACKS_PER_SECTION} tracks per section.
- "sample" must be one of the voice ids in the drum guide.
- bpm ${MIN_BPM}..${MAX_BPM}, bars ${MIN_BARS}..${MAX_BARS}, repeat ${MIN_REPEAT}..${MAX_REPEAT}, section ids unique, track ids unique within a section.
- Every sectionId in the arrangement must exist.`;
