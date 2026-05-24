import { apiClient } from '@/services/apiClient';
import type { CombatState } from '@/types';

export type CastRole = 'pc' | 'npc' | 'ally' | 'enemy';
export type CastVitals = 'alive' | 'dead' | 'unconscious' | 'unknown';

export interface SessionCastMemberDto {
  id: number;
  sessionId: number;
  ownerUserId: number;
  characterId: number | null;
  displayName: string;
  role: CastRole;
  vitals: CastVitals;
  sheetSnapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  visibleToParty: boolean;
}

export interface WorldEchoDto {
  name: string;
  kind: 'other_player';
  regionSlug?: string | null;
  note: string;
}

export interface SessionCastListResponse {
  cast: SessionCastMemberDto[];
  worldEchoes: WorldEchoDto[];
}

export async function fetchSessionCast(sessionId: number): Promise<SessionCastListResponse> {
  return apiClient<SessionCastListResponse>(`/sessoes/${sessionId}/cast`);
}

export async function syncSessionCast(
  sessionId: number,
  combatState?: CombatState | null,
): Promise<SessionCastListResponse> {
  return apiClient<SessionCastListResponse>(`/sessoes/${sessionId}/cast/sync`, {
    method: 'POST',
    body: JSON.stringify({ combatState: combatState ?? null }),
  });
}

export async function updateCastMember(
  sessionId: number,
  memberId: number,
  patch: Partial<{ displayName: string; role: CastRole; vitals: CastVitals }>,
): Promise<SessionCastMemberDto> {
  return apiClient<SessionCastMemberDto>(`/sessoes/${sessionId}/cast/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
