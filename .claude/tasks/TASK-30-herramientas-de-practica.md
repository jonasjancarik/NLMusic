# TASK-30 — Herramientas de práctica

| Campo | Valor |
|---|---|
| Task-ID | TASK-30 |
| Sprint | 4 — Baterías y canciones |
| Estado | TODO |
| Prioridad | P2 |
| Estimación | 4–6h |
| Dependencias | TASK-25 |
| Capacidades relacionadas | CAP-NLM-019 · Práctica |

---

## Contexto

Uso principal buscado: crear pistas de batería rápidas para practicar con un instrumento o
ensayar canciones. Estas funciones convierten la canción en una herramienta de estudio.

## Acceptance Criteria

**AC-1 — Bucle de sección**: reproducir solo una sección en bucle (con selector en el arreglo) y volver al modo canción completa sin cortar el audio (BR-001, cambio en el siguiente compás).

**AC-2 — Cuenta atrás**: 1 o 2 compases de clic antes de arrancar (opcional, persistido). El clic es un sonido propio, no una pista de la canción, y no se exporta a MIDI.

**AC-3 — Metrónomo opcional** durante la reproducción (negras o corcheas), con volumen propio.

**AC-4 — Entrenador de tempo**: de BPM inicial a BPM final con incremento cada N repeticiones del bucle o de la canción. Los cambios de BPM entran en el límite de compás.

**AC-5 — Silenciar partes para tocarlas tú**: mute por pista ya existe; añadir un atajo "quitar caja/bombo/charles" con vuelta atrás rápida y que respete BR-001. No altera `steps` ni se guarda como cambio de la canción.

**AC-6 — Estado**: preferencias de práctica en el slice `ui` o `audio` (persistidas selectivamente); textos ES/EN.

**AC-7 — Tests**: entrenador de tempo (secuencia de BPM), bucle de sección (qué patrón se programa) y que el clic no entra en el MIDI exportado.

## Fuera de alcance
Reconocimiento del instrumento del usuario, detección de tempo, grabación.
