import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    getPointBuyTotal,
    rollAttribute4d6,
    validatePointBuyBase,
    validateRolledBase,
    type BaseAttributes,
} from '../rules/characterAttributes.js';
import {
    clearCharacterAttributeRollSessionsForTests,
    consumeCharacterAttributeRoll,
    issueCharacterAttributeRoll,
} from '../services/characterAttributeRollService.js';

const validPointBuy: BaseAttributes = {
    strength: 15,
    dexterity: 14,
    constitution: 13,
    intelligence: 12,
    wisdom: 10,
    charisma: 8,
};

describe('characterAttributes', () => {
    it('rollAttribute4d6 retorna total entre 3 e 18', () => {
        for (let i = 0; i < 50; i++) {
            const { total } = rollAttribute4d6();
            assert.ok(total >= 3 && total <= 18);
        }
    });

    it('validatePointBuyBase aceita distribuição padrão de 27 pontos', () => {
        assert.equal(getPointBuyTotal(validPointBuy), 27);
        assert.doesNotThrow(() => validatePointBuyBase(validPointBuy));
    });

    it('validatePointBuyBase rejeita scores acima de 15', () => {
        assert.throws(
            () => validatePointBuyBase({ ...validPointBuy, strength: 18 }),
            /inválido para compra de pontos/i,
        );
    });

    it('validateRolledBase rejeita todos 8 (sem rolar)', () => {
        assert.throws(
            () =>
                validateRolledBase({
                    strength: 8,
                    dexterity: 8,
                    constitution: 8,
                    intelligence: 8,
                    wisdom: 8,
                    charisma: 8,
                }),
            /ainda não foi realizada/i,
        );
    });
});

describe('characterAttributeRollService', () => {
    it('emite e consome sessão de rolagem (anti-spoof)', async () => {
        clearCharacterAttributeRollSessionsForTests();
        const issued = await issueCharacterAttributeRoll(42);
        assert.ok(issued.rollSessionId);
        assert.ok(issued.baseAttributes.strength >= 3);

        await assert.doesNotReject(() =>
            consumeCharacterAttributeRoll(42, issued.rollSessionId, issued.baseAttributes),
        );

        await assert.rejects(
            () => consumeCharacterAttributeRoll(42, issued.rollSessionId, issued.baseAttributes),
            /expirada ou inválida/i,
        );
    });

    it('rejeita atributos adulterados pelo cliente', async () => {
        clearCharacterAttributeRollSessionsForTests();
        const issued = await issueCharacterAttributeRoll(7);
        const spoofed = { ...issued.baseAttributes, strength: 18 };

        await assert.rejects(
            () => consumeCharacterAttributeRoll(7, issued.rollSessionId, spoofed),
            /não conferem/i,
        );
    });
});
