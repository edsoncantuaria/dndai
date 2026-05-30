import type { AiAccessStatus } from '@/types/aiAccess';

/** Heurística alinhada ao backend (Google AI Studio). */
export function isLikelyGeminiKey(key: string): boolean {
  const t = key.trim();
  return t.startsWith('AIza') && t.length >= 20;
}

/**
 * O jogador pode narrar neste dispositivo?
 * Confia no status do servidor (login) + chave local ou créditos.
 */
export function clientCanInfer(
  aiAccess: AiAccessStatus | null | undefined,
  userKey?: string | null,
): boolean {
  const key = userKey?.trim() ?? '';
  if (isLikelyGeminiKey(key)) return true;

  if (aiAccess?.platformBillingEnabled && (aiAccess.creditsRemaining ?? 0) > 0) {
    return true;
  }

  if (aiAccess?.canInfer) return true;

  return false;
}

export function aiKeyRequiredMessage(aiAccess?: AiAccessStatus | null): string {
  if (aiAccess?.platformBillingEnabled && (aiAccess.creditsRemaining ?? 0) <= 0) {
    return 'Seus créditos de narração acabaram. Adicione sua chave Gemini (BYOK) para continuar jogando.';
  }
  return 'O Mestre precisa da sua chave Gemini (Google AI Studio). Ela fica só neste aparelho — não enviamos para o servidor.';
}

export function isInferenceKeyError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('chave gemini') ||
    m.includes('chave openrouter') ||
    m.includes('byok') ||
    m.includes('créditos inclusos') ||
    m.includes('créditos da plataforma') ||
    m.includes('servidor de ia indisponível') ||
    m.includes('chave da api') ||
    m.includes('api key') ||
    m.includes('inferência') ||
    m.includes('inference')
  );
}

export const AI_KEY_REQUIRED_EVENT = 'game-ai-key-required';

export function dispatchAiKeyRequired(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AI_KEY_REQUIRED_EVENT));
}
