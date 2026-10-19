# NLMusic — Claude Agent Instructions

> Este archivo es un resumen operativo del proyecto.
> Consulta `nlmusic-spec.md` solo cuando necesites reglas funcionales, edge cases o escenarios BDD específicos.

## Qué es este proyecto

NLMusic convierte instrucciones musicales en lenguaje natural en patrones reproducidos en tiempo real en el navegador, sin interrumpir lo que ya está sonando.

## Stack

- Frontend: React 19 + TypeScript + Next.js App Router
- Audio: `@strudel/web`
- Estado: Zustand con persistencia
- LLM: adapter server-side vía `/api/generate-pattern`
- Estilos: Tailwind CSS

## Invariantes críticas

- BR-001: el audio nunca se interrumpe durante generación o cambios incrementales.
- BR-006: nunca superar 8 pistas por sección (`MAX_TRACKS_PER_SECTION` en `src/lib/song/constants.ts`).
- BR-007: eliminar pista es destructivo e irreversible.
- BR-008: editar el grid manualmente no invoca al LLM.
- BR-009: grid y editor Strudel deben mantenerse coherentes.
- BR-011: la API key nunca se expone al cliente.

## Mapa rápido del proyecto

- `src/app`: layout, page y API routes
- `src/features/audio`: compilación y hooks de Strudel
- `src/features/prompt`: prompt box y generación
- `src/features/sequencer`: grid y cards de pistas
- `src/features/transport`: play, stop, BPM, barra superior
- `src/features/code-view`: panel y editor Strudel
- `src/lib/llm`: prompts, pipeline, adapters, validación
- `src/lib/song`: modelo de canción por secciones (voces, validación, `compileSong`); puro, sin React/window/Zustand
- `src/lib/strudel/compiler.ts`: compilador pista → Strudel (puro; `src/features/audio/compiler.ts` lo reexporta)
- `src/store/sessionStore.ts`: estado global de sesión

## Cómo leer contexto según la tarea

- Si tocas audio o reproducción: revisa reglas de continuidad de audio y el código en `src/features/audio`.
- Si tocas generación LLM o pipeline: revisa `src/lib/llm` y, solo si hace falta, la spec para BR-002, BR-003, BR-004, BR-006, BR-009 y BR-011.
- Si tocas UI local o estilos: empieza por el componente y sus tests; no leas la spec completa salvo dependencia funcional explícita.
- Si tocas estados, retry o errores: revisa store, transiciones y edge cases relevantes.
- Si la tarea viene del backlog: abre solo la task concreta y sus dependencias directas.

## Máquina de estados

La app debe mantenerse coherente con este flujo:

`IDLE → LOADING → PLAYING → PAUSED → ERROR`

Usa la spec solo si necesitas detalle exacto de transiciones y edge cases.

## Convenciones

- Componentes funcionales con hooks y exports nombrados.
- Sin `any` salvo necesidad excepcional justificada.
- Sin lógica de negocio compleja en componentes UI.
- Importaciones cross-feature por barrel cuando exista.
- Cambios mínimos y verificables.

## Cuándo abrir la spec completa

Consulta `nlmusic-spec.md` únicamente si ocurre alguno de estos casos:

- el cambio modifica una regla BR-*
- afecta transiciones de estado
- toca edge cases de error o retry
- cambia comportamiento funcional visible al usuario
- implementa una task con criterios de aceptación

## Qué no meter aquí

- Estado histórico del proyecto
- Roadmap largo
- Checklist completo de tareas
- Detalle exhaustivo de edge cases
- Ejemplos extensos que no sean necesarios para orientar trabajo local

1. Mira `TASK-INDEX.md` para identificar qué task toca y cuáles son sus dependencias
2. Lee el archivo de tarea correspondiente — fíjate en el frontmatter (`status`)
3. Localiza el CAP-ID en `nlmusic-spec.md`
4. Lee las secciones 5 (reglas), 6 (estados), 7 (edges) y 8 (BDD) para esa capacidad
5. Implementa respetando todas las reglas y cubriendo todos los edge cases
6. Verifica contra los escenarios BDD de la Sección 8

**Al cerrar una task:**

Una vez cerrada tu parte la task, mostraras un mensaje dando el OK, para el agente nlmusic-reviewer

No cambies  el estado de los archivos TASK-**.md ni de   TASK-INDEX-md, no hagas commit. de este se encargará otro agente 

