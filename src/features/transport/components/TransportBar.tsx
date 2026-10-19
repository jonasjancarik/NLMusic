'use client';

import { useSessionStore } from '@store/sessionStore';
import type { Language } from '@lib/i18n';
import { useTranslation } from '@lib/i18n';
import { useStrudelContext } from '@features/audio';
import { LiveConnectionIndicator } from '@features/live';
import { PlayControls } from './PlayControls';
import { BpmControl } from './BpmControl';
import { BarIndicator } from './BarIndicator';
import { DownloadMidiButton } from './DownloadMidiButton';

/**
 * Barra de transporte fija en la parte superior: marca y estado a la izquierda, transporte
 * (play/stop, tempo, pulso) en el centro y exportación e idioma a la derecha.
 *
 * Propaga `disabled` y `disabledReason` a PlayControls y BpmControl
 * cuando el motor de audio no está disponible (EC-010).
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
    ? <span className="text-[11px] text-[var(--red)]">{t('transport.audioErrorBadge')}</span>
    : strudel.isReady
      ? <span className="text-[11px] text-[var(--cyan)]">{t('transport.audioReady')}</span>
      : <span className="text-[11px] text-[var(--text-dim)]">{t('transport.audioInit')}</span>;

  return (
    <header className="fixed left-0 right-0 top-0 z-[60] border-b border-[var(--border)] bg-[rgba(12,12,16,0.82)] backdrop-blur-md">
      <div className="mx-auto grid h-[64px] w-full max-w-[1280px] grid-cols-[auto_1fr_auto] items-center gap-2 px-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={[
                'flex h-8 w-8 items-end justify-center gap-[3px] rounded-[9px] bg-[linear-gradient(135deg,#00ffc8_0%,#4cc9ff_55%,#b482ff_100%)] px-[7px] pb-[7px]',
                isPlaying ? 'shadow-[0_0_18px_rgba(0,255,200,0.35)]' : '',
              ].join(' ')}
            >
              {[10, 16, 7, 13].map((height, index) => (
                <span key={index} className="w-[3px] rounded-full bg-[#08080b]" style={{ height }} />
              ))}
            </span>
            <span className="hidden text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)] sm:inline">NLMusic</span>
          </div>
          <div className="hidden min-w-0 items-center gap-3 border-l border-[var(--border)] pl-4 lg:flex">
            {/* Engine status indicator */}
            {engineIndicator}
            {/* TASK-29 */}
            <LiveConnectionIndicator />
          </div>
        </div>

        <div className="flex items-center justify-self-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-1.5 pr-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:pr-4">
          <div
            aria-disabled={hasInitError}
            className={hasInitError ? 'opacity-45' : ''}
            style={{ margin: 0, padding: 0, border: 0, display: 'contents' }}
          >
            <PlayControls disabled={hasInitError} disabledReason={disabledReason} />
            <span aria-hidden className="mx-0.5 h-6 w-px bg-[var(--border-strong)] sm:mx-2" />
            <BpmControl disabled={hasInitError} disabledReason={disabledReason} />
          </div>
          <span aria-hidden className="mx-2 hidden h-6 w-px bg-[var(--border-strong)] md:block" />
          <BarIndicator />
        </div>

        <div className="flex items-center justify-end gap-3">
          <span className="hidden sm:contents">
            <DownloadMidiButton />
          </span>

          {/* TASK-13: language selector — discrete, right-aligned */}
          <div className="flex items-center rounded-full border border-[var(--border)] p-0.5">
            {(['es', 'en'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
                className={[
                  'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
                  language === lang ? 'bg-[var(--surface3)]' : 'hover:text-[var(--text-dim)]',
                ].join(' ')}
                style={{ color: language === lang ? 'var(--text)' : 'var(--text-muted)' }}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
