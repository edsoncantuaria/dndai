'use client';

import { useState } from 'react';
import type { Character, ProgressionFeedItem } from '@/types';

/** F.2 — personagem, sessão, ambiente e progressão. */
export function useGameSessionSlice() {
    const [character, setCharacter] = useState<Character | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [ambientSound, setAmbientSound] = useState<string>('none');
    const [progressionFeed, setProgressionFeed] = useState<ProgressionFeedItem[]>([]);

    return {
        character,
        setCharacter,
        sessionId,
        setSessionId,
        ambientSound,
        setAmbientSound,
        progressionFeed,
        setProgressionFeed,
    };
}

export type GameSessionSlice = ReturnType<typeof useGameSessionSlice>;
