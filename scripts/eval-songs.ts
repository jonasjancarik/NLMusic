/**
 * Set de evaluación de canciones (TASK-27 AC-6/AC-7). Llama a la API de Claude, así que
 * NO forma parte de `npm test`.
 *
 *   npm run eval:songs                 # todos los casos
 *   npm run eval:songs -- rock funk    # solo esos casos (por id)
 *   npm run eval:songs -- --list       # lista los casos sin llamar a la API
 *
 * Usa ANTHROPIC_API_KEY (y ANTHROPIC_MODEL si existe) del entorno o de `.env.local`.
 * Sin key, sale sin error explicando cómo activarlo.
 *
 * Guarda en `evals/<fecha>/<caso>/`: song.json, song.strudel.js, song.mid (si existe
 * src/lib/midi de TASK-26) y attempts.json con cada salida cruda del modelo, más
 * `evals/<fecha>/summary.json`. Las comprobaciones son baratas y estructurales; la
 * calidad musical se juzga escuchando.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ClaudeAdapter } from '@lib/llm/adapters/claude.adapter';
import { DRUM_GUIDE_EXAMPLES } from '@lib/llm/prompts/drumGuideExamples';
import { interpretSongResponse, runSongPipeline } from '@lib/llm/songPipeline';
import type { SessionContext, Song, SongGeneration, SongLLMProvider, SongRepairRequest } from '@lib/types';

interface EvalCase {
  id: string;
  prompt: string;
  /** Canción de partida para casos incrementales (sin llamar a la API). */
  base?: 'rock-example';
  /** Comprobaciones propias del caso; devuelven un fallo o null. */
  expect?: (song: Song, base: Song | undefined) => string | null;
}

const BACKBEAT_VOICES = new Set(['sd', 'cp', 'rim']);

const CASES: EvalCase[] = [
  { id: 'rock', prompt: 'a simple rock song: intro, verse, chorus, verse, chorus' },
  {
    id: 'funk-halftime',
    prompt: 'a funk song with a busy verse full of ghost notes and a half-time chorus',
    expect: (song) => (song.sections.length >= 2 ? null : 'expected at least a verse and a chorus'),
  },
  {
    id: 'punk-stop',
    prompt: 'fast punk song with a full stop (one bar of silence after the crash) before the last chorus',
    expect: (song) => (song.bpm >= 160 ? null : `expected a fast tempo, got ${song.bpm} bpm`),
  },
  {
    id: 'shuffle',
    prompt: 'a slow blues shuffle with a turnaround fill every 4 bars',
    expect: (song) => (song.stepsPerBar === 12 ? null : `expected stepsPerBar 12, got ${song.stepsPerBar}`),
  },
  {
    id: 'intro-2-bars',
    prompt: 'start with a 2-bar intro on toms only, then a driving pop groove',
    expect: (song) => {
      const first = song.sections.find((section) => section.id === song.arrangement[0]?.sectionId);
      return first?.bars === 2 ? null : `expected the first section to be 2 bars, got ${first?.bars}`;
    },
  },
  { id: 'house-breakdown', prompt: 'a four-on-the-floor house track with a breakdown and a drop' },
  { id: 'boom-bap', prompt: 'boom bap hip-hop beat with a verse and a hook, lazy feel' },
  { id: 'bossa', prompt: 'a bossa nova groove with rim clicks and a soft ride' },
  {
    id: 'balada-es',
    prompt: 'una balada a 70 bpm con verso tranquilo y estribillo más intenso',
    expect: (song) => (Math.abs(song.bpm - 70) <= 6 ? null : `expected about 70 bpm, got ${song.bpm}`),
  },
  {
    id: 'denser-chorus',
    base: 'rock-example',
    prompt: 'make the chorus denser',
    expect: (song, base) => unchangedExcept(song, base, ['chorus']),
  },
  {
    id: 'add-bridge',
    base: 'rock-example',
    prompt: 'add a 4-bar bridge before the last chorus',
    expect: (song, base) =>
      song.sections.length > (base?.sections.length ?? 0) ? unchangedExcept(song, base, []) : 'no section was added',
  },
];

function unchangedExcept(song: Song, base: Song | undefined, allowed: string[]): string | null {
  if (!base) return null;
  const changed = base.sections
    .filter((section) => !allowed.includes(section.id))
    .filter((section) => JSON.stringify(song.sections.find((s) => s.id === section.id)) !== JSON.stringify(section))
    .map((section) => section.id);
  if (changed.length > 0) return `sections that should not change were modified: ${changed.join(', ')}`;
  if (allowed.length > 0) {
    const touched = allowed.some(
      (id) => JSON.stringify(song.sections.find((s) => s.id === id)) !== JSON.stringify(base.sections.find((s) => s.id === id)),
    );
    if (!touched) return `expected a change in: ${allowed.join(', ')}`;
  }
  return null;
}

interface CheckResult {
  failures: string[];
  warnings: string[];
}

/** AC-7: comprobaciones automáticas baratas. El crash es aviso, no fallo. */
function checkSong(song: Song): CheckResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const arranged = new Set(song.arrangement.map((item) => item.sectionId));
  const hits = (steps: (0 | 1)[]) => steps.some((step) => step === 1);

  for (const section of song.sections) {
    if (!arranged.has(section.id)) failures.push(`section "${section.id}" is not in the arrangement`);
    const playing = section.tracks.filter((track) => !track.muted && hits(track.steps));
    if (!playing.some((track) => track.sample === 'bd')) failures.push(`section "${section.id}" has no kick`);
    if (!playing.some((track) => BACKBEAT_VOICES.has(track.sample ?? ''))) {
      failures.push(`section "${section.id}" has no snare, clap or rim`);
    }
    if (!playing.some((track) => track.sample === 'cr' && track.steps[0] === 1)) {
      warnings.push(`section "${section.id}" has no crash on its first step`);
    }
  }
  return { failures, warnings };
}

