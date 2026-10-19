import { useCallback, useRef, useState } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { selectSong } from '@store/helpers';
import type { Song } from '@lib/types';

/** Resumen corto de la canción para el historial de turnos. */
function describeSong(song: Song): string {
  const sections = song.sections.length;
  const tracks = Math.max(...song.sections.map((section) => section.tracks.length));
  return sections > 1
    ? `${sections} secciones, hasta ${tracks} pistas, ${song.bpm} BPM`
    : `${tracks} pistas a ${song.bpm} BPM`;
}

/**
 * Ejecuta la transición de reintento desde estado ERROR.
 * @see BR-003 Errores y reintento se gestionan de forma uniforme
 * @see EC-002 Reintento tras error de red sin reescribir prompt
 */
function retryFromStore(
  storeRetry: () => string | null,
  generate: (prompt: string) => Promise<boolean>
): void {
  const prompt = storeRetry();
  if (prompt) {
    void generate(prompt);
  }
}

/**
 * Orquesta la generación de patrones desde la UI hacia la API de NLMusic.
 *
 * @see BR-001 El audio existente no se interrumpe durante LOADING
 * @see BR-010 Prompt vacío no genera llamada al LLM
 */
export function usePatternGen() {
  const [info, setInfo] = useState<string | null>(null);
  // Evita envíos concurrentes aunque el store salga de LOADING por una edición del grid.
  const inFlightRef = useRef(false);

  // Solo lo que se renderiza se suscribe; el resto se lee con getState() al generar.
  const lastError = useSessionStore((s) => s.lastError);
  const uiState = useSessionStore((s) => s.uiState);
  const isLoading = uiState === 'loading';
  const loadGeneratedSong = useSessionStore((s) => s.loadGeneratedSong);
  const addTurn = useSessionStore((s) => s.addTurn);
  const startLoading = useSessionStore((s) => s.startLoading);
  const storeRetry = useSessionStore((s) => s.retry);
  const storeSetError = useSessionStore((s) => s.setError);
  const setLastPrompt = useSessionStore((s) => s.setLastPrompt);

  const generate = useCallback(async (prompt: string): Promise<boolean> => {
    // BR-010: prompt vacío no llama al LLM
    if (!prompt.trim()) {
      storeSetError("Prompt vacío");
      return false;
    }

    if (inFlightRef.current) return false;
    inFlightRef.current = true;

    const state = useSessionStore.getState();
    const { turns, bpm, currentCode, isCodeManuallyEdited, activeSectionId } = state;

    startLoading();
    setInfo(null);
    setLastPrompt(prompt);
    addTurn("user", prompt);

    // BR-009: construir contexto según modo activo
    // En grid mode se envía la canción completa (TASK-27) y la sección seleccionada.
    // En code mode la canción puede estar desfasada — solo enviamos el código actual.
    const contextPayload = isCodeManuallyEdited
      ? {
          turns,
          codeMode: { enabled: true, strudelCode: currentCode, bpmHint: bpm },
          language: "mixed",
        }
      : {
          turns,
          song: selectSong(state),
          activeSectionId,
          language: "mixed",
        };

    try {
      const response = await fetch("/api/generate-pattern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context: contextPayload }),
      });

      const payload = await response.json();

      // Hard error: non-OK HTTP or explicit ok: false in body
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      // The pipeline already validated the song and compiled strudelCode (BR-009).
      // Reuse the payload directly — no client-side normalization or recompilation (FIX-6).
      const song = payload.song as Song;
      loadGeneratedSong(song, {
        activeSectionId: payload.activeSectionId,
        strudelCode: payload.strudelCode,
      });

      if (payload.source === 'fallback') {
        // EC-001/EC-002: fallback válido informa sin forzar estado ERROR
        const fallbackMsg = payload.warning ?? 'LLM no disponible — patrón de fallback cargado';
        setInfo(fallbackMsg);
        addTurn("assistant", `Fallback: ${describeSong(song)} — ${fallbackMsg}`);
      } else {
        // LLM success — surface any delta warnings (BR-005/BR-006)
        const warnings: string[] = Array.isArray(payload.warnings) ? payload.warnings : [];
        if (warnings.length > 0) {
          const warningText = warnings.join(" | ");
          setInfo(warningText);
          addTurn("assistant", `Generado: ${describeSong(song)}. Avisos: ${warningText}`);
        } else {
          addTurn("assistant", `Generado: ${describeSong(song)}`);
        }
      }

      return true;
    } catch (err) {
      // BR-003: cualquier error real → informar, mantener estado y habilitar reintento
      const message = err instanceof Error ? err.message : "Error desconocido";
      storeSetError(message);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [addTurn, loadGeneratedSong, setLastPrompt, startLoading, storeSetError]);

  // BR-003: reintento — reutiliza lastPrompt del store sin que el usuario reescriba
  const retry = useCallback(() => {
    retryFromStore(storeRetry, generate);
  }, [generate, storeRetry]);

  return { generate, retry, isLoading, error: lastError, info };
}
