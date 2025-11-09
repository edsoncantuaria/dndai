// backend/src/services/gmValidator.ts
import { GameMasterResponse } from '../types.js';
import { GameMasterResponseSchema } from '../schemas/gameSchemas.js';

export interface ValidationIssue {
    path: string;
    problem: string;
    fixed: boolean;
}

export interface ValidatorContext {
    memorySummary?: string;
    memoryReferences?: string[];
    gameClock?: {
        day?: number;
        hour?: number;
        weather?: string;
    };
}

export interface GmValidatorResult {
    validatedResponse: GameMasterResponse;
    issues: ValidationIssue[];
}

const DEFAULT_LOG_ENTRY = {
    type: 'narration' as const,
    content: 'O tempo passa calmamente enquanto você decide o que fazer em seguida.',
};

const DEFAULT_ACTION_OPTIONS = [
    'Observar o ambiente em busca de algo incomum.',
    'Esperar e ouvir conversas próximas.',
    'Conversar com o NPC mais próximo.',
];

const slugifyActionId = (text: string) => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `acao-${Math.random().toString(36).slice(2, 6)}`;
};

const clampNumber = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
};

const sanitizeActionOptions = (
    options: Array<string | { text?: string; action?: string; skill?: string }> ,
    issues: ValidationIssue[]
) => {
    const normalized: Array<{ text: string; action: string; skill?: string }> = [];
    const seen = new Set<string>();
    options.forEach((raw, index) => {
        if (!raw) return;
        let option: { text: string; action: string; skill?: string } | null = null;
        if (typeof raw === 'string') {
            const text = raw.trim();
            if (!text) return;
            option = { text, action: slugifyActionId(text) };
            issues.push({ path: `actionOptions[${index}]`, problem: 'Opção simplificada para formato estruturado.', fixed: true });
        } else if (typeof raw === 'object') {
            const text = typeof raw.text === 'string' && raw.text.trim() ? raw.text.trim() : null;
            if (!text) return;
            const action = typeof raw.action === 'string' && raw.action.trim() ? raw.action.trim() : slugifyActionId(text);
            option = { text, action, skill: typeof raw.skill === 'string' ? raw.skill : undefined };
            if (!raw.action) {
                issues.push({ path: `actionOptions[${index}].action`, problem: 'Action ausente; slug gerado automaticamente.', fixed: true });
            }
        }
        if (!option) return;
        if (seen.has(option.action)) return;
        seen.add(option.action);
        normalized.push(option);
    });
    return normalized.length ? normalized : DEFAULT_ACTION_OPTIONS.map(text => ({ text, action: slugifyActionId(text) }));
};

const sanitizeMemoryContext = (memory: any, issues: ValidationIssue[]) => {
    if (!memory || typeof memory !== 'object') return { summary: '', references: [] };
    const sanitized: Record<string, any> = { ...memory };
    if (typeof sanitized.summary === 'string' && sanitized.summary.length > 600) {
        sanitized.summary = `${sanitized.summary.slice(0, 597)}...`;
        issues.push({ path: 'memoryContext.summary', problem: 'Resumo muito longo; truncado para 600 caracteres.', fixed: true });
    }
    if (Array.isArray(sanitized.references)) {
        const refs = sanitized.references
            .filter((ref: unknown): ref is string => typeof ref === 'string' && ref.trim().length > 0)
            .map(ref => ref.trim());
        const unique = Array.from(new Set(refs)).slice(0, 8);
        if (unique.length !== refs.length) {
            issues.push({ path: 'memoryContext.references', problem: 'Referências deduplicadas/truncadas.', fixed: true });
        }
        sanitized.references = unique;
    } else {
        sanitized.references = [];
    }
    return sanitized;
};

