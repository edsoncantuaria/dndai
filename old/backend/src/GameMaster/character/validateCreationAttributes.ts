import createError from 'http-errors';
import type { z } from 'zod';
import type { NewCharacterInfoSchema } from '../../schemas/validationSchemas.js';
import {
    validateFinalAttributesSanity,
    validateFinalMatchesBase,
    validatePointBuyBase,
    validateRolledBase,
    type BaseAttributes,
} from '../../rules/characterAttributes.js';
import { consumeCharacterAttributeRoll } from '../../services/characterAttributeRollService.js';

type CharacterPayload = z.infer<typeof NewCharacterInfoSchema>;

export async function validateCreationAttributes(userId: number, data: CharacterPayload): Promise<void> {
    const method = data.attributeMethod;
    const base = data.baseAttributes as BaseAttributes | undefined;
    const final = data.attributes as BaseAttributes;

    if (!method || !base) {
        validateFinalAttributesSanity(final);
        return;
    }

    if (method === 'point-buy') {
        validatePointBuyBase(base);
    } else if (method === 'roll') {
        if (!data.rollSessionId) {
            throw createError(400, 'rollSessionId obrigatório para método de rolagem.');
        }
        validateRolledBase(base);
        await consumeCharacterAttributeRoll(userId, data.rollSessionId, base);
    }

    validateFinalMatchesBase(final, base);
}
