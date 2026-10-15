import { parseGameMasterJson } from './responseParser.js';
import { translateLlmPayload, type LlmJsonDictionary } from './llmJsonTranslator.js';

/** Contrato actionSense — chaves canônicas em inglês; modelo pode responder EN ou PT. */
export const ACTION_SENSE_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'julgamento', 'judgment', 'data', 'output', 'response'],
    fields: [
        {
            canonical: 'acceptable',
            aliasesEn: ['allowed', 'approved', 'plausible', 'valid', 'accepted', 'ok'],
            aliasesPt: ['aceitavel', 'aceitável', 'aceito', 'plausivel', 'plausível', 'valido', 'válido'],
            coerce: 'boolean',
        },
        {
            canonical: 'reason',
            aliasesEn: ['explanation', 'message', 'verdict', 'rationale'],
            aliasesPt: ['motivo', 'explicacao', 'explicação', 'mensagem', 'razao', 'justificativa', 'julgamento'],
            coerce: 'string',
        },
        {
            canonical: 'playerFacingHint',
            aliasesEn: ['player_facing_hint', 'hint', 'suggestion', 'advice'],
            aliasesPt: ['dica', 'sugestao', 'sugestão'],
            coerce: 'string',
        },
    ],
};

/** Resumo de sessão (compactação de memória). */
export const SUMMARIZER_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output'],
    fields: [
        {
            canonical: 'summary',
            aliasesEn: ['resumo', 'text', 'content', 'narrative', 'recap'],
            aliasesPt: ['resumo', 'sintese', 'síntese', 'texto'],
            coerce: 'string',
        },
    ],
};

/** Narração mínima Gemini — reutilizável quando narration.ts adotar o tradutor. */
export const NARRATION_MINIMAL_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output', 'response'],
    fields: [
        {
            canonical: 'narration',
            aliasesEn: ['narrative', 'text', 'story', 'content', 'description'],
            aliasesPt: ['narracao', 'narração', 'texto', 'historia', 'história'],
            coerce: 'string',
        },
        {
            canonical: 'tone',
            aliasesEn: ['mood'],
            aliasesPt: ['tom', 'humor'],
            coerce: 'string',
        },
        {
            canonical: 'beat',
            aliasesEn: ['storyBeat', 'story_beat'],
            aliasesPt: ['batida'],
            coerce: 'string',
        },
    ],
};

/** NPCs do bootstrap mundial. */
export const WORLD_NPC_BATCH_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output', 'response'],
    fields: [
        {
            canonical: 'npcs',
            aliasesEn: ['characters', 'inhabitants', 'population'],
            aliasesPt: ['personagens', 'habitantes', 'moradores'],
            coerce: 'array',
        },
        {
            canonical: 'givenName',
            aliasesEn: ['firstName', 'name', 'properName'],
            aliasesPt: ['nome', 'nomeProprio', 'nome_próprio'],
            coerce: 'string',
        },
        {
            canonical: 'roleTitle',
            aliasesEn: ['title', 'occupation', 'jobTitle'],
            aliasesPt: ['titulo', 'título', 'oficio', 'ofício', 'cargo'],
            coerce: 'string',
        },
        {
            canonical: 'maxHp',
            aliasesEn: ['hp', 'hitPoints', 'maxHitPoints'],
            aliasesPt: ['vida', 'pv', 'pontosDeVida', 'vidaMaxima'],
            coerce: 'number',
        },
        {
            canonical: 'atributos',
            aliasesEn: ['attributes', 'abilityScores', 'stats'],
            aliasesPt: ['atributos', 'atributosDnd', 'pontosDeAtributo'],
            coerce: 'object',
        },
        {
            canonical: 'characterClass',
            aliasesEn: ['class', 'character_class', 'srdClass'],
            aliasesPt: ['classe', 'classePersonagem'],
            coerce: 'string',
        },
        {
            canonical: 'isSpellcaster',
            aliasesEn: ['spellcaster', 'castsSpells'],
            aliasesPt: ['conjurador', 'usaMagias'],
            coerce: 'boolean',
        },
        {
            canonical: 'spells',
            aliasesEn: ['spellList', 'knownSpells'],
            aliasesPt: ['magias', 'feitiços', 'feiticoes'],
            coerce: 'array',
        },
        {
            canonical: 'mainWeaponSlug',
            aliasesEn: ['weapon', 'mainWeapon', 'weaponSlug'],
            aliasesPt: ['arma', 'armaPrincipal'],
            coerce: 'string',
        },
        {
            canonical: 'armorClass',
            aliasesEn: ['ac', 'armor_class'],
            aliasesPt: ['ca', 'classeArmadura'],
            coerce: 'number',
        },
        {
            canonical: 'regionBlurb',
            aliasesEn: ['region_blurb', 'regionSummary'],
            aliasesPt: ['regiao', 'região', 'clima'],
            coerce: 'string',
        },
    ],
};

