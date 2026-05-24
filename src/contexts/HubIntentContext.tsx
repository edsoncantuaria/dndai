'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type HubIntent =
  | { type: 'continue'; sessionId: number }
  | { type: 'session_list' }
  | { type: 'character_vault' }
  | { type: 'creating_character' }
  | { type: 'homebrew_store' }
  | { type: 'translation_studio' };

interface HubIntentContextValue {
  intent: HubIntent | null;
  setIntent: (intent: HubIntent | null) => void;
  clearIntent: () => void;
}

const HubIntentContext = createContext<HubIntentContextValue | null>(null);

export function HubIntentProvider({ children }: { children: React.ReactNode }) {
  const [intent, setIntent] = useState<HubIntent | null>(null);
  const clearIntent = useCallback(() => setIntent(null), []);

  const value = useMemo(
    () => ({ intent, setIntent, clearIntent }),
    [intent, clearIntent]
  );

  return <HubIntentContext.Provider value={value}>{children}</HubIntentContext.Provider>;
}

export function useHubIntent() {
  const ctx = useContext(HubIntentContext);
  if (!ctx) {
    throw new Error('useHubIntent must be used within HubIntentProvider');
  }
  return ctx;
}
