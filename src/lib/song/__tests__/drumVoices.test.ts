// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { DRUM_VOICE_IDS, soundToVoice, voiceToSound } from '@lib/song'
import { compileToStrudel, parseStrudelToTrackJson } from '@lib/strudel/compiler'
import { bar16, makeTrack } from './fixtures'

describe('drum voices — TASK-24 AC-6', () => {
  it('exposes the closed list of voices', () => {
    expect(DRUM_VOICE_IDS).toEqual(['bd', 'sd', 'rim', 'cp', 'hh', 'oh', 'rd', 'cr', 'lt', 'mt', 'ht'])
  })

  it('maps voices missing from dirt-samples to sounds that exist', () => {
    expect(voiceToSound('rim')).toBe('rm')
    expect(voiceToSound('oh')).toBe('ho')
    expect(voiceToSound('rd')).toBe('cr')
    expect(voiceToSound('cr')).toBe('hh:1')
    expect(voiceToSound('bd')).toBe('bd')
    expect(voiceToSound('perc')).toBe('perc') // free-form samples pass through
  })

  it('round-trips every voice through the sound map', () => {
    for (const id of DRUM_VOICE_IDS) expect(soundToVoice(voiceToSound(id))).toBe(id)
  })

  it('the compiler emits the mapped sound and the parser maps it back to the voice', () => {
    const tracks = [makeTrack('oh-1', 'oh', bar16(2, 6, 10, 14), { velocity: bar16(2, 6, 10, 14).map((s) => s * 0.7) })]
    const code = compileToStrudel({ bpm: 120, tracks })
    expect(code).toContain('s("~ ~ ho ~')
    expect(code).toContain('.velocity("~ ~ 0.7 ~')

    const parsed = parseStrudelToTrackJson(code, tracks)
    expect(parsed?.tracks[0].sample).toBe('oh')
    expect(parsed?.tracks[0].name).toBe('oh-1') // keeps the previous name for the same voice
    expect(parsed?.tracks[0].velocity?.[2]).toBe(0.7)
  })
})
