// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { SessionContext, Song, SongGeneration, SongLLMProvider } from '@lib/types'
import { DRUM_GUIDE_EXAMPLES } from '@lib/llm/prompts/drumGuideExamples'
import { MAX_SONG_REPAIRS, interpretSongResponse, runSongPipeline } from '@lib/llm/songPipeline'

const rockResponse = DRUM_GUIDE_EXAMPLES[0].response as {
  bpm: number
  operations: [{ type: 'replaceSong'; song: Record<string, unknown> }]
}

/** Proveedor simulado: devuelve las respuestas en orden y registra las llamadas. */
function mockProvider(...responses: (string | SongGeneration | Error)[]) {
  const generateSong = vi.fn<SongLLMProvider['generateSong']>()
  for (const response of responses) {
    if (response instanceof Error) generateSong.mockRejectedValueOnce(response)
    else generateSong.mockResolvedValueOnce(typeof response === 'string' ? { text: response } : response)
  }
  return { generateSong }
}

async function rockSong(): Promise<Song> {
  const result = await runSongPipeline(mockProvider(JSON.stringify(rockResponse)), 'rock', { turns: [] })
  if (!result.ok) throw new Error('fixture failed')
  return result.song
}

describe('runSongPipeline — parsing (TASK-27 AC-8)', () => {
  it('turns a replaceSong response into a valid multi-section song and compiles it', async () => {
    const provider = mockProvider(JSON.stringify(rockResponse))
    const result = await runSongPipeline(provider, 'rock song', { turns: [] })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.attempts).toBe(1)
    expect(result.song.bpm).toBe(118)
    expect(result.song.sections.map((s) => s.id)).toEqual(['intro', 'verse', 'chorus'])
    const verseSnare = result.song.sections[1].tracks.find((t) => t.id === 'snare')!
    expect(verseSnare.steps).toHaveLength(64)
    expect(verseSnare.velocity).toHaveLength(64) // X/g → dinámica por paso
    expect(verseSnare.name).toBe('Snare') // nombre por defecto de la voz
    expect(result.strudelCode).toContain('arrange(')
    expect(result.activeSectionId).toBe('intro')
  })

  it('accepts JSON wrapped in markdown fences', async () => {
    const provider = mockProvider('```json\n' + JSON.stringify(rockResponse) + '\n```')
    const result = await runSongPipeline(provider, 'rock', { turns: [] })
    expect(result.ok).toBe(true)
  })

  it('keeps the old single-pattern contract working: { bpm, operations: [replace] } on the main section', async () => {
    const provider = mockProvider(
      JSON.stringify({
        bpm: 128,
        operations: [{ type: 'replace', tracks: [{ id: 'kick-1', name: 'Kick', sample: 'bd', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], volume: 0.9, muted: false, solo: false }] }],
      }),
    )
    const result = await runSongPipeline(provider, 'techno', { turns: [], previous: { bpm: 120, tracks: [] } })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.song.sections).toHaveLength(1)
    expect(result.song.sections[0].id).toBe('main')
    expect(result.song.bpm).toBe(128)
    // Una sección de 1 compás compila igual que antes (sin arrange)
    expect(result.strudelCode).not.toContain('arrange(')
  })

  it('applies TrackParams patches (TASK-21) to the selected section', async () => {
    const song = await rockSong()
    const provider = mockProvider(JSON.stringify({ operations: [{ type: 'update', id: 'snare', patch: { params: { room: 0.5 } } }] }))
    const result = await runSongPipeline(provider, 'reverb on the snare', { turns: [], song, activeSectionId: 'chorus' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const chorus = result.song.sections.find((s) => s.id === 'chorus')!
    expect(chorus.tracks.find((t) => t.id === 'snare')!.params).toEqual({ room: 0.5 })
    expect(result.song.sections.find((s) => s.id === 'verse')!.tracks.find((t) => t.id === 'snare')!.params).toBeUndefined()
  })
})

