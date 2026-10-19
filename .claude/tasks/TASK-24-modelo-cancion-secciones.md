# TASK-24 — Modelo de canción por secciones + reproducción con `arrange`

| Campo | Valor |
|---|---|
| Task-ID | TASK-24 |
| Sprint | 4 — Baterías y canciones |
| Estado | TODO |
| Prioridad | P0 — bloqueante para TASK-25..30 |
| Estimación | 4–6h |
| Dependencias | TASK-14..18 (refactor). Independiente de TASK-19..23 (síntesis), pero ver "Riesgos" |
| Capacidades relacionadas | Nueva: CAP-NLM-015 · Canción con secciones |

> Solo tipos, migración, validación y compilador. Sin UI nueva (TASK-25) y sin LLM nuevo (TASK-27).

---

## Contexto

Hoy la app maneja un único patrón de 16 pasos que se repite sin fin (`TrackJSON`).
Para crear pistas de batería completas hacen falta secciones (intro, verso, estribillo,
parón, final) con duración en compases y un orden de reproducción. También hace falta
dinámica por paso (acentos y notas fantasma) y más voces que 5.

Decisión de producto: el LLM inventa los patrones (no hay biblioteca obligatoria de grooves).
Por eso el modelo y la validación deben ser estrictos y dar errores claros.

## Modelo propuesto

```typescript
interface Song {
  bpm: number;
  stepsPerBar: 16 | 12;          // 12 = feel ternario (shuffle/triplets). Compás 4/4 fijo en v1
  sections: Section[];           // al menos 1
  arrangement: ArrangementItem[] // orden de reproducción, al menos 1
}
interface Section { id: string; name: string; bars: number /* 1–16 */; tracks: Track[] }
interface ArrangementItem { sectionId: string; repeat: number /* 1–16 */ }
```

- `Track` gana `velocity?: number[]` (0–1, misma longitud que `steps`; si falta, 1 donde `steps[i] === 1`).
- `Track.steps.length === stepsPerBar * section.bars`.
- `TrackJSON` existente se migra a `Song` con una sección `main` de 1 compás (sin romper `persist`).

## Acceptance Criteria

**AC-1 — Tipos** en `src/lib/types/audio.ts` (`Song`, `Section`, `ArrangementItem`, `velocity`). Barrel actualizado.

**AC-2 — Migración**: un estado persistido antiguo (`TrackJSON`) carga como `Song` equivalente y suena igual. Test con fixture del formato anterior.

**AC-3 — Validación** (`validation.ts`): rechaza con mensaje concreto (qué sección/pista y por qué) cuando: longitud de `steps` no coincide con `stepsPerBar * bars`; `velocity` de otra longitud o fuera de 0–1; `sectionId` inexistente en `arrangement`; ids duplicados; `bars`/`repeat` fuera de rango; más pistas por sección que el límite.

**AC-4 — Límite de pistas (BR-006)**: se sustituye "5 pistas" por "N pistas por sección" con N = 8. Se actualiza `nlmusic-spec.md` (BR-006, CAP, BDD) y `CLAUDE.md`. Esta task no cambia la regla sin dejarla documentada.

**AC-5 — Compilador**: `compileSong(song)` genera código Strudel donde cada sección es un `stack` de sus pistas (velocidad vía `gain`/`velocity`) y el arreglo usa `arrange([repeat * bars, sectionPattern], ...)`. `compileToStrudel` actual sigue funcionando para canciones de 1 sección.
- Verificar en el spike que `arrange` existe en la versión instalada de `@strudel/web`; si no, alternativa con `cat`/`slowcat`.

**AC-6 — Voces de batería**: lista cerrada de voces con su sample Strudel (bd, sd, rim, cp, hh, oh, rd, cr, lt, mt, ht). Spike: comprobar que cada una suena con los bancos cargados; si no, mapear a un banco concreto (p. ej. TR-909) y documentarlo.

**AC-7 — Continuidad (BR-001)**: reemplazar la canción en reproducción no corta el audio; el cambio entra en el siguiente compás.

**AC-8 — Tests**: validación (casos de AC-3), migración (AC-2), compilador (snapshot del código de una canción verso/estribillo con repeticiones).

## Fuera de alcance
UI de secciones (TASK-25), LLM (TASK-27), compases distintos de 4/4, tresillos de 24 pasos.

## Riesgos / preguntas abiertas
- `Track` se toca también en TASK-19 (`params`). Orden de merge: coordinar para no pisar `audio.ts`.
- Subir el límite de pistas afecta a UI (altura del grid) y al prompt actual.
- Si `stepsPerBar` cambia en una canción existente, definir regla (v1: no se puede cambiar tras crear secciones, o se reescala).
