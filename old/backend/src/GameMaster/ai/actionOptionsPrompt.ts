import { clipText } from './promptComposer.js';
import type { NarrativeContextPack } from '../memory/narrativePack.js';
import type { MotorActionOption } from '../motor/actionOptionTypes.js';

const SKILL_PT: Record<string, string> = {
    perception: 'Percepção',
    investigation: 'Investigação',
    persuasion: 'Persuasão',
    stealth: 'Furtividade',
    athletics: 'Atletismo',
    insight: 'Intuição',
    intimidation: 'Intimidação',
    deception: 'Enganação',
    acrobatics: 'Acrobacia',
    survival: 'Sobrevivência',
};

export function composeActionOptionsSystemPrompt(): string {
    return [
        'Consultor de ações D&D 5e em pt-BR.',
        'Leia a última narração e proponha 3–4 opções curtas, variadas e específicas à cena.',
        'Cada opção: texto no imperativo (máx. 72 caracteres), action (slug), skill se precisar de teste, needsRoll true/false.',
        'Skills válidas: perception, investigation, persuasion, stealth, athletics, insight, intimidation, deception, acrobatics, survival.',
        'Pelo menos 1 opção sem rolagem. Não repita frases genéricas vazias.',
        'Não invente NPCs ou itens que não apareçam na narração.',
    ].join(' ');
}

export function buildActionOptionsUserPayload(opts: {
    lastNarration: string;
    pack: NarrativeContextPack;
    fallbackOptions: MotorActionOption[];
    proficientSkills?: string[];
    knownSpells?: string[];
}): Record<string, unknown> {
    return {
        ultimaNarracao: clipText(opts.lastNarration, 2200),
        regiao: opts.pack.regionSlug ?? null,
        faseCombate: opts.pack.combatPhase ?? 'IDLE',
        periciasProficientes: (opts.proficientSkills ?? []).slice(0, 8),
        magiasConhecidas: (opts.knownSpells ?? []).slice(0, 4),
        fatosSessao: (opts.pack.sessionFacts ?? []).slice(0, 4).map(f => clipText(f, 120)),
        opcoesFallback: opts.fallbackOptions.slice(0, 4).map(o => o.text),
    };
}

export function formatSkillLabel(skill?: string): string | undefined {
    if (!skill?.trim()) return undefined;
    const key = skill.trim().toLowerCase();
    return SKILL_PT[key] ?? skill;
}
