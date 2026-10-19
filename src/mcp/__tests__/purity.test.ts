// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * AC-1: lo que importan la CLI y el servidor MCP no depende de React, Next, Zustand,
 * Strudel ni del navegador. Se recorre el grafo de imports desde las dos entradas.
 */
const SRC = path.resolve(__dirname, '../..');
const FORBIDDEN_PACKAGES = /^(react|react-dom|next|zustand|@strudel|lucide-react|@codemirror|codemirror)(\/|$)/;
const FORBIDDEN_GLOBALS = /\b(window|document|localStorage|navigator)\./;
const SECRET = /ANTHROPIC_API_KEY|@anthropic-ai/;

function resolveLocal(from: string, specifier: string): string | undefined {
  let base: string | undefined;
  if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else if (specifier.startsWith('@lib/')) base = path.join(SRC, 'lib', specifier.slice('@lib/'.length));
  else if (specifier.startsWith('@features/')) base = path.join(SRC, 'features', specifier.slice('@features/'.length));
  else if (specifier.startsWith('@store/')) base = path.join(SRC, 'store', specifier.slice('@store/'.length));
  if (!base) return undefined;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve "${specifier}" from ${from}`);
}

function importSpecifiers(code: string): string[] {
  const specs: string[] = [];
  // `import type` se borra al compilar, así que no cuenta.
  const re = /^\s*(?:import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;
  for (const match of code.matchAll(re)) {
    if (match[1]) continue;
    specs.push(match[2] ?? match[3]);
  }
  return specs;
}

function walk(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    const specs = importSpecifiers(fs.readFileSync(file, 'utf8'));
    seen.set(file, specs);
    for (const spec of specs) {
      const local = resolveLocal(file, spec);
      if (local) stack.push(local);
    }
  }
  return seen;
}

describe.each(['mcp/index.ts', 'mcp/song.ts'])('import graph of src/%s', (entry) => {
  const graph = walk(path.join(SRC, entry));

  it('reaches the shared song code', () => {
    const files = [...graph.keys()].map((f) => path.relative(SRC, f));
    expect(files).toEqual(expect.arrayContaining(['lib/song/validation.ts', 'lib/song/compileSong.ts', 'lib/midi/songToMidi.ts']));
  });

  it('imports no React, Next, Zustand, Strudel runtime or editor packages', () => {
    const offenders = [...graph].flatMap(([file, specs]) =>
      specs.filter((s) => FORBIDDEN_PACKAGES.test(s)).map((s) => `${path.relative(SRC, file)} → ${s}`),
    );
    expect(offenders).toEqual([]);
  });

  it('never reaches the store, features or app folders', () => {
    const offenders = [...graph.keys()].map((f) => path.relative(SRC, f)).filter((f) => /^(store|features|app)\//.test(f));
    expect(offenders).toEqual([]);
  });

  it('uses no browser globals and never touches the API key or the Anthropic SDK', () => {
    const offenders = [...graph.keys()].flatMap((file) => {
      const code = fs.readFileSync(file, 'utf8');
      return [FORBIDDEN_GLOBALS, SECRET].filter((re) => re.test(code)).map(() => path.relative(SRC, file));
    });
    expect(offenders).toEqual([]);
  });
});
