'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from '@lib/i18n';
import { stepVelocityLevel, type VelocityLevel } from '@lib/song';

const stepColors: Record<string, { bg: string; glow: string }> = {
  kick: { bg: '#00ffc8', glow: 'rgba(0,255,200,0.3)' },
  snare: { bg: '#ffaa00', glow: 'rgba(255,170,0,0.3)' },
  hihat: { bg: '#b482ff', glow: 'rgba(180,130,255,0.3)' },
  default: { bg: '#00ffc8', glow: 'rgba(0,255,200,0.3)' },
};

/** Altura y opacidad del relleno según la fuerza del golpe: se ve de un vistazo. */
const LEVEL_LOOK: Record<VelocityLevel, { height: string; opacity: number }> = {
  ghost: { height: '38%', opacity: 0.5 },
  normal: { height: '68%', opacity: 0.8 },
  accent: { height: '100%', opacity: 1 },
};

interface StepButtonProps {
  on: boolean;
  active: boolean;
  tag: string;
  /** Fuerza del paso; solo se usa si `on`. */
  level?: VelocityLevel;
  /** Posición legible, p. ej. "compás 2, paso 3", para lectores de pantalla. */
  position?: string;
  onClick: () => void;
  onLevelChange?: (level: VelocityLevel) => void;
}

/**
 * Un paso del grid. Clic activa/desactiva; con el paso activo, Mayús+clic recorre las
 * tres fuerzas (suave → normal → fuerte) y las flechas arriba/abajo suben o bajan una.
 * @see TASK-25 AC-3
 */
export function StepButton({ on, active, tag, level = 'accent', position, onClick, onLevelChange }: StepButtonProps) {
  const t = useTranslation();
  const color = stepColors[tag] ?? stepColors.default;
  const look = LEVEL_LOOK[level];

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey && on && onLevelChange) {
      onLevelChange(stepVelocityLevel(level, 1));
      return;
    }
    onClick();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!on || !onLevelChange) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const order: VelocityLevel[] = ['ghost', 'normal', 'accent'];
    const next = order[Math.min(2, Math.max(0, order.indexOf(level) + (event.key === 'ArrowUp' ? 1 : -1)))];
    if (next !== level) onLevelChange(next);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        'relative flex h-[26px] w-full items-end overflow-hidden rounded-[3px] border transition-all duration-[80ms]',
        'hover:bg-[rgba(255,255,255,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]',
        active ? 'outline outline-1 outline-offset-1 outline-[rgba(255,255,255,0.3)]' : '',
      ].join(' ')}
      style={{
        background: 'rgba(255,255,255,0.06)',
        borderColor: on ? 'transparent' : 'rgba(255,255,255,0.04)',
        boxShadow: on && level !== 'ghost' ? `0 0 6px ${color.glow}` : 'none',
        transform: on && active ? 'scaleY(1.08)' : 'scaleY(1)',
      }}
      aria-pressed={on}
      aria-label={`${t('step.toggleLabel')}${position ? ` ${position}` : ''}${on ? ` (${t(`step.${level}` as const)})` : ''}`}
      title={on ? t('step.velocityHint') : undefined}
      data-level={on ? level : undefined}
    >
      {on && (
        <span
          className="block w-full"
          style={{ height: look.height, opacity: look.opacity, background: color.bg }}
        />
      )}
    </button>
  );
}
