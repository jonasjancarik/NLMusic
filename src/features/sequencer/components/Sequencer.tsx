'use client';

import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { velocityLevel } from '@lib/song';
import { StepButton } from './StepButton';

interface SequencerProps {
  trackId: string;
  steps: (0 | 1)[];
  velocity?: number[];
  tag: string;
  stepsPerBar: number;
  /** Compás y paso que suenan ahora en esta sección, o null si no suena. */
  playhead: { bar: number; step: number } | null;
}

/**
 * Fila de pasos de una pista dividida en compases: cada compás es un bloque con su línea
 * de compás a la izquierda. Si no caben, la fila se desplaza horizontalmente.
 * @see TASK-25 AC-2
 */
export function Sequencer({ trackId, steps, velocity, tag, stepsPerBar, playhead }: SequencerProps) {
  const t = useTranslation();
  const toggleStep = useSessionStore((s) => s.toggleStep);
  const setStepVelocity = useSessionStore((s) => s.setStepVelocity);
  const bars = Math.max(1, Math.ceil(steps.length / stepsPerBar));
  const groupSize = Math.max(1, stepsPerBar / 4);

  return (
    <div className="flex overflow-x-auto pb-1">
      {Array.from({ length: bars }, (_, bar) => (
        <div
          key={`${trackId}-bar-${bar}`}
          data-bar={bar}
          className={[
            'flex min-w-[272px] flex-1 items-center',
            bar > 0 ? 'ml-[6px] border-l border-[rgba(255,255,255,0.18)] pl-[6px]' : '',
          ].join(' ')}
        >
          {Array.from({ length: stepsPerBar }, (_, local) => {
            const index = bar * stepsPerBar + local;
            const on = steps[index] === 1;
            return (
              <div
                key={`${trackId}-${index}`}
                className={local > 0 && local % groupSize === 0 ? 'ml-[6px] flex-1' : 'flex-1'}
              >
                <StepButton
                  on={on}
                  active={playhead?.bar === bar && playhead.step === local}
                  tag={tag}
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
