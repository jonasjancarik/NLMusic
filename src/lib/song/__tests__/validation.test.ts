// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateSong, MAX_TRACKS_PER_SECTION } from '@lib/song'
import type { Song } from '@lib/types'
import { bar16, makeTrack, verseChorusSong } from './fixtures'

function messages(input: unknown): string[] {
  const result = validateSong(input)
  return result.ok ? [] : result.errors.map((error) => error.message)
}

describe('validateSong — TASK-24 AC-3', () => {
  it('accepts a valid verse/chorus song', () => {
    const result = validateSong(verseChorusSong())
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects steps whose length does not match stepsPerBar × bars, naming section and track', () => {
    const song = verseChorusSong()
    song.sections[0].tracks[1].steps = bar16(4, 12) // verse has 2 bars → needs 32
    song.sections[0].tracks[1].velocity = undefined
    const result = validateSong(song)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual([
      {
        path: 'sections[0].tracks[1].steps',
        sectionId: 'verse',
        trackId: 'snare',
        message: 'Section "verse" › track "snare" › steps: has 16 steps but must have 32 (stepsPerBar 16 × 2 bars)',
      },
    ])
  })

  it('checks the step count against stepsPerBar 12', () => {
    const song: Song = { ...verseChorusSong(), stepsPerBar: 12 }
    expect(messages(song)).toContain(
      'Section "chorus" › track "kick" › steps: has 16 steps but must have 12 (stepsPerBar 12 × 1 bars)',
    )
  })

  it('rejects velocity with a different length than steps', () => {
    const song = verseChorusSong()
    song.sections[0].tracks[1].velocity = [1, 0.5]
    expect(messages(song)).toEqual([
      'Section "verse" › track "snare" › velocity: has 2 values but must have one per step (32)',
    ])
  })

  it('rejects velocity values outside 0–1', () => {
    const song = verseChorusSong()
    const velocity = Array(32).fill(1)
    velocity[4] = 1.4
    song.sections[0].tracks[1].velocity = velocity
    expect(messages(song)).toEqual([
      'Section "verse" › track "snare" › velocity[4]: velocity values must be between 0 and 1',
    ])
  })

  it('rejects an arrangement item pointing to a missing section', () => {
    const song = verseChorusSong()
    song.arrangement.push({ sectionId: 'bridge', repeat: 1 })
    expect(messages(song)).toEqual([
      'Arrangement item #4 › sectionId: section "bridge" does not exist; available sections: "verse", "chorus"',
    ])
  })

  it('rejects duplicate section ids and duplicate track ids within a section', () => {
    const song = verseChorusSong()
    song.sections.push({ ...song.sections[1] })
    song.sections[0].tracks.push(makeTrack('kick', 'bd', Array(32).fill(0)))
    expect(messages(song)).toEqual([
      'Section "chorus": section id "chorus" is used by 2 sections; section ids must be unique',
      'Section "verse" › track "kick": track id "kick" appears 2 times in this section; track ids must be unique within a section',
    ])
  })

  it('allows the same track id in different sections', () => {
    // verseChorusSong already reuses "kick" and "snare" across sections
    expect(validateSong(verseChorusSong()).ok).toBe(true)
  })

  it.each([0, 17, 1.5])('rejects bars = %s', (bars) => {
    const song = verseChorusSong()
    song.sections[1].bars = bars
    const result = messages(song)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/^Section "chorus" › bars: bars must be (a whole number )?from 1 to 16$/)
  })

  it.each([0, 17])('rejects repeat = %s', (repeat) => {
    const song = verseChorusSong()
    song.arrangement[1].repeat = repeat
    expect(messages(song)).toEqual(['Arrangement item #2 › repeat: repeat must be from 1 to 16'])
  })

  it(`rejects more than ${MAX_TRACKS_PER_SECTION} tracks in a section (BR-006)`, () => {
    const song = verseChorusSong()
    song.sections[1].tracks = Array.from({ length: MAX_TRACKS_PER_SECTION + 1 }, (_, index) =>
      makeTrack(`t${index}`, 'hh', bar16(index)),
    )
    expect(messages(song)).toEqual([
      'Section "chorus" › tracks: has 9 tracks; the limit is 8 per section (BR-006)',
    ])
  })

  it(`accepts exactly ${MAX_TRACKS_PER_SECTION} tracks in a section`, () => {
    const song = verseChorusSong()
    song.sections[1].tracks = Array.from({ length: MAX_TRACKS_PER_SECTION }, (_, index) =>
      makeTrack(`t${index}`, 'hh', bar16(index)),
    )
    expect(validateSong(song).ok).toBe(true)
  })

  it('reports schema errors with section/track location, using the index when the id is missing', () => {
    const song = verseChorusSong() as unknown as { sections: { id?: string; tracks: { volume: number }[] }[] }
    song.sections[1].tracks[2].volume = 3
    delete song.sections[0].id
    expect(messages(song)).toEqual([
      'Section #1 › id: Invalid input: expected string, received undefined',
      'Section "chorus" › track "ride" › volume: volume must be between 0 and 1',
    ])
  })

  it('rejects an empty song, wrong stepsPerBar and bpm out of range', () => {
    expect(messages({ bpm: 300, stepsPerBar: 8, sections: [], arrangement: [] })).toEqual([
      'Song › bpm: bpm must be from 60 to 220',
      'Song › stepsPerBar: stepsPerBar must be 16 or 12',
      'Song › sections: a song needs at least one section',
      'Song › arrangement: the arrangement needs at least one item',
    ])
  })

  it('accepts a section with no tracks (a full stop)', () => {
    const song = verseChorusSong()
    song.sections.push({ id: 'stop', name: 'Stop', bars: 1, tracks: [] })
    song.arrangement.push({ sectionId: 'stop', repeat: 1 })
    expect(validateSong(song).ok).toBe(true)
  })
})
