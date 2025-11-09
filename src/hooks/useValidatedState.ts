import { useEffect, useState } from 'react';
import type { GameMasterResponse } from '@/types';
import { translateLabels } from '@/utils/translator';

type ValidatorPayload = { validatedResponse: GameMasterResponse } | GameMasterResponse | null | undefined;

export const useValidatedState = (gameResponse: ValidatorPayload) => {
    const [state, setState] = useState<GameMasterResponse | null>(null);

    useEffect(() => {
        if (!gameResponse) {
            return;
        }
        const payload = (gameResponse as any).validatedResponse ?? gameResponse;
        setState(translateLabels(payload));
    }, [gameResponse]);

    return state;
};