const sanitizeProgressionFeed = (feed: any, issues: ValidationIssue[]) => {
    if (!Array.isArray(feed)) return undefined;
    const allowedTypes = new Set(['xp_gain', 'level_up']);
    const sanitized = feed
        .map((entry, index) => {
            if (!entry || typeof entry !== 'object') return null;
            const type = entry.type;
            const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
            if (!allowedTypes.has(type) || !summary) {
                issues.push({ path: `progressionFeed[${index}]`, problem: 'Entrada inválida removida.', fixed: true });
                return null;
            }
            const normalized: Record<string, any> = {
                type,
                summary: summary.slice(0, 200),
            };
            if (typeof entry.source === 'string') normalized.source = entry.source.slice(0, 120);
            if (typeof entry.detail === 'string') normalized.detail = entry.detail.slice(0, 200);
            if (typeof entry.xp === 'number' && Number.isFinite(entry.xp)) normalized.xp = Math.max(0, entry.xp);
            if (typeof entry.level === 'number' && Number.isFinite(entry.level)) normalized.level = Math.max(1, entry.level);
            return normalized;
        })
        .filter(Boolean)
        .slice(0, 10);
    return sanitized.length ? sanitized : undefined;
};

const sanitizeLootOffer = (offer: any, issues: ValidationIssue[]) => {
    if (!offer || typeof offer !== 'object') return undefined;
    const sanitized: Record<string, any> = { ...offer };
    if (!Array.isArray(sanitized.items)) {
        sanitized.items = [];
    }
    if (!sanitized.currency || typeof sanitized.currency !== 'object') {
        sanitized.currency = { gp: 0 };
        issues.push({ path: 'lootOffer.currency', problem: 'Currency ausente; definido com 0 gp.', fixed: true });
    } else {
        sanitized.currency.gp = Math.max(0, Number(sanitized.currency.gp) || 0);
    }
    return sanitized;
};

const sanitizeHomebrewList = (homebrew: any, issues: ValidationIssue[]) => {
    if (!Array.isArray(homebrew)) return undefined;
    const trimmed = homebrew.slice(0, 5);
    if (trimmed.length !== homebrew.length) {
        issues.push({ path: 'newHomebrewContent', problem: 'Lista homebrew truncada para 5 itens.', fixed: true });
    }
    return trimmed;
};

const sanitizeXpEvents = (events: any, issues: ValidationIssue[]) => {
    if (!Array.isArray(events)) return undefined;
    const allowedTypes = new Set(['skill', 'quest', 'combat']);
    const sanitized = events
        .map((entry, index) => {
            if (!entry || typeof entry !== 'object' || !allowedTypes.has(entry.type)) {
                issues.push({ path: `xpEvents[${index}]`, problem: 'Evento de XP inválido removido.', fixed: true });
                return null;
            }
            const normalized: Record<string, any> = { type: entry.type };
            if (typeof entry.dc === 'number' && Number.isFinite(entry.dc)) {
                normalized.dc = Math.max(1, entry.dc);
            }
            if (typeof entry.difficulty === 'string') {
                normalized.difficulty = entry.difficulty;
            }
            if (entry.type === 'quest') {
                if (typeof entry.questLevel === 'number' && Number.isFinite(entry.questLevel)) {
                    normalized.questLevel = Math.max(1, Math.min(20, Math.round(entry.questLevel)));
                }
            }
            if (typeof entry.description === 'string') {
                normalized.description = entry.description.slice(0, 140);
            }
            return normalized;
        })
        .filter(Boolean)
        .slice(0, 10);
    return sanitized.length ? sanitized : undefined;
};

