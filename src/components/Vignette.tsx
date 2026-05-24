'use client';

import { useGameStateContext } from '@/contexts/GameStateContext';
import { cn } from '@/lib/utils';
import React from 'react';

export type VignetteMode = 'hp' | 'subtle';

export interface VignetteProps {
  /** `hp` reage aos PV; `subtle` vinheta fixa para hub/shell. */
  mode?: VignetteMode;
  className?: string;
}

const Vignette: React.FC<VignetteProps> = ({ mode = 'hp', className }) => {
  if (mode === 'subtle') {
    return (
      <div
        className={cn('pointer-events-none fixed inset-0 z-[100]', className)}
        style={{ boxShadow: 'inset 0 0 120px 40px rgba(0, 0, 0, 0.72)' }}
        aria-hidden
      />
    );
  }

  const { character } = useGameStateContext();

  if (!character?.hp || character.hp.max <= 0) {
    return null;
  }

  const hpPercentage = (character.hp.current / character.hp.max) * 100;

  let vignetteClass = '';
  if (hpPercentage <= 25) {
    vignetteClass = 'vignette-danger';
  } else if (hpPercentage <= 50) {
    vignetteClass = 'vignette-warning';
  }

  if (!vignetteClass) {
    return (
      <div
        className={cn('pointer-events-none fixed inset-0 z-[100]', className)}
        style={{ boxShadow: 'inset 0 0 80px 24px rgba(0, 0, 0, 0.35)' }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-[100] transition-all duration-1000',
        vignetteClass,
        className
      )}
      aria-hidden
    />
  );
};

export default Vignette;
