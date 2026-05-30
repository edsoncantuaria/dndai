/**
 * JSON Schema enviado ao Gemini via `responseJsonSchema` (Structured Output).
 * Fonte canônica do contrato — o modelo não precisa adivinhar chaves.
 * Validação pós-resposta continua com Zod + tradutor como rede de segurança.
 */

/** Julgamento de plausibilidade (actionSense). */
export const ACTION_SENSE_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['acceptable', 'reason'],
    properties: {
        acceptable: {
            type: 'boolean',
            description: 'true se a ação do jogador é tentável na cena; false se meta/OOC/impossível.',
        },
        reason: {
            type: 'string',
            description: 'Justificativa curta em português brasileiro.',
        },
        playerFacingHint: {
            type: 'string',
            description: 'Opcional. Dica curta ao jogador se acceptable for false.',
        },
    },
} as const;

/** Resumo de memória da sessão (compactação). */
export const SUMMARIZER_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['summary'],
    properties: {
        summary: {
            type: 'string',
            description:
                'Resumo objetivo em português brasileiro (máx. ~8 frases). Só fatos da campanha; sem inventar.',
        },
    },
} as const;

/** Narração mínima do turno (PENAI). */
export const NARRATION_MINIMAL_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['narration'],
    properties: {
        narration: {
            type: 'string',
            description: 'Texto narrativo em português brasileiro (2–6 parágrafos curtos).',
        },
        tone: {
            type: 'string',
            enum: ['dark', 'tense', 'hopeful', 'neutral', 'epic'],
            description: 'Tom emocional da cena.',
        },
        beat: {
            type: 'string',
            description: 'Opcional. Batida dramática em uma frase.',
        },
    },
} as const;

/** Sugestões de ação após narração (agente dedicado). */
export const ACTION_OPTIONS_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['options'],
    properties: {
        options: {
            type: 'array',
            minItems: 3,
            maxItems: 5,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['text', 'action', 'needsRoll'],
                properties: {
                    text: {
                        type: 'string',
                        description: 'Rótulo curto em português para o botão (imperativo).',
                    },
                    action: {
                        type: 'string',
                        description: 'Slug: explorar, observar, conversar, investigar, atacar, seguir, etc.',
                    },
                    skill: {
                        type: 'string',
                        description: 'Perícia D&D se needsRoll=true (ex.: perception, investigation).',
                    },
                    needsRoll: {
                        type: 'boolean',
                        description: 'true se exige teste de perícia ou ataque.',
                    },
                    dc: {
                        type: 'number',
                        description: 'CD sugerida opcional (10–20).',
                    },
                },
            },
        },
    },
} as const;

/**
 * Schema mínimo para Gemini structured output.
 * Contagem exata, enums e limites ficam no Zod (`worldBootstrapNpcAgent`).
 */
export function buildWorldNpcBatchJsonSchema(_npcCount?: number): Record<string, unknown> {
    return {
        type: 'object',
        required: ['npcs'],
        properties: {
            npcs: {
                type: 'array',
                items: {
                    type: 'object',
                    required: [
                        'givenName',
                        'roleTitle',
                        'role',
                        'description',
                        'maxHp',
                        'atributos',
                        'characterClass',
                        'isSpellcaster',
                    ],
                    properties: {
                        givenName: { type: 'string' },
                        roleTitle: { type: 'string' },
                        role: { type: 'string' },
                        description: { type: 'string' },
                        maxHp: { type: 'number' },
                        atributos: { type: 'object' },
                        characterClass: { type: 'string' },
                        isSpellcaster: { type: 'boolean' },
                        goal: { type: 'string' },
                        tier: { type: 'string' },
                        level: { type: 'number' },
                        armorClass: { type: 'number' },
                        spells: { type: 'array', items: { type: 'string' } },
                        mainWeaponSlug: { type: 'string' },
                        characterClassLabel: { type: 'string' },
                    },
                },
            },
            regionBlurb: { type: 'string' },
        },
    };
}

/** NPCs iniciais do bootstrap do mundo (4–6 por chamada padrão). */
export const WORLD_NPC_BATCH_RESPONSE_JSON_SCHEMA = buildWorldNpcBatchJsonSchema(6);

/** Facções locais no bootstrap — boatos e tensões sem inventar slugs novos. */
export const WORLD_FACTION_BOOTSTRAP_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['factionBeats'],
    properties: {
        factionBeats: {
            type: 'array',
            minItems: 1,
            maxItems: 6,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['factionSlug', 'localHeadline', 'rumor'],
                properties: {
                    factionSlug: {
                        type: 'string',
                        description: 'Slug exato de facção já descoberta na sessão.',
                    },
                    localHeadline: {
                        type: 'string',
                        description: 'Manchete curta em português.',
                    },
                    rumor: {
                        type: 'string',
                        description: 'Boato de taverna (1–2 frases), só sobre facções listadas.',
                    },
                },
            },
        },
    },
} as const;

/** Economia local no bootstrap — narrativa + ajustes sugeridos. */
export const WORLD_ECONOMY_BOOTSTRAP_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['marketSummary', 'items'],
    properties: {
        marketSummary: {
            type: 'string',
            description: '2–3 frases sobre comércio e escassez na região.',
        },
        items: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['itemSlug', 'priceNote'],
                properties: {
                    itemSlug: {
                        type: 'string',
                        enum: ['wolf_pelt', 'healing_potion', 'iron_ingot', 'grain', 'ale'],
                        description: 'Item canônico da economia.',
                    },
                    priceNote: {
                        type: 'string',
                        description: 'Nota curta: caro, abundante, contrabando, etc.',
                    },
                    scarcityDelta: {
                        type: 'number',
                        description: 'Opcional. Ajuste -20 a +20 na escassez.',
                    },
                },
            },
        },
    },
} as const;

/** Narração do pulso do mundo (headline + beats + fatos para memória). */
export const WORLD_PULSE_NARRATOR_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'beats', 'mood', 'memoryFacts'],
    properties: {
        headline: {
            type: 'string',
            description: 'Manchete cinematográfica curta em português (1 frase).',
        },
        beats: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: {
                type: 'string',
                description: 'Batida narrativa curta (1 frase cada).',
            },
        },
        mood: {
            type: 'string',
            enum: ['ominous', 'busy', 'calm', 'festive', 'grim'],
        },
        memoryFacts: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: {
                type: 'string',
                description: 'Fato objetivo para memória da campanha (sem stats).',
            },
        },
    },
} as const;

/** Missões iniciais da campanha (0–2, com região-alvo). */
export const WORLD_QUEST_SEED_RESPONSE_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['quests'],
    properties: {
        quests: {
            type: 'array',
            minItems: 0,
            maxItems: 2,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'synopsis', 'questSlug', 'regionSlug', 'kind', 'stageLabel'],
                properties: {
                    title: { type: 'string', description: 'Título da missão em português.' },
                    synopsis: { type: 'string', description: '2–3 frases: objetivo e contexto.' },
                    questSlug: {
                        type: 'string',
                        description: 'Slug kebab-case único (ex.: recuperar-reliquia-forja).',
                    },
                    regionSlug: {
                        type: 'string',
                        description: 'Slug exato de uma região da lista fornecida.',
                    },
                    kind: {
                        type: 'string',
                        enum: ['local', 'travel'],
                        description: 'local = região atual; travel = outra região.',
                    },
                    stageLabel: {
                        type: 'string',
                        description: 'Ex.: Procurar pistas, Falar com o ferreiro.',
                    },
                    urgency: {
                        type: 'string',
                        enum: ['low', 'medium', 'high'],
                    },
                },
            },
        },
    },
} as const;
