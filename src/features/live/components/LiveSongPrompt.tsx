'use client';

import { useState } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { totalBars } from '@lib/song';

/**
 * Aviso "Claude te ha enviado una canción" con Cargar / Descartar (TASK-29 AC-3).
 * Si hay ediciones manuales de código sin pasar al grid, Cargar pide confirmación (AC-5).
 */
export function LiveSongPrompt() {
  const t = useTranslation();
  const pending = useSessionStore((s) => s.pendingLiveSong);
  const isPlaying = useSessionStore((s) => s.isPlaying);
  const hasManualEdits = useSessionStore((s) => s.isCodeManuallyEdited);
  const acceptLiveSong = useSessionStore((s) => s.acceptLiveSong);
  const dismissLiveSong = useSessionStore((s) => s.dismissLiveSong);
  const [confirmingFor, setConfirmingFor] = useState<string | null>(null);

  if (!pending) return null;
  const confirming = confirmingFor === pending.id && hasManualEdits;
  const { song } = pending;
  const timing = isPlaying ? t('live.nextBar') : pending.autoplay ? t('live.willStart') : null;

  const load = () => {
    if (hasManualEdits && !confirming) {
      setConfirmingFor(pending.id);
      return;
    }
    setConfirmingFor(null);
    acceptLiveSong();
  };

  const buttonClass = 'rounded-[6px] border px-3 py-1.5 text-[11px] transition-colors';

  return (
    <div
      role="alertdialog"
      aria-labelledby="live-song-title"
      className="fixed bottom-[132px] right-5 z-[70] w-[320px] max-w-[calc(100vw-32px)] rounded-[8px] border border-[var(--border-active)] bg-[var(--surface)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
    >
      <p id="live-song-title" className="text-[12px] font-medium text-[var(--text)]">
        {t('live.received')}
      </p>
      <p className="mt-1 text-[11px] text-[var(--text-dim)]">
        {pending.name ? <span className="text-[var(--cyan)]">{pending.name}</span> : null}
        {pending.name ? ' · ' : null}
        {song.bpm} {t('live.summaryBpm')} · {song.sections.length} {t('live.summarySections')} · {totalBars(song)}{' '}
        {t('song.barsUnit')}
      </p>
      {timing && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{timing}</p>}

      {confirming && (
        <p role="alert" className="mt-2 text-[11px] text-[var(--red)]">
          {t('live.editsWarning')}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => (confirming ? setConfirmingFor(null) : dismissLiveSong())}
          className={`${buttonClass} border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]`}
        >
          {confirming ? t('live.keep') : t('live.dismiss')}
        </button>
        <button
          type="button"
          onClick={load}
          className={`${buttonClass} border-[var(--border-active)] bg-[rgba(0,255,200,0.12)] text-[var(--cyan)] hover:bg-[rgba(0,255,200,0.2)]`}
        >
          {confirming ? t('live.replace') : t('live.load')}
        </button>
      </div>
    </div>
  );
}
