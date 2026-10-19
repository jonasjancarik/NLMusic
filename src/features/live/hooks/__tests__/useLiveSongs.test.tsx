import { act, render, renderHook, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@store/sessionStore';
import { initialSong } from '@store/slices/tracksSlice';
import type { Song } from '@lib/types';
import { useLiveSongs, MAX_RECONNECT_MS } from '../useLiveSongs';
import { LiveSongPrompt } from '../../components/LiveSongPrompt';

/** EventSource simulado: guarda las instancias para que el test emita eventos. */
class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
  listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
  emit(type: string, data?: unknown) {
    const event = new MessageEvent(type, { data: data === undefined ? undefined : JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.emit('open');
  }
  fail(closed: boolean) {
    this.readyState = closed ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.emit('error');
  }
}

const bar = (hits: number[]) => Array.from({ length: 16 }, (_, i) => (hits.includes(i) ? 1 : 0)) as (0 | 1)[];
const sentSong: Song = {
  bpm: 96,
  stepsPerBar: 16,
  sections: [
    { id: 'verse', name: 'Verse', bars: 1, tracks: [{ id: 'kick', name: 'Kick', sample: 'bd', steps: bar([0, 8]), volume: 0.8, muted: false, solo: false }] },
    { id: 'chorus', name: 'Chorus', bars: 1, tracks: [{ id: 'kick', name: 'Kick', sample: 'bd', steps: bar([0, 4, 8, 12]), volume: 0.8, muted: false, solo: false }] },
  ],
  arrangement: [
    { sectionId: 'verse', repeat: 2 },
    { sectionId: 'chorus', repeat: 1 },
  ],
};

const latest = () => FakeEventSource.instances[FakeEventSource.instances.length - 1];

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  useSessionStore.getState().loadSong(initialSong);
  useSessionStore.setState({
    isPlaying: false,
    autoAcceptSentSongs: false,
    pendingLiveSong: null,
    liveConnection: 'connecting',
    isCodeManuallyEdited: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useLiveSongs (TASK-29 AC-2/AC-3)', () => {
  it('connects to the stream and reports the connection state', () => {
    renderHook(() => useLiveSongs());
    expect(latest().url).toBe('/api/songs/stream');
    expect(useSessionStore.getState().liveConnection).toBe('connecting');
    act(() => latest().open());
    expect(useSessionStore.getState().liveConnection).toBe('connected');
    act(() => latest().fail(false));
    expect(useSessionStore.getState().liveConnection).toBe('offline');
  });

  it('shows a prompt for a received song and does not touch the current song until Load', () => {
    renderHook(() => useLiveSongs());
    act(() => latest().emit('song', { id: 'a-1', song: sentSong, name: 'groove', autoplay: false }));
    const state = useSessionStore.getState();
    expect(state.pendingLiveSong).toMatchObject({ id: 'a-1', name: 'groove' });
    expect(state.bpm).toBe(initialSong.bpm);

    act(() => state.acceptLiveSong());
    expect(useSessionStore.getState().bpm).toBe(96);
    expect(useSessionStore.getState().sections).toEqual(sentSong.sections);
    expect(useSessionStore.getState().pendingLiveSong).toBeNull();
    // BR-001: parado y sin autoplay, no arranca solo.
    expect(useSessionStore.getState().isPlaying).toBe(false);
  });

  it('loads directly when auto-accept is on, and starts playback only with autoplay', () => {
    useSessionStore.setState({ autoAcceptSentSongs: true });
    renderHook(() => useLiveSongs());
    act(() => latest().emit('song', { id: 'a-1', song: sentSong, autoplay: false }));
    expect(useSessionStore.getState().bpm).toBe(96);
    expect(useSessionStore.getState().isPlaying).toBe(false);
    act(() => latest().emit('song', { id: 'a-2', song: { ...sentSong, bpm: 120 }, autoplay: true }));
    expect(useSessionStore.getState().bpm).toBe(120);
    expect(useSessionStore.getState().isPlaying).toBe(true);
  });

  it('keeps playing while loading a song (the transport is not stopped)', () => {
    useSessionStore.setState({ autoAcceptSentSongs: true, isPlaying: true });
    renderHook(() => useLiveSongs());
    act(() => latest().emit('song', { id: 'a-1', song: sentSong, autoplay: false }));
    expect(useSessionStore.getState().isPlaying).toBe(true);
    expect(useSessionStore.getState().currentCode).toContain('96');
  });

  it('asks first, even with auto-accept, when there are unapplied manual code edits', () => {
    useSessionStore.setState({ autoAcceptSentSongs: true, isCodeManuallyEdited: true, currentCode: 'my edits' });
    renderHook(() => useLiveSongs());
    act(() => latest().emit('song', { id: 'a-1', song: sentSong, autoplay: false }));
    expect(useSessionStore.getState().currentCode).toBe('my edits');
    expect(useSessionStore.getState().pendingLiveSong?.id).toBe('a-1');
  });

  it('ignores invalid songs, malformed data and duplicates', () => {
    renderHook(() => useLiveSongs());
    act(() => latest().emit('song', { id: 'bad', song: { ...sentSong, bpm: 9999 }, autoplay: false }));
    act(() => latest().emit('song', 'not json at all'));
    expect(useSessionStore.getState().pendingLiveSong).toBeNull();
    act(() => latest().emit('song', { id: 'a-1', song: sentSong, autoplay: false }));
    act(() => useSessionStore.getState().dismissLiveSong());
    act(() => latest().emit('song', { id: 'a-1', song: sentSong, autoplay: false }));
    expect(useSessionStore.getState().pendingLiveSong).toBeNull();
  });

  it('reconnects with growing waits when the browser gives up, resuming after the last song', () => {
    vi.useFakeTimers();
    renderHook(() => useLiveSongs());
    act(() => latest().emit('song', { id: 'abcd0123-4', song: sentSong, autoplay: false }));
    act(() => latest().fail(true));
    expect(useSessionStore.getState().liveConnection).toBe('offline');
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(latest().url).toBe('/api/songs/stream?lastEventId=abcd0123-4');
    act(() => latest().fail(true));
    act(() => vi.advanceTimersByTime(1999));
    expect(FakeEventSource.instances).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeEventSource.instances).toHaveLength(3);
    for (let i = 0; i < 10; i += 1) {
      act(() => latest().fail(true));
      act(() => vi.advanceTimersByTime(MAX_RECONNECT_MS));
    }
    expect(FakeEventSource.instances).toHaveLength(13);
    act(() => latest().open());
    expect(useSessionStore.getState().liveConnection).toBe('connected');
  });

  it('closes the connection on unmount', () => {
    const { unmount } = renderHook(() => useLiveSongs());
    const source = latest();
    unmount();
    expect(source.closed).toBe(true);
  });
});

describe('LiveSongPrompt (AC-3/AC-5)', () => {
  const pending = { id: 'p-1', song: sentSong, name: 'groove', autoplay: false };

  it('loads the song when the user clicks Load', () => {
    useSessionStore.setState({ language: 'en', pendingLiveSong: pending });
    render(<LiveSongPrompt />);
    expect(screen.getByText('Claude sent you a song')).toBeInTheDocument();
    expect(screen.getByText('groove')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(useSessionStore.getState().bpm).toBe(96);
    expect(screen.queryByText('Claude sent you a song')).not.toBeInTheDocument();
  });

  it('asks for confirmation before replacing manual code edits', () => {
    useSessionStore.setState({ language: 'en', pendingLiveSong: pending, isCodeManuallyEdited: true, currentCode: 'my edits' });
    render(<LiveSongPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(useSessionStore.getState().currentCode).toBe('my edits');
    expect(screen.getByRole('alert')).toHaveTextContent(/discard/);

    fireEvent.click(screen.getByRole('button', { name: 'Keep my code' }));
    expect(useSessionStore.getState().currentCode).toBe('my edits');
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace my code' }));
    expect(useSessionStore.getState().bpm).toBe(96);
    expect(useSessionStore.getState().isCodeManuallyEdited).toBe(false);
  });

  it('says the song comes in on the next bar when music is playing', () => {
    useSessionStore.setState({ language: 'en', pendingLiveSong: pending, isPlaying: true });
    render(<LiveSongPrompt />);
    expect(screen.getByText(/next bar/)).toBeInTheDocument();
  });

  it('dismisses without loading', () => {
    useSessionStore.setState({ language: 'en', pendingLiveSong: pending });
    render(<LiveSongPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(useSessionStore.getState().pendingLiveSong).toBeNull();
    expect(useSessionStore.getState().bpm).toBe(initialSong.bpm);
  });
});
