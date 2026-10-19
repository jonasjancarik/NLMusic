// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { patternToSong } from '../../song';
import { MAX_ITEMS, MAX_SUBSCRIBERS, PENDING_TTL_MS, createSongHub, getSongHub } from '../songHub';
import { handleStream } from '../streamResponse';
import type { LiveSongMessage } from '../types';

const song = patternToSong({ bpm: 100, tracks: [] });
const input = (name: string) => ({ song, name, autoplay: false });

describe('song queue', () => {
  it('sends each song to every connected tab (two tabs: both get it)', () => {
    const hub = createSongHub();
    const a: LiveSongMessage[] = [];
    const b: LiveSongMessage[] = [];
    hub.subscribe((m) => a.push(m));
    hub.subscribe((m) => b.push(m));
    expect(hub.push(input('one')).tabs).toBe(2);
    expect(a.map((m) => m.name)).toEqual(['one']);
    expect(b.map((m) => m.name)).toEqual(['one']);
  });

  it('keeps a song sent while no tab is open for the next tab that connects, once', () => {
    const hub = createSongHub();
    expect(hub.push(input('waiting')).tabs).toBe(0);
    expect(hub.subscribe(() => {})!.replay.map((m) => m.name)).toEqual(['waiting']);
    expect(hub.subscribe(() => {})!.replay).toEqual([]);
  });

  it('replays what a reconnecting tab missed after its Last-Event-ID', () => {
    const hub = createSongHub();
    const first = hub.subscribe(() => {})!;
    const { id } = hub.push(input('seen'));
    first.unsubscribe();
    hub.push(input('missed'));
    expect(hub.subscribe(() => {}, id)!.replay.map((m) => m.name)).toEqual(['missed']);
  });

  it('ignores a Last-Event-ID from a previous server start', () => {
    const hub = createSongHub();
    hub.push(input('fresh'));
    expect(hub.subscribe(() => {}, 'deadbeef-999')!.replay.map((m) => m.name)).toEqual(['fresh']);
  });

  it('drops old songs and caps the queue', () => {
    let now = 0;
    const hub = createSongHub(() => now);
    hub.push(input('old'));
    now += PENDING_TTL_MS + 1;
    for (let i = 0; i < MAX_ITEMS + 3; i += 1) hub.push(input(`n${i}`));
    const replay = hub.subscribe(() => {})!.replay;
    expect(replay).toHaveLength(MAX_ITEMS);
    expect(replay.some((m) => m.name === 'old')).toBe(false);
  });

  it('refuses subscribers past the limit and frees the slot on unsubscribe', () => {
    const hub = createSongHub();
    const subs = Array.from({ length: MAX_SUBSCRIBERS }, () => hub.subscribe(() => {})!);
    expect(hub.subscribe(() => {})).toBeNull();
    subs[0].unsubscribe();
    expect(hub.subscribe(() => {})).not.toBeNull();
  });

  it('is a single shared instance across modules and hot reloads (globalThis)', () => {
    expect(getSongHub()).toBe(getSongHub());
    expect((globalThis as { __nlmusicSongHub?: unknown }).__nlmusicSongHub).toBe(getSongHub());
  });
});

describe('GET /api/songs/stream (SSE)', () => {
  async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, needle: string): Promise<string> {
    const decoder = new TextDecoder();
    let text = '';
    while (!text.includes(needle)) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    return text;
  }

  it('streams pushed songs as `song` events and unsubscribes when the tab goes away', async () => {
    const hub = createSongHub();
    const abort = new AbortController();
    const res = handleStream(new Request('http://x/api/songs/stream', { signal: abort.signal }), hub);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const reader = res.body!.getReader();
    expect(await readUntil(reader, 'event: ready')).toMatch(/retry: \d+/);

    const { id } = hub.push(input('live'));
    const text = await readUntil(reader, 'event: song');
    expect(text).toContain(`id: ${id}`);
    const data = JSON.parse(/data: (.*)\n/.exec(text.slice(text.indexOf('event: song')))![1]) as LiveSongMessage;
    expect(data.name).toBe('live');

    expect(hub.subscriberCount()).toBe(1);
    abort.abort();
    expect(hub.subscriberCount()).toBe(0);
  });

  it('tells the browser to back off when the server is full', async () => {
    const hub = createSongHub();
    for (let i = 0; i < MAX_SUBSCRIBERS; i += 1) hub.subscribe(() => {});
    const text = await new Response(handleStream(new Request('http://x/api/songs/stream'), hub).body).text();
    expect(text).toContain('event: busy');
  });
});
