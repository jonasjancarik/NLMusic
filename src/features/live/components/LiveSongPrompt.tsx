'use client';

import { useState } from 'react';
import { Music4 } from 'lucide-react';
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

  const buttonClass = 'rounded-full border px-4 py-1.5 text-[12px] font-medium transition-colors';

  return (
    <div
      role="alertdialog"
      aria-labelledby="live-song-title"
      className="animate-rise-in fixed bottom-[104px] right-5 z-[70] w-[340px] max-w-[calc(100vw-32px)] rounded-[14px] border border-[rgba(180,130,255,0.35)] bg-[rgba(23,23,29,0.96)] px-4 py-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(180,130,255,0.15)] text-[var(--violet)]">
          <Music4 size={14} strokeWidth={2} />
        </span>
        <p id="live-song-title" className="text-[14px] font-semibold text-[var(--text)]">
          {t('live.received')}
        </p>
      </div>
      <p className="mt-2 text-[12px] text-[var(--text-dim)]">
        {pending.name ? <span className="font-medium text-[var(--text)]">{pending.name}</span> : null}
        {pending.name ? ' · ' : null}
        {song.bpm} {t('live.summaryBpm')} · {song.sections.length} {t('live.summarySections')} · {totalBars(song)}{' '}
        {t('song.barsUnit')}
      </p>
      {timing && <p className="mt-1 text-[12px] text-[var(--text-muted)]">{timing}</p>}

      {confirming && (
        <p role="alert" className="mt-2 text-[11px] text-[var(--red)]">
          {t('live.editsWarning')}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => (confirming ? setConfirmingFor(null) : dismissLiveSong())}
          className={`${buttonClass} border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)]`}
        >
          {confirming ? t('live.keep') : t('live.dismiss')}
        </button>
        <button
          type="button"
          onClick={load}
          className={`${buttonClass} border-transparent bg-[var(--cyan)] text-[#06221b] hover:shadow-[0_0_14px_rgba(0,255,200,0.45)]`}
        >
          {confirming ? t('live.replace') : t('live.load')}
        </button>
      </div>
    </div>
  );
}