describe('runSongPipeline — retry with concrete errors (AC-3)', () => {
  it('retries once with the validation errors and the rejected output, then succeeds', async () => {
    const broken = structuredClone(rockResponse)
    const verse = (broken.operations[0].song.sections as { tracks: { steps: string }[] }[])[1]
    verse.tracks[2].steps = 'x.......x.x.....' // 1 compás en una sección de 4

    const provider = mockProvider(JSON.stringify(broken), JSON.stringify(rockResponse))
    const result = await runSongPipeline(provider, 'rock', { turns: [] })

    expect(result.ok).toBe(true)
    expect(provider.generateSong).toHaveBeenCalledTimes(2)
    const repair = provider.generateSong.mock.calls[1][2]!
    expect(repair.previousOutput).toBe(JSON.stringify(broken))
    expect(repair.errors).toEqual([
      'Section "verse" › track "kick" › steps: has 16 steps but must have 64 (stepsPerBar 16 × 4 bars)',
    ])
  })

  it('reports invalid JSON and unknown step characters as retryable errors', async () => {
    const badChar = structuredClone(rockResponse)
    ;(badChar.operations[0].song.sections as { tracks: { steps: string }[] }[])[0].tracks[0].steps = 'o...............|................'
    const provider = mockProvider('not json at all', JSON.stringify(badChar), JSON.stringify(rockResponse))

    const result = await runSongPipeline(provider, 'rock', { turns: [] })

    expect(result.ok).toBe(true)
    expect(provider.generateSong.mock.calls[1][2]!.errors[0]).toContain('not valid JSON')
    expect(provider.generateSong.mock.calls[2][2]!.errors[0]).toContain('unknown character "o" at step 1')
  })

  it('tells the model the output was cut off when it hit max_tokens', () => {
    const result = interpretSongResponse({ text: '{"operations":[{"type":"replaceSong","song":{', truncated: true }, { turns: [] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('cut off')
  })

  it(`gives up after ${MAX_SONG_REPAIRS} repairs with kind "invalid" and the last errors`, async () => {
    const provider = mockProvider('{}', '{}', '{}', JSON.stringify(rockResponse))
    const result = await runSongPipeline(provider, 'rock', { turns: [] })

    expect(provider.generateSong).toHaveBeenCalledTimes(MAX_SONG_REPAIRS + 1)
    expect(result).toMatchObject({ ok: false, kind: 'invalid', attempts: MAX_SONG_REPAIRS + 1 })
    if (result.ok || result.kind !== 'invalid') return
    expect(result.errors[0]).toContain('operations')
  })

  it('does not retry on provider errors', async () => {
    const provider = mockProvider(new Error('Network timeout'))
    const result = await runSongPipeline(provider, 'rock', { turns: [] })

    expect(result).toEqual({ ok: false, kind: 'provider', error: 'Network timeout', attempts: 1 })
    expect(provider.generateSong).toHaveBeenCalledTimes(1)
  })

  it('rejects unknown drum voices and more than 8 tracks per section (BR-006)', () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, sample: 'bd', steps: 'x...............' }))
    const result = interpretSongResponse(
      {
        text: JSON.stringify({
          operations: [
            {
              type: 'replaceSong',
              song: { sections: [{ id: 'a', bars: 1, tracks: tooMany }, { id: 'b', bars: 1, tracks: [{ id: 'k', sample: 'cowbell', steps: 'x...............' }] }], arrangement: [{ sectionId: 'a', repeat: 1 }, { sectionId: 'b', repeat: 1 }] },
            },
          ],
        }),
      },
      { turns: [] },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.join('\n')).toContain('"cowbell" is not a drum voice')
  })
})

