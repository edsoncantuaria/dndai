import test from 'node:test';
import assert from 'node:assert/strict';
import {
    detectIntentSkillIndex,
    detectExplicitSkillIndex,
    normalizeActionText,
    playerActionImpliesSkillRoll,
    resolveSkillForPlayerAction,
} from '../services/dm/skillActionSemantics.js';

const MOCK_SKILLS = [
    { index: 'acrobatics', name: 'Acrobacia' },
    { index: 'deception', name: 'Enganação' },
    { index: 'persuasion', name: 'Persuasão' },
    { index: 'athletics', name: 'Atletismo' },
    { index: 'perception', name: 'Percepção' },
];

test('playerActionImpliesSkillRoll: conversa casual não dispara', () => {
    assert.equal(playerActionImpliesSkillRoll('Converso com o taverneiro sobre o clima.'), false);
    assert.equal(playerActionImpliesSkillRoll('Pergunto o preço da cerveja.'), false);
});

test('playerActionImpliesSkillRoll: tentativa mecânica dispara', () => {
    assert.equal(playerActionImpliesSkillRoll('Tento enganar o guarda.'), true);
    assert.equal(playerActionImpliesSkillRoll('Faço teste de acrobacia.'), true);
});

test('resolveSkillForPlayerAction: acrobacia para enganar → Enganação', () => {
    const action = 'Faço teste de acrobacia para enganar o guarda na porta.';
    const r = resolveSkillForPlayerAction(action, MOCK_SKILLS);
    assert.ok(r);
    assert.equal(r!.skillIndex, 'deception');
    assert.equal(r!.source, 'reconciled');
    assert.equal(r!.explicitSkillIndex, 'acrobatics');
    assert.match(r!.resolutionNote ?? '', /Enganação/);
});

test('resolveSkillForPlayerAction: só enganar → intenção', () => {
    const r = resolveSkillForPlayerAction('Tento enganar o mercador.', MOCK_SKILLS);
    assert.ok(r);
    assert.equal(r!.skillIndex, 'deception');
    assert.equal(r!.source, 'intent');
});

test('resolveSkillForPlayerAction: acrobacia para escalar → Acrobacia ou Atletismo', () => {
    const r = resolveSkillForPlayerAction('Tento usar acrobacia para equilibrar na corda.', MOCK_SKILLS);
    assert.ok(r);
    assert.equal(r!.skillIndex, 'acrobatics');
});

test('resolveSkillForPlayerAction: persuadir sem citar perícia errada', () => {
    const r = resolveSkillForPlayerAction('Tento persuadir o capitão a nos deixar passar.', MOCK_SKILLS);
    assert.ok(r);
    assert.equal(r!.skillIndex, 'persuasion');
});

test('detectIntentSkillIndex normaliza acentos', () => {
    const n = normalizeActionText('Tento intimidar o bandido.');
    assert.equal(detectIntentSkillIndex(n), 'intimidation');
});

test('detectExplicitSkillIndex encontra alias enganação', () => {
    const n = normalizeActionText('Rolagem de enganação');
    assert.equal(detectExplicitSkillIndex(n, MOCK_SKILLS), 'deception');
});
