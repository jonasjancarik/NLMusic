# TASK-27 — LLM: generación de canciones y guía de batería

| Campo | Valor |
|---|---|
| Task-ID | TASK-27 |
| Sprint | 4 — Baterías y canciones |
| Estado | TODO |
| Prioridad | P1 |
| Estimación | 5–6h |
| Dependencias | TASK-24 (TASK-21 comparte archivos de prompt: coordinar) |
| Capacidades relacionadas | CAP-NLM-015 · CAP-NLM-017 · Guía de batería |

---

## Contexto

Decisión de producto: **el LLM inventa los grooves**; no hay biblioteca obligatoria. Toda la
calidad musical depende del prompt y de la validación. Esta task también separa la guía
de batería en un archivo editable, porque TASK-28 la expondrá al cliente MCP.

## Acceptance Criteria

**AC-1 — Guía de batería** en `src/lib/llm/prompts/drum-guide.md` (o `.ts` exportando string), leída por el system prompt y por el MCP. Contenido mínimo: voces disponibles y su papel; crash en el compás 1 de cada sección nueva; relleno en el último compás antes de un cambio; verso más sobrio que estribillo (hh cerrado vs ride/abierto); acentos y fantasmas con `velocity`; variación cada 4–8 compases; cuándo usar `stepsPerBar = 12`; ejemplos de salida válidos de 2–3 estilos.

**AC-2 — Contrato de salida**: el adaptador devuelve `Song` completo (o un delta de canción: `addSection`, `updateSection`, `setArrangement`, `setBpm`; decidir y documentar). Se mantiene el modo incremental (BR-004): "haz el estribillo más denso" modifica solo esa sección y no corta el audio.

**AC-3 — Validación y reintento**: la salida pasa por la validación de TASK-24. Si falla, un reintento automático con los errores concretos en el prompt (máx. 1–2). Si sigue fallando, estado ERROR con reintento manual (TASK-04).

**AC-4 — Guardas existentes**: se mantienen las guardas de modo código (TASK-09) y el límite de pistas por sección.

**AC-5 — Prompt caching**: la guía larga va como bloque cacheable (alinear con TASK-17).

**AC-6 — Set de evaluación**: `src/lib/llm/__tests__/` o `scripts/` con ~10 peticiones (rock simple, funk con verso y estribillo en half-time, punk rápido con parón, shuffle, intro de 2 compases, "más denso el estribillo"…). Comando `npm run eval:songs` que las ejecuta con la API y guarda resultados en `evals/` (JSON + código Strudel + MIDI) para escucharlos y comparar versiones del prompt. No forma parte de `npm test` (usa API y cuesta).

**AC-7 — Comprobaciones automáticas baratas** sobre cada resultado del eval: válido según validación; todas las secciones aparecen en el arreglo; hay bombo y caja en cada sección; hay crash al inicio de cada sección (aviso, no fallo).

**AC-8 — Tests unitarios** con respuestas simuladas del adaptador: parseo, reintento con errores, delta incremental.

## Fuera de alcance
Biblioteca de grooves predefinidos (puede añadirse después como ejemplos few-shot si el eval lo justifica), evaluación automática de "calidad musical".