describe('runSongPipeline — incremental deltas (BR-004)', () => {
  it('"make the chorus denser" changes only the chorus; other sections stay identical', async () => {
    const song = await rockSong()
    const denserKick = 'x.x...x.x.x..x..|x.x...x.x.x..x..|x.x...x.x.x..x..|x.x...x.x.......'
    const provider = mockProvider(
      JSON.stringify({ operations: [{ type: 'update', sectionId: 'chorus', id: 'kick', patch: { steps: denserKick } }] }),
    )
    const context: SessionContext = { turns: [], song, activeSectionId: 'verse' }

    const result = await runSongPipeline(provider, 'make the chorus denser', context)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.song.sections.find((s) => s.id === 'intro')).toStrictEqual(song.sections[0])
    expect(result.song.sections.find((s) => s.id === 'verse')).toStrictEqual(song.sections[1])
    expect(result.song.arrangement).toEqual(song.arrangement)
    const chorusKick = result.song.sections.find((s) => s.id === 'chorus')!.tracks.find((t) => t.id === 'kick')!
    expect(chorusKick.steps.filter((step) => step === 1).length).toBeGreaterThan(
      song.sections[2].tracks.find((t) => t.id === 'kick')!.steps.filter((step) => step === 1).length,
    )
    expect(result.activeSectionId).toBe('chorus') // el grid muestra lo que cambió
  })

  it('adds a section and rearranges without touching existing sections', async () => {
    const song = await rockSong()
    const provider = mockProvider(
      JSON.stringify({
        operations: [
          { type: 'addSection', section: { id: 'break', name: 'Break', bars: 1, tracks: [{ id: 'crash', sample: 'cr', steps: 'X...............' }, { id: 'kick', sample: 'bd', steps: 'x...............' }] } },
          { type: 'setArrangement', arrangement: [...song.arrangement, { sectionId: 'break', repeat: 1 }] },
        ],
      }),
    )
    const result = await runSongPipeline(provider, 'end with a stop', { turns: [], song })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.song.sections.slice(0, 3)).toEqual(song.sections)
    expect(result.song.arrangement.at(-1)).toEqual({ sectionId: 'break', repeat: 1 })
    expect(result.warnings).toEqual([])
  })

  it('warns when a section is left out of the arrangement', async () => {
    const song = await rockSong()
    const provider = mockProvider(
      JSON.stringify({ operations: [{ type: 'addSection', section: { id: 'bridge', bars: 1, tracks: [{ id: 'kick', sample: 'bd', steps: 'x...............' }] } }] }),
    )
    const result = await runSongPipeline(provider, 'add a bridge', { turns: [], song })
    expect(result.ok && result.warnings[0]).toContain('Bridge')
  })

  it('turns a reference to a missing section into a retryable error', async () => {
    const song = await rockSong()
    const result = interpretSongResponse(
      { text: JSON.stringify({ operations: [{ type: 'updateSection', sectionId: 'bridge', bars: 2 }] }) },
      { turns: [], song },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toBe('updateSection: section "bridge" does not exist; current sections: "intro", "verse", "chorus"')
  })

  it('changes bpm only with the top-level bpm', async () => {
    const song = await rockSong()
    const result = await runSongPipeline(
      mockProvider(JSON.stringify({ bpm: 140, operations: [{ type: 'setArrangement', arrangement: song.arrangement }] })),
      'faster',
      { turns: [], song },
    )
    expect(result.ok && result.song.bpm).toBe(140)
    expect(result.ok && result.song.sections).toEqual(song.sections)
  })
})

describe('runSongPipeline — code mode guards (TASK-09, AC-4)', () => {
  const codeMode = { enabled: true as const, strudelCode: 's("bd sd")', bpmHint: 97 }

  it('rejects incremental operations in code mode and asks for replaceSong', () => {
    const result = interpretSongResponse(
      { text: JSON.stringify({ operations: [{ type: 'update', id: 'kick', patch: { volume: 1 } }] }) },
      { turns: [], codeMode },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('only replaceSong is allowed')
  })

  it('accepts replaceSong in code mode and keeps the bpm hint when none is given', () => {
    const response = structuredClone(rockResponse) as { bpm?: number }
    delete response.bpm
    const result = interpretSongResponse({ text: JSON.stringify(response) }, { turns: [], codeMode })
    expect(result.ok && result.song.bpm).toBe(97)
  })
})
