'use client';

import { useGameStateContext } from '@/contexts/GameStateContext';
import { usePenaiGameplay } from '@/contexts/PenaiGameplayContext';
import { getPenaiBridge } from '@/lib/penaiBridge';

/**
 * Envia ação ao motor PENAI (WS v2).
 */
export function useMotorAction() {
    const penai = usePenaiGameplay();
    const { sendMotorAction } = useGameStateContext();

    return {
        penaiActive: penai.active || Boolean(getPenaiBridge()?.active),
        sendMotorAction,
    };
}
