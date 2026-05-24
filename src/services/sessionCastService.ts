import { apiClient } from '@/services/apiClient';

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

export async function fetchSessionCast(sessionId: number): Promise<SessionCastMemberDto[]> {
  return apiClient<SessionCastMemberDto[]>(`/sessoes/${sessionId}/cast`);
}

export async function addCastMember(
  sessionId: number,
  body: {
    displayName: string;
    role: CastRole;
    vitals?: CastVitals;
    characterId?: number | null;
  },
): Promise<SessionCastMemberDto> {
  return apiClient<SessionCastMemberDto>(`/sessoes/${sessionId}/cast`, {
    method: 'POST',
    body: JSON.stringify(body),
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

export async function deleteCastMember(sessionId: number, memberId: number): Promise<void> {
  await apiClient<void>(`/sessoes/${sessionId}/cast/${memberId}`, { method: 'DELETE' });
}
