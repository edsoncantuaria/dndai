import type { NarrativeContextPack } from '../memory/narrativePack.js';
import { buildContextualActionOptions } from '../motor/contextualActionOptions.js';
import type { MotorActionOption } from '../motor/actionOptionTypes.js';
import { suggestActionOptionsGemini } from '../adapters/gemini/actionOptions.js';
import { formatSkillLabel } from '../ai/actionOptionsPrompt.js';
import { penaiPipelineLog, penaiPipelineWait } from '../infra/pipelineLog.js';
import type { PipelineCtx } from '../infra/pipelineLog.js';

function mergeWithFallback(ai: MotorActionOption[], fallback: MotorActionOption[]): MotorActionOption[] {
    const seen = new Set(ai.map(o => o.text.toLowerCase()));
    const merged = [...ai];
    for (const f of fallback) {
        if (merged.length >= 5) break;
        const key = f.text.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(f);
        }
    }
    return merged.slice(0, 5);
}

/** Agente dedicado: lê última narração + contexto e sugere opções (com rolagem quando fizer sentido). */
export async function suggestActionOptionsForTurn(opts: {
    sessionId: number;
    lastNarration: string;
    pack: NarrativeContextPack;
    userApiKey?: string;
    proficientSkills?: string[];
    knownSpells?: string[];
    combatActive?: boolean;
    ctx?: PipelineCtx;
}): Promise<MotorActionOption[]> {
    const combatActive =
        opts.combatActive ??
        (Boolean(opts.pack.combatPhase) &&
            opts.pack.combatPhase !== 'IDLE' &&
            opts.pack.combatPhase !== 'NONE');

    const fallback = buildContextualActionOptions({
        domain: combatActive ? 'combat' : 'exploration',
        combatActive,
        proficientSkills: opts.proficientSkills,
        knownSpells: opts.knownSpells,
    }) as MotorActionOption[];

    if (!opts.lastNarration.trim()) {
        return fallback;
    }

    penaiPipelineLog(
        'ACTION_OPTIONS',
        'agente Gemini — última narração',
        { narrationPreview: opts.lastNarration.slice(0, 160), fallbackCount: fallback.length },
        opts.ctx,
    );

    penaiPipelineWait('ACTION_OPTIONS', 'Gemini — opções pós-narração…', opts.ctx);
    const ai = await suggestActionOptionsGemini({
        lastNarration: opts.lastNarration,
        pack: opts.pack,
        fallbackOptions: fallback,
        userApiKey: opts.userApiKey,
        proficientSkills: opts.proficientSkills,
        knownSpells: opts.knownSpells,
    });

    const merged = mergeWithFallback(ai, fallback);
    penaiPipelineLog(
        'ACTION_OPTIONS',
        'opções finais',
        {
            options: merged.map(o => ({
                text: o.text,
                skill: formatSkillLabel(o.skill),
                roll: o.needsRoll ?? false,
            })),
        },
        opts.ctx,
    );

    return merged;
}
