'use client';

import { useState } from 'react';
import { Copy, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { MAX_BARS, MIN_BARS } from '@lib/song';
import { LoopSectionButton } from '@features/practice';
import { sectionColor, withAlpha } from '../colors';

interface SectionTabsProps {
  /** Sección que está sonando ahora, para marcarla en su pestaña. */
  playingSectionId?: string | null;
}

const toolButton =
  'flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-2.5 text-[12px] text-[var(--text)] ' +
  'transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface3)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--surface2)]';

const stepper =
  'flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--text-dim)] transition-colors hover:bg-[var(--surface3)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * Cabecera del editor de secciones: pestañas para elegir la sección que muestra el grid y
 * una barra con lo que se puede hacer con ella (renombrar, duración en compases, duplicar,
 * repetir en bucle, eliminar). Solo edita la canción en el store; no llama al LLM (BR-008)
 * ni toca el transporte (BR-001).
 * @see TASK-25 AC-1
 * @see BR-007 Eliminar una sección es destructivo e irreversible
 */
export function SectionTabs({ playingSectionId = null }: SectionTabsProps) {
  const t = useTranslation();
  const sections = useSessionStore((s) => s.sections);
  const activeSectionId = useSessionStore((s) => s.activeSectionId);
  const setActiveSection = useSessionStore((s) => s.setActiveSection);
  const addSection = useSessionStore((s) => s.addSection);
  const duplicateSection = useSessionStore((s) => s.duplicateSection);
  const renameSection = useSessionStore((s) => s.renameSection);
  const deleteSection = useSessionStore((s) => s.deleteSection);
  const setSectionBars = useSessionStore((s) => s.setSectionBars);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSectionId));
  const active = sections[activeIndex];
  const activeColor = sectionColor(activeIndex);

  const startRename = () => {
    setDraftName(active.name);
    setRenamingId(active.id);
  };
  const commitRename = () => {
    if (renamingId) renameSection(renamingId, draftName);
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 pb-3 pt-3" data-testid="section-tabs">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label={t('song.sectionsLabel')} className="flex flex-wrap items-center gap-1">
          {sections.map((section, index) => {
            const selected = section.id === active.id;
            const playing = section.id === playingSectionId;
            const color = sectionColor(index);
            return renamingId === section.id ? (
              <input
                key={section.id}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                aria-label={t('song.renameLabel')}
                value={draftName}
                maxLength={32}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename();
                  if (event.key === 'Escape') setRenamingId(null);
                }}
                className="h-8 w-36 rounded-[8px] border bg-[var(--surface2)] px-2.5 text-[13px] text-[var(--text)] outline-none"
                style={{ borderColor: color }}
              />
            ) : (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveSection(section.id)}
                onDoubleClick={() => {
                  setActiveSection(section.id);
                  setDraftName(section.name);
                  setRenamingId(section.id);
                }}
                className={[
                  'relative flex h-8 items-center gap-2 rounded-[8px] px-3 text-[13px] transition-colors',
                  selected ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-dim)] hover:bg-[var(--surface2)] hover:text-[var(--text)]',
                ].join(' ')}
                style={selected ? { background: withAlpha(color, 0.13), boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.45)}` } : undefined}
              >
                <span
                  aria-hidden={!playing}
                  aria-label={playing ? t('song.playingNow') : undefined}
                  className={['inline-block h-2 w-2 rounded-full', playing ? 'animate-pulse-dot' : ''].join(' ')}
                  style={{ background: color, boxShadow: playing ? `0 0 8px ${color}` : undefined }}
                />
                {section.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="flex h-8 items-center gap-1 rounded-[8px] px-2.5 text-[12px] text-[var(--text-dim)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
          onClick={() => addSection(`${t('song.defaultSectionName')} ${sections.length + 1}`)}
        >
          <Plus size={13} strokeWidth={2} aria-hidden />
          {t('song.addSection')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={toolButton} onClick={startRename}>
          <Pencil size={12} strokeWidth={2} aria-hidden className="text-[var(--text-dim)]" />
          {t('song.rename')}
        </button>

        <div className="flex h-8 items-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] pl-2.5 pr-1">
          <span className="mr-1 text-[12px] text-[var(--text-dim)]">{t('song.length')}</span>
          <button
            type="button"
            className={stepper}
            aria-label={t('song.fewerBars')}
            disabled={active.bars <= MIN_BARS}
            onClick={() => setSectionBars(active.id, active.bars - 1)}
          >
            <Minus size={12} strokeWidth={2} />
          </button>
          <span className="tabular min-w-[18px] text-center text-[13px] font-semibold" style={{ color: activeColor }} data-testid="section-bars">
            {active.bars}
          </span>
          <button
            type="button"
            className={stepper}
            aria-label={t('song.moreBars')}
            disabled={active.bars >= MAX_BARS}
            onClick={() => setSectionBars(active.id, active.bars + 1)}
          >
            <Plus size={12} strokeWidth={2} />
          </button>
          <span className="pr-1.5 text-[12px] text-[var(--text-dim)]">{active.bars === 1 ? t('song.barUnit') : t('song.barsUnit')}</span>
        </div>

        <button
          type="button"
          className={toolButton}
          onClick={() => duplicateSection(active.id, `${active.name} (${t('song.copySuffix')})`)}
        >
          <Copy size={12} strokeWidth={2} aria-hidden className="text-[var(--text-dim)]" />
          {t('song.duplicate')}
        </button>

        <LoopSectionButton />

        {/* BR-007: destructivo e irreversible, sin confirmación; la última sección no se puede eliminar */}
        <button
          type="button"
          className={`${toolButton} ml-auto hover:!border-[rgba(255,68,102,0.45)] hover:!bg-[rgba(255,68,102,0.08)] hover:!text-[var(--red)]`}
          disabled={sections.length <= 1}
          onClick={() => deleteSection(active.id)}
        >
          <Trash2 size={12} strokeWidth={2} aria-hidden />
          {t('song.delete')}
        </button>
      </div>
    </div>
  );
}
