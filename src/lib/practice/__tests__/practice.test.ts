import { describe, expect, it } from 'vitest';
import { compileSong } from '@lib/song';
import { songToMidi } from '@lib/midi';
import { verseChorusSong } from '../../song/__tests__/fixtures';
import {
  buildPlayCode,
  buildPracticeSong,
  isPlainPlayback,
  nextBarBoundary,
  nextTrainerBpm,
  practiceLoopBars,
  retimeAt,
  barsAt,
  sectionStartBar,
  trainerBpmForLoop,
  trainerBpmSequence,
  normalizeTempoTrainer,
  type TempoTrainerConfig,
} from '..';

const trainer = (patch: Partial<TempoTrainerConfig> = {}): TempoTrainerConfig => ({
  enabled: true,
  startBpm: 80,
  endBpm: 100,
  stepBpm: 10,
  everyLoops: 2,
  ...patch,
});

describe('tempo trainer (TASK-30 AC-4 / AC-7)', () => {
  it('raises the BPM every N loops and stops at the end BPM', () => {
    const bpms = Array.from({ length: 8 }, (_, loop) => trainerBpmForLoop(trainer(), loop));
    expect(bpms).toEqual([80, 80, 90, 90, 100, 100, 100, 100]);
  });

  it('never overshoots the end BPM when the step does not divide the range', () => {
    expect(trainerBpmSequence(trainer({ startBpm: 80, endBpm: 98, stepBpm: 10 }))).toEqual([80, 90, 98]);
  });

  it('can slow down (end below start)', () => {
    expect(trainerBpmSequence(trainer({ startBpm: 120, endBpm: 100, stepBpm: 10, everyLoops: 1 }))).toEqual([120, 110, 100]);
  });

  it('lists each distinct BPM once', () => {
    expect(trainerBpmSequence(trainer())).toEqual([80, 90, 100]);
    expect(trainerBpmSequence(trainer({ startBpm: 90, endBpm: 90 }))).toEqual([90]);
  });

  it('reports the next change only when the BPM actually changes', () => {
    expect(nextTrainerBpm(trainer(), 0)).toBeNull();
    expect(nextTrainerBpm(trainer(), 1)).toBe(90);
    expect(nextTrainerBpm(trainer(), 4)).toBeNull();
  });

  it('clamps invalid stored values', () => {
    const cfg = normalizeTempoTrainer({ startBpm: 10, endBpm: 999, stepBpm: 0, everyLoops: Number.NaN });
    expect(cfg).toMatchObject({ startBpm: 60, endBpm: 220, stepBpm: 1, everyLoops: 4 });
  });
});

describe('section loop (TASK-30 AC-1 / AC-7)', () => {
  const song = verseChorusSong();

  it('schedules only the looped section, as a single block without arrange', () => {
    const looped = buildPracticeSong(song, { loopSectionId: 'chorus' });
    expect(looped.arrangement).toEqual([{ sectionId: 'chorus', repeat: 1 }]);
    const code = buildPlayCode(song, { bpm: song.bpm, loopSectionId: 'chorus' });
    expect(code).not.toContain('arrange(');
    expect(code).toBe(compileSong(looped));
    expect(practiceLoopBars(song, 'chorus')).toBe(1);
  });

  it('compiles to the full song when there is no loop or the section no longer exists', () => {
    expect(buildPlayCode(song, { bpm: song.bpm })).toBe(compileSong(song));
    expect(buildPlayCode(song, { bpm: song.bpm, loopSectionId: 'gone' })).toBe(compileSong(song));
    expect(isPlainPlayback({ bpm: song.bpm }, song.bpm)).toBe(true);
    expect(isPlainPlayback({ bpm: song.bpm, loopSectionId: 'chorus' }, song.bpm)).toBe(false);
  });

  it('finds where a section first starts in the arrangement', () => {
    expect(sectionStartBar(song, 'verse')).toBe(0);
    expect(sectionStartBar(song, 'chorus')).toBe(song.sections[0].bars * song.arrangement[0].repeat);
  });
});

describe('drop parts (TASK-30 AC-5)', () => {
  it('silences kick without touching steps or the original song', () => {
    const song = verseChorusSong();
    const before = JSON.stringify(song);
    const practice = buildPracticeSong(song, { droppedParts: ['kick'] });
    const kick = practice.sections[0].tracks.find((t) => t.id === 'kick');
    const snare = practice.sections[0].tracks.find((t) => t.id === 'snare');
    expect(kick?.muted).toBe(true);
    expect(kick?.steps).toEqual(song.sections[0].tracks[0].steps);
    expect(snare?.muted).toBe(false);
    expect(JSON.stringify(song)).toBe(before);
    expect(buildPlayCode(song, { bpm: song.bpm, droppedParts: ['kick'] })).not.toBe(compileSong(song));
  });
});

describe('clicks stay out of the song (TASK-30 AC-2 / AC-3 / AC-7)', () => {
  it('adds metronome and count-in only to the played code', () => {
    const song = verseChorusSong();
    const plain = compileSong(song);
    const code = buildPlayCode(song, { bpm: song.bpm, metronome: { mode: 'eighth', volume: 0.5 }, countInBars: 2 });
    expect(plain).not.toContain('triangle');
    expect(code).toContain('triangle');
    expect(code).toContain('square');
    expect(code).toMatch(/arrange\(\n {2}\[2, /);
    expect(code.endsWith('.slow(4).cpm(120.00)')).toBe(true);
  });

  it('exports the same MIDI regardless of practice settings', () => {
    const song = verseChorusSong();
    const before = songToMidi(song);
    buildPlayCode(song, {
      bpm: 90,
      loopSectionId: 'chorus',
      droppedParts: ['snare'],
      metronome: { mode: 'quarter', volume: 1 },
      countInBars: 1,
      phaseBars: 3,
    });
    const after = songToMidi(song);
    expect(Array.from(after)).toEqual(Array.from(before));
  });

  it('click patterns are not drum voices, so no click note can appear in the MIDI track', () => {
    const midi = Buffer.from(songToMidi(verseChorusSong())).toString('latin1');
    expect(midi).not.toContain('triangle');
    expect(midi).not.toContain('square');
  });
});

describe('timeline (tempo changes land on bar boundaries)', () => {
  const cps = 0.5;

  it('keeps the position continuous across a tempo change at the next bar boundary', () => {
    const current = { bpm: 80, phaseBars: 0 };
    const cycles = 3.7; // somewhere inside a bar
    const boundary = nextBarBoundary(current, cycles, cps);
    expect(boundary.bar).toBe(Math.ceil(barsAt(current, cycles, cps)));
    const next = retimeAt(90, boundary.cycles, cps, boundary.bar);
    expect(barsAt(next, boundary.cycles, cps)).toBeCloseTo(boundary.bar, 9);
    expect(barsAt(current, boundary.cycles, cps)).toBeCloseTo(boundary.bar, 9);
  });

  it('can jump to another bar (loop restart) at the same instant', () => {
    const current = { bpm: 100, phaseBars: 0 };
    const boundary = nextBarBoundary(current, 5.1, cps);
    const jumped = retimeAt(100, boundary.cycles, cps, 12);
    expect(barsAt(jumped, boundary.cycles, cps)).toBeCloseTo(12, 9);
  });
});
