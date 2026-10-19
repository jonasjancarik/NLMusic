// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveInsideSongsDir, sanitizeSongName } from '../songFiles';

let root: string;
let songsDir: string;
let outside: string;

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nlmusic-files-')));
  songsDir = path.join(root, 'songs');
  outside = path.join(root, 'outside');
  fs.mkdirSync(songsDir);
  fs.mkdirSync(outside);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('sanitizeSongName', () => {
  it.each([
    ['Rock Beat', 'rock-beat'],
    ['my_song-2', 'my_song-2'],
    ['groove.json', 'groove'],
    ['  Cumbia   Lenta ', 'cumbia-lenta'],
  ])('turns %j into %j', (input, expected) => {
    expect(sanitizeSongName(input)).toEqual({ ok: true, name: expected });
  });

  it.each(['../evil', '..', 'a/b', 'a\\b', '/etc/passwd', 'C:\\x', '~/x', '', '   ', '...', '\0x', 'a\0b'])(
    'rejects %j',
    (input) => {
      expect(sanitizeSongName(input).ok).toBe(false);
    },
  );

  it('rejects names that sanitize to nothing', () => {
    expect(sanitizeSongName('???').ok).toBe(false);
  });
});

describe('resolveInsideSongsDir', () => {
  it('resolves a plain file inside songs/', () => {
    const result = resolveInsideSongsDir(songsDir, 'a.mid', '.mid');
    expect(result).toEqual({ ok: true, path: path.join(songsDir, 'a.mid') });
  });

  it('allows subdirectories inside songs/', () => {
    const result = resolveInsideSongsDir(songsDir, 'exports/a.mid', '.mid');
    expect(result).toEqual({ ok: true, path: path.join(songsDir, 'exports', 'a.mid') });
  });

  it.each(['../a.mid', 'x/../../a.mid', '/tmp/a.mid', 'C:\\a.mid', '..\\a.mid', 'a\0.mid'])('rejects %j', (input) => {
    const result = resolveInsideSongsDir(songsDir, input, '.mid');
    expect(result.ok).toBe(false);
  });

  it('rejects the wrong extension', () => {
    expect(resolveInsideSongsDir(songsDir, 'a.json', '.mid').ok).toBe(false);
    expect(resolveInsideSongsDir(songsDir, 'a', '.mid').ok).toBe(false);
  });

  it('rejects a symlinked directory that points outside songs/', () => {
    fs.symlinkSync(outside, path.join(songsDir, 'link'));
    expect(resolveInsideSongsDir(songsDir, 'link/a.mid', '.mid').ok).toBe(false);
  });

  it('rejects a symlinked file that points outside songs/', () => {
    fs.writeFileSync(path.join(outside, 'secret.json'), '{}');
    fs.symlinkSync(path.join(outside, 'secret.json'), path.join(songsDir, 'secret.json'));
    expect(resolveInsideSongsDir(songsDir, 'secret.json', '.json').ok).toBe(false);
  });

  it('rejects a symlinked songs/ directory whose targets escape through a nested link', () => {
    fs.mkdirSync(path.join(songsDir, 'sub'));
    fs.symlinkSync(outside, path.join(songsDir, 'sub', 'deep'));
    expect(resolveInsideSongsDir(songsDir, 'sub/deep/new/a.mid', '.mid').ok).toBe(false);
  });

  it('works when songs/ does not exist yet', () => {
    const missing = path.join(root, 'fresh');
    expect(resolveInsideSongsDir(missing, 'a.json', '.json')).toEqual({ ok: true, path: path.join(missing, 'a.json') });
  });
});
