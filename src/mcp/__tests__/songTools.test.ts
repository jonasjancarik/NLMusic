// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportMidi, exportStrudel, getSongGuide, listSongs, loadSong, saveSong, validateSongTool } from '../songTools';
import { badSong, goodSong, unknownVoiceSong } from './helpers';

let root: string;
let ctx: { songsDir: string };

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nlmusic-tools-')));
  ctx = { songsDir: path.join(root, 'songs') };
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('path traversal and unsafe names (written first, AC-4)', () => {
  const attacks = ['../evil', '../../etc/passwd', '/tmp/evil', 'a/../../evil', '..\\evil', 'C:\\evil'];

  it.each(attacks)('save_song rejects name %j and writes nothing outside songs/', (name) => {
    const result = saveSong(ctx, { name, song: goodSong() });
    expect(result.ok).toBe(false);
    expect(fs.readdirSync(root)).not.toContain('evil.json');
    expect(fs.existsSync(path.join(root, 'evil.json'))).toBe(false);
  });

  it.each(attacks)('load_song rejects name %j', (name) => {
    expect(loadSong(ctx, name).ok).toBe(false);
  });

  it.each(['../out.mid', '/tmp/out.mid', 'sub/../../out.mid', 'x.json'])('export_midi rejects outPath %j', (outPath) => {
    const result = exportMidi(ctx, { song: goodSong(), outPath });
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(root, 'out.mid'))).toBe(false);
  });

  it('does not follow a symlinked songs/ file to write outside', () => {
    const outside = path.join(root, 'outside.json');
    fs.writeFileSync(outside, 'original');
    fs.mkdirSync(ctx.songsDir);
    fs.symlinkSync(outside, path.join(ctx.songsDir, 'trap.json'));
    const result = saveSong(ctx, { name: 'trap', song: goodSong(), overwrite: true });
    expect(result.ok).toBe(false);
    expect(fs.readFileSync(outside, 'utf8')).toBe('original');
  });

  it('does not write MIDI through a symlinked directory', () => {
    const outside = path.join(root, 'elsewhere');
    fs.mkdirSync(outside);
    fs.mkdirSync(ctx.songsDir);
    fs.symlinkSync(outside, path.join(ctx.songsDir, 'link'));
    const result = exportMidi(ctx, { song: goodSong(), outPath: 'link/out.mid' });
    expect(result.ok).toBe(false);
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it('sanitizes harmless names', () => {
    const result = saveSong(ctx, { name: 'My Rock Beat', song: goodSong() });
    expect(result).toMatchObject({ ok: true, name: 'my-rock-beat' });
    expect(fs.existsSync(path.join(ctx.songsDir, 'my-rock-beat.json'))).toBe(true);
  });
});

describe('validate_song', () => {
  it('accepts a good song', () => {
    const result = validateSongTool(goodSong());
    expect(result).toMatchObject({ ok: true, summary: { bpm: 100, sections: 1, bars: 4 } });
  });

  it('accepts JSON text', () => {
    expect(validateSongTool(JSON.stringify(goodSong())).ok).toBe(true);
  });

  it('accepts the app response wrapper (replaceSong)', () => {
    const wrapped = { operations: [{ type: 'replaceSong', song: goodSong() }] };
    expect(validateSongTool(wrapped).ok).toBe(true);
  });

  it('names the section and track of every problem', () => {
    const result = validateSongTool(badSong());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = result.errors.join('\n');
    expect(text).toMatch(/Section "verse" › track "snare" › steps/);
  });

  it('names the section and track of an unknown drum voice', () => {
    const result = validateSongTool(unknownVoiceSong());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(/Section "verse" › track "hat" › sample: "banjo"/);
  });

  it('reports a bad arrangement reference with the section id', () => {
    const song = goodSong();
    song.arrangement = [{ sectionId: 'chorus', repeat: 1 }];
    const result = validateSongTool(song);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('chorus');
  });

  it('rejects non-JSON text and non-objects with a clear message', () => {
    expect(validateSongTool('not json')).toMatchObject({ ok: false });
    expect(validateSongTool(42)).toMatchObject({ ok: false });
    expect(validateSongTool(null)).toMatchObject({ ok: false });
  });
});

