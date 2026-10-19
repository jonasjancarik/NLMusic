'use client';

import { Plus, Minus } from 'lucide-react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';

interface BpmControlProps {
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Control de BPM con botones + y −.
 *
 * Cuando `disabled` es true, los botones no responden y muestran
 * `disabledReason` como tooltip, bloqueando cambios de tempo
 * mientras el motor de audio no está disponible (EC-010).
 *
 * @see EC-010 Motor no disponible — controles de tempo deshabilitados
 */
export function BpmControl({ disabled = false, disabledReason }: BpmControlProps) {
  const t = useTranslation();
  const bpm = useSessionStore((s) => s.bpm);
  // TASK-30: mientras el entrenador de tempo manda, se muestra el BPM que suena.
  const shownBpm = useSessionStore((s) => s.practiceBpm ?? s.bpm);
  const setBpm = useSessionStore((s) => s.setBpm);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title={disabledReason}
        aria-label={t('bpm.decrementLabel')}
        disabled={disabled}
        className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-dim)] transition-colors hover:bg-[var(--surface3)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:hover:bg-transparent"
        onClick={() => setBpm(bpm - 1)}
      >
        <Minus size={13} strokeWidth={2} className="text-current" />
      </button>
      <span className="flex min-w-[58px] items-baseline justify-center gap-1">
        <span className="tabular text-[20px] font-semibold leading-none text-[var(--text)]">{shownBpm}</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">BPM</span>
      </span>
      <button
        type="button"
        title={disabledReason}
        aria-label={t('bpm.incrementLabel')}
        disabled={disabled}
        className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-dim)] transition-colors hover:bg-[var(--surface3)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:hover:bg-transparent"
        onClick={() => setBpm(bpm + 1)}
      >
        <Plus size={13} strokeWidth={2} className="text-current" />
      </button>
    </div>
  );
}
