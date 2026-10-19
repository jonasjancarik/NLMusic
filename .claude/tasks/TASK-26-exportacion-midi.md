# TASK-26 — Exportación MIDI

| Campo | Valor |
|---|---|
| Task-ID | TASK-26 |
| Sprint | 4 — Baterías y canciones |
| Estado | TODO |
| Prioridad | P1 — es la forma más rápida de llevar una canción a un DAW |
| Estimación | 3–4h |
| Dependencias | TASK-24 |
| Capacidades relacionadas | CAP-NLM-016 · Integración con DAW |

---

## Contexto

Un archivo `.mid` estándar se arrastra a cualquier DAW y suena con el plugin de batería que
se quiera. Debe ser una función pura (`Song` → bytes) reutilizable desde la UI (botón
descargar) y desde la CLI/MCP (TASK-28).

## Acceptance Criteria

**AC-1 — Función pura** `songToMidi(song): Uint8Array` en `src/lib/midi/`, sin dependencias de navegador ni de Strudel.

**AC-2 — Mapa General MIDI de batería** (canal 10): bd→36, sd→38, rim→37, cp→39, hh→42, oh→46, rd→51, cr→49, lt→41, mt→47, ht→50. Mapa en un único archivo, documentado.

**AC-3 — Contenido**: tempo (`song.bpm`), compás 4/4, notas de cada paso activo con la velocity del paso (0–1 → 1–127), duración corta fija, `arrangement` expandido (repeticiones desplegadas), pasos ternarios (`stepsPerBar = 12`) en las posiciones correctas del tick.

**AC-4 — Marcadores**: un marker (meta-evento) por sección en el compás donde empieza, con su nombre.

**AC-5 — Mute/solo**: se respetan al exportar (una pista silenciada no se exporta). Decisión documentada en la UI.

**AC-6 — UI**: botón "Descargar MIDI" en la barra de transporte o en la pestaña de código, con nombre de archivo derivado del título/fecha. Textos ES/EN.

**AC-7 — Tests**: parsear el resultado con un lector MIDI en test y comprobar: número de notas, notas por pista, ticks de inicio de cada sección, tempo, velocities. Un fixture de canción verso/estribillo.

**AC-8 — Dependencia**: decidir entre librería (`midi-writer-js`, `@tonejs/midi`, otra) o escritor propio de SMF (~100 líneas). Si se añade una dependencia, hacer comprobación de salud (último release, adopción) y anotarla en `CLAUDE.md` (sección de nuevas dependencias).

## Fuera de alcance
MIDI en vivo (Web MIDI), importación de MIDI, exportación de audio.
