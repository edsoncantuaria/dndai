import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import { attachResponseMetadata, ensureResponseSchemaHash } from './schemaIntegrityService.js';

const ACTION_VERBS = [
    'tente',
    'tentar',
    'investigue',
    'investigar',
    'observe',
    'observar',
    'ataque',
    'atacar',
    'fuja',
    'fugir',
    'responda',
    'responder',
    'procure',
    'procurar',
    'pergunte',
    'perguntar',
    'prepare',
    'preparar',
    'ajude',
    'interaja',
    'negocie',
    'explore',
    'explorar',
];

const FALLBACK_ACTIONS: GameMasterResponse['actionOptions'] = [
    { text: 'Observe o cenário em busca de pistas imediatas.', action: 'observar' },
    { text: 'Converse com os NPCs próximos para coletar informações.', action: 'conversar' },
    { text: 'Revise seus recursos antes de decidir o próximo passo.', action: 'avaliar' },
];

const stripControlChars = (value: string): string =>
    value.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();

const splitSentences = (text: string): string[] =>
    stripControlChars(text)
        .split(/(?<=[.!?])\s+/)
        .map(chunk => chunk.trim())
        .filter(Boolean);

const deriveNarrativeEntries = (
    sentences: string[],
    input: GameMasterFlowInput
): GameMasterResponse['logEntries'] => {
    const emphasis = sentences.filter(sentence => /você|seu|sua|teu|tua/i.test(sentence));
    const selected = (emphasis.length ? emphasis.slice(-2) : sentences.slice(-2)).map(content => ({
        type: 'narration' as const,
        content,
    }));

    const logEntries = [...selected];
    if (logEntries.length >= 2) {
        return logEntries;
    }

    const fromGameLog = (input.gameLog || '')
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(-2)
        .map(line => ({
            type: line.toUpperCase().startsWith('JOGADOR') ? 'action' : 'narration',
            content: line.replace(/^[A-ZÀ-Ú\s]+:\s*/i, '').trim() || line,
        }));

    for (const entry of fromGameLog) {
        logEntries.push(entry);
        if (logEntries.length >= 2) break;
    }

    if (!logEntries.length) {
        logEntries.push({
            type: 'narration',
            content: 'O sistema reconstruiu a narrativa com base no texto parcial recebido do Mestre de Jogo.',
        });
    }

    return logEntries;
};

const slugify = (value: string): string =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'acao';

const deriveActionOptions = (sentences: string[]): GameMasterResponse['actionOptions'] => {
    const options = sentences
        .map(sentence => sentence.replace(/"/g, '').trim())
        .filter(Boolean)
        .map(sentence => {
            const normalized = sentence.toLowerCase();
            const matchesVerb = ACTION_VERBS.some(verb => normalized.startsWith(verb));
            if (!matchesVerb) return null;
            return {
                text: sentence.endsWith('.') ? sentence.slice(0, -1) : sentence,
                action: slugify(sentence),
            };
        })
        .filter(Boolean) as GameMasterResponse['actionOptions'];

    if (options.length >= 2) {
        return options.slice(0, 4);
    }

    const enriched = [...options];
    for (const fallback of FALLBACK_ACTIONS) {
        enriched.push(fallback);
        if (enriched.length >= 2) break;
    }

    return enriched.slice(0, 4);
};

const detectLootOffer = (text: string) => {
    const lootMatch = text.match(/(\d{1,4})\s*(?:po|p\.?o\.?|ouro|moedas?)/i);
    if (!lootMatch) return null;
    const amount = Number.parseInt(lootMatch[1], 10);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
        currency: { gp: amount },
        items: [],
    };
};

const detectDamageEvents = (text: string) => {
    const regex = /([A-ZÁ-Ú][\wÀ-ÿ']{2,})[^.!?]{0,40}?(\d{1,3})\s*(?:pontos?\s+de\s+)?dano/gi;
    const events: string[] = [];
    const xpEvents: GameMasterResponse['xpEvents'] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) && events.length < 3) {
        const [, target, amount] = match;
        const parsedAmount = Number.parseInt(amount, 10);
        events.push(`${target} sofre ${parsedAmount} pontos de dano.`);
        xpEvents.push({
            type: 'combat',
            description: `Causou ${parsedAmount} de dano em ${target}.`,
            difficulty: parsedAmount > 20 ? 'hard' : 'medium',
        });
    }
    return { combatEvents: events, xpEvents };
};

const deriveMemoryContext = (sentences: string[]) => {
    if (!sentences.length) return undefined;
    const summary = sentences.slice(0, 2).join(' ');
    const references = sentences
        .filter(sentence => /[A-ZÁ-Ú][a-zá-ú]+/.test(sentence))
        .slice(0, 3);
    return {
        summary: summary.slice(0, 240),
        references: references.length ? references : undefined,
    };
};

const cloneStructured = <T>(value: T): T | undefined => {
    if (value === undefined || value === null) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return undefined;
    }
};

