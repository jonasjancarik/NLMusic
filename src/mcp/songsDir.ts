import path from 'node:path';

/** `songs/` junto al directorio desde el que se lanza el proceso; `NLMUSIC_SONGS_DIR` lo cambia. */
export function defaultSongsDir(): string {
  return path.resolve(process.env.NLMUSIC_SONGS_DIR || path.join(process.cwd(), 'songs'));
}
