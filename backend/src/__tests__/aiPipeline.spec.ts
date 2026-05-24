import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGameMasterJson } from '../ai/responseParser.js';
import { buildCompactPromptSections } from '../ai/promptSections.js';
import { resolvePipelineMode } from '../ai/constants.js';
import { stripMotorOwnedFields } from '../narration/motorStateBridge.js';
import { NarrativePhaseResponseSchema, GameMasterResponseSchema } from '../schemas/gameSchemas.js';

test('parseGameMasterJson repara JSON com trailing comma', () => {
    const raw = '{"logEntries":[{"type":"narration","content":"Olá"}], "actionOptions":["Atacar","Fugir","Conversar"],}';
    const parsed = parseGameMasterJson(raw);
    assert.equal(parsed.ok, true);
    assert.ok(parsed.strategy);
});

test('parseGameMasterJson extrai objeto dentro de markdown', () => {
    const raw = 'Aqui está:\n```json\n{"logEntries":[],"actionOptions":["A","B","C"]}\n```';
    const parsed = parseGameMasterJson(raw);
    assert.equal(parsed.ok, true);
    const data = parsed.data as Record<string, unknown>;
    assert.ok(Array.isArray(data.actionOptions));
});

test('buildCompactPromptSections inclui estado e ação', () => {
    const section = buildCompactPromptSections({
        character: { attributes: { hp: 10, ac: 14 }, currentRegion: 'Floresta' },
        playerAction: 'Investigo a caverna',
        combatState: { isActive: false },
    } as any);
    assert.match(section, /ESTADO/);
    assert.match(section, /Investigo a caverna/);
});

test('NarrativePhaseResponseSchema valida resposta mínima da IA', () => {
    const sample = {
        logEntries: [
            { type: 'narration', content: 'Você avança pela caverna.' },
            { type: 'system', content: 'O ar está úmido.' },
        ],
        actionOptions: ['Explorar', 'Ouvir', 'Recuar'],
    };
    const parsed = NarrativePhaseResponseSchema.parse(sample);
    assert.equal(parsed.logEntries.length, 2);
});

test('GameMasterResponseSchema aceita resposta narrativa-only enxuta', () => {
    const sample = {
        logEntries: [{ type: 'narration', content: 'Teste' }, { type: 'system', content: 'Ok' }],
        actionOptions: ['A', 'B', 'C'],
    };
    assert.doesNotThrow(() => GameMasterResponseSchema.parse(sample));
});

test('resolvePipelineMode usa narration_only por padrão', () => {
    const previous = process.env.AI_PIPELINE_MODE;
    delete process.env.AI_PIPELINE_MODE;
    assert.equal(resolvePipelineMode(), 'narration_only');
    if (previous !== undefined) {
        process.env.AI_PIPELINE_MODE = previous;
    } else {
        delete process.env.AI_PIPELINE_MODE;
    }
});

test('stripMotorOwnedFields remove estado da resposta da IA', () => {
    const stripped = stripMotorOwnedFields({
        logEntries: [{ type: 'narration', content: 'Teste' }],
        actionOptions: ['A', 'B', 'C'],
        updatedCharacter: { xp: 100 },
        combatState: { isActive: true } as any,
        systemLog: 'ok',
    });
    assert.equal(stripped.updatedCharacter, undefined);
    assert.equal(stripped.combatState, undefined);
    assert.equal(stripped.systemLog, 'ok');
});