/** Parse da resposta structured do lote de NPCs (repair JSON + aliases PT). */
export function parseWorldNpcBatchJson(raw: string): {
    ok: true;
    data: Record<string, unknown>;
} | {
    ok: false;
    detail: string;
    preview: string;
} {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed || trimmed === '{}') {
        return { ok: false, detail: 'Resposta vazia do Gemini', preview: trimmed };
    }

    const repaired = parseGameMasterJson(trimmed);
    if (!repaired.ok) {
        return {
            ok: false,
            detail: repaired.error ?? 'JSON irreparável',
            preview: trimmed.slice(0, 500),
        };
    }

    const payload = repaired.data;
    if (Array.isArray(payload)) {
        return { ok: true, data: { npcs: payload } };
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const obj = payload as Record<string, unknown>;
        if (Array.isArray(obj.npcs)) {
            return { ok: true, data: obj };
        }
        const { data } = translateLlmPayload(obj, WORLD_NPC_BATCH_LLM_DICTIONARY);
        if (Array.isArray(data.npcs)) {
            return { ok: true, data };
        }
    }

    return {
        ok: false,
        detail: 'Payload sem array npcs',
        preview: trimmed.slice(0, 500),
    };
}

/** Facções no bootstrap. */
export const WORLD_FACTION_BOOTSTRAP_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output', 'response'],
    fields: [
        {
            canonical: 'factionBeats',
            aliasesEn: ['factions', 'beats', 'rumors'],
            aliasesPt: ['faccoes', 'facções', 'boatos', 'rumores'],
            coerce: 'array',
        },
    ],
};

/** Economia no bootstrap. */
export const WORLD_ECONOMY_BOOTSTRAP_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output', 'response'],
    fields: [
        {
            canonical: 'marketSummary',
            aliasesEn: ['summary', 'market', 'economy'],
            aliasesPt: ['resumo', 'mercado', 'economia'],
            coerce: 'string',
        },
        {
            canonical: 'items',
            aliasesEn: ['goods', 'products', 'prices'],
            aliasesPt: ['itens', 'produtos', 'precos', 'preços'],
            coerce: 'array',
        },
    ],
};

/** Pulso do mundo — narrador. */
export const WORLD_PULSE_NARRATOR_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output', 'response'],
    fields: [
        {
            canonical: 'headline',
            aliasesEn: ['title', 'headline_text'],
            aliasesPt: ['manchete', 'titulo', 'título'],
            coerce: 'string',
        },
        {
            canonical: 'beats',
            aliasesEn: ['events', 'lines', 'pulses'],
            aliasesPt: ['batidas', 'eventos', 'linhas'],
            coerce: 'array',
        },
        {
            canonical: 'mood',
            aliasesEn: ['tone', 'atmosphere'],
            aliasesPt: ['tom', 'clima', 'humor'],
            coerce: 'string',
        },
        {
            canonical: 'memoryFacts',
            aliasesEn: ['facts', 'memories', 'memory_facts'],
            aliasesPt: ['fatos', 'memorias', 'memórias'],
            coerce: 'array',
        },
    ],
};

/** Seed de missões no bootstrap. */
export const WORLD_QUEST_SEED_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output', 'response'],
    fields: [
        {
            canonical: 'quests',
            aliasesEn: ['missions', 'objectives'],
            aliasesPt: ['missoes', 'missões', 'objetivos'],
            coerce: 'array',
        },
    ],
};

/** Opções de ação pós-narração. */
export const ACTION_OPTIONS_LLM_DICTIONARY: LlmJsonDictionary = {
    nestKeys: ['result', 'data', 'output', 'response', 'opcoes', 'options'],
    fields: [
        {
            canonical: 'options',
            aliasesEn: ['actions', 'choices', 'suggestions', 'actionOptions'],
            aliasesPt: ['opcoes', 'opções', 'acoes', 'ações'],
            coerce: 'array',
        },
    ],
};