const ensureRollNarration = (response: GameMasterResponse, issues: ValidationIssue[]) => {
    if (!response.playerRollRequest) return;
    const logEntries = ensureArray(response.logEntries);
    const reason = response.playerRollRequest.reason || 'Ação pendente';
    const dice = response.playerRollRequest.dice || '1d20';
    const modifier = typeof response.playerRollRequest.modifier === 'number' ? response.playerRollRequest.modifier : 0;
    const dc = typeof response.playerRollRequest.dc === 'number' ? `CD ${response.playerRollRequest.dc}` : 'sem CD definida';
    const hasRollLog = logEntries.some(entry => entry && typeof entry === 'object' && entry.type === 'system' && typeof entry.content === 'string' && entry.content.toLowerCase().includes('rolagem'));
    if (!hasRollLog) {
        logEntries.push({
            type: 'system',
            content: `Rolagem solicitada: ${reason} (${dice}, modificador ${modifier >= 0 ? `+${modifier}` : modifier}, ${dc}).`,
        });
        issues.push({ path: 'logEntries', problem: 'Adicionada instrução para rolagem solicitada.', fixed: true });
    }
    response.logEntries = logEntries;
};

const sanitizeCurrency = (currency: Record<string, any> | undefined, issues: ValidationIssue[]) => {
    if (!currency || typeof currency !== 'object') return;
    const coins = ['pp', 'gp', 'ep', 'sp', 'cp'];
    coins.forEach(coin => {
        const current = Number(currency[coin]);
        if (!Number.isFinite(current)) return;
        const sanitized = Math.max(current, 0);
        if (sanitized !== current) {
            currency[coin] = sanitized;
            issues.push({ path: `updatedCharacter.currency.${coin}`, problem: 'Valor negativo corrigido para 0.', fixed: true });
        }
    });
};

const applySemanticSanitizer = (response: GameMasterResponse, issues: ValidationIssue[]) => {
    if (response.gameClock) {
        const day = Number(response.gameClock.day ?? 0);
        const hour = Number(response.gameClock.hour ?? 12);
        const normalizedDay = clampNumber(day, 0, 9999);
        const normalizedHour = clampNumber(hour, 0, 23);
        if (normalizedDay !== day) {
            response.gameClock.day = normalizedDay;
            issues.push({ path: 'gameClock.day', problem: 'Dia fora do intervalo foi normalizado.', fixed: true });
        }
        if (normalizedHour !== hour) {
            response.gameClock.hour = normalizedHour;
            issues.push({ path: 'gameClock.hour', problem: 'Hora fora do intervalo foi normalizada.', fixed: true });
        }
    }

    const updatedCharacter = response.updatedCharacter as Record<string, any> | undefined;
    if (updatedCharacter) {
        const attributes = updatedCharacter.attributes as Record<string, any> | undefined;
        if (attributes) {
            ['hp', 'maxHp', 'ac', 'temporaryHp'].forEach(field => {
                const current = attributes[field];
                if (current === undefined) return;
                if (typeof current === 'number' && current < 0) {
                    attributes[field] = 0;
                    issues.push({ path: `updatedCharacter.attributes.${field}`, problem: 'Valor negativo corrigido para 0.', fixed: true });
                }
            });
        }

        if (typeof updatedCharacter.hp === 'number' && updatedCharacter.hp < 0) {
            updatedCharacter.hp = 0;
            issues.push({ path: 'updatedCharacter.hp', problem: 'HP negativo corrigido para 0.', fixed: true });
        }

        sanitizeCurrency(updatedCharacter.currency, issues);
    }

    if (response.playerRollRequest) {
        const dc = response.playerRollRequest.dc;
        if (typeof dc === 'number' && dc < 0) {
            response.playerRollRequest.dc = 0;
            issues.push({ path: 'playerRollRequest.dc', problem: 'DC negativo corrigido para 0.', fixed: true });
        }
    }

    if (Array.isArray(response.xpEvents)) {
        response.xpEvents = response.xpEvents.filter(event => Boolean(event));
    }

    if (response.combatState && typeof response.combatState === 'object') {
        sanitizeCombatState(response.combatState as any, issues);
    }

    if (response.shopState && typeof response.shopState === 'object') {
        sanitizeShopState(response.shopState as any, issues);
    }

    return response;
};

