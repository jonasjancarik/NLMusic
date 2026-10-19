# NLMusic desde Claude Code: servidor MCP y CLI (TASK-28)

Escribe canciones de batería con tu suscripción de Claude Code (o cualquier cliente MCP) en vez de la API.
El cliente redacta la canción; NLMusic la valida, la guarda en `songs/` y la exporta. **Nada de esto llama a la API de Anthropic ni lee `ANTHROPIC_API_KEY`** (BR-011).

## Registrar el servidor en Claude Code

Entrada de `.mcp.json` (raíz del proyecto), para usar `npm run mcp` desde este repo:

```json
{
  "mcpServers": {
    "nlmusic": {
      "command": "npm",
      "args": ["run", "--silent", "mcp"],
      "cwd": "/ruta/absoluta/a/NLMusic"
    }
  }
}
```

`--silent` evita que npm escriba su cabecera en stdout (stdout es el canal del protocolo). Equivalente por línea de comandos:

```bash
claude mcp add nlmusic -- npm run --silent mcp
```

Las canciones se guardan en `songs/` relativo al directorio de trabajo del proceso. `NLMUSIC_SONGS_DIR` lo cambia.

## Herramientas

| Herramienta | Qué hace |
|---|---|
| `get_song_guide` | Formato de la canción + guía de batería de la app (voces, notación de pasos, forma, estilos, ejemplos). Léela antes de escribir. |
| `validate_song(song)` | `{ ok: true, summary }` o `{ ok: false, errors }`. Cada error nombra sección y pista. |
| `save_song(name, song, overwrite?)` | Valida y escribe `songs/<name>.json`. No sobreescribe sin `overwrite: true`. |
| `list_songs` | Canciones guardadas con bpm, secciones y compases. |
| `load_song(name)` | Lee `songs/<name>.json`. |
| `export_midi(name \| song, outPath?)` | Escribe `songs/<name>.mid` (o `outPath`, relativo a `songs/`, acabado en `.mid`) y devuelve la ruta. |
| `export_strudel(name \| song)` | Devuelve el código Strudel; no escribe nada. |

`song` es un objeto JSON (o su texto) con `bpm`, `stepsPerBar`, `sections` y `arrangement`; las pistas usan la notación compacta (`"x...X.g.|..."`) o arrays 0/1. También se acepta la respuesta `replaceSong` de la app.

### Flujo de ejemplo: pide, valida, guarda, exporta

1. «Hazme una canción de rock de 120 bpm con estrofa y estribillo». El cliente llama a `get_song_guide` y escribe la canción.
2. `validate_song` → si devuelve errores como `Section "verse" › track "snare" › steps: has 31 steps but must have 32 …`, corrige solo eso y repite.
3. `save_song { name: "rock-120", song }` → `songs/rock-120.json`.
4. `export_midi { name: "rock-120" }` → `songs/rock-120.mid`, listo para el DAW.

El archivo guardado es una `Song` completa (pasos como arrays), el mismo formato que el store de la app.

## CLI equivalente

```bash
npm run song -- validate mi-cancion.json
npm run song -- save rock-120 mi-cancion.json [--overwrite]
npm run song -- list
npm run song -- midi rock-120 [salida.mid]      # <nombre guardado> o <archivo.json>
npm run song -- strudel rock-120
```

Los archivos de entrada se leen tal cual los das (es tu terminal); los de salida siempre quedan dentro de `songs/`. Código de salida: 0 bien, 1 canción o ruta inválida, 2 uso incorrecto. `v0:cli` sigue disponible por separado.

## Seguridad (AC-4)

- Los nombres de canción se limpian a `[a-z0-9_-]`; si parecen una ruta (`/`, `\`, `..`, `C:`, `~`) se rechazan en vez de «arreglarse».
- `outPath` se resuelve contra `songs/`: se rechazan rutas absolutas, `..` y extensiones distintas de `.mid`. Se comprueba el `realpath` del archivo o de la carpeta existente más cercana, de modo que un enlace simbólico que apunte fuera de `songs/` también se rechaza.
- `save_song` abre el archivo con `wx`: nunca pisa una canción existente por accidente.
- Tests: `src/mcp/__tests__/songFiles.test.ts` y `songTools.test.ts` (ataques de ruta), contra directorios temporales.

## Código compartido (AC-1)

`src/mcp/` solo añade el acceso a archivos y el envoltorio de protocolo. La validación (`validateSong`, `interpretSongResponse`), `compileSong`, `songToMidi` y la guía (`DRUM_GUIDE`) son los mismos módulos de `src/lib/` que usa la app. `src/mcp/__tests__/purity.test.ts` recorre el grafo de imports de ambas entradas y falla si aparece React, Next, Zustand, Strudel, `window`, el store o el SDK de Anthropic; `smoke.test.ts` arranca el servidor y la CLI en Node puro (sin jsdom).

## Límites conocidos

- Los errores de forma (p. ej. una voz inexistente) se devuelven antes que los de longitud o referencias del arreglo: son dos fases del código compartido de TASK-27. Basta con validar de nuevo tras corregir.
- La reproducción en la app (`play_in_app`) llega con TASK-29.
