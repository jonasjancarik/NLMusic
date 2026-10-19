import fs from 'node:fs';
import path from 'node:path';

/**
 * Acceso seguro al directorio `songs/` (TASK-28 AC-4). Solo Node (`fs`, `path`): sin React,
 * Next, window ni Zustand. Toda ruta que llega de un cliente MCP o de la CLI pasa por aquí
 * antes de tocar el disco.
 */

export type NameResult = { ok: true; name: string } | { ok: false; error: string };
export type PathResult = { ok: true; path: string } | { ok: false; error: string };

const MAX_NAME_LENGTH = 64;

/**
 * Convierte el nombre de una canción en un nombre de archivo seguro (`rock-beat`).
 * Rechaza (en vez de "arreglar") todo lo que parece una ruta: separadores, `..`, rutas absolutas.
 */
export function sanitizeSongName(input: string): NameResult {
  if (typeof input !== 'string' || input.trim() === '') {
    return { ok: false, error: 'The song name is empty. Use letters, digits, "-" or "_", for example "rock-beat".' };
  }
  if (/[\0/\\]/.test(input) || input.includes('..') || /^[a-zA-Z]:/.test(input.trim()) || input.trim().startsWith('~')) {
    return {
      ok: false,
      error: `Invalid song name "${input}": names are file names inside songs/, not paths. Use letters, digits, "-" or "_".`,
    };
  }
  const name = input
    .trim()
    .replace(/\.json$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  if (!name) {
    return { ok: false, error: `Invalid song name "${input}": it has no letters or digits. Use for example "rock-beat".` };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Song name is too long (max ${MAX_NAME_LENGTH} characters after cleaning).` };
  }
  return { ok: true, name };
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Ruta real del ancestro existente más profundo + el resto aún inexistente. */
function realpathOfDeepestExisting(target: string): string {
  let current = target;
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...rest.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return target;
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Resuelve `relativePath` dentro de `songsDir` y comprueba que no se sale de él:
 * rechaza rutas absolutas, `..`, NUL, extensión distinta de `extension` y enlaces
 * simbólicos (del archivo o de cualquier carpeta intermedia) que apunten fuera.
 * `songsDir` puede no existir todavía.
 */
export function resolveInsideSongsDir(songsDir: string, relativePath: string, extension: '.json' | '.mid'): PathResult {
  if (typeof relativePath !== 'string' || relativePath === '') {
    return { ok: false, error: 'The path is empty.' };
  }
  if (relativePath.includes('\0')) return { ok: false, error: 'The path contains a NUL character.' };
  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath) || relativePath.startsWith('\\')) {
    return { ok: false, error: `"${relativePath}" is an absolute path. Use a path relative to songs/.` };
  }
  const segments = relativePath.split(/[\\/]/);
  if (segments.includes('..')) {
    return { ok: false, error: `"${relativePath}" contains "..". Paths must stay inside songs/.` };
  }
  if (path.extname(relativePath).toLowerCase() !== extension) {
    return { ok: false, error: `"${relativePath}" must end in ${extension}.` };
  }

  const base = path.resolve(songsDir);
  const target = path.join(base, ...segments.filter((segment) => segment !== '' && segment !== '.'));
  if (!isInside(base, target) || target === base) {
    return { ok: false, error: `"${relativePath}" is outside songs/.` };
  }

  const realBase = realpathOfDeepestExisting(base);
  const realTarget = realpathOfDeepestExisting(target);
  if (!isInside(realBase, realTarget)) {
    return { ok: false, error: `"${relativePath}" resolves outside songs/ (symbolic link).` };
  }
  return { ok: true, path: target };
}
