'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { clearHubSessionEntered } from '@/lib/hubSession';

interface HubNavigationContextValue {
  /** Volta à HubLanding (fora do GameContainer). */
  returnToHubLanding: () => void;
}

const HubNavigationContext = createContext<HubNavigationContextValue | null>(null);

export function HubNavigationProvider({
  onReturnToLanding,
  children,
}: {
  onReturnToLanding: () => void;
  children: React.ReactNode;
}) {
  const returnToHubLanding = useCallback(() => {
    clearHubSessionEntered();
    onReturnToLanding();
  }, [onReturnToLanding]);

  const value = useMemo(() => ({ returnToHubLanding }), [returnToHubLanding]);

  return (
    <HubNavigationContext.Provider value={value}>{children}</HubNavigationContext.Provider>
  );
}

export function useHubNavigation(): HubNavigationContextValue | null {
  return useContext(HubNavigationContext);
}
