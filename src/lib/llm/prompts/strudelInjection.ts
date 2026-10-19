/**
 * Synth-parameter reference injected into the system prompt (TASK-21).
 * Kept as an embedded string (no fs at runtime) so it bundles with Next.js.
 * The prompt is always English (spec section 10).
 *
 * @see BR-NEW-003 delayfeedback must never reach 1
 */
export const STRUDEL_INJECTION = `## Track synth params (optional \`params\` object on a track)
Every field is optional. Ranges are hard limits; values outside them are rejected.

| Field | Range | Meaning | Strudel method |
|---|---|---|---|
| synth | "sample" | "sine" | "sawtooth" | "square" | "triangle" | sound source; "sample" = drum sample | s("<synth>") |
| note | Strudel mini-notation, e.g. "c2", "<c2 eb2 f2>" | pitch; only used when synth is an oscillator | note() |
| attack | 0..2 s | fade-in time | .attack() |
| decay | 0..0.5 s | time to fall to the sustain level | .decay() |
| sustain | 0..1 | held level | .sustain() |
| release | 0..2 s | fade-out time | .release() |
| filterType | "lp" | "hp" | low-pass or high-pass | .lpf() / .hpf() |
| filterCutoff | 20..20000 Hz | filter frequency | .lpf(x) / .hpf(x) |
| filterQ | 0..20 | filter resonance | .lpq(x) / .hpq(x) |
| room | 0..1 | reverb amount | .room() |
| delay | 0..1 | delay (echo) amount | .delay() |
| delaytime | 0..1 s | echo spacing; only used together with delay | .delaytime() |
| delayfeedback | 0..0.9 | echo repeats; only used together with delay | .delayfeedback() |
| pan | 0..1 | 0 = left, 0.5 = centre, 1 = right | .pan() |

### Patch semantics for params
A \`params\` patch is MERGED into the track's existing params, field by field:
- Set or change a value: include the field with the new value.
- Remove or disable an effect: include the field with value 0 (never omit it when the intent is removal).
- Leave a value unchanged: omit the field from the patch entirely.
Correct — only changes room, an existing delay is preserved:
  patch: { "params": { "room": 0 } }
Incorrect when the intent is only to remove room — it would also wipe the delay:
  patch: { "params": { "room": 0, "delay": 0 } }
Never set delayfeedback >= 1 — it creates an infinite audio loop.
Setting synth to an oscillator turns the 16 steps into note gates; "note" defaults to "c3".

### Params examples
User: "Add reverb to track 2" (snare-1)
→ { "type": "update", "id": "snare-1", "patch": { "params": { "room": 0.6 } } }
User: "Remove reverb from track 2"
→ { "type": "update", "id": "snare-1", "patch": { "params": { "room": 0 } } }
User: "Make track 1 play a sine wave on C2"
→ { "type": "update", "id": "kick-1", "patch": { "params": { "synth": "sine", "note": "c2" } } }
User: "Add a slow delay to the hi-hat"
→ { "type": "update", "id": "hihat-1", "patch": { "params": { "delay": 0.4, "delaytime": 0.5, "delayfeedback": 0.3 } } }
User: "Pan the snare to the right"
→ { "type": "update", "id": "snare-1", "patch": { "params": { "pan": 0.8 } } }
User: "Add a low-pass filter to the kick"
→ { "type": "update", "id": "kick-1", "patch": { "params": { "filterType": "lp", "filterCutoff": 500 } } }`;