const sanitizeCombatState = (state: any, issues: ValidationIssue[]) => {
    const safeNumber = (value: any, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.min(Math.max(num, min), max);
    };

    state.round = safeNumber(state.round, 1, 1, 9999);
    state.turn = safeNumber(state.turn, 0, 0, 99);
    state.isActive = Boolean(state.isActive);

    if (!Array.isArray(state.combatants)) {
        state.combatants = [];
        issues.push({ path: 'combatState.combatants', problem: 'Lista vazia ou inválida; redefinida como [].', fixed: true });
    }

    const seenIds = new Set<string>();
    state.combatants = state.combatants
        .map((combatant: any, index: number) => {
            if (!combatant || typeof combatant !== 'object') {
                issues.push({ path: `combatState.combatants[${index}]`, problem: 'Combatente inválido removido.', fixed: true });
                return null;
            }
            let id = typeof combatant.id === 'string' && combatant.id.trim()
                ? combatant.id.trim()
                : combatant.name || `combatant-${index + 1}`;
            id = id.slice(0, 64);
            while (seenIds.has(id)) {
                id = `${id}-${Math.random().toString(36).slice(2, 4)}`;
            }
            seenIds.add(id);
            combatant.id = id;

            if (!combatant.hp || typeof combatant.hp !== 'object') {
                combatant.hp = { current: 0, max: 0 };
                issues.push({ path: `combatState.combatants[${index}].hp`, problem: 'HP ausente; definido para 0.', fixed: true });
            }
            combatant.hp.current = safeNumber(combatant.hp.current, 0, 0, 9999);
            combatant.hp.max = safeNumber(combatant.hp.max, combatant.hp.current, 1, 9999);
            if (combatant.hp.current > combatant.hp.max) {
                combatant.hp.current = combatant.hp.max;
            }

            combatant.ac = safeNumber(combatant.ac, 10, 0, 99);
            combatant.actionPoints = safeNumber(combatant.actionPoints, 0, 0, 30);
            combatant.bonusActionPoints = safeNumber(combatant.bonusActionPoints, 0, 0, 30);
            combatant.hasActed = Boolean(combatant.hasActed);
            combatant.hasMoved = Boolean(combatant.hasMoved);
            combatant.isDead = Boolean(combatant.isDead);
            combatant.conditions = Array.isArray(combatant.conditions)
                ? combatant.conditions.filter((c: any) => typeof c === 'string')
                : [];
            if (!Array.isArray(combatant.rollHistory)) {
                combatant.rollHistory = [];
            }
            return combatant;
        })
        .filter(Boolean);

    if (!Array.isArray(state.log)) {
        state.log = [];
    } else if (state.log.length > 20) {
        state.log = state.log.slice(-20);
    }
};

const sanitizeShopState = (state: any, issues: ValidationIssue[]) => {
    state.isOpen = Boolean(state.isOpen);
    state.isHaggling = Boolean(state.isHaggling);
    if (typeof state.name !== 'string' || !state.name.trim()) {
        state.name = 'Loja Desconhecida';
        issues.push({ path: 'shopState.name', problem: 'Nome ausente; utilizando padrão.', fixed: true });
    }

    if (!Array.isArray(state.inventory)) {
        state.inventory = [];
    } else {
        state.inventory = state.inventory
            .map((item: any, index: number) => {
                if (!item || typeof item !== 'object') return null;
                const normalized: Record<string, any> = { ...item };
                if (typeof normalized.id !== 'string' || !normalized.id.trim()) {
                    normalized.id = `item-${index + 1}`;
                }
                if (typeof normalized.name !== 'string') {
                    normalized.name = `Item ${index + 1}`;
                }
                normalized.price = Number(normalized.price ?? normalized.cost ?? 0);
                return normalized;
            })
            .filter(Boolean);
    }

    if (!state.sellPrices || typeof state.sellPrices !== 'object') {
        state.sellPrices = {};
    }
};

const ensureArray = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

