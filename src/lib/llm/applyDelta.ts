import type { Track, TrackJSON, PatternDelta } from "@lib/types";
import { MAX_TRACKS_PER_SECTION, reconcileVelocity } from "@lib/song";

export interface ApplyDeltaResult {
  next: TrackJSON;
  warnings: string[];
}

/**
 * Aplica un delta de operaciones al patrón actual de forma inmutable.
 * Devuelve el siguiente TrackJSON y cualquier aviso que la UI debe mostrar.
 *
 * @see BR-004 Añadir no destruye pistas existentes
 * @see BR-005 Referencias a pistas inexistentes → warning, no error
 * @see BR-006 Máximo MAX_TRACKS_PER_SECTION (8) pistas tras aplicar el delta
 * @see BR-001 El audio sigue sonando; Strudel actualiza en el siguiente ciclo
 */
export function applyDelta(current: TrackJSON, delta: PatternDelta): ApplyDeltaResult {
  const warnings: string[] = [];
  let tracks: Track[] = [...current.tracks];
  const bpm = delta.bpm ?? current.bpm;

  for (const op of delta.operations) {
    if (op.type === "add") {
      // BR-006: rechazar si ya se alcanzó el límite
      if (tracks.length >= MAX_TRACKS_PER_SECTION) {
        warnings.push(
          `No se puede añadir '${op.track.name}': límite de ${MAX_TRACKS_PER_SECTION} pistas alcanzado (BR-006). Elimina una pista primero.`
        );
      } else {
        // BR-004: secuencial, añadir al final
        tracks = [...tracks, op.track];
      }
    } else if (op.type === "update") {
      const exists = tracks.some((t) => t.id === op.id);
      if (!exists) {
        // BR-005: referencia a pista inexistente → warning, no fail
        warnings.push(`Pista '${op.id}' no encontrada — operación de actualización ignorada.`);
      } else {
        // TASK-19: params se fusionan campo a campo; el resto del patch reemplaza.
        tracks = tracks.map((t) => {
          if (t.id !== op.id) return t;
          const next: Track = {
            ...t,
            ...op.patch,
            ...(op.patch.params ? { params: { ...t.params, ...op.patch.params } } : {}),
          };
          // TASK-24: pasos nuevos no deben heredar una velocity 0 residual
          const velocity = reconcileVelocity(next.steps, next.velocity);
          return velocity ? { ...next, velocity } : next;
        });
      }
    } else if (op.type === "remove") {
      const exists = tracks.some((t) => t.id === op.id);
      if (!exists) {
        // BR-005
        warnings.push(`Pista '${op.id}' no encontrada — operación de eliminación ignorada.`);
      } else {
        tracks = tracks.filter((t) => t.id !== op.id);
      }
    } else if (op.type === "replace") {
      if (op.tracks.length > MAX_TRACKS_PER_SECTION) {
        warnings.push(
          `Reemplazo propuso ${op.tracks.length} pistas; se mantuvieron ${MAX_TRACKS_PER_SECTION} (BR-006).`
        );
      }
      tracks = op.tracks.slice(0, MAX_TRACKS_PER_SECTION);
    }
  }

  return {
    next: { bpm, tracks },
    warnings,
  };
}
