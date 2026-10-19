// @vitest-environment node
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest'

const { runV0PipelineMock, ClaudeAdapterMock } = vi.hoisted(() => ({
  runV0PipelineMock: vi.fn(),
  ClaudeAdapterMock: vi.fn(),
}))

// TASK-27: la ruta usa el pipeline de canciones; el nombre del mock se conserva.
vi.mock('@lib/llm/songPipeline', () => ({
  runSongPipeline: runV0PipelineMock,
}))

vi.mock('@lib/llm/adapters/claude.adapter', () => ({
  ClaudeAdapter: class MockClaudeAdapter {
    constructor(options: unknown) {
      ClaudeAdapterMock(options)
    }
  },
}))

import { POST } from '../route'
import { patternToSong } from '@lib/song'

const kick = {
  id: 'kick-1',
  name: 'Kick',
  steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] as (0 | 1)[],
  volume: 0.9,
  muted: false,
  solo: false,
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/generate-pattern', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeRawRequest(body: string): Request {
  return new Request('http://localhost/api/generate-pattern', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('POST /api/generate-pattern — TASK-06 contract coherence', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns { ok: false } with 400 for invalid prompt', async () => {
    const response = await POST(makeRequest({ prompt: '   ' }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ ok: false, error: 'Prompt inválido' })
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('returns { ok: false } with 500 when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const response = await POST(makeRequest({ prompt: 'kick', context: {} }) as never)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.ok).toBe(false)
    expect(payload.error).toContain('ANTHROPIC_API_KEY')
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('returns { ok: true, source: llm } with warnings on successful LLM response', async () => {
    runV0PipelineMock.mockResolvedValueOnce({
      ok: true,
      attempts: 1,
      song: patternToSong({ bpm: 128, tracks: [kick] }),
      activeSectionId: 'main',
      strudelCode: 'code',
      warnings: ['Reemplazo propuso 7 pistas; se mantuvieron 5 (BR-006).'],
    })

    const response = await POST(makeRequest({
      prompt: 'añade un kick',
      context: {
        turns: [],
        previous: {
          bpm: 120,
          tracks: [],
        },
      },
    }) as never)

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.source).toBe('llm')
    expect(payload.warning).toBeUndefined()
    expect(payload.warnings).toHaveLength(1)
    expect(payload.song.sections[0].tracks[0].id).toBe('kick-1')
    expect(payload.activeSectionId).toBe('main')
    expect(payload.strudelCode).toBe('code')
  })

  it('returns { ok: true, source: fallback, warning } when pipeline used fallback', async () => {
    runV0PipelineMock.mockResolvedValueOnce({ ok: false, kind: 'provider', error: 'Network timeout', attempts: 1 })

    const response = await POST(makeRequest({ prompt: 'kick', context: { turns: [] } }) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.source).toBe('fallback')
    expect(payload.warning).toContain('Network timeout')
    expect(payload.song.sections[0].tracks.length).toBeGreaterThan(0)
    expect(payload.strudelCode).toContain('cpm')
  })

  it('TASK-27: provider error keeps an existing song (502, no fallback)', async () => {
    runV0PipelineMock.mockResolvedValueOnce({ ok: false, kind: 'provider', error: 'Network timeout', attempts: 1 })

    const response = await POST(makeRequest({
      prompt: 'kick',
      context: { turns: [], song: patternToSong({ bpm: 120, tracks: [kick] }) },
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(502)
    expect(payload.ok).toBe(false)
    expect(payload.song).toBeUndefined()
  })

  it('TASK-27 AC-3: invalid song after retries → 422 with the concrete errors', async () => {
    runV0PipelineMock.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid',
      errors: ['Section "verse" › track "kick" › steps: has 16 steps but must have 32'],
      attempts: 3,
    })

    const response = await POST(makeRequest({ prompt: 'rock song', context: { turns: [] } }) as never)
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload.ok).toBe(false)
    expect(payload.error).toContain('3')
    expect(payload.details[0]).toContain('Section "verse"')
  })

  it('TASK-27: passes song and activeSectionId to the pipeline', async () => {
    runV0PipelineMock.mockResolvedValueOnce({
      ok: true, attempts: 1, song: patternToSong({ bpm: 120, tracks: [kick] }), activeSectionId: 'main', strudelCode: 'c', warnings: [],
    })
    const song = patternToSong({ bpm: 120, tracks: [kick] })

    await POST(makeRequest({ prompt: 'denser', context: { turns: [], song, activeSectionId: 'main' } }) as never)

    expect(runV0PipelineMock).toHaveBeenCalledWith(
      expect.anything(),
      'denser',
      expect.objectContaining({ song, activeSectionId: 'main' }),
    )
  })

  it('TASK-27: returns 400 when context.song is not a valid song', async () => {
    const response = await POST(makeRequest({
      prompt: 'denser',
      context: { song: { bpm: 120, stepsPerBar: 16, sections: [], arrangement: [] } },
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('builds SessionContext using previous (not currentPattern alias)', async () => {
    runV0PipelineMock.mockResolvedValueOnce({
      ok: true, attempts: 1, song: patternToSong({ bpm: 120, tracks: [kick] }), activeSectionId: 'main', strudelCode: 'c', warnings: [],
    })

    const previous = {
      bpm: 110,
      tracks: [
        {
          id: 'kick-1',
          name: 'Kick',
          steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          volume: 0.8,
          muted: false,
          solo: false,
        },
      ],
      strudelCode: 'stack(s("bd ~ ~ ~").gain(0.8))',
    }

    await POST(makeRequest({
      prompt: 'keep groove',
      context: {
        turns: [{ role: 'user', content: 'initial groove' }],
        previous,
        currentPattern: { bpm: 999, tracks: [] },
      },
    }) as never)

    expect(runV0PipelineMock).toHaveBeenCalledTimes(1)
    expect(runV0PipelineMock).toHaveBeenCalledWith(
      expect.anything(),
      'keep groove',
      expect.objectContaining({
        previous,
        language: 'mixed',
      })
    )
  })

  it('TASK-14: returns 400 when turns exceeds 40 entries', async () => {
    const tooManyTurns = Array.from({ length: 41 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${i}`,
    }))

    const response = await POST(makeRequest({
      prompt: 'valid prompt',
      context: { turns: tooManyTurns },
    }) as never)

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('TASK-14: returns 400 when the request body contains invalid JSON', async () => {
    const response = await POST(makeRawRequest('{"prompt": invalid-json}') as never)

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload).toEqual({ ok: false, error: 'Body inválido' })
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('TASK-14: returns 400 when previous.tracks has invalid shape', async () => {
    const response = await POST(makeRequest({
      prompt: 'valid prompt',
      context: {
        previous: {
          bpm: 120,
          tracks: [{ notATrack: true, garbage: 'field' }],
        },
      },
    }) as never)

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('TASK-14: returns 400 when previous.strudelCode exceeds the allowed size', async () => {
    const response = await POST(makeRequest({
      prompt: 'valid prompt',
      context: {
        previous: {
          bpm: 120,
          tracks: [],
          strudelCode: 'x'.repeat(100_001),
        },
      },
    }) as never)

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('TASK-14: returns 400 when previous.tracks[0].steps has wrong length (not 16)', async () => {
    const response = await POST(makeRequest({
      prompt: 'valid prompt',
      context: {
        previous: {
          bpm: 120,
          tracks: [
            {
              id: 'k1',
              name: 'Kick',
              steps: [1, 0, 0, 0, 1, 0, 0, 0],  // 8 steps — domain requires exactly 16
              volume: 0.8,
              muted: false,
              solo: false,
            },
          ],
        },
      },
    }) as never)

    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(runV0PipelineMock).not.toHaveBeenCalled()
  })

  it('TASK-09: propagates codeMode and clears previous when in code mode', async () => {
    runV0PipelineMock.mockResolvedValueOnce({
      ok: true, attempts: 1, song: patternToSong({ bpm: 120, tracks: [kick] }), activeSectionId: 'main', strudelCode: 'c', warnings: [],
    })

    const codeMode = {
      enabled: true,
      strudelCode: 'stack(s("bd ~ hh ~"))',
      bpmHint: 138,
    }

    await POST(makeRequest({
      prompt: 'make it slower',
      context: {
        turns: [],
        codeMode,
        previous: { bpm: 138, tracks: [] },
      },
    }) as never)

    expect(runV0PipelineMock).toHaveBeenCalledWith(
      expect.anything(),
      'make it slower',
      expect.objectContaining({
        codeMode,
        previous: undefined,
      })
    )
  })
})
