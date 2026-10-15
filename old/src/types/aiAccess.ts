export type AiBillingMode = 'byok' | 'platform_credits' | 'unavailable';

export type AiAccessStatus = {
  engine: 'gemini' | 'penai';
  billingMode: AiBillingMode;
  canInfer: boolean;
  hasByok: boolean;
  platformKeyConfigured: boolean;
  creditsRemaining: number;
  creditsUsed: number;
  platformBillingEnabled: boolean;
  includedCreditsPerSignup: number;
};
