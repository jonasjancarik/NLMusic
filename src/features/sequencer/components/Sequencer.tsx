'use client';

import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { velocityLevel } from '@lib/song';
import { StepButton } from './StepButton';

interface SequencerProps {
  trackId: string;
  steps: (0 | 1)[];
  velocity?: number[];
  /** Color de la voz de la pista. */
  color: string;
  stepsPerBar: number;
  /** Compás y paso que suenan ahora en esta sección, o null si no suena. */
  playhead: { bar: number; step: number } | null;
}

/** Ancho mínimo de un compás; con muchos compases la zona del grid se desplaza en horizontal. */
export const BAR_MIN_WIDTH = 'min-w-[300px]';

/** Clases de un compás, compartidas con la regla de compases para que todo quede alineado. */
export function barClass(bar: number): string {
  return ['flex flex-1 items-center', BAR_MIN_WIDTH, bar > 0 ? 'ml-[10px] border-l border-[rgba(255,255,255,0.12)] pl-[10px]' : ''].join(' ');
}

/** Clases de la celda de un paso: un hueco extra separa cada tiempo. */
export function stepCellClass(local: number, groupSize: number): string {
  return local > 0 && local % groupSize === 0 ? 'ml-[6px] flex-1 pl-0' : 'ml-[3px] flex-1 first:ml-0';
}

/**
 * Fila de pasos de una pista dividida en compases: cada compás es un bloque con su línea
 * de compás a la izquierda y un hueco entre tiempos.
 * @see TASK-25 AC-2
 */
export function Sequencer({ trackId, steps, velocity, color, stepsPerBar, playhead }: SequencerProps) {
  const t = useTranslation();
  const toggleStep = useSessionStore((s) => s.toggleStep);
  const setStepVelocity = useSessionStore((s) => s.setStepVelocity);
  const bars = Math.max(1, Math.ceil(steps.length / stepsPerBar));
  const groupSize = Math.max(1, stepsPerBar / 4);

  return (
    <div className="flex flex-1">
      {Array.from({ length: bars }, (_, bar) => (
        <div key={`${trackId}-bar-${bar}`} data-bar={bar} className={barClass(bar)}>
          {Array.from({ length: stepsPerBar }, (_, local) => {
            const index = bar * stepsPerBar + local;
            const on = steps[index] === 1;
            return (
              <div key={`${trackId}-${index}`} className={stepCellClass(local, groupSize)}>
                <StepButton
                  on={on}
                  active={playhead?.bar === bar && playhead.step === local}
                  color={color}
                  downbeat={local % groupSize === 0}
                  level={velocityLevel(velocity?.[index])}
                  position={`${t('song.barLabel').toLowerCase()} ${bar + 1}, ${local + 1}`}
                  onClick={() => toggleStep(trackId, index)}
                  onLevelChange={(level) => setStepVelocity(trackId, index, level)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface BarRulerProps {
  bars: number;
  stepsPerBar: number;
  /** Compás y paso que suenan ahora en esta sección, o null. */
  playhead: { bar: number; step: number } | null;
}

/** Regla sobre el grid: número de compás y de tiempo, alineados con los pasos. */
export function BarRuler({ bars, stepsPerBar, playhead }: BarRulerProps) {
  const groupSize = Math.max(1, stepsPerBar / 4);
  return (
    <div className="flex flex-1" aria-hidden>
      {Array.from({ length: bars }, (_, bar) => (
        <div key={bar} data-ruler-bar={bar} className={`${barClass(bar)} !border-transparent`}>
          {Array.from({ length: stepsPerBar }, (_, local) => {
            const beatStart = local % groupSize === 0;
            const beat = local / groupSize + 1;
            const current = playhead?.bar === bar && Math.floor(playhead.step / groupSize) === beat - 1;
            return (
              <div key={local} className={`${stepCellClass(local, groupSize)} h-5`}>
                {beatStart && (
                  <span
                    className={[
                      'tabular block text-[10px] leading-5',
                      local === 0 ? 'font-semibold text-[var(--text-dim)]' : 'text-[var(--text-muted)]',
                      current ? '!text-[var(--cyan)]' : '',
                    ].join(' ')}
                  >
                    {local === 0 ? bar + 1 : `${bar + 1}.${beat}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
