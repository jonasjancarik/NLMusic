/**
 * Guía de batería (TASK-27 AC-1): cómo escribir grooves y canciones creíbles.
 * El LLM inventa los grooves; no hay biblioteca. Esta guía es la que fija la calidad.
 *
 * Es un string importable (no un .md leído con fs) para que se empaquete con Next.js
 * y para que el servidor MCP (TASK-28) la exponga desde Node. Solo importaciones
 * relativas y sin React/Next.
 */
import { DRUM_VOICES } from '../../song/drumVoices';
import { DRUM_GUIDE_EXAMPLES } from './drumGuideExamples';

const VOICE_ROLES: Record<string, string> = {
  bd: 'the pulse; locks with the bass. Main hits on strong beats, pickups on 16ths before them',
  sd: 'the backbeat (beats 2 and 4 in a normal feel, beat 3 in half-time); ghost notes between',
  rim: 'side-stick or rimshot; quiet verses, ballads, bossa and reggae cross-stick',
  cp: 'clap; layered on the backbeat or as an alternative to the snare in electronic styles',
  hh: 'closed hi-hat; the timekeeper in verses (8ths or 16ths), accents on the beats',
  oh: 'open hi-hat; lifts energy on off-beats or at the end of a phrase',
  rd: 'ride cymbal; timekeeper for choruses and louder parts, bigger and brighter than the closed hi-hat',
  cr: 'crash; marks the first beat of a new section, a big accent, or the end of a fill',
  lt: 'low (floor) tom; end of fills, tribal grooves',
  mt: 'mid tom; fills, moving downwards from the high tom',
  ht: 'high tom; start of fills',
};

function renderVoices(): string {
  return DRUM_VOICES.map((voice) => `- ${voice.id} (${voice.name}): ${VOICE_ROLES[voice.id] ?? voice.tag}`).join('\n');
}

function renderExamples(): string {
  return DRUM_GUIDE_EXAMPLES.map(
    (example, index) =>
      `### Example ${index + 1}: ${example.title}\nUser: "${example.request}"\n→ ${JSON.stringify(example.response)}`,
  ).join('\n\n');
}

export const DRUM_GUIDE = `# Drum guide

## Voices (use these ids as "sample")
${renderVoices()}

## The step grid
- 4/4 only. With stepsPerBar 16, each beat has 4 steps (16th notes): beat 1 = step 1, beat 2 = step 5, beat 3 = step 9, beat 4 = step 13. The "and" of each beat is the 3rd step of that beat.
- With stepsPerBar 12, each beat has 3 steps (8th-note triplets): beats start at steps 1, 4, 7, 10. Use 12 for shuffle, swing, blues, 6/8-feel ballads, jazz ride patterns and triplet hip-hop. Use 16 for everything straight (rock, pop, funk, punk, disco, house, techno, drum and bass, reggaeton, bossa). stepsPerBar applies to the whole song.
- Write each bar as exactly stepsPerBar characters and separate bars with "|". A 4-bar section at 16 steps per bar is four 16-character groups.
- Characters: "." rest, "x" normal hit, "X" accent, "g" ghost note (very soft). Use X and g to make grooves breathe: accents on the beats of the hi-hat or ride, ghost notes on the snare between backbeats in funk, soul, hip-hop and jazz.

## Song form
- Give each section the length of a musical phrase: usually 4 or 8 bars, 2 for an intro or a break, 1 for a stop or a pickup. Use "repeat" in the arrangement to play a section several times; remember that everything in the section (crash, fill) repeats with it.
- Crash ("cr") on step 1 of the first bar of every new section, usually together with the kick. Not on every bar.
- Put a fill in the last bar of a section when the next section is different: drop the hi-hat or ride for the last 2 beats and play snare and/or toms (ht → mt → lt) in 16ths or triplets, often with a crescendo of accents. The bars before the fill keep the main groove.
- Verse sparser than chorus: in the verse keep time with a closed hi-hat ("hh") and a simpler kick; in the chorus switch to ride ("rd") or open hi-hat ("oh"), add kick notes, raise volumes slightly.
- Vary something every 4–8 bars (an extra kick, an open hi-hat at the end of a bar, a short fill) so loops do not sound mechanical, while the core groove stays recognisable.
- Half-time: snare only on beat 3 (step 9 at 16 steps), kick spread out; it feels slower without changing bpm. Double-time: snare on every beat or on the "and"s.
- A stop or break: a 1–2 bar section with only a crash and kick on beat 1, or silence after beat 1.
- Every playing section needs at least a kick and a snare (or clap/rim as the backbeat), except deliberate breaks or intros where the user asks for something else.
- Use the arrangement to tell the story: intro → verse → chorus → verse → chorus → (bridge) → chorus → outro. Every section you define should appear in the arrangement.

## Style hints (starting points, not templates)
- Rock / pop: kick on 1 and 3 with variations, snare on 2 and 4, 8th-note hi-hat, ride or open hat in choruses. 100–140 bpm.
- Punk: fast (170–200 bpm), kick-snare alternating on 8ths ("x.X.") or snare on every off-beat, crash-driven choruses, abrupt stops.
- Funk / soul: 16th hi-hat with accents, syncopated kick, snare ghost notes, open hi-hat on the last "and". 90–110 bpm.
- Hip-hop / boom bap: 85–95 bpm, lazy kick pattern, snare on 2 and 4, swung 16ths can be faked with ghost notes; trap uses 130–150 bpm with half-time snare and rolling hi-hats.
- House / techno: four-on-the-floor kick, clap or snare on 2 and 4, open hi-hat on every off-beat. 120–135 bpm.
- Shuffle / blues / swing: stepsPerBar 12, hi-hat or ride on the 1st and 3rd triplet of each beat ("x.x").
- Reggae one drop: kick and rim together on beat 3 only, hi-hat in 8ths or triplets.

## Dynamics and volume
- "volume" (0–1) sets the overall level of a track: kick 0.85–0.95, snare 0.75–0.9, hi-hats 0.45–0.6, ride 0.55–0.65, crash 0.6–0.75, toms 0.7–0.8.
- Accents and ghost notes come from X and g inside the steps, not from volume.

## Examples of valid responses
${renderExamples()}`;
