import fs from 'node:fs';
import { exportMidi, exportStrudel, listSongs, loadSong, saveSong, validateSongTool, type ToolContext } from './songTools';
import { defaultSongsDir } from './songsDir';

/**
 * CLI de canciones (TASK-28 AC-3): envoltorio fino sobre songTools.ts, igual que el MCP.
 * Convive con `v0:cli`. Uso: npm run song -- <validate|save|list|midi|strudel> ...
 */

const USAGE = `Usage: npm run song -- <command> ...
  validate <file|->                     check a song file (or stdin)
  save <name> <file|-> [--overwrite]    validate and write songs/<name>.json
  list                                  list saved songs
  midi <name|file> [out.mid]            write songs/<name>.mid (out is relative to songs/)
  strudel <name|file>                   print the Strudel code
A <file> is read from disk as given; <name> refers to songs/<name>.json. Output files always stay inside songs/.`;

class UsageError extends Error {}

function readInput(source: string): unknown {
  try {
    return fs.readFileSync(source === '-' ? 0 : source, 'utf8');
  } catch (error) {
    throw new UsageError(`Cannot read "${source}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Un argumento es archivo si parece una ruta (separador o .json que existe); si no, es el nombre de una canción guardada. */
function songSource(arg: string): { name: string } | { song: unknown } {
  const looksLikeFile = arg === '-' || /[\\/]/.test(arg) || (arg.endsWith('.json') && fs.existsSync(arg));
  return looksLikeFile ? { song: readInput(arg) } : { name: arg };
}

function print(result: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export function runCli(argv: string[], ctx: ToolContext = { songsDir: defaultSongsDir() }): number {
  const args = argv.filter((arg) => arg !== '--overwrite');
  const overwrite = argv.includes('--overwrite');
  const [command, a, b] = args;
  try {
    switch (command) {
      case 'validate': {
        if (!a) throw new UsageError('validate needs a file.');
        const result = validateSongTool(readInput(a));
        print(result);
        return result.ok ? 0 : 1;
      }
      case 'save': {
        if (!a || !b) throw new UsageError('save needs a name and a file.');
        const result = saveSong(ctx, { name: a, song: readInput(b), overwrite });
        print(result);
        return result.ok ? 0 : 1;
      }
      case 'list':
        print(listSongs(ctx));
        return 0;
      case 'load': {
        if (!a) throw new UsageError('load needs a name.');
        const result = loadSong(ctx, a);
        print(result);
        return result.ok ? 0 : 1;
      }
      case 'midi': {
        if (!a) throw new UsageError('midi needs a song name or file.');
        const result = exportMidi(ctx, { ...songSource(a), outPath: b });
        print(result);
        return result.ok ? 0 : 1;
      }
      case 'strudel': {
        if (!a) throw new UsageError('strudel needs a song name or file.');
        const result = exportStrudel(ctx, songSource(a));
        if (!result.ok) {
          print(result);
          return 1;
        }
        process.stdout.write(`${result.code}\n`);
        return 0;
      }
      default:
        process.stderr.write(`${USAGE}\n`);
        return command ? 2 : 0;
    }
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    throw error;
  }
}
