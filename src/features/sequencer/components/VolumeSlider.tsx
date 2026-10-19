'use client';

import type { CSSProperties } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';

interface VolumeSliderProps {
  trackId: string;
  volume: number;
  /** Color del relleno (la voz de la pista). */
  color?: string;
}

export function VolumeSlider({ trackId, volume, color }: VolumeSliderProps) {
  const t = useTranslation();
  const setVolume = useSessionStore((s) => s.setVolume);
  const percent = Math.round(volume * 100);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5" title={`${t('track.volumeLabel')}: ${percent}%`}>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        aria-label={t('track.volumeLabel')}
        onChange={(event) => setVolume(trackId, Number(event.target.value) / 100)}
        className="volume-slider h-[3px] min-w-0 flex-1"
        style={{ '--slider-value': `${percent}%`, '--slider-fill': color } as CSSProperties}
      />
      <span className="tabular w-7 text-right text-[10px] text-[var(--text-muted)]">{percent}</span>
    </div>
  );
}