describe('save / list / load', () => {
  it('saves a good song and loads it back as a valid Song', () => {
    const saved = saveSong(ctx, { name: 'groove', song: goodSong() });
    expect(saved).toMatchObject({ ok: true, name: 'groove', overwritten: false });
    const loaded = loadSong(ctx, 'groove');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.song.bpm).toBe(100);
    expect(loaded.song.sections[0].tracks[0].steps).toHaveLength(32);
  });

  it('does not save an invalid song', () => {
    const result = saveSong(ctx, { name: 'bad', song: badSong() });
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(ctx.songsDir, 'bad.json'))).toBe(false);
  });

  it('does not overwrite without overwrite: true', () => {
    saveSong(ctx, { name: 'groove', song: goodSong() });
    const changed = { ...goodSong(), bpm: 140 };
    const refused = saveSong(ctx, { name: 'groove', song: changed });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errors[0]).toContain('overwrite: true');
    expect(JSON.parse(fs.readFileSync(path.join(ctx.songsDir, 'groove.json'), 'utf8')).bpm).toBe(100);

    const replaced = saveSong(ctx, { name: 'groove', song: changed, overwrite: true });
    expect(replaced).toMatchObject({ ok: true, overwritten: true });
    expect(JSON.parse(fs.readFileSync(path.join(ctx.songsDir, 'groove.json'), 'utf8')).bpm).toBe(140);
  });

  it('lists saved songs, flagging unreadable ones', () => {
    expect(listSongs(ctx)).toEqual({ ok: true, songs: [] });
    saveSong(ctx, { name: 'b-song', song: goodSong() });
    saveSong(ctx, { name: 'a-song', song: goodSong() });
    fs.writeFileSync(path.join(ctx.songsDir, 'broken.json'), '{nope');
    const songs = listSongs(ctx).songs;
    expect(songs.map((s) => [s.name, s.valid])).toEqual([
      ['a-song', true],
      ['b-song', true],
      ['broken', false],
    ]);
    expect(songs[0]).toMatchObject({ bpm: 100, sections: 1, bars: 4 });
  });

  it('load_song explains a missing song and lists what exists', () => {
    saveSong(ctx, { name: 'groove', song: goodSong() });
    const result = loadSong(ctx, 'nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/nope.*groove/);
  });

  it('load_song reports a corrupted file by name', () => {
    fs.mkdirSync(ctx.songsDir);
    fs.writeFileSync(path.join(ctx.songsDir, 'broken.json'), '{nope');
    const result = loadSong(ctx, 'broken');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('songs/broken.json');
  });
});

describe('exports', () => {
  it('writes a MIDI file in songs/ and the bytes read back as an SMF', () => {
    saveSong(ctx, { name: 'groove', song: goodSong() });
    const result = exportMidi(ctx, { name: 'groove' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(path.join(ctx.songsDir, 'groove.mid'));
    const bytes = fs.readFileSync(result.path);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('MThd');
    expect(bytes.byteLength).toBe(result.bytes);
    // drum notes (channel 10 note-on = 0x99) are present
    expect(bytes.includes(0x99)).toBe(true);
  });

  it('exports an inline song to a given outPath and creates folders', () => {
    const result = exportMidi(ctx, { song: goodSong(), outPath: 'exports/take1.mid' });
    expect(result).toMatchObject({ ok: true, path: path.join(ctx.songsDir, 'exports', 'take1.mid') });
  });

  it('does not export an invalid inline song', () => {
    expect(exportMidi(ctx, { song: badSong() }).ok).toBe(false);
    expect(fs.existsSync(ctx.songsDir)).toBe(false);
  });

  it('needs exactly one of name or song', () => {
    expect(exportMidi(ctx, {}).ok).toBe(false);
    expect(exportStrudel(ctx, { name: 'a', song: goodSong() }).ok).toBe(false);
  });

  it('returns Strudel code for a saved song', () => {
    saveSong(ctx, { name: 'groove', song: goodSong() });
    const result = exportStrudel(ctx, { name: 'groove' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.code).toMatch(/stack|arrange|cpm/);
  });
});

describe('get_song_guide', () => {
  it('contains the song format, drum voices and examples', () => {
    const { guide } = getSongGuide();
    expect(guide).toContain('Song format');
    expect(guide).toContain('Drum guide');
    expect(guide).toContain('Example 1');
    expect(guide).toContain('stepsPerBar');
  });
});
