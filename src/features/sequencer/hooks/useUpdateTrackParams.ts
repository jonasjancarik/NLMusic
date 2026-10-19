'use client';

import { useCallback } from 'react';
import type { TrackParams } from '@lib/types';
import { useSessionStore } from '@store/sessionStore';
import { useStrudelContext } from '@features/audio';

/**
 * Devuelve un callback que aplica un patch de params a una pista y, si el audio ya
 * está sonando, vuelve a evaluar el código recompilado.
 *
 * @see BR-001 Con el transporte parado no llama a play(); si suena, play() actualiza
 * el loop sin stop() previo, así que el audio no se corta.
 */
export function useUpdateTrackParams() {
  const strudel = useStrudelContext();

  return useCallback(
    (id: string, patch: Partial<TrackParams>) => {
      useSessionStore.getState().updateTrackParams(id, patch);
      // Se lee el estado tras la acción para obtener el código recién compilado.
      const { isPlaying, currentCode } = useSessionStore.getState();
      if (isPlaying && strudel.isReady) {
        void strudel.play(currentCode);
      }
    },
    [strudel],
  );
}
