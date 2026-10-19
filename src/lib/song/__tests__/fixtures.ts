import type { Song, Track } from '@lib/types'

export function bar16(...onSteps: number[]): (0 | 1)[] {
  return Array.from({ length: 16 }, (_, index) => (onSteps.includes(index) ? 1 : 0))
}

export function makeTrack(id: string, sample: string, steps: (0 | 1)[], extra: Partial<Track> = {}): Track {
  return { id, name: id, sample, steps, volume: 0.8, muted: false, solo: false, ...extra }
}

/** Verso de 2 compases (×2) + estribillo de 1 compás (×4) + verso otra vez. */
export function verseChorusSong(): Song {
  return {
    bpm: 120,
    stepsPerBar: 16,
    sections: [
      {
        id: 'verse',
        name: 'Verse',
        bars: 2,
        tracks: [
          makeTrack('kick', 'bd', [...bar16(0, 8), ...bar16(0, 8, 10)]),
          makeTrack('snare', 'sd', [...bar16(4, 12), ...bar16(4, 12)], {
            velocity: [...bar16(4, 12).map((s) => (s ? 1 : 0)), ...bar16(4, 12).map((s) => (s ? 0.3 : 0))],
          }),
          makeTrack('hat', 'hh', [...bar16(0, 2, 4, 6, 8, 10, 12, 14), ...bar16(0, 2, 4, 6, 8, 10, 12, 14)]),
        ],
      },
      {
        id: 'chorus',
        name: 'Chorus',
        bars: 1,
        tracks: [
          makeTrack('kick', 'bd', bar16(0, 4, 8, 12)),
          makeTrack('snare', 'sd', bar16(4, 12), { params: { room: 0.4 } }),
          makeTrack('ride', 'rd', bar16(0, 2, 4, 6, 8, 10, 12, 14), { volume: 0.5 }),
          makeTrack('crash', 'cr', bar16(0)),
        ],
      },
    ],
    arrangement: [
      { sectionId: 'verse', repeat: 2 },
      { sectionId: 'chorus', repeat: 4 },
      { sectionId: 'verse', repeat: 1 },
    ],
  }
}
