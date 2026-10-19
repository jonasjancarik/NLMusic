import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  exportMidi,
  exportStrudel,
  getSongGuide,
  listSongs,
  loadSong,
  saveSong,
  validateSongTool,
  type ToolContext,
} from './songTools';

/**
 * Servidor MCP de NLMusic (TASK-28). Envoltorio fino: cada herramienta llama a las funciones
 * de `songTools.ts`, que usan el mismo código que la app (validateSong, compileSong, songToMidi).
 * No hay llamadas a la API de Anthropic: quien escribe la canción es el cliente MCP.
 */

const songArg = z
  .union([z.record(z.string(), z.unknown()), z.string()])
  .describe('The song: a JSON object (or JSON text). Call get_song_guide for the format.');

const nameArg = z.string().describe('Song name; becomes songs/<name>.json (letters, digits, "-", "_").');

type Result = { ok: boolean } & Record<string, unknown>;

function reply(result: Result) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    ...(result.ok ? {} : { isError: true }),
  };
}

export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: 'nlmusic', version: '0.1.0' });

  server.registerTool(
    'get_song_guide',
    {
      description:
        'Read this first. Returns the song JSON format and the drum guide (voices, step notation, song form, styles, examples) used by NLMusic.',
    },
    async () => ({ content: [{ type: 'text' as const, text: getSongGuide().guide }] }),
  );

  server.registerTool(
    'validate_song',
    {
      description:
        'Check a song without saving it. Returns { ok: true } or { ok: false, errors } where each error names the section and track and what is wrong.',
      inputSchema: { song: songArg },
    },
    async ({ song }) => reply(validateSongTool(song)),
  );

  server.registerTool(
    'save_song',
    {
      description:
        'Validate a song and write it to songs/<name>.json. Refuses invalid songs, and refuses to replace an existing song unless overwrite is true.',
      inputSchema: { name: nameArg, song: songArg, overwrite: z.boolean().optional() },
    },
    async ({ name, song, overwrite }) => reply(saveSong(ctx, { name, song, overwrite })),
  );

  server.registerTool(
    'list_songs',
    { description: 'List the songs saved in songs/ with bpm, sections and bars.' },
    async () => reply(listSongs(ctx)),
  );

  server.registerTool(
    'load_song',
    { description: 'Read a saved song from songs/<name>.json.', inputSchema: { name: nameArg } },
    async ({ name }) => reply(loadSong(ctx, name)),
  );

  server.registerTool(
    'export_midi',
    {
      description:
        'Write a Standard MIDI File (drums on channel 10). Pass a saved song "name" or an inline "song". Written to songs/<name>.mid unless outPath (relative to songs/, ending in .mid) is given.',
      inputSchema: { name: nameArg.optional(), song: songArg.optional(), outPath: z.string().optional() },
    },
    async (args) => reply(exportMidi(ctx, args)),
  );

  server.registerTool(
    'export_strudel',
    {
      description: 'Return the Strudel code for a saved song ("name") or an inline "song". Nothing is written to disk.',
      inputSchema: { name: nameArg.optional(), song: songArg.optional() },
    },
    async (args) => reply(exportStrudel(ctx, args)),
  );

  return server;
}
