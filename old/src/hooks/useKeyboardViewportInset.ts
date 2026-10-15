'use client';

import { useEffect, useState } from 'react';

/**
 * Estima a altura do teclado virtual (iOS/Android) via Visual Viewport API
 * para empurrar a action bar acima do teclado.
 */
export function useKeyboardViewportInset() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBottomInset(gap > 50 ? gap : 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return bottomInset;
}
