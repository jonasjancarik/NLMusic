'use client';

import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { useLoopSection } from '../hooks/usePracticeControls';

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
          'h-7 rounded-[4px] border px-2 text-[11px] transition-all',
          onActive
            ? 'border-[var(--border-active)] bg-[rgba(0,255,200,0.08)] text-[var(--cyan)]'
            : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] hover:border-[var(--border-active)]',
        ].join(' ')}
      >
        ↻ {onActive ? t('practice.loopStop') : t('practice.loopThis')}
      </button>
      {looping && !onActive && (
        <button
          type="button"
          onClick={() => changeLoop(null)}
          className="h-7 rounded-[4px] border border-[var(--border)] bg-[var(--surface2)] px-2 text-[11px] text-[var(--cyan)] hover:border-[var(--border-active)]"
        >
          {t('practice.loopingOther')} “{loopName}” · {t('practice.loopStop')}
        </button>
      )}
    </div>
  );
}
