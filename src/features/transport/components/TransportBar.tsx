'use client';

import { useSessionStore } from '@store/sessionStore';
import type { Language } from '@lib/i18n';
import { useTranslation } from '@lib/i18n';
import { useStrudelContext } from '@features/audio';
import { PlayControls } from './PlayControls';
import { BpmControl } from './BpmControl';
import { BarIndicator } from './BarIndicator';

/**
 * Barra de transporte fija en la parte superior.
 *
 * Propaga `disabled` y `disabledReason` a PlayControls y BpmControl
 * cuando el motor de audio no está disponible (EC-010).
 * Muestra un indicador discreto del estado del motor junto al logotipo.
 *
 * @see EC-010 Motor no disponible — controles deshabilitados con tooltip explicativo
 */
export function TransportBar() {
  const t = useTranslation();
  const strudel = useStrudelContext();
  const hasInitError = strudel.initError !== null;
  const isPlaying = useSessionStore((s) => s.isPlaying);
  const language = useSessionStore((s) => s.language);
  const setLanguage = useSessionStore((s) => s.setLanguage);
  const disabledReason = hasInitError ? t('transport.audioError') : undefined;

  // EC-010: indicador discreto de estado del motor junto al logo
  const engineIndicator = strudel.initError !== null
    ? <span className="text-[10px] text-[var(--red)]">{t('transport.audioErrorBadge')}</span>
    : strudel.isReady
      ? <span className="text-[10px] text-[var(--cyan)]">{t('transport.audioReady')}</span>
      : <span className="text-[10px] text-[var(--text-dim)]">{t('transport.audioInit')}</span>;

  return (
    <header
      className="fixed left-0 right-0 top-0 z-[60] border-b border-[var(--border)] bg-[var(--surface)]"
    >
      <div
        className="relative mx-auto flex min-h-[58px] w-full max-w-[1100px] items-center justify-center gap-6 px-5"
      >
        <div
          className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center gap-3"
        >
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            NLMusic
          </span>
          {/* Play state dot */}
          <span
            className={[
              'h-[10px] w-[10px] rounded-full transition-colors',
              isPlaying
                ? 'bg-[var(--cyan)] animate-pulse-dot shadow-[0_0_8px_rgba(0,255,200,0.8)]'
                : 'bg-white/30',
            ].join(' ')}
          />
          {/* Engine status indicator */}
          {engineIndicator}
        </div>

        <div
          aria-disabled={hasInitError}
          className={hasInitError ? 'opacity-45' : ''}
          style={{ margin: 0, padding: 0, border: 0, display: 'contents' }}
        >
          <PlayControls disabled={hasInitError} disabledReason={disabledReason} />
          <BpmControl disabled={hasInitError} disabledReason={disabledReason} />
        </div>

        <BarIndicator />

        {/* TASK-13: language selector — discrete, right-aligned */}
        <div
          className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1"
        >
          {(['es', 'en'] as Language[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className="text-[10px] uppercase tracking-[0.1em] transition-colors"
              style={{ color: language === lang ? 'var(--text)' : 'var(--text-muted)' }}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