/** Envuelve el adaptador para guardar cada salida cruda (y ver qué corrigió el reintento). */
function recording(provider: SongLLMProvider) {
  const attempts: { repairErrors?: string[]; output: SongGeneration; ms: number }[] = [];
  const wrapped: SongLLMProvider = {
    async generateSong(prompt: string, context: SessionContext, repair?: SongRepairRequest) {
      const started = Date.now();
      const output = await provider.generateSong(prompt, context, repair);
      attempts.push({ repairErrors: repair?.errors, output, ms: Date.now() - started });
      return output;
    },
  };
  return { wrapped, attempts };
}

function baseSong(kind: EvalCase['base']): Song | undefined {
  if (kind !== 'rock-example') return undefined;
  const result = interpretSongResponse({ text: JSON.stringify(DRUM_GUIDE_EXAMPLES[0].response) }, { turns: [] });
  if (!result.ok) throw new Error(`base song is invalid: ${result.errors.join('; ')}`);
  return result.song;
}

type SongToMidi = (song: Song) => Uint8Array;

/** La exportación MIDI llega con TASK-26; si aún no existe, se omite el .mid. */
async function loadSongToMidi(): Promise<SongToMidi | undefined> {
  const file = path.resolve('src/lib/midi/index.ts');
  if (!existsSync(file)) return undefined;
  const midiModule = (await import(pathToFileURL(file).href)) as { songToMidi?: SongToMidi };
  return midiModule.songToMidi;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    for (const evalCase of CASES) console.log(`${evalCase.id.padEnd(16)} ${evalCase.prompt}`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY && existsSync('.env.local')) {
    process.loadEnvFile('.env.local');
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(
      'Skipping the song eval: ANTHROPIC_API_KEY is not set.\n' +
        'It calls the Claude API (about one request per case, more when a retry is needed).\n' +
        'Set ANTHROPIC_API_KEY in the environment or in .env.local and run `npm run eval:songs` again.',
    );
    return;
  }

  const selected = args.filter((arg) => !arg.startsWith('--'));
  const unknown = selected.filter((id) => !CASES.some((evalCase) => evalCase.id === id));
  if (unknown.length > 0) {
    console.error(`Unknown case(s): ${unknown.join(', ')}. Use --list to see them.`);
    process.exitCode = 1;
    return;
  }
  const cases = selected.length > 0 ? CASES.filter((evalCase) => selected.includes(evalCase.id)) : CASES;

  const model = process.env.ANTHROPIC_MODEL;
  const adapter = new ClaudeAdapter({ apiKey, model });
  const songToMidi = await loadSongToMidi();
  const runDir = path.join('evals', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(runDir, { recursive: true });
  console.log(`Model: ${model ?? '(adapter default)'} · ${cases.length} case(s) · results in ${runDir}`);
  if (!songToMidi) console.log('MIDI export not available yet (TASK-26); skipping .mid files.');

  const summary = [];
  for (const evalCase of cases) {
    const caseDir = path.join(runDir, evalCase.id);
    mkdirSync(caseDir, { recursive: true });
    const base = baseSong(evalCase.base);
    const context: SessionContext = { turns: [], song: base, activeSectionId: base?.arrangement[0]?.sectionId };
    const { wrapped, attempts } = recording(adapter);

    const result = await runSongPipeline(wrapped, evalCase.prompt, context);
    writeFileSync(path.join(caseDir, 'attempts.json'), JSON.stringify({ prompt: evalCase.prompt, attempts }, null, 2));

    let failures: string[] = [];
    let warnings: string[] = [];
    if (result.ok) {
      writeFileSync(path.join(caseDir, 'song.json'), JSON.stringify(result.song, null, 2));
      writeFileSync(path.join(caseDir, 'song.strudel.js'), `${result.strudelCode}\n`);
      if (songToMidi) writeFileSync(path.join(caseDir, 'song.mid'), songToMidi(result.song));
      const checks = checkSong(result.song);
      const custom = evalCase.expect?.(result.song, base);
      failures = [...checks.failures, ...(custom ? [custom] : [])];
      warnings = [...checks.warnings, ...result.warnings];
    } else {
      failures = result.kind === 'invalid' ? ['invalid after retries', ...result.errors] : [`provider error: ${result.error}`];
    }

    const status = failures.length === 0 ? 'PASS' : 'FAIL';
    summary.push({
      id: evalCase.id,
      status,
      attempts: result.attempts,
      ms: attempts.reduce((sum, attempt) => sum + attempt.ms, 0),
      bpm: result.ok ? result.song.bpm : undefined,
      sections: result.ok ? result.song.arrangement.map((item) => `${item.sectionId}×${item.repeat}`).join(' ') : undefined,
      failures,
      warnings,
    });
    console.log(`${status} ${evalCase.id} (attempts: ${result.attempts})`);
    for (const failure of failures) console.log(`   ✗ ${failure}`);
    for (const warning of warnings) console.log(`   ! ${warning}`);
  }

  writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({ model: model ?? null, cases: summary }, null, 2));
  const passed = summary.filter((entry) => entry.status === 'PASS').length;
  console.log(`\n${passed}/${summary.length} passed. Summary: ${path.join(runDir, 'summary.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
