// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { patternToSong } from '../../song';
import { handlePush } from '../pushRequest';
import { ensurePushToken } from '../pushToken';
import { createSongHub, type SongHub } from '../songHub';
import { MAX_PUSH_BODY_BYTES, type LiveSongMessage } from '../types';

const song = patternToSong({
  bpm: 120,
  tracks: [
    { id: 'kick', name: 'Kick', sample: 'bd', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], volume: 0.8, muted: false, solo: false },
  ],
});

let dir: string;
let tokenFile: string;
let token: string;
let hub: SongHub;
let received: LiveSongMessage[];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlmusic-push-'));
  tokenFile = path.join(dir, '.nlmusic', 'push-token');
  token = ensurePushToken(tokenFile);
  hub = createSongHub();
  received = [];
  hub.subscribe((message) => received.push(message));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1:3000/api/songs/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const push = (req: Request) => handlePush(req, { hub, tokenFile });

describe('POST /api/songs/push — only local tools can send (AC-1)', () => {
  it('rejects a request without the token, even if it claims to come from localhost', async () => {
    const res = await push(
      request({ song }, { Authorization: '', Host: 'localhost:3000', 'X-Forwarded-For': '127.0.0.1', 'X-Real-IP': '127.0.0.1' }),
    );
    expect(res.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it('rejects a wrong token', async () => {
    const res = await push(request({ song }, { Authorization: `Bearer ${'0'.repeat(64)}` }));
    expect(res.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it('rejects a request forwarded from another machine, even with the right token', async () => {
    const res = await push(request({ song }, { 'X-Forwarded-For': '192.168.1.20' }));
    expect(res.status).toBe(403);
    expect(received).toHaveLength(0);
  });

  it('rejects requests made by a web page (Origin / Sec-Fetch-Site)', async () => {
    expect((await push(request({ song }, { Origin: 'http://localhost:3000' }))).status).toBe(403);
    expect((await push(request({ song }, { 'Sec-Fetch-Site': 'same-origin' }))).status).toBe(403);
    expect(received).toHaveLength(0);
  });

  it('refuses a token file other users can read', async () => {
    fs.chmodSync(tokenFile, 0o644);
    const res = await push(request({ song }));
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toMatch(/chmod 600/);
  });

  it('refuses a token file that is a symbolic link', async () => {
    const real = path.join(dir, 'elsewhere');
    fs.writeFileSync(real, `${token}\n`, { mode: 0o600 });
    fs.rmSync(tokenFile);
    fs.symlinkSync(real, tokenFile);
    expect((await push(request({ song }))).status).toBe(500);
  });

  it('creates the token file with private permissions when it does not exist', () => {
    const fresh = path.join(dir, 'new', 'push-token');
    const created = ensurePushToken(fresh);
    expect(created).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.statSync(fresh).mode & 0o777).toBe(0o600);
    expect(ensurePushToken(fresh)).toBe(created);
  });
});

describe('POST /api/songs/push — validation', () => {
  it('accepts a valid song and delivers it to connected tabs', async () => {
    const res = await push(request({ song, name: 'demo', autoplay: true }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; tabs: number; id: string };
    expect(body).toMatchObject({ ok: true, tabs: 1 });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ id: body.id, name: 'demo', autoplay: true });
    expect(received[0].song.bpm).toBe(120);
  });

  it('rejects an invalid song with errors that name what is wrong', async () => {
    const broken = { ...song, sections: [{ ...song.sections[0], tracks: [{ ...song.sections[0].tracks[0], steps: [1, 0] }] }] };
    const res = await push(request({ song: broken }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: string[] };
    expect(body.errors.join(' ')).toMatch(/steps/);
    expect(received).toHaveLength(0);
  });

  it('rejects unknown fields, bad JSON, a missing song and the wrong content type', async () => {
    expect((await push(request({ song, extra: 1 }))).status).toBe(400);
    expect((await push(request('{nope'))).status).toBe(400);
    expect((await push(request({ name: 'x' }))).status).toBe(400);
    expect((await push(request({ song }, { 'Content-Type': 'text/plain' }))).status).toBe(415);
  });

  it('rejects a body over the size limit', async () => {
    const res = await push(request({ song, name: 'x'.repeat(MAX_PUSH_BODY_BYTES) }));
    expect(res.status).toBe(413);
  });

  it('rejects an oversized chunked body without Content-Length', async () => {
    const big = new TextEncoder().encode(JSON.stringify({ song, pad: 'x'.repeat(MAX_PUSH_BODY_BYTES) }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < big.length; i += 16_384) controller.enqueue(big.slice(i, i + 16_384));
        controller.close();
      },
    });
    const req = new Request('http://127.0.0.1:3000/api/songs/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
      duplex: 'half',
    } as RequestInit);
    expect((await push(req)).status).toBe(413);
  });
});
