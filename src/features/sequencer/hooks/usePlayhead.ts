'use client';

import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { useStrudelContext } from '@features/audio';
import { locatePlayhead, schedulerCps, type PlayheadPosition } from '@lib/song';
import { barsAt, buildPracticeSong } from '@lib/practice';
import { selectTimeline } from '@store/practiceSelectors';

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
      const state = useSessionStore.getState();
      const { sections, arrangement, stepsPerBar, bpm, loopSectionId, practiceCountInBars } = state;
      let cycles = 0;
      try {
        cycles = getHapState().getTime();
      } catch {
        cycles = 0;
      }
      // Sin reloj de Strudel (motor aún arrancando) se estima desde el inicio de la reproducción.
      const cps = schedulerCps();
      if (!(cycles > 0)) cycles = ((performance.now() - startedAt) / 1000) * cps;

      // TASK-30: la posición sale de la línea de tiempo de práctica (BPM del entrenador, fase y
      // cuenta atrás); con un bucle de sección suena una canción de un solo bloque.
      const song = { bpm, stepsPerBar, sections, arrangement };
      const bars = barsAt(selectTimeline(state), cycles, cps) - practiceCountInBars;
      const located = bars < 0 ? null : locatePlayhead(buildPracticeSong(song, { loopSectionId }), bars);
      const looped = located && loopSectionId ? arrangement.findIndex((item) => item.sectionId === loopSectionId) : -1;
      const next = located && looped >= 0 ? { ...located, itemIndex: looped } : located;
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
