import type { HubIntent } from '@/contexts/HubIntentContext';

const STORAGE_KEY = 'dndai_hub_intent';

export function saveHubIntent(intent: HubIntent): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export function consumeHubIntent(): HubIntent | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HubIntent;
  } catch {
    return null;
  }
}