const normalizeGameClock = (
    response: GameMasterResponse,
    context?: ValidatorContext
) => {
    const world = response.worldState || {};
    const inferredHour = (() => {
        const time = (world.timeOfDay || '').toLowerCase();
        if (time.includes('manhã')) return 9;
        if (time.includes('tarde')) return 15;
        if (time.includes('noite')) return 21;
        return 12;
    })();
    return {
        day: context?.gameClock?.day ?? response.gameClock?.day ?? 0,
        hour: context?.gameClock?.hour ?? response.gameClock?.hour ?? inferredHour,
        weather: context?.gameClock?.weather ?? response.gameClock?.weather ?? world.weather ?? 'clear',
    };
};

const enforceCombatConsistency = (
    response: GameMasterResponse,
    issues: ValidationIssue[]
) => {
    if (!response.combatState || typeof response.combatState !== 'object' || !response.combatState.isActive) {
        return;
    }
    if (!Array.isArray(response.combatState.combatants) || response.combatState.combatants.length === 0) {
        response.combatState.combatants = [
            {
                id: 'emergent-threat',
                name: 'Ameaça Desconhecida',
                hp: { current: 1, max: 1 },
                ac: 10,
                actionPoints: 1,
                bonusActionPoints: 0,
                isPlayer: false,
                hasActed: false,
                hasMoved: false,
                isDead: false,
                conditions: [],
                rollHistory: [],
            },
        ] as any;
        issues.push({
            path: 'combatState.combatants',
            problem: 'Combatentes ausentes em combate ativo; stub adicionado.',
            fixed: true,
        });
    }
    const hasCombatLog = ensureArray(response.logEntries).some(entry => entry?.type === 'combat');
    if (!hasCombatLog) {
        response.logEntries = [
            ...ensureArray(response.logEntries),
            {
                type: 'combat',
                content: 'Os combatentes se reposicionam aguardando sua decisão imediata.',
            },
        ];
        issues.push({
            path: 'logEntries',
            problem: 'Inserida menção de combate para manter coerência do turno.',
            fixed: true,
        });
    }
};

const enforceGameClockConsistency = (
    response: GameMasterResponse,
    context: ValidatorContext | undefined,
    issues: ValidationIssue[]
) => {
    if (!context?.gameClock || !response.gameClock) return;
    const ctx = context.gameClock;
    const res = response.gameClock;
    const ctxValue = (ctx.day ?? 0) * 24 + (ctx.hour ?? 0);
    const resValue = (res.day ?? 0) * 24 + (res.hour ?? 0);
    if (resValue < ctxValue) {
        response.gameClock.day = ctx.day ?? res.day ?? 0;
        response.gameClock.hour = ctx.hour ?? res.hour ?? 12;
        issues.push({
            path: 'gameClock',
            problem: 'Retrocesso temporal detectado; valores restaurados ao último snapshot.',
            fixed: true,
        });
    }
};

const dedupeInventory = (response: GameMasterResponse, issues: ValidationIssue[]) => {
    const inventory = (response.updatedCharacter as any)?.inventory;
    if (!Array.isArray(inventory) || inventory.length <= 1) return;
    const seen = new Map<string, any>();
    const normalized = inventory.reduce((acc: any[], item: any) => {
        if (!item || typeof item !== 'object' || typeof item.name !== 'string') return acc;
        const key = item.name.toLowerCase();
        if (seen.has(key)) {
            const existing = seen.get(key);
            const qty = Number(item.quantity) || 0;
            existing.quantity = (existing.quantity || 0) + qty;
            return acc;
        }
        const clone = { ...item };
        seen.set(key, clone);
        acc.push(clone);
        return acc;
    }, []);
    if (normalized.length !== inventory.length) {
        (response.updatedCharacter as any).inventory = normalized;
        issues.push({
            path: 'updatedCharacter.inventory',
            problem: 'Itens duplicados consolidados.',
            fixed: true,
        });
    }
};

