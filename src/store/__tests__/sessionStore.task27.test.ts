import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '@store/sessionStore'
import type { Song } from '@lib/types'

const bar = (hits: number[]) => Array.from({ length: 16 }, (_, i) => (hits.includes(i) ? 1 : 0)) as (0 | 1)[]
const track = (id: string, steps: (0 | 1)[]) => ({ id, name: id, sample: 'bd', steps, volume: 0.8, muted: false, solo: false })

const song: Song = {
  bpm: 110,
  stepsPerBar: 16,
  sections: [
    { id: 'verse', name: 'Verse', bars: 1, tracks: [track('kick', bar([0, 8]))] },
    { id: 'chorus', name: 'Chorus', bars: 1, tracks: [track('kick', bar([0, 4, 8, 12]))] },
  ],
  arrangement: [
    { sectionId: 'verse', repeat: 2 },
    { sectionId: 'chorus', repeat: 2 },
  ],
}

describe('loadGeneratedSong (TASK-27)', () => {
  beforeEach(() => {
    useSessionStore.setState({ isPlaying: false, uiState: 'loading', lastError: 'old', isCodeManuallyEdited: true })
  })

  it('loads the song, shows the section the response points to and starts playing', () => {
    useSessionStore.getState().loadGeneratedSong(song, { activeSectionId: 'chorus', strudelCode: 'server-code' })
    const state = useSessionStore.getState()

    expect(state.sections).toEqual(song.sections)
    expect(state.arrangement).toEqual(song.arrangement)
    expect(state.activeSectionId).toBe('chorus')
    expect(state.tracks).toEqual(song.sections[1].tracks)
    expect(state.bpm).toBe(110)
    expect(state.currentCode).toBe('server-code')
    expect(state.isCodeManuallyEdited).toBe(false)
    expect(state.isPlaying).toBe(true)
    expect(state.uiState).toBe('playing')
    expect(state.lastError).toBeNull()
  })

  it('falls back to the first arranged section and compiles locally without server code', () => {
    useSessionStore.getState().loadGeneratedSong(song, { activeSectionId: 'missing' })
    const state = useSessionStore.getState()
    expect(state.activeSectionId).toBe('verse')
    expect(state.currentCode).toContain('arrange(')
  })
})
