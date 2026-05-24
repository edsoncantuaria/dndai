'use client';

import { createContext, useContext } from 'react';

export type NarrativeLogVariant = 'legacy' | 'v2';

const NarrativeLogVariantContext = createContext<NarrativeLogVariant>('legacy');

export function NarrativeLogVariantProvider({
  variant,
  children,
}: {
  variant: NarrativeLogVariant;
  children: React.ReactNode;
}) {
  return (
    <NarrativeLogVariantContext.Provider value={variant}>{children}</NarrativeLogVariantContext.Provider>
  );
}

export function useNarrativeLogVariant(): NarrativeLogVariant {
  return useContext(NarrativeLogVariantContext);
}
