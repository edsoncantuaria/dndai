import type { Character, SessaoIA } from '@/types';

/**
 * Encontra a sessão de jogo associada a um herói do cofre (template) ou ao clone em jogo.
 */
export const findSessionForCharacter = (character: Character, sessions: SessaoIA[]): SessaoIA | undefined => {
    const direct = sessions.find(session => session.characterId === character.id);
    if (direct) return direct;

    return sessions.find(session => {
        const templateId = session.character?.templateCharacterId;
        return typeof templateId === 'number' && templateId === character.id;
    });
};
