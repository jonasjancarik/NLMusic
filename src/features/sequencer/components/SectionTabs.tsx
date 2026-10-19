'use client';

import { useState } from 'react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { MAX_BARS, MIN_BARS } from '@lib/song';
import { LoopSectionButton } from '@features/practice';

interface SectionTabsProps {
  /** Sección que está sonando ahora, para marcarla en su pestaña. */
  playingSectionId?: string | null;
}

const iconButton =
  'h-7 rounded-[4px] border border-[var(--border)] bg-[var(--surface2)] px-2 text-[11px] text-[var(--text)] ' +
  'transition-all hover:border-[var(--border-active)] disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Pestañas de sección sobre el grid: elegir, añadir, renombrar, duplicar y eliminar, y la
 * duración en compases de la sección elegida. Solo edita la canción en el store; no llama
 * al LLM (BR-008) ni toca el transporte (BR-001).
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

  const active = sections.find((section) => section.id === activeSectionId) ?? sections[0];

  const startRename = () => {
    setDraftName(active.name);
    setRenamingId(active.id);
  };
  const commitRename = () => {
    if (renamingId) renameSection(renamingId, draftName);
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col gap-2 px-5 pt-3 pb-2" data-testid="section-tabs">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label={t('song.sectionsLabel')} className="flex flex-wrap items-center gap-1.5">
          {sections.map((section) => {
            const selected = section.id === active.id;
            const playing = section.id === playingSectionId;
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
                className="h-7 w-32 rounded-[4px] border border-[var(--border-active)] bg-[var(--surface2)] px-2 text-[11px] text-[var(--text)] outline-none"
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
                  'flex h-7 items-center gap-1.5 rounded-[4px] border px-3 text-[11px] transition-all',
                  selected
                    ? 'border-[var(--border-active)] bg-[rgba(0,255,200,0.08)] text-[var(--cyan)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--text-dim)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {playing && (
                  <span
                    aria-label={t('song.playingNow')}
                    className="inline-block h-[6px] w-[6px] rounded-full bg-[var(--cyan)] shadow-[0_0_6px_rgba(0,255,200,0.8)]"
                  />
                )}
                {section.name}
              </button>
            );
          })}
        </div>
        <button type="button" className={iconButton} onClick={() => addSection(`${t('song.defaultSectionName')} ${sections.length + 1}`)}>
          + {t('song.addSection')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={iconButton} onClick={startRename}>
          {t('song.rename')}
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={() => duplicateSection(active.id, `${active.name} (${t('song.copySuffix')})`)}
        >
          {t('song.duplicate')}
        </button>
        {/* BR-007: destructivo e irreversible, sin confirmación; la última sección no se puede eliminar */}
        <button
          type="button"
          className={`${iconButton} hover:!border-[var(--red)] hover:!text-[var(--red)]`}
          disabled={sections.length <= 1}
          onClick={() => deleteSection(active.id)}
        >
          {t('song.delete')}
        </button>

        <LoopSectionButton />

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{t('song.bars')}</span>
          <button
            type="button"
            className={iconButton}
            aria-label={t('song.fewerBars')}
            disabled={active.bars <= MIN_BARS}
            onClick={() => setSectionBars(active.id, active.bars - 1)}
          >
            −
          </button>
          <span className="w-6 text-center text-[12px] text-[var(--text)]" data-testid="section-bars">
            {active.bars}
          </span>
          <button
            type="button"
            className={iconButton}
            aria-label={t('song.moreBars')}
            disabled={active.bars >= MAX_BARS}
            onClick={() => setSectionBars(active.id, active.bars + 1)}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
