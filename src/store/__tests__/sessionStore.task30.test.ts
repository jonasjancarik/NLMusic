import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '../sessionStore';
import { selectPlayCode } from '../practiceSelectors';
import { selectSong } from '../helpers';
import { songToMidi } from '@lib/midi';
import { compileSong } from '@lib/song';
import { mergePersistedState } from '../persistence';

const initial = useSessionStore.getState();

describe('TASK-30 practice state', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState(initial, true);
  });

  it('plays the saved song code untouched while no practice option is on', () => {
    const state = useSessionStore.getState();
    expect(selectPlayCode(state)).toBe(state.currentCode);
  });

  it('dropping a part changes only the played code, not the song, its code or its MIDI', () => {
    const store = useSessionStore.getState();
    const songBefore = JSON.stringify(selectSong(store));
    const midiBefore = Array.from(songToMidi(selectSong(store)));
    const codeBefore = store.currentCode;

    store.toggleDroppedPart('kick');
    store.setMetronomeMode('quarter');
    store.setLoopSection(store.activeSectionId);

    const after = useSessionStore.getState();
    expect(selectPlayCode(after)).not.toBe(after.currentCode);
    expect(after.currentCode).toBe(codeBefore);
    expect(JSON.stringify(selectSong(after))).toBe(songBefore);
    expect(Array.from(songToMidi(selectSong(after)))).toEqual(midiBefore);
    expect(after.currentCode).toBe(compileSong(selectSong(after)));

    useSessionStore.getState().toggleDroppedPart('kick');
    expect(useSessionStore.getState().droppedParts).toEqual([]);
  });

  it('the tempo trainer starts at its start BPM and ends with the playback', () => {
    const store = useSessionStore.getState();
    store.setTempoTrainer({ enabled: true, startBpm: 70, endBpm: 90, stepBpm: 10, everyLoops: 2 });
    useSessionStore.getState().setCountInBars(2);
    useSessionStore.getState().beginPractice();
    let state = useSessionStore.getState();
    expect(state.practiceBpm).toBe(70);
    expect(state.practiceCountInBars).toBe(2);
    expect(selectPlayCode(state)).toContain('.cpm(70.00)');
    // the song's own BPM is untouched
    expect(state.bpm).not.toBe(70);

    state.endPractice();
    state = useSessionStore.getState();
    expect(state.practiceBpm).toBeNull();
    expect(state.practiceCountInBars).toBe(0);
  });

  it('restores invalid saved practice preferences to safe values', () => {
    const merged = mergePersistedState(
      { countInBars: 7, metronomeMode: 'loud', metronomeVolume: 5, tempoTrainer: { startBpm: 5 } },
      useSessionStore.getState(),
    );
    expect(merged.countInBars).toBe(0);
    expect(merged.metronomeMode).toBe('off');
    expect(merged.metronomeVolume).toBe(0.5);
    expect(merged.tempoTrainer.startBpm).toBe(60);
  });
});
