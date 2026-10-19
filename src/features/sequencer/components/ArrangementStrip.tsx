'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Minus, Play, Plus, X } from 'lucide-react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { MAX_REPEAT, MIN_REPEAT, totalBars, type PlayheadPosition } from '@lib/song';
import { arrangementItemStartBar, practiceLoopBars } from '@lib/practice';
import { usePlayFromBlock } from '@features/practice';
import { sectionColor, withAlpha } from '../colors';

interface ArrangementStripProps {
  playhead: PlayheadPosition | null;
}

const tool =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[var(--text-dim)] transition-colors ' +
  'hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-30';

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Línea de tiempo del arreglo: cada bloque es una parte de la canción, con un ancho
 * proporcional a cuántos compases dura. Clic en un bloque abre su sección en el grid;
 * arrastrar cambia el orden; el botón ▶ de cada bloque reproduce la canción desde ahí.
 * Mientras suena, el bloque actual se rellena según avanza.
 * @see TASK-25 AC-4, AC-5
 */
export function ArrangementStrip({ playhead }: ArrangementStripProps) {
  const t = useTranslation();
  const sections = useSessionStore((s) => s.sections);
  const arrangement = useSessionStore((s) => s.arrangement);
  const bpm = useSessionStore((s) => s.bpm);
  const stepsPerBar = useSessionStore((s) => s.stepsPerBar);
  const activeSectionId = useSessionStore((s) => s.activeSectionId);
  const setActiveSection = useSessionStore((s) => s.setActiveSection);
  const addArrangementItem = useSessionStore((s) => s.addArrangementItem);
  const removeArrangementItem = useSessionStore((s) => s.removeArrangementItem);
  const moveArrangementItem = useSessionStore((s) => s.moveArrangementItem);
  const setArrangementRepeat = useSessionStore((s) => s.setArrangementRepeat);
  const loopSectionId = useSessionStore((s) => s.loopSectionId);
  const playFromBlock = usePlayFromBlock();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const song = { bpm, stepsPerBar, sections, arrangement };
  const total = totalBars(song);
  // TASK-30: con un bucle de sección el contador de compás cuenta dentro del bucle.
  const cycleBars = practiceLoopBars(song, loopSectionId);
  const duration = formatDuration((total * 4 * 60) / Math.max(1, bpm));

  const endDrag = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragIndex !== null && dragIndex !== index) moveArrangementItem(dragIndex, index);
    endDrag();
  };

  return (
    <div className="px-5 pb-4" data-testid="arrangement-strip">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[13px] font-semibold text-[var(--text)]">{t('song.arrangement')}</h2>
          <span className="hidden text-[12px] text-[var(--text-muted)] md:inline">{t('song.arrangementHint')}</span>
        </div>
        <span className="tabular text-[11px] text-[var(--text-dim)]" data-testid="arrangement-total">
          {playhead ? (
            <span className="text-[var(--cyan)]">{`${t('song.barLabel')} ${playhead.barInSong + 1} / ${cycleBars} · `}</span>
          ) : (
            ''
          )}
          {t('song.total')}: {total} {total === 1 ? t('song.barUnit') : t('song.barsUnit')} · {duration}
        </span>
      </div>

      <div className="flex items-stretch gap-1.5">
      <ol className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto pb-1">
        {arrangement.map((item, index) => {
          const sectionIndex = sections.findIndex((s) => s.id === item.sectionId);
          const section = sections[sectionIndex];
          const color = sectionColor(sectionIndex);
          const bars = (section?.bars ?? 1) * item.repeat;
          const playing = playhead?.itemIndex === index;
          const selected = item.sectionId === activeSectionId;
          const start = arrangementItemStartBar(song, index);
          const progress = playing && playhead && !loopSectionId ? ((playhead.barInSong - start + playhead.stepInBar / stepsPerBar) / bars) * 100 : 0;
          const name = section?.name ?? '';

          return (
            <li
              key={`${index}-${item.sectionId}`}
              data-playing={playing || undefined}
              draggable
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (dropIndex !== index) setDropIndex(index);
              }}
              onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
              onDrop={(event) => handleDrop(event, index)}
              onDragEnd={endDrag}
              style={{
                flexGrow: bars,
                flexBasis: 0,
                minWidth: 164,
                background: `linear-gradient(180deg, ${withAlpha(color, selected ? 0.16 : 0.09)} 0%, ${withAlpha(color, 0.03)} 100%)`,
                borderColor: playing ? color : selected ? withAlpha(color, 0.55) : withAlpha(color, 0.18),
                boxShadow: playing ? `0 0 0 1px ${color}, 0 0 18px ${withAlpha(color, 0.25)}` : undefined,
              }}
              className={[
                'group relative flex flex-col overflow-hidden rounded-[10px] border transition-[opacity,box-shadow,border-color]',
                dragIndex === index ? 'opacity-40' : '',
                dropIndex === index && dragIndex !== index ? 'outline outline-2 outline-offset-2 outline-[var(--text-dim)]' : '',
              ].join(' ')}
            >
              {/* Progreso del bloque que suena */}
              {playing && progress > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear"
                  style={{ width: `${Math.min(100, progress)}%`, background: withAlpha(color, 0.14) }}
                />
              )}
              <span aria-hidden className="h-[3px] w-full" style={{ background: color, opacity: selected || playing ? 1 : 0.55 }} />

              <div className="relative flex items-start gap-1 pr-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection(item.sectionId)}
                  aria-current={selected ? 'true' : undefined}
                  title={t('song.editSectionHint')}
                  className="flex min-w-0 flex-1 items-start gap-1 pb-1 pl-1.5 text-left"
                >
                  <GripVertical
                    size={13}
                    aria-hidden
                    className="mt-[3px] shrink-0 cursor-grab text-[var(--text-muted)] opacity-40 transition-opacity group-hover:opacity-100"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold" style={{ color: selected || playing ? color : 'var(--text)' }}>
                      {name}
                    </span>
                    <span className="tabular block text-[11px] text-[var(--text-dim)]">
                      {section?.bars ?? 0} {section?.bars === 1 ? t('song.barUnit') : t('song.barsUnit')}
                      {item.repeat > 1 ? <span className="text-[var(--text)]">{` × ${item.repeat}`}</span> : null}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:scale-105"
                  style={{ background: withAlpha(color, playing ? 0.9 : 0.16), color: playing ? '#08080b' : color }}
                  aria-label={`${t('song.playFromHere')} ${index + 1}`}
                  title={t('song.playFromHere')}
                  onClick={() => playFromBlock(index)}
                >
                  <Play size={11} strokeWidth={0} fill="currentColor" className="ml-[1px]" />
                </button>
              </div>

              {/* Repeticiones: un segmento por vuelta */}
              {item.repeat > 1 && (
                <span aria-hidden className="relative mx-2.5 mb-1.5 flex gap-[3px]">
                  {Array.from({ length: item.repeat }, (_, i) => (
                    <span key={i} className="h-[3px] flex-1 rounded-full" style={{ background: withAlpha(color, 0.35) }} />
                  ))}
                </span>
              )}

              <div className="relative flex items-center gap-0.5 border-t border-[rgba(255,255,255,0.05)] px-1 py-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <button
                  type="button"
                  className={tool}
                  aria-label={`${t('song.repeat')} −, ${name} ${index + 1}`}
                  title={t('song.repeatFewer')}
                  disabled={item.repeat <= MIN_REPEAT}
                  onClick={() => setArrangementRepeat(index, item.repeat - 1)}
                >
                  <Minus size={12} strokeWidth={2} />
                </button>
                <span className="tabular w-6 text-center text-[11px] text-[var(--text)]" aria-label={`${t('song.repeat')} ×${item.repeat}`}>
                  ×{item.repeat}
                </span>
                <button
                  type="button"
                  className={tool}
                  aria-label={`${t('song.repeat')} +, ${name} ${index + 1}`}
                  title={t('song.repeatMore')}
                  disabled={item.repeat >= MAX_REPEAT}
                  onClick={() => setArrangementRepeat(index, item.repeat + 1)}
                >
                  <Plus size={12} strokeWidth={2} />
                </button>

                <span className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    className={tool}
                    aria-label={`${t('song.moveEarlier')} ${index + 1}`}
                    title={t('song.moveEarlier')}
                    disabled={index === 0}
                    onClick={() => moveArrangementItem(index, index - 1)}
                  >
                    <ChevronLeft size={13} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className={tool}
                    aria-label={`${t('song.moveLater')} ${index + 1}`}
                    title={t('song.moveLater')}
                    disabled={index === arrangement.length - 1}
                    onClick={() => moveArrangementItem(index, index + 1)}
                  >
                    <ChevronRight size={13} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className={`${tool} hover:!bg-[rgba(255,68,102,0.12)] hover:!text-[var(--red)]`}
                    aria-label={`${t('song.removeBlock')} ${index + 1}`}
                    title={t('song.removeBlock')}
                    disabled={arrangement.length <= 1}
                    onClick={() => removeArrangementItem(index)}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              </div>
            </li>
          );
        })}

      </ol>

        <div ref={menuRef} className="relative flex shrink-0 pb-1">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-full min-h-[72px] w-[92px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-[var(--border-strong)] text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text)]"
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            {t('song.addBlock')}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="animate-rise-in absolute right-0 top-[calc(100%+6px)] z-30 min-w-[200px] rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface2)] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
            >
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-[var(--text-muted)]">{t('song.addBlockMenu')}</p>
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    addArrangementItem(s.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[13px] text-[var(--text)] hover:bg-[var(--surface3)]"
                >
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: sectionColor(i) }} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="tabular text-[11px] text-[var(--text-muted)]">
                    {s.bars} {s.bars === 1 ? t('song.barUnit') : t('song.barsUnit')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
