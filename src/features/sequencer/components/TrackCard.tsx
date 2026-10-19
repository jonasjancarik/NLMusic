'use client';

import { X } from 'lucide-react';
import type { Track } from '@lib/types';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { DRUM_VOICES } from '@lib/song';
import { Sequencer } from './Sequencer';
import { VolumeSlider } from './VolumeSlider';
import { trackColor, withAlpha } from '../colors';
import { TRACK_HEADER_WIDTH } from '../layout';

interface TrackCardProps {
  track: Track;
  /** Compás y paso que suenan ahora en esta sección, o null si no suena. */
  playhead?: { bar: number; step: number } | null;
}


const toggle = 'flex h-6 w-6 items-center justify-center rounded-[6px] text-[11px] font-bold transition-colors';

/**
 * Fila de pista: cabecera fija a la izquierda (nombre, mezcla, quitar) y sus pasos a la
 * derecha. La eliminación delega al store sin confirmación para mantener la acción destructiva.
 *
 * @see BR-007 Eliminar pista es irreversible y no solicita confirmación
 * @see EC-007/EC-008 Si es la última pista, el store transiciona a IDLE
 */
export function TrackCard({ track, playhead = null }: TrackCardProps) {
  const t = useTranslation();
  const toggleMute = useSessionStore((s) => s.toggleMute);
  const toggleSolo = useSessionStore((s) => s.toggleSolo);
  const deleteTrack = useSessionStore((s) => s.deleteTrack);
  const stepsPerBar = useSessionStore((s) => s.stepsPerBar);
  const color = trackColor(track);
  const voice = DRUM_VOICES.find((v) => v.id === track.sample)?.name;

  return (
    <article className="group/track flex items-stretch">
      <div
        className={[
          'sticky left-0 z-10 flex shrink-0 items-center gap-2.5 border-r border-[var(--border)] bg-[var(--surface)] py-1.5 pl-3 pr-3',
          TRACK_HEADER_WIDTH,
        ].join(' ')}
      >
        <span
          aria-hidden
          className="h-9 w-1 shrink-0 rounded-full transition-opacity"
          style={{ background: color, opacity: track.muted ? 0.25 : 1, boxShadow: track.muted ? undefined : `0 0 8px ${withAlpha(color, 0.5)}` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span
              title={voice && voice !== track.name ? voice : undefined}
              className={['truncate text-[13px] font-semibold', track.muted ? 'text-[var(--text-muted)] line-through decoration-[var(--text-muted)]' : 'text-[var(--text)]'].join(' ')}
            >
              {track.name}
            </span>
            {/* BR-007: destructivo e irreversible, sin confirmación */}
            <button
              type="button"
              aria-label={`${t('tracks.deleteAriaLabel')} ${track.name}`}
              title={t('tracks.deleteAriaLabel')}
              className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[var(--text-muted)] opacity-0 transition-all hover:bg-[rgba(255,68,102,0.12)] hover:text-[var(--red)] focus-visible:opacity-100 group-hover/track:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={() => deleteTrack(track.id)}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              className={[
                toggle,
                track.muted ? 'bg-[var(--red)] text-white' : 'bg-[var(--surface3)] text-[var(--text-dim)] hover:text-[var(--text)]',
              ].join(' ')}
              aria-label={`${t('track.muteLabel')} ${track.name}`}
              title={t('track.muteLabel')}
              onClick={() => toggleMute(track.id)}
            >
              M
            </button>
            <button
              type="button"
              className={[
                toggle,
                track.solo ? 'bg-[var(--amber)] text-black' : 'bg-[var(--surface3)] text-[var(--text-dim)] hover:text-[var(--text)]',
              ].join(' ')}
              aria-label={`${t('track.soloLabel')} ${track.name}`}
              title={t('track.soloLabel')}
              onClick={() => toggleSolo(track.id)}
            >
              S
            </button>
            <VolumeSlider trackId={track.id} volume={track.volume} color={color} />
          </div>
        </div>
      </div>

      <div
        className={[
          'flex flex-1 items-center px-3 py-1.5 transition-opacity',
          track.muted ? 'opacity-35' : '',
          track.solo ? 'bg-[rgba(255,170,0,0.04)]' : '',
        ].join(' ')}
      >
        <Sequencer
          trackId={track.id}
          steps={track.steps}
          velocity={track.velocity}
          color={color}
          stepsPerBar={stepsPerBar}
          playhead={playhead}
        />
      </div>
    </article>
  );
}
