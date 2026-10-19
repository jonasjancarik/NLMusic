'use client';

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
      disabled={!hasNotes}
      title={hasNotes ? t('midi.downloadTitle') : t('midi.downloadEmpty')}
      className="rounded border border-[var(--border)] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {t('midi.download')}
    </button>
  );
}
