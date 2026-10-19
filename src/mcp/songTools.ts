import fs from 'node:fs';
import path from 'node:path';
import type { Song } from '../lib/types';
import { compileSong, totalBars } from '../lib/song';
import { songToMidi } from '../lib/midi';
import { interpretSongResponse } from '../lib/llm/songPipeline';
import { buildSongGuide } from './songGuide';
import { resolveInsideSongsDir, sanitizeSongName } from './songFiles';

/**
 * Operaciones compartidas por el servidor MCP y la CLI (TASK-28). Son funciones puras sobre
 * un directorio `songsDir`; ninguna llama a la API ni lee la clave de API (BR-011).
 * Los errores de usuario no lanzan: devuelven `{ ok: false, errors }` con mensajes que
 * nombran sección y pista (los de `validateSong`), para que quien escribe la canción pueda corregir.
 */

export interface ToolContext {
  songsDir: string;
}

export type Failure = { ok: false; errors: string[] };
const fail = (...errors: string[]): Failure => ({ ok: false, errors });

/** Entrada de canción: objeto, o texto JSON (el cliente puede mandar cualquiera de los dos). */
export type SongInput = unknown;

export type ParsedSong = { ok: true; song: Song; warnings: string[] } | Failure;

/** Normaliza y valida una canción con el mismo código que usa la app (delta replaceSong + validateSong). */
export function parseSongInput(input: SongInput): ParsedSong {
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (error) {
      return fail(`The song is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('The song must be a JSON object with bpm, stepsPerBar, sections and arrangement.');
  }
  const result = interpretSongResponse({ text: JSON.stringify(raw) }, { turns: [] });
  if (!result.ok) return fail(...result.errors);
  return { ok: true, song: result.song, warnings: result.warnings };
}

export function getSongGuide(): { guide: string } {
  return { guide: buildSongGuide() };
}

export function validateSongTool(input: SongInput): { ok: true; warnings: string[]; summary: SongSummary } | Failure {
  const parsed = parseSongInput(input);
  if (!parsed.ok) return parsed;
  return { ok: true, warnings: parsed.warnings, summary: summarize(parsed.song) };
}

export interface SongSummary {
  bpm: number;
  stepsPerBar: number;
  sections: number;
  bars: number;
}

function summarize(song: Song): SongSummary {
  return { bpm: song.bpm, stepsPerBar: song.stepsPerBar, sections: song.sections.length, bars: totalBars(song) };
}

function songFile(ctx: ToolContext, name: string): { ok: true; name: string; file: string } | Failure {
  const clean = sanitizeSongName(name);
  if (!clean.ok) return fail(clean.error);
  const resolved = resolveInsideSongsDir(ctx.songsDir, `${clean.name}.json`, '.json');
  if (!resolved.ok) return fail(resolved.error);
  return { ok: true, name: clean.name, file: resolved.path };
}

export function saveSong(
  ctx: ToolContext,
  args: { name: string; song: SongInput; overwrite?: boolean },
): { ok: true; name: string; path: string; overwritten: boolean; warnings: string[] } | Failure {
  const target = songFile(ctx, args.name);
  if (!target.ok) return target;
  const parsed = parseSongInput(args.song);
  if (!parsed.ok) return parsed;

  fs.mkdirSync(path.dirname(target.file), { recursive: true });
  // Re-check after mkdir: now the directory exists, so a symlink swap would be caught here.
  const recheck = resolveInsideSongsDir(ctx.songsDir, `${target.name}.json`, '.json');
  if (!recheck.ok) return fail(recheck.error);

  const body = `${JSON.stringify(parsed.song, null, 2)}\n`;
  const existed = fs.existsSync(target.file);
  try {
    // 'wx' fails atomically if the file exists, so nothing is overwritten by accident.
    fs.writeFileSync(target.file, body, { flag: args.overwrite ? 'w' : 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return fail(`songs/${target.name}.json already exists. Pass overwrite: true to replace it, or choose another name.`);
    }
    throw error;
  }
  return { ok: true, name: target.name, path: target.file, overwritten: existed, warnings: parsed.warnings };
}

export function loadSong(ctx: ToolContext, name: string): { ok: true; name: string; song: Song; warnings: string[] } | Failure {
  const target = songFile(ctx, name);
  if (!target.ok) return target;
  let text: string;
  try {
    text = fs.readFileSync(target.file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const known = listSongs(ctx).songs.map((song) => song.name);
      return fail(`No song named "${target.name}" in songs/. ${known.length ? `Available: ${known.join(', ')}.` : 'songs/ has no songs yet.'}`);
    }
    throw error;
  }
  const parsed = parseSongInput(text);
  if (!parsed.ok) return fail(...parsed.errors.map((message) => `songs/${target.name}.json: ${message}`));
  return { ok: true, name: target.name, song: parsed.song, warnings: parsed.warnings };
}

export interface SongListing extends Partial<SongSummary> {
  name: string;
  valid: boolean;
  modified: string;
}

export function listSongs(ctx: ToolContext): { ok: true; songs: SongListing[] } {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(ctx.songsDir, { withFileTypes: true });
  } catch {
    return { ok: true, songs: [] };
  }
  const songs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry): SongListing | undefined => {
      const name = entry.name.slice(0, -'.json'.length);
      const resolved = resolveInsideSongsDir(ctx.songsDir, entry.name, '.json');
      if (!resolved.ok) return undefined;
      const modified = fs.statSync(resolved.path).mtime.toISOString();
      const parsed = parseSongInput(fs.readFileSync(resolved.path, 'utf8'));
      return parsed.ok ? { name, valid: true, modified, ...summarize(parsed.song) } : { name, valid: false, modified };
    })
    .filter((song): song is SongListing => song !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, songs };
}

/** Resuelve `name` (canción guardada) o `song` (inline). */
function songFromArgs(ctx: ToolContext, args: { name?: string; song?: SongInput }): { ok: true; song: Song; name?: string } | Failure {
  if (args.name !== undefined && args.song !== undefined) return fail('Pass either "name" or "song", not both.');
  if (args.name !== undefined) {
    const loaded = loadSong(ctx, args.name);
    return loaded.ok ? { ok: true, song: loaded.song, name: loaded.name } : loaded;
  }
  if (args.song !== undefined) {
    const parsed = parseSongInput(args.song);
    return parsed.ok ? { ok: true, song: parsed.song } : parsed;
  }
  return fail('Pass "name" (a saved song) or "song" (the song itself).');
}

export function exportMidi(
  ctx: ToolContext,
  args: { name?: string; song?: SongInput; outPath?: string },
): { ok: true; path: string; bytes: number } | Failure {
  const source = songFromArgs(ctx, args);
  if (!source.ok) return source;
  const relative = args.outPath ?? `${source.name ?? 'untitled'}.mid`;
  const resolved = resolveInsideSongsDir(ctx.songsDir, relative, '.mid');
  if (!resolved.ok) return fail(resolved.error);
  fs.mkdirSync(path.dirname(resolved.path), { recursive: true });
  const recheck = resolveInsideSongsDir(ctx.songsDir, relative, '.mid');
  if (!recheck.ok) return fail(recheck.error);
  const bytes = songToMidi(source.song);
  fs.writeFileSync(resolved.path, bytes);
  return { ok: true, path: resolved.path, bytes: bytes.byteLength };
}

export function exportStrudel(
  ctx: ToolContext,
  args: { name?: string; song?: SongInput },
): { ok: true; code: string } | Failure {
  const source = songFromArgs(ctx, args);
  if (!source.ok) return source;
  return { ok: true, code: compileSong(source.song) };
}
