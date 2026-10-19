/**
 * Notación compacta de pasos para el LLM y el MCP (TASK-27).
 *
 * Un compás de 16 pasos se escribe como `"X.x.X.x.X.x.X.x."` en lugar de un array de 16
 * números: cuesta unas 10 veces menos tokens y el modelo razona mejor sobre la rejilla.
 * - `.` o `-` silencio
 * - `x` golpe normal
 * - `X` acento
 * - `g` nota fantasma (ghost)
 * Los separadores `|` y los espacios se ignoran (sirven para marcar compases).
 *
 * Si la pista solo usa `x`, no se genera `velocity` (todos los golpes suenan igual,
 * como antes de TASK-24). Si mezcla `X`/`g`, se genera `velocity` con estos valores.
 */
export const NOTATION_VELOCITY = { X: 1, x: 0.8, g: 0.35 } as const;

const IGNORED = new Set(['|', ' ']);

export type ParsedSteps =
  | { ok: true; steps: (0 | 1)[]; velocity?: number[] }
  | { ok: false; error: string };

/** Convierte una cadena de notación en `steps` (+ `velocity` si hay acentos o fantasmas). */
export function parseStepString(input: string): ParsedSteps {
  const steps: (0 | 1)[] = [];
  const velocity: number[] = [];
  let dynamic = false;

  for (const char of input) {
    if (IGNORED.has(char)) continue;
    if (char === '.' || char === '-') {
      steps.push(0);
      velocity.push(0);
    } else if (char === 'x' || char === 'X' || char === 'g') {
      steps.push(1);
      velocity.push(NOTATION_VELOCITY[char]);
      if (char !== 'x') dynamic = true;
    } else {
      return {
        ok: false,
        error: `unknown character "${char}" at step ${steps.length + 1}; use . (rest), x (hit), X (accent), g (ghost)`,
      };
    }
  }

  return dynamic ? { ok: true, steps, velocity } : { ok: true, steps };
}

/** Inverso aproximado de `parseStepString`, con `|` entre compases. */
export function formatStepString(steps: (0 | 1)[], velocity: number[] | undefined, stepsPerBar: number): string {
  const chars = steps.map((step, index) => {
    if (step !== 1) return '.';
    const value = velocity?.[index] ?? 1;
    if (!velocity) return 'x';
    if (value >= 0.9) return 'X';
    if (value <= 0.5) return 'g';
    return 'x';
  });
  const bars: string[] = [];
  for (let start = 0; start < chars.length; start += stepsPerBar) {
    bars.push(chars.slice(start, start + stepsPerBar).join(''));
  }
  return bars.join('|');
}
