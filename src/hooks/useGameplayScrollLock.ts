'use client';

import { useEffect } from 'react';

/** Evita pull-to-refresh e bounce no body durante a sessão de jogo (mobile). */
export function useGameplayScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add('overscroll-contain', 'gameplay-active');
    return () => {
      document.body.classList.remove('overscroll-contain', 'gameplay-active');
    };
  }, [active]);
}
