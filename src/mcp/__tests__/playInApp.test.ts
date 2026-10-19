// @vitest-environment node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handlePush } from '../../lib/live/pushRequest';
import { createSongHub, type SongHub } from '../../lib/live/songHub';
import type { LiveSongMessage } from '../../lib/live/types';
import { playInApp } from '../playInApp';
import { saveSong, type ToolContext } from '../songTools';
import { badSong, goodSong } from './helpers';

let dir: string;
let ctx: ToolContext;
let hub: SongHub;
let server: http.Server;

/** Servidor HTTP mínimo con la misma lógica que la ruta de Next. */
async function startApp(tokenFile: string): Promise<string> {
  server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
    const response = await handlePush(
      new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers, body: Buffer.concat(chunks) }),
      { hub, tokenFile },
    );
    res.writeHead(response.status, { 'Content-Type': 'application/json' });
    res.end(await response.text());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlmusic-play-'));
  hub = createSongHub();
  const tokenFile = path.join(dir, '.nlmusic', 'push-token');
  ctx = { songsDir: path.join(dir, 'songs'), pushTokenFile: tokenFile, appUrl: await startApp(tokenFile) };
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('play_in_app (TASK-29 AC-4)', () => {
  it('sends an inline song to the open tab', async () => {
    const received: LiveSongMessage[] = [];
    hub.subscribe((m) => received.push(m));
    const result = await playInApp(ctx, { song: goodSong(), autoplay: true });
    expect(result).toMatchObject({ ok: true, tabs: 1, delivered: true });
    expect(received[0]).toMatchObject({ autoplay: true });
    expect(received[0].song.sections[0].id).toBe('verse');
  });

  it('sends a saved song by name', async () => {
    saveSong(ctx, { name: 'groove', song: goodSong() });
    const received: LiveSongMessage[] = [];
    hub.subscribe((m) => received.push(m));
    expect(await playInApp(ctx, { name: 'groove' })).toMatchObject({ ok: true, tabs: 1 });
    expect(received[0]).toMatchObject({ name: 'groove', autoplay: false });
  });

  it('says clearly when no tab is open, and that the song is kept', async () => {
    saveSong(ctx, { name: 'groove', song: goodSong() });
    const result = await playInApp(ctx, { name: 'groove' });
    expect(result).toMatchObject({ ok: true, tabs: 0, delivered: false });
    if (!result.ok) throw new Error('unreachable');
    expect(result.message).toMatch(/No NLMusic tab is open/);
    expect(result.message).toMatch(/songs\/groove\.json/);
    expect(hub.subscribe(() => {})!.replay.map((m) => m.name)).toEqual(['groove']);
  });

  it('says clearly when the app is not running', async () => {
    const result = await playInApp({ ...ctx, appUrl: 'http://127.0.0.1:9' }, { song: goodSong() });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.join(' ')).toMatch(/not running at http:\/\/127\.0\.0\.1:9.*npm run dev/);
  });

  it('explains a token mismatch (MCP and app started from different folders)', async () => {
    const result = await playInApp({ ...ctx, pushTokenFile: path.join(dir, 'other', 'push-token') }, { song: goodSong() });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.join(' ')).toMatch(/rejected the push token/);
  });

  it('does not send an invalid song', async () => {
    const result = await playInApp(ctx, { song: badSong() });
    expect(result.ok).toBe(false);
    expect(hub.subscribe(() => {})!.replay).toEqual([]);
  });
});
