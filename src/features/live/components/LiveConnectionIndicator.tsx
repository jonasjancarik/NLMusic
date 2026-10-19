'use client';

import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';

/** Indicador discreto "Claude conectado / sin conexión" (TASK-29 AC-2). */
export function LiveConnectionIndicator() {
  const t = useTranslation();
  const connection = useSessionStore((s) => s.liveConnection);
  const label =
    connection === 'connected' ? t('live.connected') : connection === 'connecting' ? t('live.connecting') : t('live.offline');
  const hint = connection === 'connected' ? t('live.connectedHint') : t('live.offlineHint');

  return (
    <span
      role="status"
      title={hint}
      data-connection={connection}
      className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]"
    >
      <span
        aria-hidden
        className={[
          'inline-block h-[6px] w-[6px] rounded-full',
          connection === 'connected' ? 'bg-[var(--cyan)]' : 'bg-white/25',
        ].join(' ')}
      />
      {label}
    </span>
  );
}
