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
| `play_in_app(name \| song, autoplay?)` | Envía la canción a la pestaña de NLMusic abierta (TASK-29). Ver «Escuchar en la app». |

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

## Escuchar en la app: `play_in_app` (TASK-29)

Strudel solo suena en el navegador, así que el MCP no reproduce: manda la canción al servidor de la app y este la entrega a las pestañas abiertas.

1. Arranca la app desde la misma carpeta que el MCP: `npm run dev` (o `npx next dev -H 0.0.0.0` para abrirla también desde el móvil o Tailscale) y ábrela en el navegador. Junto al logo aparece «Claude conectado».
2. Pide a Claude que escriba la canción y llame a `play_in_app { song }` (o `{ name }` para una guardada).
3. La pestaña muestra «Claude te ha enviado una canción» con **Cargar** / **Descartar**. Si ya suena algo, la canción entra en el siguiente compás sin cortar el audio (BR-001). Si está parado, no arranca sola salvo `autoplay: true`.
4. En Configuración, «Aceptar canciones enviadas por Claude automáticamente» (desactivado por defecto) se salta el aviso. Si has editado el código a mano y esas ediciones no están en el grid, la app pregunta igualmente antes de reemplazarlas.

La canción cargada queda en el store como cualquier otra: el grid es editable (BR-008) y el código se recompila (BR-009).

Respuesta de la herramienta: `{ ok, tabs, delivered, message }`. Con `tabs: 0` no hay ninguna pestaña abierta: la canción espera en la app 30 minutos y se ofrece a la primera pestaña que se conecte. Si la app no está arrancada, el error lo dice y recuerda que la canción guardada sigue en `songs/`.

Variables: `NLMUSIC_APP_URL` (por defecto `http://127.0.0.1:3000`) y `NLMUSIC_PUSH_TOKEN_FILE` (por defecto `.nlmusic/push-token` en la carpeta de trabajo).

**Dos pestañas abiertas:** en v1 la canción llega a todas y cada una muestra su aviso. `tabs` dice cuántas la recibieron.

### Seguridad de `/api/songs/push` y `/api/songs/stream`

El servidor de desarrollo suele escuchar en `0.0.0.0` (LAN, Tailscale), así que «solo localhost» no puede depender de lo que diga la petición:

- **Por qué no la IP.** En Next 16 los route handlers no tienen acceso al socket. La única pista es `x-forwarded-for`, que Next rellena con la IP real *solo si el cliente no la manda* (`??=`), así que cualquiera en la red la falsifica con `curl -H 'X-Forwarded-For: 127.0.0.1'`. `Host` y `Origin` tampoco sirven.
- **Barrera real: token en un archivo local.** La app y el MCP comparten un token aleatorio de 256 bits en `.nlmusic/push-token` (carpeta 0700, archivo 0600, ignorado por git). Lo crea el primero que lo necesita (`wx`, sin carreras). La ruta exige `Authorization: Bearer <token>` y lo compara en tiempo constante. Para leerlo hace falta acceso a la carpeta del proyecto como el mismo usuario. Un equipo de la red o una página web no lo tienen. Se rechaza un archivo que sea un enlace simbólico, de otro usuario o legible por otros.
- **Capas adicionales.** Se rechaza cualquier petición con `Origin` o `Sec-Fetch-Site`, porque las mandan los navegadores, nunca el MCP. También se rechaza un `x-forwarded-for` que no sea loopback: así una petición honesta desde la LAN se corta aunque tenga el token. El body tiene un tope de 256 KB, contado también sin `Content-Length`. Solo se acepta `application/json` con `{ song, name?, autoplay? }` estricto, y la canción pasa por la misma validación que el MCP y el LLM (`src/lib/llm/parseSongInput.ts`).
- **El stream no pide token, a propósito.** Solo lleva canciones ya validadas que alguien con el token envió, lo mismo que la app enseña a quien la abre. Así una pestaña abierta desde el móvil también las recibe. No se mandan cabeceras CORS, así que otra web abierta en tu navegador no puede leerlo. Hay un tope de 16 clientes simultáneos, y el navegador vuelve a validar cada canción antes de usarla.
- Tests: `src/lib/live/__tests__/pushRequest.test.ts` (sin token, token falso, cabeceras de localhost falsificadas, LAN, peticiones de navegador, permisos del archivo, tamaño, validación).

## Código compartido (AC-1)

`src/mcp/` solo añade el acceso a archivos y el envoltorio de protocolo. La validación (`validateSong`, `interpretSongResponse`), `compileSong`, `songToMidi` y la guía (`DRUM_GUIDE`) son los mismos módulos de `src/lib/` que usa la app. `src/mcp/__tests__/purity.test.ts` recorre el grafo de imports de ambas entradas y falla si aparece React, Next, Zustand, Strudel, `window`, el store o el SDK de Anthropic; `smoke.test.ts` arranca el servidor y la CLI en Node puro (sin jsdom).

## Límites conocidos

- Los errores de forma (p. ej. una voz inexistente) se devuelven antes que los de longitud o referencias del arreglo: son dos fases del código compartido de TASK-27. Basta con validar de nuevo tras corregir.
