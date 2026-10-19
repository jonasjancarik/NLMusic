/** Canción de ejemplo en notación de pasos, tal como la escribiría un cliente MCP. */
export function goodSong(): Record<string, unknown> {
  return {
    bpm: 100,
    stepsPerBar: 16,
    sections: [
      {
        id: 'verse',
        name: 'Verse',
        bars: 2,
        tracks: [
          { id: 'kick', sample: 'bd', steps: 'x.......x.x.....|x.......x.......', volume: 0.9 },
          { id: 'snare', sample: 'sd', steps: '....X.......X...|....X.......X...', volume: 0.8 },
          { id: 'hat', sample: 'hh', steps: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.', volume: 0.5 },
        ],
      },
    ],
    arrangement: [{ sectionId: 'verse', repeat: 2 }],
  };
}

/** Pista de caja con 15 pasos en un compás de 16 (lo detecta validateSong). */
export function badSong(): Record<string, unknown> {
  const song = goodSong() as { sections: { tracks: Record<string, unknown>[] }[] };
  song.sections[0].tracks[1].steps = '....X.......X..|....X.......X...';
  return song;
}

/** Una voz que no existe (lo detecta la normalización, antes de validateSong). */
export function unknownVoiceSong(): Record<string, unknown> {
  const song = goodSong() as { sections: { tracks: Record<string, unknown>[] }[] };
  song.sections[0].tracks[2].sample = 'banjo';
  return song;
}
