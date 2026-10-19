'use client';

import { useEffect, useRef } from 'react';
import { AudioLines } from 'lucide-react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { MAX_TRACKS_PER_SECTION } from '@lib/song';
import { TrackCard } from './TrackCard';
import { TRACK_HEADER_WIDTH } from '../layout';
import { SectionTabs } from './SectionTabs';
import { ArrangementStrip } from './ArrangementStrip';
import { BarRuler } from './Sequencer';
import { PracticePanel } from '@features/practice';
import { usePlayhead } from '../hooks/usePlayhead';

/**
 * Vista del secuenciador: arreglo de la canción arriba, herramientas de práctica y, en una
 * tarjeta, la sección elegida con su regla de compases y una fila por pista. La columna de
 * nombres queda fija y los pasos se desplazan juntos en horizontal.
 *
 * @see BR-006 Máximo MAX_TRACKS_PER_SECTION (8) pistas por sección
 * @see EC-004 Al llegar al límite, el contador lo destaca
 */
export function TrackZone() {
  const t = useTranslation();
  const tracks = useSessionStore((s) => s.tracks);
  const isCodeManuallyEdited = useSessionStore((s) => s.isCodeManuallyEdited);
  const activeSectionId = useSessionStore((s) => s.activeSectionId);
  const stepsPerBar = useSessionStore((s) => s.stepsPerBar);
  const activeBars = useSessionStore((s) => s.sections.find((section) => section.id === s.activeSectionId)?.bars ?? 1);
  const playhead = usePlayhead();
  // Solo se resalta el compás y el paso si la sección que suena es la que se ve en el grid.
  const gridPlayhead =
    playhead && playhead.sectionId === activeSectionId
      ? { bar: playhead.barInSection, step: playhead.stepInBar }
      : null;
  const atLimit = tracks.length >= MAX_TRACKS_PER_SECTION;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const playingBar = gridPlayhead?.bar ?? null;

  // Sigue al cabezal: si el compás que suena queda fuera de la vista, desplaza el grid hasta él.
  useEffect(() => {
    const container = scrollRef.current;
    if (playingBar === null || !container) return;
    const barEl = container.querySelector<HTMLElement>(`[data-ruler-bar="${playingBar}"]`);
    const header = container.querySelector<HTMLElement>('[data-track-header]');
    if (!barEl) return;
    const headerWidth = header?.offsetWidth ?? 0;
    const left = barEl.offsetLeft - headerWidth;
    const visibleStart = container.scrollLeft;
    const visibleEnd = visibleStart + container.clientWidth - headerWidth;
    if (left < visibleStart || left + barEl.offsetWidth > visibleEnd) {
      container.scrollTo({ left: Math.max(0, left - 12), behavior: 'smooth' });
    }
  }, [playingBar]);

  // BR-006 / EC-004: el contador sigue visible aunque no haya pistas y se destaca en el límite.
  const counter = (
    <span
      className="tabular text-[10px] uppercase tracking-[0.08em]"
      style={{ color: atLimit ? 'var(--amber)' : 'var(--text-muted)' }}
    >
      {t('tracks.counterLabel')}: {tracks.length} / {MAX_TRACKS_PER_SECTION}
    </span>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-4">
      <ArrangementStrip playhead={playhead} />
      <PracticePanel />

      <section className="mx-5 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <SectionTabs playingSectionId={playhead?.sectionId ?? null} />

        {/* BR-009: "modo código" — grid may not reflect manually edited Strudel code */}
        {isCodeManuallyEdited && (
          <div className="mx-4 mt-3 rounded-[8px] border border-[rgba(180,130,255,0.3)] bg-[rgba(180,130,255,0.07)] px-3 py-2">
            <p className="text-[12px] text-[rgba(200,165,255,0.9)]">{t('tracks.codeEditedWarning')}</p>
          </div>
        )}

        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface2)] text-[var(--text-dim)]">
              <AudioLines size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-[14px] text-[var(--text-dim)]">{t('tracks.empty')}</p>
            {counter}
          </div>
        ) : (
          <div ref={scrollRef} className="relative overflow-x-auto rounded-b-[14px]">
            <div
              data-testid="track-grid"
              className="flex min-w-full w-max flex-col pb-2 transition-opacity"
              style={{ opacity: isCodeManuallyEdited ? 0.5 : 1 }}
            >
              <div className="flex items-stretch">
                <div
                  data-track-header
                  className={`sticky left-0 z-10 flex shrink-0 items-center border-r border-[var(--border)] bg-[var(--surface)] px-4 ${TRACK_HEADER_WIDTH}`}
                >
                  {counter}
                </div>
                <div className="flex flex-1 px-3 pt-1">
                  <BarRuler bars={activeBars} stepsPerBar={stepsPerBar} playhead={gridPlayhead} />
                </div>
              </div>
              <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.04)]">
                {tracks.map((track) => (
                  <TrackCard key={track.id} track={track} playhead={gridPlayhead} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
