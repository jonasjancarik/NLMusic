'use client';

import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { MAX_REPEAT, MIN_REPEAT, totalBars, type PlayheadPosition } from '@lib/song';

interface ArrangementStripProps {
  playhead: PlayheadPosition | null;
}

const smallButton =
  'h-6 w-6 rounded-[4px] border border-[var(--border)] bg-[var(--surface2)] text-[11px] text-[var(--text)] ' +
  'transition-all hover:border-[var(--border-active)] disabled:cursor-not-allowed disabled:opacity-35';

/**
 * Tira de arreglo: el orden en que suenan las secciones y cuántas veces se repite cada una.
 * Cada bloque se puede cambiar de sección, repetir más o menos, mover y quitar; muestra
 * el total de compases y, mientras suena, el compás actual y el bloque que lo contiene.
 * @see TASK-25 AC-4, AC-5
 */
export function ArrangementStrip({ playhead }: ArrangementStripProps) {
  const t = useTranslation();
  const sections = useSessionStore((s) => s.sections);
  const arrangement = useSessionStore((s) => s.arrangement);
  const bpm = useSessionStore((s) => s.bpm);
  const stepsPerBar = useSessionStore((s) => s.stepsPerBar);
  const activeSectionId = useSessionStore((s) => s.activeSectionId);
  const addArrangementItem = useSessionStore((s) => s.addArrangementItem);
  const removeArrangementItem = useSessionStore((s) => s.removeArrangementItem);
  const moveArrangementItem = useSessionStore((s) => s.moveArrangementItem);
  const setArrangementRepeat = useSessionStore((s) => s.setArrangementRepeat);
  const setArrangementSection = useSessionStore((s) => s.setArrangementSection);

  const total = totalBars({ bpm, stepsPerBar, sections, arrangement });

  return (
    <div className="px-5 pb-3" data-testid="arrangement-strip">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{t('song.arrangement')}</span>
        <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]" data-testid="arrangement-total">
          {playhead ? `${t('song.barLabel')} ${playhead.barInSong + 1} / ${total} · ` : ''}
          {t('song.total')}: {total} {t('song.barsUnit')}
        </span>
      </div>

      <ol className="flex flex-wrap items-stretch gap-2">
        {arrangement.map((item, index) => {
          const section = sections.find((s) => s.id === item.sectionId);
          const playing = playhead?.itemIndex === index;
          return (
            <li
              key={`${index}-${item.sectionId}`}
              data-playing={playing || undefined}
              className={[
                'flex flex-col gap-1.5 rounded-[6px] border bg-[var(--surface)] p-2',
                playing
                  ? 'border-[var(--cyan)] shadow-[0_0_8px_rgba(0,255,200,0.25)]'
                  : item.sectionId === activeSectionId
                    ? 'border-[var(--border-active)]'
                    : 'border-[var(--border)]',
              ].join(' ')}
            >
              <select
                aria-label={`${t('song.blockSection')} ${index + 1}`}
                value={item.sectionId}
                onChange={(event) => setArrangementSection(index, event.target.value)}
                className="h-6 rounded-[4px] border border-[var(--border)] bg-[var(--surface2)] px-1 text-[11px] text-[var(--text)]"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={smallButton}
                  aria-label={`${t('song.repeat')} −, ${section?.name ?? ''} ${index + 1}`}
                  disabled={item.repeat <= MIN_REPEAT}
                  onClick={() => setArrangementRepeat(index, item.repeat - 1)}
                >
                  −
                </button>
                <span className="w-9 text-center text-[11px] text-[var(--text)]" aria-label={`${t('song.repeat')} ×${item.repeat}`}>
                  ×{item.repeat}
                </span>
                <button
                  type="button"
                  className={smallButton}
                  aria-label={`${t('song.repeat')} +, ${section?.name ?? ''} ${index + 1}`}
                  disabled={item.repeat >= MAX_REPEAT}
                  onClick={() => setArrangementRepeat(index, item.repeat + 1)}
                >
                  +
                </button>
              </div>

              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  className={smallButton}
                  aria-label={`${t('song.moveEarlier')} ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => moveArrangementItem(index, index - 1)}
                >
                  ◀
                </button>
                <button
                  type="button"
                  className={smallButton}
                  aria-label={`${t('song.moveLater')} ${index + 1}`}
                  disabled={index === arrangement.length - 1}
                  onClick={() => moveArrangementItem(index, index + 1)}
                >
                  ▶
                </button>
                <button
                  type="button"
                  className={`${smallButton} hover:!border-[var(--red)] hover:!text-[var(--red)]`}
                  aria-label={`${t('song.removeBlock')} ${index + 1}`}
                  disabled={arrangement.length <= 1}
                  onClick={() => removeArrangementItem(index)}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}

        <li className="flex items-center">
          <button
            type="button"
            className="h-7 rounded-[4px] border border-dashed border-[var(--border)] bg-transparent px-3 text-[11px] text-[var(--text-dim)] transition-all hover:border-[var(--border-active)] hover:text-[var(--text)]"
            onClick={() => addArrangementItem(activeSectionId)}
          >
            + {t('song.addBlock')}
          </button>
        </li>
      </ol>
    </div>
  );
}
