'use client';

import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { useStrudelContext } from '@features/audio';
import { cyclesToBars, locatePlayhead, schedulerCps, type PlayheadPosition } from '@lib/song';

/**
 * Posición de reproducción (bloque del arreglo, sección, compás y paso) leída del reloj
 * del scheduler de Strudel, no de un temporizador propio: así sigue en fase aunque se
 * cambie el código mientras suena. Solo toca el estado de React cuando cambia el paso.
 * Devuelve null mientras no suena nada.
 * @see BR-001 Es solo lectura; nunca toca el audio.
 */
export function usePlayhead(): PlayheadPosition | null {
  const { getHapState } = useStrudelContext();
  const isPlaying = useSessionStore((s) => s.isPlaying);
  const [position, setPosition] = useState<PlayheadPosition | null>(null);
  const lastKey = useRef('');

  useEffect(() => {
    if (!isPlaying) {
      lastKey.current = '';
      setPosition(null);
      return;
    }

    const startedAt = performance.now();
    let frame = 0;

    const tick = () => {
      const { sections, arrangement, stepsPerBar, bpm } = useSessionStore.getState();
      let cycles = 0;
      try {
        cycles = getHapState().getTime();
      } catch {
        cycles = 0;
      }
      // Sin reloj de Strudel (motor aún arrancando) se estima desde el inicio de la reproducción.
      const cps = schedulerCps();
      if (!(cycles > 0)) cycles = ((performance.now() - startedAt) / 1000) * cps;

      const next = locatePlayhead({ bpm, stepsPerBar, sections, arrangement }, cyclesToBars(cycles, bpm, cps));
      const key = next ? `${next.barInSong}:${next.stepInBar}` : '';
      if (key !== lastKey.current) {
        lastKey.current = key;
        setPosition(next);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, getHapState]);

  return isPlaying ? position : null;
}
