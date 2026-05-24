/**
 * Regressão automatizada alinhada às métricas do TODO §8.
 * QA manual: docs/VALIDATION_CHECKLIST.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrompt } from '../ai/promptAssembler.js';
import { sanitizeGameMasterResponse } from '../services/aiSanitizer.js';
import { stripMotorOwnedFields } from '../narration/motorStateBridge.js';
import { validateNewFact, formatFactsForPrompt } from '../services/sessionFactService.js';
import { applyForkOverlay } from '../services/homebrewMergeService.js';
import { formatRegionGraphSummary } from '../narration/regionContext.js';
import { validateEquipItemIntent } from '../rules/inventoryMotor.js';
import { reconcileCurrency } from '../services/inventoryService.js';

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

test('§8.2 — sanitize descarta playerRollRequest com suppressRollRequest', () => {
    const sanitized = sanitizeGameMasterResponse(
        {
            logEntries: [{ type: 'narration', content: 'Teste' }],
            actionOptions: [
                { text: 'A', action: 'a' },
                { text: 'B', action: 'b' },
                { text: 'C', action: 'c' },
            ],
            playerRollRequest: {
                reason: 'Percepção',
                dice: '1d20',
                dc: 12,
                rollType: 'check',
            },
        } as any,
        undefined,
        { suppressRollRequest: true },
    );
    assert.equal(sanitized.playerRollRequest, undefined);
});

test('§8.2 — narration_only remove campos de estado da resposta', () => {
    const stripped = stripMotorOwnedFields({
        logEntries: [{ type: 'narration', content: 'Ok' }],
        actionOptions: [
            { text: 'A', action: 'a' },
            { text: 'B', action: 'b' },
            { text: 'C', action: 'c' },
        ],
        updatedCharacter: { xp: 100 },
        combatState: { isActive: true },
        worldState: { currentRegion: 'Floresta' },
    } as any);
    assert.equal(stripped.updatedCharacter, undefined);
    assert.equal(stripped.combatState, undefined);
    assert.equal(stripped.worldState, undefined);
});

test('§8.4 — fork homebrew mantém official_index', () => {
    const forked = applyForkOverlay(
        { index: 'fireball', name: 'Fireball', level: 3 },
        { name: 'Fireball Aprimorada', desc: ['Mais dano'] },
    );
    assert.equal(forked.official_index, 'fireball');
    assert.match(String(forked.name), /Aprimorada/i);
});

test('§8.5 — resumo de região lista POIs descobertos', () => {
    const summary = formatRegionGraphSummary({
        slug: 'floresta',
        name: 'Floresta Sombria',
        type: 'wilderness',
        summary: 'Névoa densa.',
        pointsOfInterest: [
            { slug: 'altar', name: 'Altar', type: 'landmark', isDiscovered: true },
            { slug: 'ruinas', name: 'Ruínas', type: 'dungeon', isDiscovered: false },
        ],
        neighbors: [],
        breadcrumbs: [{ slug: 'floresta', name: 'Floresta Sombria' }],
    } as any);
    assert.match(summary, /Floresta Sombria/);
    assert.match(summary, /Altar/);
});

test('§8.6 — validação de facts narrativos vs mecânicos', () => {
    assert.equal(
        validateNewFact({ category: 'general', fact: 'O goblin perdeu 5 HP.' }).ok,
        false,
    );
    assert.equal(
        validateNewFact({
            category: 'npc',
            subject: 'Mira',
            fact: 'Mira confia no grupo.',
            npcId: 'mira',
        }).ok,
        true,
    );
    const formatted = formatFactsForPrompt([
        {
            id: '1',
            category: 'region',
            subject: 'Floresta',
            fact: 'Névoa nos trilhos.',
            regionSlug: 'floresta',
            npcId: null,
            questId: null,
            source: 'ai',
            isActive: true,
            sessaoId: 1,
            characterId: null,
            createdAt: new Date(),
        } as any,
    ]);
    assert.match(formatted, /Floresta/);
});

test('§8.1 parcial — motor de inventário e moeda canônica', () => {
    assert.equal(validateEquipItemIntent({ itemId: 12, equipped: true }).status, 'accepted');
    const merged = reconcileCurrency({ gp: 50 }, { gp: 10, sp: 5 });
    assert.equal(merged.gp, 50);
    assert.equal(merged.sp, 5);
});

test('§8.3 — prompt narrativo estimado abaixo do soft cap (9500 tokens)', () => {
    const prompt = createPrompt(
        {
            playerAction: 'Observo o salão',
            gameLog: 'SEM_EVENTOS',
            character: {
                name: 'Test',
                race: 'Elfo',
                characterClass: 'Mago',
                level: 1,
                attributes: { hp: 8, maxHp: 8 },
                inventory: [],
                proficiencies: [],
                spells: [],
                worldState: { currentRegion: 'Torre' },
            },
            responseFocus: 'narrative',
        } as any,
        false,
    );
    assert.ok(estimateTokens(prompt) < 9500);
});