Si la task introdujo cambios estructurales (nuevas dependencias, nuevos directorios,
   cambios en el modelo de datos) actualiza la sección "Estado actual del proyecto"
   más abajo en este mismo `CLAUDE.md`

---

## Estado actual del proyecto (Abril 2026)

**Completado:**
- Pipeline LLM → JSON → Strudel ✅
- Sequencer visual 16 pasos, mute/solo, volumen ✅
- Play/Stop, BPM control, BarIndicator ✅
- Persistencia Zustand + localStorage ✅
- Build producción sin errores ✅
- Validación e2e del flujo Prompt → API → Pipeline → Adapter → Store → Strudel (TASK-01)
- Robustez de inicialización Strudel + banner EC-010 (TASK-02)
- Límite máximo de 5 pistas, contador y truncado defensivo (TASK-03)
- Estado ERROR con reintento, prompt persistente (TASK-04)
- Incrementalidad de pistas con `applyDelta` (add/update/remove/replace) (TASK-05)
- Coherencia compiler + contrato API (mute via `gain(0)`) (TASK-06)
- Eliminar pista desde UI con botón ✕ — transición a IDLE en última pista (TASK-07)
- StrudelCodePanel editable (textarea) con sincronización bidireccional grid ↔ código + flag `isCodeManuallyEdited` (TASK-08)
- Contexto LLM coherente en modo código: `codeMode` como fuente de verdad y guardas de pipeline para deltas inseguros (TASK-09)
- Editor CodeMirror 6 con syntax highlighting (paleta del design system) — deps: codemirror, @codemirror/*, @strudel/codemirror (TASK-10)
- Tercera pestaña Configuración/Guía con estado del sistema, guía de prompts clickable y preferencias de editor persistidas (TASK-12)

- Multiidioma UI ES / EN: selector discreto en TransportBar, detección del navegador, diccionario tipado centralizado, hook `useTranslation` reactivo, persistencia en localStorage (TASK-13)

- Correctness: hotfixes y robustez del contrato del request/API/store/editor, incluyendo validación temprana del body, límite persistido de `turns` y reutilización de `strudelCode` precompilado (TASK-14)

- Store dividido en 5 Zustand slices (`tracks`, `audio`, `ui`, `session`, `editor`) con `useSessionStore` estable y persistencia selectiva mantenida (TASK-15)

- StrudelContext sin prop drilling y estado mutable encapsulado por instancia en `useRef` para el runtime de audio (TASK-16)

- Sintetizador por pista: `TrackParams` opcional en `Track` (`src/lib/types/audio.ts`), validación Zod (`delayfeedback` ≤ 0.9), `delayTimeMode` en el ui slice (persistido), `applyDelta` fusiona `params` campo a campo (TASK-19)
- Compilador con `buildParamsChain` (ADSR → filtro lp/hp con `lpq`/`hpq` → room → delay → pan; osciladores vía `note().s().struct()`), acción `updateTrackParams` en el tracks slice y hook `useUpdateTrackParams` sobre StrudelContext (TASK-20)
- System prompt LLM con referencia de `params` y semántica de merge (TASK-21)
- Modelo de canción por secciones (TASK-24): `Song`/`Section`/`ArrangementItem` y `Track.velocity`; `validateSong` con errores que nombran sección y pista; `compileSong` con `arrange`; voces de batería con su sample real; persistencia v1 (`song` + `activeSectionId`) con migración desde v0; BR-006 pasa a 8 pistas por sección. La UI y el LLM siguen trabajando sobre la sección activa (`main` por defecto); `tracks` del store es un espejo de esa sección
- Exportación MIDI (TASK-26): `songToMidi(song): Uint8Array` en `src/lib/midi/` (SMF formato 1, canal 10, 480 PPQ, markers por bloque del arreglo, mute/solo respetados); mapa GM en `DRUM_VOICES.midi`; botón `DownloadMidiButton` en TransportBar. Sin dependencias nuevas: escritor SMF propio (~100 líneas) y lector propio en los tests

- LLM de canciones de batería (TASK-27): el LLM devuelve un delta de canción (`replaceSong`, `addSection`, `updateSection`, `removeSection`, `setArrangement` y las operaciones de pista con `sectionId` opcional) con pasos en notación compacta (`X.x.g...|`); guía de batería como string importable; hasta 2 reintentos automáticos con los errores concretos y luego ERROR (422); prompt de sistema cacheable; `npm run eval:songs` fuera de `npm test`

**Pendiente Sprint 2 (orden de ejecución):**
- TASK-11 — Hap highlighting en tiempo real (flash de tokens al sonar) sobre el editor CodeMirror

**Nuevas dependencias añadidas (TASK-10):**
- `codemirror@6.0.2`, `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/commands`, `@codemirror/lang-javascript`, `@strudel/codemirror@1.3.0`

**Nuevos directorios/archivos (TASK-10):**
- `src/features/code-view/theme/nlmusicTheme.ts` — theme dedicado reutilizable
- `src/features/code-view/components/StrudelEditor.tsx` — componente CodeMirror puro (sin lógica de store)

**Nuevos directorios/archivos (TASK-12):**
- `src/features/config/` — tercera pestaña Configuración/Guía (estado, guía de prompts, atajos, preferencias)
- `src/features/code-view/components/__tests__/StrudelCodePanel.task12.test.tsx` — cobertura del toggle editor avanzado/simple

**Nuevos directorios/archivos (TASK-13):**
- `src/lib/i18n/translations.ts` — diccionario ES/EN tipado con `TranslationKey` union
- `src/lib/i18n/useTranslation.ts` — hook reactivo que lee `language` del store
- `src/lib/i18n/index.ts` — barrel export

**Nuevos directorios/archivos (TASK-28):**
- `src/mcp/` — servidor MCP stdio (`npm run mcp`, `index.ts` + `server.ts`) y CLI (`npm run song`, `song.ts` + `cli.ts`) como envoltorios finos sobre `songTools.ts`; `songFiles.ts` restringe rutas a `songs/` (sin `..`, rutas absolutas ni symlinks hacia fuera); `songGuide.ts` compone `get_song_guide`. Todo reutiliza `src/lib/` (validateSong, interpretSongResponse, compileSong, songToMidi, DRUM_GUIDE) y no importa React/Next/Zustand ni lee la clave de API (`purity.test.ts` lo comprueba)
- Nueva dependencia: `@modelcontextprotocol/sdk@1.32.1` (comprobada 2026-10-19: release estable del 2026-10-05, ~39 M descargas/semana, MIT, Node ≥18, peer `zod ^3.25 || ^4`). Runner de TypeScript: `tsx`, como `v0:cli`/`eval:songs`
- Documentación: `docs/mcp-and-cli.md`; `songs/` es el directorio de canciones guardadas (`NLMUSIC_SONGS_DIR` lo cambia)

 El índice maestro
con dependencias y criterios de revisión está en `.claude/tasks/TASK-INDEX.md`.

**Nuevos directorios/archivos (TASK-19..21):**
- `src/features/sequencer/hooks/useUpdateTrackParams.ts` — aplica un patch de params y re-evalúa el código si está sonando
- `src/lib/llm/prompts/strudelInjection.ts` — referencia de `params` embebida como string e inyectada en `systemPrompt.ts`

**Nuevos directorios/archivos (TASK-24):**
- `src/lib/song/` — `constants.ts` (límites), `drumVoices.ts` (voces y spike de samples), `song.ts` (helpers), `validation.ts` (`validateSong`), `compileSong.ts`
- `src/lib/strudel/compiler.ts` — compilador movido desde `src/features/audio/compiler.ts` (que ahora lo reexporta)
- `src/store/persistence.ts` — versión de persistencia, `migrate` y `merge` del estado guardado
- Modelo de datos: el tracks slice añade `stepsPerBar`, `sections`, `arrangement`, `activeSectionId`, `loadSong`, `setActiveSection`; el estado persistido pasa a `{ song, activeSectionId, ... }` (versión 1)

**Nuevos directorios/archivos (TASK-27):**
- `src/lib/llm/prompts/drumGuide.ts`, `drumGuideExamples.ts`, `songContract.ts` — guía de batería, ejemplos validados y contrato de salida como strings sin dependencias de Next/React (los reutiliza el MCP de TASK-28); `songPrompt.ts` — bloques de sistema y mensaje de usuario
- `src/lib/llm/songDelta.ts` (parseo y aplicación del delta), `src/lib/llm/songPipeline.ts` (pipeline con reintentos), `src/lib/llm/parseJson.ts`
- `src/lib/song/notation.ts` — notación compacta de pasos ↔ `steps`/`velocity`
- `scripts/eval-songs.ts` + `evals/README.md` — set de evaluación; los resultados (`evals/<fecha>/`) están en `.gitignore`
- Modelo de datos: `SessionContext` añade `song` y `activeSectionId`; el tracks slice añade `loadGeneratedSong`; la API responde `{ song, activeSectionId, strudelCode }` en lugar de `trackJson`
