# TASK-25 — UI: secciones, arreglo y velocidad por paso

| Campo | Valor |
|---|---|
| Task-ID | TASK-25 |
| Sprint | 4 — Baterías y canciones |
| Estado | TODO |
| Prioridad | P1 |
| Estimación | 5–7h |
| Dependencias | TASK-24 |
| Capacidades relacionadas | CAP-NLM-015 · Canción con secciones |

---

## Contexto

Con el modelo de TASK-24 la app necesita mostrar y editar una canción, no un único patrón.
La edición manual del grid sigue sin llamar al LLM (BR-008) y grid y código deben seguir
coherentes (BR-009).

## Acceptance Criteria

**AC-1 — Selector de sección**: pestañas (o chips) sobre el sequencer con las secciones de la canción; la seleccionada es la que muestra el grid. Añadir, renombrar, duplicar y eliminar sección (eliminar es destructivo, BR-007, y no deja huérfanos en el arreglo).

**AC-2 — Grid multi-compás**: una sección de N compases se muestra como N bloques de `stepsPerBar` pasos (o con scroll horizontal), con línea de compás visible.

**AC-3 — Velocidad por paso**: clic normal activa/desactiva; cada paso activo tiene 3 niveles (fantasma / normal / acento) por gesto simple (p. ej. clic repetido o arrastre vertical) y se ve por tamaño/intensidad. Teclado accesible.

**AC-4 — Tira de arreglo**: lista ordenada de bloques (sección × repeticiones) reordenable y editable. Muestra el total de compases y la posición actual durante la reproducción (se apoya en `BarIndicator`).

**AC-5 — Reproducción**: la sección y el compás que suenan se resaltan. Editar una sección mientras suena se aplica en el siguiente compás sin cortar (BR-001).

**AC-6 — Estado**: la canción vive en el slice `tracks` (o uno nuevo `song`) respetando la persistencia selectiva y la división en slices de TASK-15. Textos en `translations.ts` ES/EN.

**AC-7 — Tests**: componentes (añadir/eliminar sección, cambiar velocidad, reordenar arreglo) y que editar el grid no invoca al LLM.

## Fuera de alcance
Arrastrar para copiar compases entre secciones, edición de tempo por sección.
