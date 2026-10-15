import { apiClient } from './apiClient';
import type { AiAccessStatus } from '@/types/aiAccess';

export async function completeOnboarding(): Promise<void> {
  await apiClient('/v2/users/me/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export type { AiAccessStatus };
