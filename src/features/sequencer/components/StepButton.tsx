'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from '@lib/i18n';
import { stepVelocityLevel, type VelocityLevel } from '@lib/song';
import { withAlpha } from '../colors';

/** Altura y opacidad del relleno según la fuerza del golpe: se ve de un vistazo. */
const LEVEL_LOOK: Record<VelocityLevel, { height: string; opacity: number }> = {
  ghost: { height: '34%', opacity: 0.55 },
  normal: { height: '66%', opacity: 0.85 },
  accent: { height: '100%', opacity: 1 },
};

interface StepButtonProps {
  on: boolean;
  active: boolean;
  /** Color de la voz de la pista (ver `trackColor`). */
  color: string;
  /** Primer paso de un tiempo: se marca un poco más claro para leer el compás. */
  downbeat?: boolean;
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
export function StepButton({ on, active, color, downbeat = false, level = 'accent', position, onClick, onLevelChange }: StepButtonProps) {
  const t = useTranslation();
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

  const idle = active ? 'rgba(255,255,255,0.16)' : downbeat ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.04)';

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        'relative flex h-[34px] w-full items-end overflow-hidden rounded-[5px] transition-[background,box-shadow,transform] duration-75',
        'hover:brightness-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--cyan)]',
      ].join(' ')}
      style={{
        background: on ? withAlpha(color, 0.14) : idle,
        boxShadow: on
          ? `inset 0 0 0 1px ${withAlpha(color, 0.35)}${active ? `, 0 0 14px ${withAlpha(color, 0.7)}` : level === 'accent' ? `, 0 0 8px ${withAlpha(color, 0.18)}` : ''}`
          : active
            ? 'inset 0 0 0 1px rgba(255,255,255,0.25)'
            : 'none',
        transform: on && active ? 'scale(1.06)' : undefined,
      }}
      aria-pressed={on}
      aria-label={`${t('step.toggleLabel')}${position ? ` ${position}` : ''}${on ? ` (${t(`step.${level}` as const)})` : ''}`}
      title={on ? t('step.velocityHint') : undefined}
      data-level={on ? level : undefined}
    >
      {on && (
        <span
          className="block w-full rounded-[4px]"
          style={{
            height: look.height,
            opacity: active ? 1 : look.opacity,
            background: `linear-gradient(180deg, ${color} 0%, ${withAlpha(color, 0.8)} 100%)`,
          }}
        />
      )}
    </button>
  );
}
