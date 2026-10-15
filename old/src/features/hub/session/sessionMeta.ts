import type { SessaoIA } from '@/types';

type SessionCharacter = SessaoIA['character'] & {
  worldState?: { currentRegion?: string; timeOfDay?: string };
  currentRegion?: string;
};

export function getSessionMeta(session: SessaoIA) {
  const char = session.character as SessionCharacter | undefined;
  const region =
    char?.worldState?.currentRegion ?? char?.currentRegion ?? null;
  return {
    region,
    level: char?.level ?? null,
    className: char?.characterClass ?? null,
    heroName: char?.name ?? 'Herói desconhecido',
  };
}
