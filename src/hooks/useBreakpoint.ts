'use client';

import { useEffect, useState } from 'react';
import { dndBreakpoints, type BreakpointKey } from '@/design-system/tokens';

function getBreakpoint(width: number): BreakpointKey {
  if (width >= dndBreakpoints.xl) return 'xl';
  if (width >= dndBreakpoints.lg) return 'lg';
  if (width >= dndBreakpoints.md) return 'md';
  if (width >= dndBreakpoints.sm) return 'sm';
  return 'xs';
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<BreakpointKey>('xs');
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setWidth(w);
      setBreakpoint(getBreakpoint(w));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return {
    breakpoint,
    width,
    isMobile: breakpoint === 'xs' || breakpoint === 'sm',
    isMdUp: width >= dndBreakpoints.md,
    isLgUp: width >= dndBreakpoints.lg,
    isXlUp: width >= dndBreakpoints.xl,
  };
}
