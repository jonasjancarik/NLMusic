'use client';

import { useSessionStore } from '@store/sessionStore';
import { effectiveBpm } from '@store/practiceSelectors';
import { useTranslation, type TranslationKey } from '@lib/i18n';
import {
  COUNT_IN_OPTIONS,
  METRONOME_MODES,
  trainerBpmSequence,
  type CountInBars,
  type DropPart,
  type MetronomeMode,
} from '@lib/practice';

const field =
  'h-7 rounded-[4px] border border-[var(--border)] bg-[var(--surface2)] px-2 text-[11px] text-[var(--text)] outline-none focus:border-[var(--border-active)]';
const label = 'text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]';

const DROP_LABELS: Record<DropPart, { name: TranslationKey; title: TranslationKey }> = {
  kick: { name: 'practice.dropKick', title: 'practice.dropKickHint' },
  snare: { name: 'practice.dropSnare', title: 'practice.dropSnareHint' },
  hihat: { name: 'practice.dropHihat', title: 'practice.dropHihatHint' },
};

const METRONOME_LABELS: Record<MetronomeMode, TranslationKey> = {
  off: 'practice.metronomeOff',
  quarter: 'practice.metronomeQuarter',
  eighth: 'practice.metronomeEighth',
};

/**
 * Herramientas para practicar con un instrumento: quitar partes de la batería, cuenta atrás,
 * metrónomo y entrenador de tempo. Todo afecta solo a lo que suena; la canción (y su MIDI)
 * no cambia. El bucle de sección está junto a las pestañas de sección.
 * @see TASK-30
 */
export function PracticePanel() {
  const t = useTranslation();
  const droppedParts = useSessionStore((s) => s.droppedParts);
  const toggleDroppedPart = useSessionStore((s) => s.toggleDroppedPart);
  const countInBars = useSessionStore((s) => s.countInBars);
  const setCountInBars = useSessionStore((s) => s.setCountInBars);
  const metronomeMode = useSessionStore((s) => s.metronomeMode);
  const setMetronomeMode = useSessionStore((s) => s.setMetronomeMode);
  const metronomeVolume = useSessionStore((s) => s.metronomeVolume);
  const setMetronomeVolume = useSessionStore((s) => s.setMetronomeVolume);
  const trainer = useSessionStore((s) => s.tempoTrainer);
  const setTempoTrainer = useSessionStore((s) => s.setTempoTrainer);
  const isPlaying = useSessionStore((s) => s.isPlaying);
  const currentBpm = useSessionStore(effectiveBpm);

  const numberField = (key: 'startBpm' | 'endBpm' | 'stepBpm' | 'everyLoops', text: TranslationKey) => (
    <label className="flex items-center gap-1.5">
      <span className={label}>{t(text)}</span>
      <input
        type="number"
        className={`${field} w-16`}
        value={trainer[key]}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value)) setTempoTrainer({ [key]: value });
        }}
      />
    </label>
  );

  return (
    <details className="mx-5 mb-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)]" data-testid="practice-panel">
      <summary className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
        {t('practice.title')}
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={label}>{t('practice.dropTitle')}</span>
          {(Object.keys(DROP_LABELS) as DropPart[]).map((part) => {
            const on = droppedParts.includes(part);
            return (
              <button
                key={part}
                type="button"
                aria-pressed={on}
                title={t(DROP_LABELS[part].title)}
                onClick={() => toggleDroppedPart(part)}
                className={[
                  'h-7 rounded-[4px] border px-2 text-[11px] transition-all',
                  on
                    ? 'border-[var(--amber)] bg-[rgba(255,180,0,0.1)] text-[var(--amber)]'
                    : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] hover:border-[var(--border-active)]',
                ].join(' ')}
              >
                {on ? '✕ ' : ''}
                {t(DROP_LABELS[part].name)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5">
            <span className={label}>{t('practice.countIn')}</span>
            <select
              className={field}
              value={countInBars}
              onChange={(event) => setCountInBars(Number(event.target.value) as CountInBars)}
            >
              {COUNT_IN_OPTIONS.map((bars) => (
                <option key={bars} value={bars}>
                  {bars === 0 ? t('practice.countInOff') : `${bars} ${bars === 1 ? t('practice.barOne') : t('practice.barMany')}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span className={label}>{t('practice.metronome')}</span>
            <select
              className={field}
              value={metronomeMode}
              onChange={(event) => setMetronomeMode(event.target.value as MetronomeMode)}
            >
              {METRONOME_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(METRONOME_LABELS[mode])}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span className={label}>{t('practice.metronomeVolume')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={metronomeVolume}
              disabled={metronomeMode === 'off'}
              aria-label={t('practice.metronomeVolume')}
              onChange={(event) => setMetronomeVolume(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="text-[10px] text-[var(--text-dim)]">{t('practice.clickNote')}</p>

        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trainer.enabled}
              onChange={(event) => setTempoTrainer({ enabled: event.target.checked })}
            />
            <span className="text-[11px] text-[var(--text)]">{t('practice.trainer')}</span>
            {trainer.enabled && isPlaying && (
              <span className="text-[11px] text-[var(--cyan)]" data-testid="trainer-current-bpm">
                {currentBpm} BPM
              </span>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {numberField('startBpm', 'practice.trainerStart')}
            {numberField('endBpm', 'practice.trainerEnd')}
            {numberField('stepBpm', 'practice.trainerStep')}
            {numberField('everyLoops', 'practice.trainerEvery')}
          </div>
          <p className="text-[10px] text-[var(--text-dim)]">
            {t('practice.trainerPlan')}: {trainerBpmSequence(trainer).join(' → ')} BPM
          </p>
        </div>
      </div>
    </details>
  );
}
