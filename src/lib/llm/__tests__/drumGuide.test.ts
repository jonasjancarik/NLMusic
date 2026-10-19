// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { DRUM_GUIDE } from '@lib/llm/prompts/drumGuide'
import { DRUM_GUIDE_EXAMPLES } from '@lib/llm/prompts/drumGuideExamples'
import { SONG_RESPONSE_CONTRACT } from '@lib/llm/prompts/songContract'
import { buildSongSystemBlocks, buildSongUserPrompt } from '@lib/llm/prompts/songPrompt'
import { interpretSongResponse } from '@lib/llm/songPipeline'
import { DRUM_VOICE_IDS, patternToSong } from '@lib/song'

describe('drum guide (TASK-27 AC-1)', () => {
  it('lists every drum voice and covers the required topics', () => {
    for (const id of DRUM_VOICE_IDS) expect(DRUM_GUIDE).toContain(`- ${id} (`)
    for (const topic of ['Crash ("cr") on step 1', 'fill in the last bar', 'Verse sparser than chorus', 'every 4–8 bars', 'stepsPerBar 12', 'ghost']) {
      expect(DRUM_GUIDE).toContain(topic)
    }
  })

  it('every example in the guide is a valid response', () => {
    const base = patternToSong({ bpm: 120, tracks: [] })
    // El ejemplo incremental se aplica sobre la canción del primer ejemplo (rock).
    const rock = interpretSongResponse({ text: JSON.stringify(DRUM_GUIDE_EXAMPLES[0].response) }, { turns: [], song: base })
    expect(rock.ok).toBe(true)
    if (!rock.ok) return

    for (const example of DRUM_GUIDE_EXAMPLES) {
      const result = interpretSongResponse({ text: JSON.stringify(example.response) }, { turns: [], song: rock.song })
      expect(result.ok ? [] : result.errors, example.title).toEqual([])
      if (result.ok) expect(result.warnings, example.title).toEqual([])
    }
    expect(DRUM_GUIDE_EXAMPLES.length).toBeGreaterThanOrEqual(3)
  })

  it('has no Next/React or path-alias imports so TASK-28 can load it from Node', async () => {
    const { readFileSync } = await import('node:fs')
    for (const file of ['drumGuide.ts', 'drumGuideExamples.ts', 'songContract.ts']) {
      const source = readFileSync(new URL(`../prompts/${file}`, import.meta.url), 'utf8')
      expect(source, file).not.toMatch(/from ['"](@lib|@store|@features|next|react)/)
    }
  })
})

describe('song prompts', () => {
  it('system blocks are static (identical between calls) so the prefix caches', () => {
    expect(buildSongSystemBlocks()).toEqual(buildSongSystemBlocks())
    const [contract, guide] = buildSongSystemBlocks()
    expect(contract).toContain(SONG_RESPONSE_CONTRACT)
    expect(guide).toBe(DRUM_GUIDE)
  })

  it('user prompt shows sections in step notation and the selected section', () => {
    const song = patternToSong({
      bpm: 100,
      tracks: [{ id: 'kick', name: 'Kick', sample: 'bd', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], volume: 0.9, muted: false, solo: false }],
    })
    const text = buildSongUserPrompt('make it denser', { turns: [], song, activeSectionId: 'main' })
    expect(text).toContain('User request: make it denser')
    expect(text).toContain('selected section: "main"')
    expect(text).toContain('steps: x...x...x...x...')
  })

  it('code mode prompt uses the Strudel code as the only source of truth', () => {
    const text = buildSongUserPrompt('slower', { turns: [], codeMode: { enabled: true, strudelCode: 's("bd")', bpmHint: 90 } })
    expect(text).toContain('SOURCE OF TRUTH: Strudel code')
    expect(text).toContain('Use only replaceSong')
    expect(text).not.toContain('Current song')
  })
})
