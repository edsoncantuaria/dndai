// src/rules/index.ts
import { getResourceByIndex } from './catalog';

export type RuleCheckStatus = 'accepted' | 'rejected' | 'needs_roll';

export interface AttackIntentPayload {
  attackerClass: string;
  weaponIndex: string;
}

export interface RuleCheckResult {
  status: RuleCheckStatus;
  reason?: string;
  data?: Record<string, any>;
}

export function validateWeaponExists(payload: AttackIntentPayload): RuleCheckResult {
  const weapon = getResourceByIndex('equipment', payload.weaponIndex);
  if (!weapon) {
    return { status: 'rejected', reason: `Arma ${payload.weaponIndex} não encontrada no catálogo.` };
  }
  return { status: 'accepted', data: { weapon } };
}