const detectLogicalAnomalies = (response: GameMasterResponse): ValidationIssue[] => {
    const anomalies: ValidationIssue[] = [];
    const logEntries = ensureArray(response.logEntries);
    if (response.combatState?.isActive) {
        const hasCombat = logEntries.some(entry => entry?.type === 'combat');
        if (!hasCombat) {
            anomalies.push({
                path: 'combatState.log',
                problem: 'Combate ativo sem registros narrativos correspondentes.',
                fixed: false,
            });
        }
    } else if (Array.isArray(response.xpEvents)) {
        const combatXp = response.xpEvents.some(event => event?.type === 'combat');
        if (combatXp) {
            anomalies.push({
                path: 'xpEvents',
                problem: 'XP de combate emitido apesar de combate inativo.',
                fixed: false,
            });
        }
    }
    return anomalies;
};

export const runGmValidator = (
    rawResponse: GameMasterResponse | null | undefined,
    context?: ValidatorContext
): GmValidatorResult => {
    const working: GameMasterResponse = rawResponse
        ? JSON.parse(JSON.stringify(rawResponse))
        : { logEntries: [], actionOptions: [] };

    const issues: ValidationIssue[] = [];

    const logEntries = ensureArray(working.logEntries);
    if (logEntries.length === 0) {
        logEntries.push({ ...DEFAULT_LOG_ENTRY });
        issues.push({ path: 'logEntries', problem: 'Campo vazio', fixed: true });
    }
    working.logEntries = logEntries;

    let actionOptions = ensureArray(working.actionOptions);
    if (actionOptions.length < 3) {
        while (actionOptions.length < 3) {
            actionOptions.push(DEFAULT_ACTION_OPTIONS[actionOptions.length % DEFAULT_ACTION_OPTIONS.length]);
        }
        issues.push({
            path: 'actionOptions',
            problem: 'Quantidade insuficiente de opções',
            fixed: true,
        });
    }
    working.actionOptions = sanitizeActionOptions(actionOptions, issues);

    working.updatedCharacter = working.updatedCharacter || {};

    if (!working.worldState) {
        working.worldState = {
            timeOfDay: 'Manhã',
            weather: 'Ensolarado',
            currentRegion: 'Desconhecida',
        };
        issues.push({ path: 'worldState', problem: 'Campo ausente, valor padrão aplicado', fixed: true });
    }

    working.gameClock = normalizeGameClock(working, context);
    working.memoryContext = working.memoryContext || {
        summary: context?.memorySummary ?? '',
        references: context?.memoryReferences ?? [],
    };
    working.memoryContext = sanitizeMemoryContext(working.memoryContext, issues);

    ensureRollNarration(working, issues);

    if (Array.isArray(working.progressionFeed)) {
        working.progressionFeed = sanitizeProgressionFeed(working.progressionFeed, issues);
    }

    if (working.lootOffer) {
        working.lootOffer = sanitizeLootOffer(working.lootOffer, issues);
    }

    if (Array.isArray(working.newHomebrewContent)) {
        working.newHomebrewContent = sanitizeHomebrewList(working.newHomebrewContent, issues);
    }

    if (Array.isArray(working.xpEvents)) {
        working.xpEvents = sanitizeXpEvents(working.xpEvents, issues);
    }

    const parsed = GameMasterResponseSchema.safeParse(working);
    if (!parsed.success) {
        const flattened = parsed.error.flatten();
        Object.entries(flattened.fieldErrors).forEach(([path, problems]) => {
            problems?.forEach(problem =>
                issues.push({
                    path,
                    problem,
                    fixed: false,
                })
            );
        });
        return { validatedResponse: working, issues };
    }

    const semanticallySafe = applySemanticSanitizer(parsed.data, issues);
    enforceCombatConsistency(semanticallySafe, issues);
    enforceGameClockConsistency(semanticallySafe, context, issues);
    dedupeInventory(semanticallySafe, issues);
    issues.push(...detectLogicalAnomalies(semanticallySafe));

    return {
        validatedResponse: semanticallySafe,
        issues,
    };
};
