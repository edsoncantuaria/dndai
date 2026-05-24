/** Sessão UI v2: usuário já passou pela landing cinematográfica. */
export const HUB_SESSION_KEY = 'dndai_hub_v2_entered';

/** Para onde o próximo "Voltar" do cofre/lista deve ir. */
export const HUB_BACK_TARGET_KEY = 'dndai_hub_back_target';

export type HubBackTarget = 'landing' | 'mesa';

export function markHubSessionEntered(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(HUB_SESSION_KEY, '1');
}

export function clearHubSessionEntered(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(HUB_SESSION_KEY);
  sessionStorage.removeItem(HUB_BACK_TARGET_KEY);
}

export function isHubSessionEntered(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(HUB_SESSION_KEY) === '1';
}

export function setHubBackTarget(target: HubBackTarget): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(HUB_BACK_TARGET_KEY, target);
}

export function getHubBackTarget(): HubBackTarget {
  if (typeof sessionStorage === 'undefined') return 'mesa';
  const v = sessionStorage.getItem(HUB_BACK_TARGET_KEY);
  return v === 'landing' ? 'landing' : 'mesa';
}
