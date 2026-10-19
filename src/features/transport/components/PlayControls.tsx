'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { useStrudelContext } from '@features/audio';
import { msUntilNextBar, schedulerCps } from '@lib/song';
import { barsAt, type Timeline } from '@lib/practice';
import { selectPlayCode, selectTimeline } from '@store/practiceSelectors';
import { useTempoTrainer } from '@features/practice';

interface PlayControlsProps {
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Controles de reproducción (Play / Stop).
 *
 * Cuando `disabled` es true, los botones no responden a clics y muestran
 * un tooltip con `disabledReason` explicando el motivo (EC-010).
 * El cambio de código se aplica en el siguiente ciclo sin interrumpir
 * el loop en curso (BR-001).
 *
 * @see BR-001 El audio nunca se interrumpe — actualiza en el siguiente ciclo
 * @see EC-010 Motor no disponible — botones deshabilitados con tooltip
 */
export function PlayControls({ disabled = false, disabledReason }: PlayControlsProps) {
  const t = useTranslation();
  const { play, stop, isReady, getHapState } = useStrudelContext();
  const isPlaying = useSessionStore((s) => s.isPlaying);
  const setPlaying = useSessionStore((s) => s.setPlaying);
  // TASK-30: lo que suena es el código de la canción más, si se piden, bucle de sección,
  // partes quitadas, clics y tempo del entrenador. Sin práctica activa es `currentCode`.
  const currentCode = useSessionStore(selectPlayCode);
  const beginPractice = useSessionStore((s) => s.beginPractice);
  const endPractice = useSessionStore((s) => s.endPractice);
  useTempoTrainer();
  // Línea de tiempo (BPM y fase) del código que está sonando, para calcular el siguiente compás.
  const appliedTimeline = useRef<Timeline>({ bpm: 0, phaseBars: 0 });
  const [stopFlash, setStopFlash] = useState(false);
  const syncedCode = useRef('');
  const prevIsPlayingRef = useRef(isPlaying);

  // EC-007/EC-008: detener audio cuando isPlaying cae a false externamente
  // (ej. se elimina la última pista) — BR-001 safe porque hush() es idempotente
  useEffect(() => {
    if (prevIsPlayingRef.current && !isPlaying) {
      stop();
      endPractice();
      syncedCode.current = '';
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying, stop, endPractice]);

  useEffect(() => {
    if (!isPlaying || !isReady || !currentCode || syncedCode.current === currentCode) {
      return;
    }

    const apply = () => {
      appliedTimeline.current = selectTimeline(useSessionStore.getState());
      syncedCode.current = currentCode;
      void play(currentCode);
    };

    // TASK-25 AC-5: con la canción ya sonando, el cambio entra en el siguiente compás.
    // Una edición posterior cancela la espera y manda la última versión.
    let wait = 0;
    if (syncedCode.current) {
      try {
        const timeline = appliedTimeline.current;
        wait = msUntilNextBar(barsAt(timeline, getHapState?.().getTime() ?? 0, schedulerCps()), timeline.bpm);
      } catch {
        wait = 0;
      }
    }
    if (wait <= 0) {
      apply();
      return;
    }
    const timer = window.setTimeout(apply, wait);
    return () => window.clearTimeout(timer);
  }, [currentCode, isPlaying, isReady, play, getHapState]);

  const handlePlayToggle = async () => {
    // EC-010: no-op si el motor no está disponible
    if (disabled) {
      return;
    }
    if (!isReady || !currentCode) {
      return;
    }

    if (isPlaying) {
      stop();
      setPlaying(false);
      syncedCode.current = '';
      return;
    }

    try {
      // TASK-30: cada reproducción nueva empieza el entrenador y fija la cuenta atrás.
      beginPractice();
      const state = useSessionStore.getState();
      const code = selectPlayCode(state);
      appliedTimeline.current = selectTimeline(state);
      syncedCode.current = code;
      await play(code);
      setPlaying(true);
    } catch {
      endPractice();
      syncedCode.current = '';
    }
  };

  const handleStop = () => {
    // EC-010: no-op si el motor no está disponible
    if (disabled) {
      return;
    }
    setStopFlash(true);
    stop();
    setPlaying(false);
    syncedCode.current = '';

    window.setTimeout(() => setStopFlash(false), 200);
  };

  return (
    <div className="flex items-center gap-3 mr-3">
      <button
        type="button"
        aria-label={t('transport.stop')}
        title={disabledReason}
        disabled={disabled}
        onClick={handleStop}
        className={[
          'h-12 w-12 rounded-[6px] border text-[15px] leading-none transition-all',
          stopFlash
            ? 'border-[var(--cyan)] bg-[rgba(0,255,200,0.16)] text-[var(--cyan)]'
            : 'border-[var(--border)] bg-transparent text-[var(--text)] hover:border-[var(--border-active)]',
          disabled ? 'cursor-not-allowed opacity-70 hover:border-[var(--border)]' : '',
        ].join(' ')}
      >
        <Square size={16} strokeWidth={1.5} className="text-current" />
      </button>

      <button
        type="button"
        aria-label={t('transport.play')}
        title={disabledReason}
        disabled={disabled}
        onClick={() => void handlePlayToggle()}
        className={[
          'h-12 w-12 rounded-[6px] border text-[15px] leading-none transition-all',
          isPlaying
            ? 'border-[var(--cyan)] bg-[rgba(0,255,200,0.12)] text-[var(--cyan)] shadow-[0_0_8px_rgba(0,255,200,0.35)]'
            : 'border-[var(--border)] bg-transparent text-[var(--text)] hover:border-[var(--border-active)]',
          disabled ? 'cursor-not-allowed opacity-70 hover:border-[var(--border)]' : '',
        ].join(' ')}
      >
        <Play size={16} strokeWidth={1.5} className="text-current" />
      </button>
    </div>
  );
}
