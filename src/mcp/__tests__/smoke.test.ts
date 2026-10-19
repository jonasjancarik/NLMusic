// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { badSong, goodSong } from './helpers';

/**
 * Smoke test: arranca `npm run mcp` de verdad (proceso Node con tsx, sin jsdom ni Next),
 * se conecta con el cliente del SDK por stdio y recorre las herramientas.
 */
const REPO = path.resolve(__dirname, '../../..');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');

let tmp: string;
let client: Client;

function text(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content.map((c) => c.text).join('\n');
}

beforeAll(async () => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nlmusic-smoke-')));
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    NLMUSIC_SONGS_DIR: path.join(tmp, 'songs'),
  };
  client = new Client({ name: 'smoke', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: TSX, args: ['src/mcp/index.ts'], cwd: REPO, env, stderr: 'pipe' }));
}, 60_000);

afterAll(async () => {
  await client?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('MCP server over stdio', () => {
  it('lists the tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['export_midi', 'export_strudel', 'get_song_guide', 'list_songs', 'load_song', 'play_in_app', 'save_song', 'validate_song'],
    );
  });

  it('serves the guide', async () => {
    expect(text(await client.callTool({ name: 'get_song_guide', arguments: {} }))).toContain('Drum guide');
  });

  it('reports errors for a bad song, then validates, saves, lists, loads and exports a good one', async () => {
    const bad = await client.callTool({ name: 'validate_song', arguments: { song: badSong() } });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain('track \\"snare\\"');

    const ok = await client.callTool({ name: 'validate_song', arguments: { song: goodSong() } });
    expect(ok.isError).not.toBe(true);

    const saved = await client.callTool({ name: 'save_song', arguments: { name: 'smoke', song: goodSong() } });
    expect(saved.isError).not.toBe(true);
    expect(fs.existsSync(path.join(tmp, 'songs', 'smoke.json'))).toBe(true);

    const again = await client.callTool({ name: 'save_song', arguments: { name: 'smoke', song: goodSong() } });
    expect(again.isError).toBe(true);

    expect(text(await client.callTool({ name: 'list_songs', arguments: {} }))).toContain('"smoke"');
    expect(text(await client.callTool({ name: 'load_song', arguments: { name: 'smoke' } }))).toContain('"bpm": 100');

    const midi = await client.callTool({ name: 'export_midi', arguments: { name: 'smoke' } });
    expect(midi.isError).not.toBe(true);
    expect(fs.readFileSync(path.join(tmp, 'songs', 'smoke.mid')).subarray(0, 4).toString('ascii')).toBe('MThd');

    expect(text(await client.callTool({ name: 'export_strudel', arguments: { name: 'smoke' } }))).toContain('cpm');
  });

  it('refuses path traversal through the protocol', async () => {
    const result = await client.callTool({ name: 'save_song', arguments: { name: '../escape', song: goodSong() } });
    expect(result.isError).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'escape.json'))).toBe(false);
  });
});

// Child env with only PATH plus the given vars (not the whole parent env).
const minimalEnv = (extra: Record<string, string>): NodeJS.ProcessEnv =>
  Object.assign({} as NodeJS.ProcessEnv, { PATH: process.env.PATH ?? '' }, extra);

describe('CLI in plain Node', () => {
  const run = (args: string[], songsDir: string) =>
    spawnSync(TSX, ['src/mcp/song.ts', ...args], {
      cwd: REPO,
      env: minimalEnv({ NLMUSIC_SONGS_DIR: songsDir }),
      encoding: 'utf8',
    });

  it('validates, saves, lists and exports', () => {
    const songsDir = path.join(tmp, 'cli-songs');
    const file = path.join(tmp, 'good.json');
    const badFile = path.join(tmp, 'bad.json');
    fs.writeFileSync(file, JSON.stringify(goodSong()));
    fs.writeFileSync(badFile, JSON.stringify(badSong()));

    expect(run(['validate', file], songsDir).status).toBe(0);
    const bad = run(['validate', badFile], songsDir);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('track \\"snare\\"');

    expect(run(['save', 'cli', file], songsDir).status).toBe(0);
    expect(run(['save', 'cli', file], songsDir).status).toBe(1);
    expect(run(['save', 'cli', file, '--overwrite'], songsDir).status).toBe(0);
    expect(run(['list'], songsDir).stdout).toContain('"cli"');
    expect(run(['midi', 'cli'], songsDir).status).toBe(0);
    expect(fs.existsSync(path.join(songsDir, 'cli.mid'))).toBe(true);
    expect(run(['strudel', 'cli'], songsDir).stdout).toContain('cpm');
    expect(run(['midi', 'cli', '../out.mid'], songsDir).status).toBe(1);
    expect(run(['nonsense'], songsDir).status).toBe(2);
  }, 60_000);

  it('does not read ANTHROPIC_API_KEY (works with it unset and set)', () => {
    const out = execFileSync(TSX, ['src/mcp/song.ts', 'list'], {
      cwd: REPO,
      env: minimalEnv({ NLMUSIC_SONGS_DIR: path.join(tmp, 'none'), ANTHROPIC_API_KEY: 'sk-test' }),
      encoding: 'utf8',
    });
    expect(out).not.toContain('sk-test');
  });
});
