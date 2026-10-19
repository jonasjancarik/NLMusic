/**
 * Ejemplos de salida válidos que aparecen en la guía de batería (TASK-27 AC-1).
 * Viven como objetos para que un test compruebe que pasan el parser y validateSong:
 * un ejemplo roto en el prompt enseña al modelo a equivocarse.
 *
 * Sin dependencias de Next/React ni alias de ruta: TASK-28 lo importa desde Node.
 */

const REST_16 = '................';
const REST_12 = '............';

/** Une compases con `|`. */
function bars(...items: string[]): string {
  return items.join('|');
}

/** Repite un compás `count` veces. */
function times(bar: string, count: number): string[] {
  return Array.from({ length: count }, () => bar);
}

export interface DrumGuideExample {
  title: string;
  request: string;
  response: unknown;
}

export const DRUM_GUIDE_EXAMPLES: DrumGuideExample[] = [
  {
    title: 'Rock, 16 steps per bar',
    request: 'a simple rock song with an intro, verse and chorus',
    response: {
      bpm: 118,
      operations: [
        {
          type: 'replaceSong',
          song: {
            stepsPerBar: 16,
            sections: [
              {
                id: 'intro',
                name: 'Intro',
                bars: 2,
                tracks: [
                  { id: 'crash', sample: 'cr', steps: bars('X...............', REST_16), volume: 0.7 },
                  { id: 'hihat', sample: 'hh', steps: bars('x.x.x.x.x.x.x.x.', 'x.x.x.x.........'), volume: 0.55 },
                  { id: 'kick', sample: 'bd', steps: bars('x.......x.......', 'x.......x.......'), volume: 0.9 },
                  { id: 'snare', sample: 'sd', steps: bars('....x.......x...', '....x...x.xxXXXX'), volume: 0.8 },
                ],
              },
              {
                id: 'verse',
                name: 'Verse',
                bars: 4,
                tracks: [
                  { id: 'crash', sample: 'cr', steps: bars('X...............', ...times(REST_16, 3)), volume: 0.7 },
                  {
                    id: 'hihat',
                    sample: 'hh',
                    steps: bars(...times('X.x.X.x.X.x.X.x.', 3), 'X.x.X.x.X.x.....'),
                    volume: 0.55,
                  },
                  {
                    id: 'kick',
                    sample: 'bd',
                    steps: bars(...times('x.......x.x.....', 3), 'x.......x.......'),
                    volume: 0.9,
                  },
                  {
                    id: 'snare',
                    sample: 'sd',
                    steps: bars(...times('....X..g....X...', 3), '....X.......XgXX'),
                    volume: 0.8,
                  },
                ],
              },
              {
                id: 'chorus',
                name: 'Chorus',
                bars: 4,
                tracks: [
                  { id: 'crash', sample: 'cr', steps: bars('X...............', ...times(REST_16, 3)), volume: 0.75 },
                  { id: 'ride', sample: 'rd', steps: bars(...times('X.x.X.x.X.x.X.x.', 4)), volume: 0.6 },
                  {
                    id: 'kick',
                    sample: 'bd',
                    steps: bars(...times('x.x.....x.x..x..', 3), 'x.x.....x.......'),
                    volume: 0.95,
                  },
                  {
                    id: 'snare',
                    sample: 'sd',
                    steps: bars(...times('....X.......X...', 3), '....X.......XXXX'),
                    volume: 0.85,
                  },
                ],
              },
            ],
            arrangement: [
              { sectionId: 'intro', repeat: 1 },
              { sectionId: 'verse', repeat: 2 },
              { sectionId: 'chorus', repeat: 2 },
              { sectionId: 'verse', repeat: 1 },
              { sectionId: 'chorus', repeat: 2 },
            ],
          },
        },
      ],
    },
  },
  {
    title: 'Funk with a half-time chorus, ghost notes',
    request: 'funk with a busy verse and a half-time chorus',
    response: {
      bpm: 96,
      operations: [
        {
          type: 'replaceSong',
          song: {
            stepsPerBar: 16,
            sections: [
              {
                id: 'verse',
                name: 'Verse',
                bars: 4,
                tracks: [
                  { id: 'crash', sample: 'cr', steps: bars('X...............', ...times(REST_16, 3)), volume: 0.65 },
                  {
                    id: 'hihat',
                    sample: 'hh',
                    steps: bars(...times('XxxxXxxxXxxxXxxx', 3), 'XxxxXxxxXxxxXx..'),
                    volume: 0.5,
                  },
                  { id: 'open-hat', sample: 'oh', steps: bars(...times(REST_16, 3), '..............x.'), volume: 0.55 },
                  {
                    id: 'kick',
                    sample: 'bd',
                    steps: bars(...times('x..x..x...x..x..', 3), 'x..x..x...x.....'),
                    volume: 0.9,
                  },
                  {
                    id: 'snare',
                    sample: 'sd',
                    steps: bars(...times('....X..g.g..X..g', 3), '....X..g.g..XgXX'),
                    volume: 0.8,
                  },
                ],
              },
              {
                id: 'chorus',
                name: 'Chorus (half-time)',
                bars: 4,
                tracks: [
                  { id: 'crash', sample: 'cr', steps: bars('X...............', ...times(REST_16, 3)), volume: 0.7 },
                  { id: 'ride', sample: 'rd', steps: bars(...times('X.x.X.x.X.x.X.x.', 4)), volume: 0.6 },
                  {
                    id: 'kick',
                    sample: 'bd',
                    steps: bars(...times('x.....x...x.....', 3), 'x.....x...x..x..'),
                    volume: 0.95,
                  },
                  {
                    id: 'snare',
                    sample: 'sd',
                    steps: bars(...times('........X......g', 3), '........X...XgXX'),
                    volume: 0.85,
                  },
                ],
              },
            ],
            arrangement: [
              { sectionId: 'verse', repeat: 2 },
              { sectionId: 'chorus', repeat: 2 },
              { sectionId: 'verse', repeat: 1 },
              { sectionId: 'chorus', repeat: 2 },
            ],
          },
        },
      ],
    },
  },
  {
    title: 'Slow blues shuffle, 12 steps per bar (triplet feel)',
    request: 'a slow blues shuffle',
    response: {
      bpm: 76,
      operations: [
        {
          type: 'replaceSong',
          song: {
            stepsPerBar: 12,
            sections: [
              {
                id: 'groove',
                name: 'Groove',
                bars: 4,
                tracks: [
                  { id: 'crash', sample: 'cr', steps: bars('X...........', ...times(REST_12, 3)), volume: 0.6 },
                  { id: 'hihat', sample: 'hh', steps: bars(...times('X.xx.xX.xx.x', 4)), volume: 0.5 },
                  {
                    id: 'kick',
                    sample: 'bd',
                    steps: bars(...times('x.....x.....', 3), 'x.....x..x..'),
                    volume: 0.85,
                  },
                  {
                    id: 'snare',
                    sample: 'sd',
                    steps: bars(...times('...X.....X..', 3), '...X.....XgX'),
                    volume: 0.8,
                  },
                ],
              },
            ],
            arrangement: [{ sectionId: 'groove', repeat: 3 }],
          },
        },
      ],
    },
  },
  {
    title: 'Incremental edit: only the chorus changes',
    request: 'make the chorus kick busier (current song has sections verse and chorus; chorus is 4 bars)',
    response: {
      operations: [
        {
          type: 'update',
          sectionId: 'chorus',
          id: 'kick',
          patch: { steps: bars(...times('x.x...x.x.x..x..', 3), 'x.x...x.x.......') },
        },
      ],
    },
  },
];
