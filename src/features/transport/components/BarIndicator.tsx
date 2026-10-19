'use client';

import { useBeatClock } from '@features/audio';
import { useTranslation } from '@lib/i18n';
import { useSessionStore } from '@store/sessionStore';

/** Cuatro luces de pulso: la del tiempo actual se enciende y la primera marca el compás. */
export function BarIndicator() {
  const t = useTranslation();
  const { beat } = useBeatClock();
  const isPlaying = useSessionStore((s) => s.isPlaying);

  return (
    <div className="hidden items-center gap-1.5 md:flex" role="img" aria-label={t('transport.barLabel')}>
      {Array.from({ length: 4 }).map((_, index) => {
        const stateClass = !isPlaying
          ? 'bg-[rgba(255,255,255,0.1)]'
          : index === beat
            ? index === 0
              ? 'bg-[var(--cyan)] shadow-[0_0_10px_rgba(0,255,200,0.7)] scale-110'
              : 'bg-[var(--text)] shadow-[0_0_8px_rgba(255,255,255,0.4)]'
            : index < beat
              ? 'bg-[rgba(255,255,255,0.22)]'
              : 'bg-[rgba(255,255,255,0.08)]';

        return <span key={index} className={`inline-block h-2.5 w-2.5 rounded-full transition-all duration-75 ${stateClass}`} />;
      })}
    </div>
  );
}
