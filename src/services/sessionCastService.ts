import { apiClient } from '@/services/apiClient';
import type { CombatState } from '@/types';

export type CastRole = 'pc' | 'npc' | 'ally' | 'enemy';
export type CastVitals = 'alive' | 'dead' | 'unconscious' | 'unknown';

export interface SessionCastMemberDto {
  id: string | number;
  sessionId: number;
  displayName: string;
  role: CastRole;
  vitals: CastVitals;
  source?: string;
  hp?: number;
  hpMax?: number;
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
  const res = await apiClient<{ sessionId: number; members: SessionCastMemberDto[] }>(
    `/v2/sessions/${sessionId}/cast`,
  );
  return {
    cast: res.members ?? [],
    worldEchoes: [],
  };
}

export async function syncSessionCast(
  sessionId: number,
  _combatState?: CombatState | null,
): Promise<SessionCastListResponse> {
  return fetchSessionCast(sessionId);
}

export async function updateCastMember(
  sessionId: number,
  memberId: string | number,
  patch: Partial<{ displayName: string; role: CastRole; vitals: CastVitals }>,
): Promise<SessionCastMemberDto> {
  return apiClient<SessionCastMemberDto>(`/v2/sessions/${sessionId}/cast/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
