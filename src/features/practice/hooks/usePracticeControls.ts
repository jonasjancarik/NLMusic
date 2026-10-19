'use client';

import { useCallback, useEffect } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { selectSong } from '@store/helpers';
import { effectiveBpm, selectTimeline } from '@store/practiceSelectors';
import { schedulerCps } from '@lib/song';
import {
  arrangementItemStartBar,
  barsAt,
  nextBarBoundary,
  nextTrainerBpm,
  practiceLoopBars,
  retimeAt,
  sectionStartBar,
} from '@lib/practice';
import { useStrudelContext } from '@features/audio';

/**
 * Cambia la sección en bucle. Parado, solo guarda la elección. Sonando, programa el cambio
 * para el siguiente compás sin parar el reloj de Strudel (BR-001): el bucle empieza en el
 * primer compás de la sección y, al volver a la canción completa, sigue desde donde empieza
 * esa sección en el arreglo. Si el entrenador de tempo está activo, vuelve a empezar desde
 * su BPM inicial.
 * @see TASK-30 AC-1
 */
export function useLoopSection(): (sectionId: string | null) => void {
  const { getHapState } = useStrudelContext();

  return useCallback(
    (sectionId) => {
      const state = useSessionStore.getState();
      if (sectionId === state.loopSectionId) return;
      if (!state.isPlaying) {
        state.setLoopSection(sectionId);
        return;
      }

      const timeline = selectTimeline(state);
      const countIn = state.practiceCountInBars;
      let cycles = 0;
      try {
        cycles = getHapState().getTime();
      } catch {
        cycles = 0;
      }
      const cps = schedulerCps();
      // Durante la cuenta atrás la canción aún no ha empezado: basta con cambiar la elección.
      if (barsAt(timeline, cycles, cps) < countIn) {
        state.setLoopSection(sectionId);
        return;
      }

      const boundary = nextBarBoundary(timeline, cycles, cps);
      const song = selectSong(state);
      const target = countIn + (sectionId ? 0 : sectionStartBar(song, state.loopSectionId ?? ''));
      const trainerBpm = state.tempoTrainer.enabled ? state.tempoTrainer.startBpm : null;
      const next = retimeAt(trainerBpm ?? state.bpm, boundary.cycles, cps, target);
      state.retimePractice({ bpm: trainerBpm, phaseBars: next.phaseBars, loopSectionId: sectionId });
    },
    [getHapState],
  );
}

/**
 * Reproduce la canción desde el bloque `index` del arreglo. Sonando, salta en el siguiente
 * compás sin parar el reloj de Strudel (BR-001) y sale del bucle de sección si lo hay.
 * Parado, arranca directamente en ese bloque (sin cuenta atrás, que es para empezar desde
 * el principio). En modo código no hay canción que recorrer y no hace nada.
 */
export function usePlayFromBlock(): (index: number) => void {
  const { getHapState, isReady } = useStrudelContext();

  return useCallback(
    (index) => {
      const state = useSessionStore.getState();
      if (!isReady || state.isCodeManuallyEdited || !state.currentCode) return;
      const startBar = arrangementItemStartBar(selectSong(state), index);
      const trainerBpm = state.tempoTrainer.enabled ? state.tempoTrainer.startBpm : null;

      if (!state.isPlaying) {
        state.beginPractice();
        const countIn = useSessionStore.getState().practiceCountInBars;
        // La cuenta atrás ocupa los primeros compases de la línea de tiempo: se salta.
        state.retimePractice({ bpm: trainerBpm, phaseBars: countIn + startBar, loopSectionId: null });
        state.setPlaying(true);
        return;
      }

      const timeline = selectTimeline(state);
      let cycles = 0;
      try {
        cycles = getHapState().getTime();
      } catch {
        cycles = 0;
      }
      const cps = schedulerCps();
      const boundary = nextBarBoundary(timeline, cycles, cps);
      const target = state.practiceCountInBars + startBar;
      const next = retimeAt(trainerBpm ?? state.bpm, boundary.cycles, cps, Math.max(target, 0));
      state.retimePractice({ bpm: trainerBpm, phaseBars: next.phaseBars, loopSectionId: null });
    },
    [getHapState, isReady],
  );
}

/**
 * Entrenador de tempo mientras suena: al empezar el último compás de cada vuelta (del bucle
 * de sección o de la canción) fija el BPM de la vuelta siguiente. El cambio entra en el
 * límite de compás y la posición sigue siendo continua (ver `retimeAt`). También gestiona
 * activar o desactivar el entrenador con la canción sonando.
 * @see TASK-30 AC-4
 */
export function useTempoTrainer(): void {
  const { getHapState } = useStrudelContext();
  const isPlaying = useSessionStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      const state = useSessionStore.getState();
      const { tempoTrainer } = state;
      const timeline = selectTimeline(state);
      let cycles = 0;
      try {
        cycles = getHapState().getTime();
      } catch {
        return;
      }
      if (!(cycles > 0)) return;
      const cps = schedulerCps();
      const countIn = state.practiceCountInBars;
      const position = barsAt(timeline, cycles, cps) - countIn;
      if (position < 0) return;

      const retime = (bpm: number | null, targetBar: number) => {
        const boundary = nextBarBoundary(timeline, cycles, cps);
        const next = retimeAt(bpm ?? state.bpm, boundary.cycles, cps, targetBar);
        state.retimePractice({ bpm, phaseBars: next.phaseBars });
      };

      if (!tempoTrainer.enabled) {
        // Entrenador apagado: vuelve al BPM de la canción sin saltar de compás.
        if (state.practiceBpm !== null) retime(null, nextBarBoundary(timeline, cycles, cps).bar);
        return;
      }
      if (state.practiceBpm === null) {
        // Entrenador encendido con la canción sonando: empieza desde el principio, en el siguiente compás.
        retime(tempoTrainer.startBpm, countIn);
        return;
      }

      const loopBars = Math.max(1, practiceLoopBars(selectSong(state), state.loopSectionId));
      const loopIndex = Math.floor(position / loopBars);
      const barInLoop = Math.floor(position - loopIndex * loopBars);
      if (barInLoop !== loopBars - 1) return;

      const nextBpm = nextTrainerBpm(tempoTrainer, loopIndex);
      if (nextBpm !== null && nextBpm !== effectiveBpm(state)) {
        retime(nextBpm, nextBarBoundary(timeline, cycles, cps).bar);
      }
    }, 40);

    return () => window.clearInterval(timer);
  }, [isPlaying, getHapState]);
}
