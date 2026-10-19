'use client';

import { Repeat } from 'lucide-react';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { useLoopSection } from '../hooks/usePracticeControls';

const base = 'flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] transition-colors';

/**
 * Botón para repetir en bucle la sección elegida, o volver a la canción completa.
 * Sonando, el cambio entra en el siguiente compás sin cortar el audio.
 * @see TASK-30 AC-1
 */
export function LoopSectionButton() {
  const t = useTranslation();
  const activeSectionId = useSessionStore((s) => s.activeSectionId);
  const loopSectionId = useSessionStore((s) => s.loopSectionId);
  const loopName = useSessionStore((s) => s.sections.find((section) => section.id === s.loopSectionId)?.name);
  const changeLoop = useLoopSection();

  const looping = loopSectionId !== null && loopName !== undefined;
  const onActive = looping && loopSectionId === activeSectionId;

  return (
    <div className="flex items-center gap-2" data-testid="loop-controls">
      <button
        type="button"
        aria-pressed={onActive}
        onClick={() => changeLoop(onActive ? null : activeSectionId)}
        title={t('practice.loopHint')}
        className={[
          base,
          onActive
            ? 'border-[var(--border-active)] bg-[rgba(0,255,200,0.1)] text-[var(--cyan)]'
            : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface3)]',
        ].join(' ')}
      >
        <Repeat size={12} strokeWidth={2} aria-hidden className={onActive ? '' : 'text-[var(--text-dim)]'} />
        {onActive ? t('practice.loopStop') : t('practice.loopThis')}
      </button>
      {looping && !onActive && (
        <button
          type="button"
          onClick={() => changeLoop(null)}
          className={`${base} border-[var(--border-active)] bg-[rgba(0,255,200,0.06)] text-[var(--cyan)] hover:bg-[rgba(0,255,200,0.12)]`}
        >
          <Repeat size={12} strokeWidth={2} aria-hidden />
          {t('practice.loopingOther')} “{loopName}” · {t('practice.loopStop')}
        </button>
      )}
    </div>
  );
}
