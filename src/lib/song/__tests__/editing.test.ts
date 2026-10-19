import { describe, it, expect } from 'vitest';
import {
  addArrangementItem,
  addSection,
  duplicateSection,
  locatePlayhead,
  moveArrangementItem,
  msUntilNextBar,
  removeArrangementItem,
  removeSection,
  renameSection,
  setArrangementRepeat,
  setSectionBars,
  setStepVelocity,
  stepVelocityLevel,
  validateSong,
  velocityLevel,
} from '..';
import { verseChorusSong } from './fixtures';

describe('song editing (TASK-25)', () => {
  it('addSection appends a valid 1-bar section on the same kit, with an arrangement block', () => {
    const { song, sectionId } = addSection(verseChorusSong(), 'Bridge', 'chorus');
    const added = song.sections.find((s) => s.id === sectionId)!;
    expect(added.name).toBe('Bridge');
    expect(added.tracks.map((t) => t.id)).toEqual(['kick', 'snare', 'ride', 'crash']);
    expect(added.tracks.every((t) => t.steps.every((s) => s === 0))).toBe(true);
    expect(song.arrangement.at(-1)).toEqual({ sectionId, repeat: 1 });
    expect(validateSong(song).ok).toBe(true);
  });

  it('removeSection drops every arrangement block of that section (no orphans)', () => {
    const song = removeSection(verseChorusSong(), 'verse');
    expect(song.sections.map((s) => s.id)).toEqual(['chorus']);
    expect(song.arrangement).toEqual([{ sectionId: 'chorus', repeat: 4 }]);
    expect(validateSong(song).ok).toBe(true);
  });

  it('removeSection keeps a playable arrangement and refuses to delete the last section', () => {
    const base = verseChorusSong();
    const onlyVerse = { ...base, arrangement: [{ sectionId: 'verse', repeat: 1 }] };
    const song = removeSection(onlyVerse, 'verse');
    expect(song.arrangement).toEqual([{ sectionId: 'chorus', repeat: 1 }]);
    expect(removeSection(song, 'chorus')).toBe(song);
  });

  it('duplicateSection copies the pattern and places the copy after the last use of the original', () => {
    const { song, sectionId } = duplicateSection(verseChorusSong(), 'chorus', 'Chorus 2');
    expect(song.sections.map((s) => s.id)).toEqual(['verse', 'chorus', sectionId]);
    expect(song.arrangement.map((i) => i.sectionId)).toEqual(['verse', 'chorus', sectionId, 'verse']);
    expect(song.sections[2].tracks[0].steps).toEqual(song.sections[1].tracks[0].steps);
    expect(validateSong(song).ok).toBe(true);
  });

  it('renameSection ignores blank names', () => {
    const song = verseChorusSong();
    expect(renameSection(song, 'verse', '  Intro ').sections[0].name).toBe('Intro');
    expect(renameSection(song, 'verse', '   ')).toBe(song);
  });

  it('setSectionBars resizes steps and velocity so the song stays valid', () => {
    const grown = setSectionBars(verseChorusSong(), 'verse', 4);
    const snare = grown.sections[0].tracks[1];
    expect(snare.steps).toHaveLength(64);
    expect(snare.velocity).toHaveLength(64);
    expect(validateSong(grown).ok).toBe(true);
    const shrunk = setSectionBars(grown, 'verse', 1);
    expect(shrunk.sections[0].tracks[0].steps).toHaveLength(16);
    expect(validateSong(shrunk).ok).toBe(true);
  });

  it('arrangement edits: move, repeat, add and the last block cannot be removed', () => {
    const song = verseChorusSong();
    expect(moveArrangementItem(song, 0, 2).arrangement.map((i) => i.sectionId)).toEqual(['chorus', 'verse', 'verse']);
    expect(setArrangementRepeat(song, 0, 99).arrangement[0].repeat).toBe(16);
    expect(addArrangementItem(song, 'chorus').arrangement).toHaveLength(4);
    const single = { ...song, arrangement: [{ sectionId: 'verse', repeat: 1 }] };
    expect(removeArrangementItem(single, 0)).toBe(single);
  });

  it('velocity levels: classify, cycle, and only change active steps', () => {
    expect(velocityLevel(undefined)).toBe('accent');
    expect(velocityLevel(0.3)).toBe('ghost');
    expect(velocityLevel(0.7)).toBe('normal');
    expect(stepVelocityLevel('accent')).toBe('ghost');
    const song = verseChorusSong();
    const kick = song.sections[0].tracks[0];
    const soft = setStepVelocity(kick, 0, 'ghost');
    expect(velocityLevel(soft.velocity?.[0])).toBe('ghost');
    expect(soft.velocity?.[8]).toBe(1);
    expect(setStepVelocity(kick, 1, 'ghost')).toBe(kick);
  });

  it('locatePlayhead follows the arrangement and loops', () => {
    const song = verseChorusSong(); // verse 2 bars ×2, chorus 1 bar ×4, verse 2 bars ×1 = 10 bars
    expect(locatePlayhead(song, 0)).toMatchObject({ itemIndex: 0, sectionId: 'verse', barInSection: 0 });
    expect(locatePlayhead(song, 3.5)).toMatchObject({ itemIndex: 0, barInSection: 1, stepInBar: 8 });
    expect(locatePlayhead(song, 5)).toMatchObject({ itemIndex: 1, sectionId: 'chorus' });
    expect(locatePlayhead(song, 9)).toMatchObject({ itemIndex: 2, barInSection: 1 });
    expect(locatePlayhead(song, 10)).toMatchObject({ itemIndex: 0, barInSong: 0 });
  });

  it('msUntilNextBar waits for the bar line, minus the lead, and never goes negative', () => {
    // 120 bpm: a beat is 500 ms; at 1 beat into the bar, 3 beats remain
    expect(msUntilNextBar(1, 120, 150)).toBe(1350);
    expect(msUntilNextBar(3.95, 120, 150)).toBe(0);
    expect(msUntilNextBar(0, 120)).toBe(0);
  });
});
