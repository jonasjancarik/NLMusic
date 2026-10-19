/**
 * Parsea el JSON que devuelve el LLM. Tolera texto alrededor del objeto (p. ej. fences
 * de markdown) recortando desde la primera `{` hasta la última `}`.
 */
export function parseLlmJson(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("Claude did not return valid JSON.");
  }
}
