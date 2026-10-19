# TASK-28 — CLI y servidor MCP (sin llamadas a la API)

| Campo | Valor |
|---|---|
| Task-ID | TASK-28 |
| Sprint | 4 — Baterías y canciones |
| Estado | TODO |
| Prioridad | P1 |
| Estimación | 5–7h |
| Dependencias | TASK-24, TASK-26, TASK-27 |
| Capacidades relacionadas | CAP-NLM-018 · Uso desde Claude Code / clientes MCP |

---

## Contexto

La clave de API solo hace falta en el adaptador que llama a Claude. Si es el propio cliente
(Claude Code u otro) quien escribe la canción, el resto del pipeline (validación, guardado,
exportación) funciona sin API. Esto permite iterar con la suscripción en vez de la API y
trabajar sobre archivos del repositorio.

Debe compartir código con la app: nada de duplicar validación ni compilador.

## Acceptance Criteria

**AC-1 — Módulo compartido**: la lógica sin dependencias de React/Next (tipos, validación, `compileSong`, `songToMidi`, guía) se importa desde `src/lib/` por la app, la CLI y el MCP. Nada de lo importado por la CLI/MCP depende de `window`, Zustand ni de Next.

**AC-2 — Servidor MCP stdio** (`@modelcontextprotocol/sdk`, comprobar salud/versión) en `src/mcp/` con arranque `npm run mcp`, y entrada de ejemplo para `.mcp.json` en el README. Herramientas:
- `get_song_guide` → esquema `Song` + guía de batería (TASK-27 AC-1) + ejemplos.
- `validate_song(song)` → `{ ok, errors[] }` con los mismos mensajes que la app.
- `save_song(name, song)` → escribe `songs/<name>.json` (valida antes; nombre saneado; no sobreescribe sin `overwrite: true`).
- `list_songs`, `load_song(name)`.
- `export_midi(name | song, outPath?)` → escribe `.mid` en `songs/` por defecto y devuelve la ruta.
- `export_strudel(name | song)` → devuelve el código Strudel.
- (`play_in_app` se añade en TASK-29.)

**AC-3 — CLI** equivalente (`npm run song -- validate|save|list|midi|strudel <archivo>`) como envoltorio fino sobre las mismas funciones. Convive con `v0:cli`.

**AC-4 — Seguridad**: las rutas se restringen a `songs/` (sin `..` ni rutas absolutas arbitrarias). La clave de API nunca se lee ni se expone aquí (BR-011).

**AC-5 — Errores útiles**: cada fallo devuelve qué sección/pista y por qué, para que el modelo pueda corregir sin adivinar.

**AC-6 — Tests**: llamadas a las herramientas contra un directorio temporal (validar canción mala/buena, guardar, no sobreescribir, exportar MIDI y releerlo, intento de path traversal).

**AC-7 — Documentación**: README (cómo registrar el MCP en Claude Code, flujo de ejemplo "pide, valida, guarda, exporta") y nota en `docs/`.

## Fuera de alcance
Reproducción (TASK-29), exposición remota del MCP, autenticación.
