'use client';

import { Download } from 'lucide-react';
import { useSessionStore } from '@store/sessionStore';
import { selectSong } from '@store/helpers';
import { useTranslation } from '@lib/i18n';
import { songToMidi } from '@lib/midi';

/** TASK-26: descarga la canción actual como .mid (mute/solo se respetan; ver `songToMidi`). */
export function DownloadMidiButton() {
  const t = useTranslation();
  const hasNotes = useSessionStore((s) => s.sections.some((section) => section.tracks.length > 0));

  const download = () => {
    const bytes = songToMidi(selectSong(useSessionStore.getState()));
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/midi' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `nlmusic-${new Date().toISOString().slice(0, 10)}.mid`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      aria-label={t('midi.download')}
      disabled={!hasNotes}
      title={hasNotes ? t('midi.downloadTitle') : t('midi.downloadEmpty')}
      className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download size={13} strokeWidth={2} aria-hidden />
      <span className="hidden md:inline">{t('midi.download')}</span>
    </button>
  );
}