const buildWorldStateSnapshot = (character: any) => {
    const worldState = character?.worldState;
    if (!worldState || typeof worldState !== 'object') return undefined;
    const snapshot: Record<string, any> = {};
    if (typeof worldState.timeOfDay === 'string') snapshot.timeOfDay = worldState.timeOfDay;
    if (typeof worldState.weather === 'string') snapshot.weather = worldState.weather;
    if (typeof worldState.currentRegion === 'string') snapshot.currentRegion = worldState.currentRegion;
    return Object.keys(snapshot).length ? snapshot : undefined;
};

const extractBalancedSection = (text: string, field: string): string | null => {
    const token = `"${field}"`;
    const start = text.indexOf(token);
    if (start === -1) return null;
    const colon = text.indexOf(':', start + token.length);
    if (colon === -1) return null;
    let cursor = colon + 1;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
    const opener = text[cursor];
    const closer = opener === '[' ? ']' : opener === '{' ? '}' : null;
    if (!closer) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = cursor; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === opener) depth += 1;
        if (char === closer) depth -= 1;
        if (depth === 0) {
            return text.slice(cursor, i + 1);
        }
    }
    return null;
};

const applyFieldHints = (response: GameMasterResponse, rawText: string, notes: string[]) => {
    const fields: Array<{ key: keyof GameMasterResponse; type: 'array' | 'object'; name: string }> = [
        { key: 'logEntries', type: 'array', name: 'logEntries' },
        { key: 'actionOptions', type: 'array', name: 'actionOptions' },
        { key: 'worldState', type: 'object', name: 'worldState' },
    ];
    fields.forEach(field => {
        const section = extractBalancedSection(rawText, field.name);
        if (!section) return;
        try {
            const parsed = JSON.parse(section);
            if (field.type === 'array' && Array.isArray(parsed) && parsed.length) {
                (response as any)[field.key] = parsed;
                notes.push(`Recuperado ${field.name} diretamente do texto.`);
            }
            if (field.type === 'object' && parsed && typeof parsed === 'object') {
                (response as any)[field.key] = parsed;
                notes.push(`Snapshot de ${field.name} identificado no texto.`);
            }
        } catch {
            // ignore parsing issues
        }
    });
};

const analyzeAnchors = (text: string) => {
    return {
        hasCombat: /dano|ataque|iniciativa|espada|flecha/i.test(text),
        hasWeather: /nublado|chuva|ensolarado|tempestade|neve/i.test(text),
        hasNpc: /senhor|ladino|arqueiro|feiticeir[oa]/i.test(text),
    };
};

export const reconstructSemanticIntent = (
    rawText: string,
    input: GameMasterFlowInput
): GameMasterResponse | null => {
    if (!rawText || typeof rawText !== 'string') return null;
    const trimmed = stripControlChars(rawText);
    if (!trimmed.length) return null;

    const sentences = splitSentences(trimmed);
    if (!sentences.length) return null;

    const logEntries = deriveNarrativeEntries(sentences, input);
    const actionOptions = deriveActionOptions(sentences);
    const { combatEvents, xpEvents } = detectDamageEvents(trimmed);
    const lootOffer = detectLootOffer(trimmed);

    const combatState = input.combatState
        ? cloneStructured(input.combatState) ?? null
        : combatEvents.length
            ? {
                isActive: true,
                round: 1,
                turn: 0,
                combatants: [],
                log: combatEvents,
            }
            : null;

    const integrityNotes: string[] = [];
    const response: GameMasterResponse = {
        logEntries,
        actionOptions,
        updatedCharacter: {},
        combatState,
        playerRollRequest: null,
        systemLog: `[SemanticRecovery] GameMasterResponse reconstruído após falha de parse do modelo.`,
        levelUpState: null,
        shopState: (input.character as any)?.shopState ?? null,
        lootOffer,
        useHitDiceRequest: null,
        worldState: buildWorldStateSnapshot(input.character),
        newHomebrewContent: [],
        xpEvents: xpEvents.length ? xpEvents : [],
        progressionFeed: [],
        gameClock: (input.character as any)?.gameClock,
        memoryContext: deriveMemoryContext(sentences),
    };
    applyFieldHints(response, trimmed, integrityNotes);

    ensureResponseSchemaHash(response);
    const anchors = analyzeAnchors(trimmed);
    const baseScore = Math.min(
        1,
        (logEntries.length >= 2 ? 0.4 : 0) +
            (actionOptions.length >= 3 ? 0.3 : 0) +
            (combatEvents.length ? 0.15 : 0) +
            (lootOffer ? 0.1 : 0) +
            (anchors.hasWeather ? 0.05 : 0)
    );
    attachResponseMetadata(response, {
        recoveryStrategies: ['semantic-recovery'],
        reconstructionScore: baseScore,
        integrityNotes: ['Reconstruído via camada semântica.', ...integrityNotes],
    });
    return response;
};
