import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';
import { buildCompactPromptSections } from './promptSections.js';
import { createSystemInstruction } from './instructions.js';
import { buildMemoryGraph, formatMemoryGraphSnippet } from '../game/memoryGraph.js';
import { CURRENT_SCHEMA_VERSION, GAME_MASTER_SCHEMA_HASH } from '../services/schemaIntegrityService.js';

const MAX_PROMPT_INVENTORY_ITEMS = 12;
const MAX_PROMPT_PROFICIENCIES = 8;
const MAX_PROMPT_RELATIONSHIPS = 6;
const STORY_SO_FAR_CHAR_LIMIT = 800;

const STATE_PHASE_ALLOWED_FIELDS_LABEL = [
    'updatedCharacter',
    'worldState',
    'combatState',
    'playerRollRequest',
    'xpEvents',
    'progressionFeed',
    'newHomebrewContent',
    'levelUpState',
    'shopState',
    'lootOffer',
    'useHitDiceRequest',
    'gameClock',
    'memoryContext',
    'systemLog',
    '_meta',
].join(', ');

const condenseCombatStateForPrompt = (combatState: any) => {
    if (!combatState || typeof combatState !== 'object' || !Array.isArray(combatState.combatants)) {
        return combatState;
    }

    const mapEffects = (effects: any[] | undefined, max: number) => {
        if (!Array.isArray(effects) || effects.length === 0) return [];
        return effects.slice(0, max).map(effect => ({
            name: effect?.name,
            remainingRounds: effect?.remainingRounds,
            severity: effect?.severity,
        }));
    };

    const mapCooldowns = (cooldowns: any[] | undefined, max: number) => {
        if (!Array.isArray(cooldowns) || cooldowns.length === 0) return [];
        return cooldowns.slice(0, max).map(entry => ({
            name: entry?.name,
            remainingRounds: entry?.remainingRounds,
            totalRounds: entry?.totalRounds,
        }));
    };

    const condensedCombatants = combatState.combatants.map((combatant: any) => ({
        id: combatant.id,
        name: combatant.name,
        attitude: combatant.attitude,
        hp: combatant.hp,
        ac: combatant.ac,
        actionPoints: combatant.actionPoints,
        bonusActionPoints: combatant.bonusActionPoints,
        isPlayer: combatant.isPlayer,
        isDead: combatant.isDead,
        hasMoved: combatant.hasMoved,
        hasActed: combatant.hasActed,
        distance: combatant.distance,
        zone: combatant.zone,
        conditions: combatant.conditions,
        statusEffects: mapEffects(combatant.statusEffects, 4),
        cooldowns: mapCooldowns(combatant.cooldowns, 4),
    }));

    const recentLog = Array.isArray(combatState.log)
        ? combatState.log.slice(-5)
        : undefined;

    return {
        isActive: combatState.isActive,
        round: combatState.round,
        turn: combatState.turn,
        initiativeOrder: combatState.initiativeOrder,
        combatants: condensedCombatants,
        recentLog,
    };
};

const safeArray = <T>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];
const COIN_INDICES = new Set(['pp', 'gp', 'ep', 'sp', 'cp']);
const toPositiveInteger = (value: any, fallback = 1): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.floor(parsed));
};
const isCurrencyItem = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const index = typeof item.index === 'string' ? item.index.toLowerCase() : '';
    return COIN_INDICES.has(index);
};
const expandInventoryForPrompt = (items: any[]): any[] => {
    const collapsed: any[] = [];
    for (const entry of items) {
        if (!entry || typeof entry !== 'object') continue;
        const safeQuantity = toPositiveInteger(entry.quantity ?? 1);
        const normalized = { ...entry, quantity: safeQuantity };
        if ('stackInstance' in normalized) {
            delete normalized.stackInstance;
        }
        if (safeQuantity > 1 && !isCurrencyItem(entry)) {
            normalized.stackSize = safeQuantity;
        } else if ('stackSize' in normalized) {
            delete normalized.stackSize;
        }
        collapsed.push(normalized);
    }
    return collapsed;
};

const buildNarrativeDecisionTags = (character: any, playerAction?: string): string[] => {
    const tags = new Set<string>();
    const normalize = (value?: string | null) =>
        typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '-') : null;

    const world = character?.worldState;
    const normalizedRegion = normalize(world?.currentRegion);
    if (normalizedRegion) tags.add(`reg:${normalizedRegion}`);
    const normalizedPoi = normalize(world?.poiSlug);
    if (normalizedPoi) tags.add(`poi:${normalizedPoi}`);
    if (Array.isArray(world?.visitedRegions) && world.visitedRegions.length) {
        tags.add(`visited:${world.visitedRegions.length}`);
    }

    if (Array.isArray(character?.journal) && character.journal.length) {
        const activeQuest = character.journal.find((entry: any) => entry?.status && entry.status !== 'completed') ?? character.journal[0];
        const questName = normalize(activeQuest?.name);
        if (questName) tags.add(`quest:${questName}`);
        const questStatus = normalize(activeQuest?.status);
        if (questStatus) tags.add(`quest-status:${questStatus}`);
    }

    if (Array.isArray(character?.relationships) && character.relationships.length) {
        const ally = character.relationships.find((rel: any) => rel?.status === 'ally') ?? character.relationships[0];
        const allyName = normalize(ally?.name);
        if (allyName) tags.add(`npc:${allyName}`);
    }

    const actionText = (playerAction ?? '').toLowerCase();
    if (/investig|procur/.test(actionText)) tags.add('intent:investigate');
    if (/combate|atac|defes|luta/.test(actionText)) tags.add('intent:combat');
    if (/loot|saque|recompensa/.test(actionText)) tags.add('intent:loot');
    if (/convers|dialog|social/.test(actionText)) tags.add('intent:social');
    if (/recuper|descans|curar/.test(actionText)) tags.add('intent:recover');

    return Array.from(tags).slice(0, 6);
};

const narrativeExampleSnippet = `{"logEntries":[{"type":"narration","content":"Visão breve do cenário."},{"type":"system","content":"Observação objetiva."}],"actionOptions":[{"text":"Explorar o arco violeta","action":"explore","skill":"perception"},{"text":"Investigar o beco estreito","action":"investigate","skill":"stealth"},{"text":"Recuperar fôlego e observar","action":"wait"}],"systemLog":"Notas concisas sobre verificações e ganchos."}`;
const stateExampleSnippet = `{"logEntries":[],"actionOptions":[],"updatedCharacter":{"worldState":{"currentRegion":"biblioteca-arcana","timeOfDay":"Manhã"}},"worldState":{"currentRegion":"biblioteca-arcana","poiSlug":"arco-violeta"},"playerRollRequest":{"reason":"Teste de Arcana para purificar a relíquia","dice":"1d20","dc":15,"rollType":"check"},"systemLog":"Estado consolidado após a ação.","_meta":{"version":${CURRENT_SCHEMA_VERSION},"hash":"${GAME_MASTER_SCHEMA_HASH}"}}`;

const SCENARIO_STATE_DIRECTIVES: Record<string, string[]> = {
    'Recuperação / loot': [
        'Forneça lootOffer com moedas ou itens coerentes OU inclua updatedCharacter.inventory/currency refletindo o saque.',
        'Se houve descanso ou cura, atualize useHitDiceRequest e HP/conditions relevantes.',
        'Forneça lootOffer com moedas ou itens coerentes OU inclua updatedCharacter.inventory/currency refletindo o saque.',
        'Se houve descanso ou cura, atualize useHitDiceRequest e HP/conditions relevantes.',
        'Atualize currency do personagem quando ganhar GP; não deixe lootOffer desconectado do inventário.',
    ],
    'Visita à loja': [
        'Inclua shopState com isOpen=true, lista de itens e preços, além de limites de compra/venda.',
        'Ao registrar compras/vendas, atualize apenas os deltas em updatedCharacter.inventory/currency.',
        'Se a loja permanecer aberta, persista shopState para o próximo turno (não remova sem motivo).',
    ],
    'Revisão de progresso': [
        'Liste xpEvents e progressionFeed descrevendo XP ganhos e marcos recentes.',
        'Se o nível mudou, retorne levelUpState detalhando a evolução.',
        'Mesmo sem evolução, registre progresso planejado (xpEvents vazia não é aceita).',
    ],
    'Combate prolongado': [
        'Mantenha combatState.isActive=true e atualize combatants, turno, rodada e condições persistentes.',
        'Aplique deltas de HP/status nos combatentes que agiram neste turno.',
        'Não encerre o combate enquanto hostis estiverem em campo; mantenha lootOffer vazio até o fim.',
        'Se solicitar rolagem, use playerRollRequest.rollType="check" e coloque a perícia no reason (ex.: "Teste de Atletismo para resistir à investida").',
    ],
    'Desafio multi-rolagem': [
        'Inclua playerRollRequest com requestId único (ex.: "rollreq_multiskill_01"), rollType apropriado, DC explícito e razão da rolagem.',
        'Cite as skills/atributos envolvidos nas rolagens encadeadas deste desafio.',
    ],
    'Registro de NPCs e quests': [
        'Atualize updatedCharacter.relationships/journal somente com entradas que mudaram desde o turno anterior.',
        'Registre reputações/missões em progressionFeed ou memoryContext quando houver novidades relevantes.',
    ],
    'Queda e recuperação': [
        'Atualize HP/conditions do personagem; se usar dados de vida, preencha useHitDiceRequest com maxDice/hitDieValue.',
        'Registre efeitos persistentes (exaustão, penalidades) em updatedCharacter ou memoryContext.',
    ],
    'Resumo final controlado': [
        'Consolide progressionFeed com XP, lootOffer, shopState e localização final antes de encerrar.',
        'Inclua xpEvents resumindo a XP total deste ciclo (mesmo que nenhum ganho tenha ocorrido).',
    ],
};

const buildScenarioStateDirectiveBlock = (label?: string): string => {
    if (!label) return '';
    const directives = SCENARIO_STATE_DIRECTIVES[label];
    if (!directives || !directives.length) return '';
    const bulletList = directives.map(entry => `- ${entry}`).join('\n');
    return `Diretivas específicas para "${label}":\n${bulletList}`;
};

export const createPrompt = (input: GameMasterFlowInput, isGemma: boolean) => {
    const {
        character,
        playerAction,
        gameLog,
        combatState,
        homebrewSummary,
        validationFeedback,
        storySummary,
        timelineFacts,
        regionSlug,
        regionGraphSummary,
        responseFocus: providedFocus,
    } = input;
    const focus = providedFocus ?? 'full';
    const includeNarrativeBrief = focus !== 'state';
    const includeStateBrief = focus !== 'narrative';
    const phaseLabel = focus === 'narrative'
        ? 'FASE_ATUAL=NARRATIVA'
        : focus === 'state'
            ? 'FASE_ATUAL=ESTADO'
            : 'FASE_ATUAL=COMPLETA';
    const focusInstruction = (() => {
        if (focus === 'narrative') {
            return `### FASE NARRATIVA (APENAS STORY + OPÇÕES)
Estrutura obrigatória (JSON completo, sem campos extras):
${narrativeExampleSnippet}
- Gere pelo menos 2 logEntries e 3 actionOptions coerentes com o turno.
- Não replique inventário, proficiências ou listas extensas; a fase narrativa só precisa de contexto textual.
- NÃO inclua updatedCharacter, worldState, combatState, xpEvents, memoryContext, playerRollRequest ou qualquer outro campo de estado; mantenha-os omitidos.
- Não solicite rolagens aqui. Se perceber que uma rolagem será necessária, registre essa intenção em systemLog (texto curto) para a fase seguinte.
- Mantenha systemLog sucinto (ex.: “Verificação de Percepção necessária se o jogador seguir pelo beco”).`;
        }
        if (focus === 'state') {
            const suppressRollDirective = input.suppressRollRequest
                ? 'Se suppressRollRequest=true, NÃO retorne playerRollRequest (o backend registrará que nenhuma rolagem foi solicitada).'
                : 'Só gere playerRollRequest quando realmente necessário e descreva no systemLog o motivo da rolagem.';
            const scenarioDirectiveBlock = buildScenarioStateDirectiveBlock(input.scenarioLabel);
            return `### FASE DE ESTADO (APENAS DELTAS)
Campos permitidos: ${STATE_PHASE_ALLOWED_FIELDS_LABEL}.
Estrutura obrigatória (JSON completo, sem campos extras):
${stateExampleSnippet}
- ${scenarioDirectiveBlock || 'Sem diretivas adicionais específicas para este turno.'}
- NÃO retorne logEntries/actionOptions ou snapshots completos; envie apenas os deltas solicitados.
- logEntries e actionOptions DEVEM ser arrays vazios ( [] ).
- Atualize updatedCharacter e worldState somente com os campos que MUDARAM. Se nada mudou, devolva {}.
- Não aninhe worldState dentro de updatedCharacter se já estiver preenchendo o campo dedicado.
- Atualize combatState, xpEvents, progressionFeed, lootOffer etc. apenas se houver mudanças reais.
- ${suppressRollDirective}
- Sempre use playerRollRequest.rollType="check" e descreva a perícia/atributo em reason (ex.: "Teste de Arcana para purificar a relíquia").
- Sempre que lootOffer conceder moedas/itens, atualize updatedCharacter.currency/inventory apenas com os deltas correspondentes.
- Se o gameClock já existir, reporte o novo dia/hora sem retroceder valores.
- Mantenha systemLog como um resumo objetivo das atualizações aplicadas.`;
        }
        return '';
    })();

    const simplifyInventoryItem = (item: any) => {
        if (!item) return null;
        const parsedQuantity = Number(item.quantity);
        const safeQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

        const simplified: Record<string, any> = {
            id: item.id ?? null,
            index: item.index ?? null,
            name: item.name,
            quantity: safeQuantity,
            equipped: Boolean(item.equipped),
        };

        if (item.weight !== undefined) simplified.weight = item.weight;
        if (item.weapon_category) simplified.weapon_category = item.weapon_category;
        if (item.weapon_range) simplified.weapon_range = item.weapon_range;
        if (item.armor_category) simplified.armor_category = item.armor_category;
        if (item.armor_class) {
            simplified.armor_class = {
                base: item.armor_class.base ?? null,
                dex_bonus: item.armor_class.dex_bonus ?? false,
                max_bonus: item.armor_class.max_bonus ?? null,
            };
        }
        const equipmentCategoryIndex = item.equipment_category?.index || item.equipment_category;
        if (equipmentCategoryIndex) simplified.equipment_category = equipmentCategoryIndex;
        if (item.cost?.quantity && item.cost?.unit) {
            simplified.cost = { quantity: item.cost.quantity, unit: item.cost.unit };
        }
        if (item.damage?.damage_dice || item.damage?.damage_type?.name) {
            simplified.damage = {
                dice: item.damage?.damage_dice ?? null,
                type: item.damage?.damage_type?.name ?? null,
            };
        }
        if (item.two_handed_damage?.damage_dice || item.two_handed_damage?.damage_type?.name) {
            simplified.two_handed_damage = {
                dice: item.two_handed_damage?.damage_dice ?? null,
                type: item.two_handed_damage?.damage_type?.name ?? null,
            };
        }
        if (Array.isArray(item.properties) && item.properties.length > 0) {
            simplified.properties = item.properties
                .map((prop: any) => prop?.index || prop?.name)
                .filter(Boolean);
        }
        if (item.consumable) simplified.consumable = true;
        if (item.usable) simplified.usable = true;
        if (item.recoverable) simplified.recoverable = true;

        return simplified;
    };
    
    // Create a leaner character object for the prompt
    let inventoryCondensedNote = '';
    let proficiencyCondensedNote = '';
    let relationshipCondensedNote = '';
    let storyCondensedNote = '';
    const expandedInventory = expandInventoryForPrompt(safeArray(character?.inventory));
    const characterForPrompt = character ? {
        name: character.name,
        race: character.race,
        characterClass: character.characterClass,
        level: character.level,
        attributes: character.attributes,
        proficiencies: safeArray(character.proficiencies),
        inventory: expandedInventory
            .map((item: any) => simplifyInventoryItem(item))
            .filter(Boolean),
        spells: safeArray(character.spells),
        storySoFar: character.storySoFar,
        worldState: character.worldState,
        gameClock: (character as any)?.gameClock,
        currency: (character as any)?.currency,
        relationships: safeArray(character.relationships).map((r: any) => ({
            name: r.name,
            status: r.status,
            affinity: r.affinity,
            regionSlug: r.regionSlug,
            poiSlug: r.poiSlug,
            description: r.description,
        })),
        journal: safeArray(character.journal).map((j: any) => ({ name: j.name, region: j.region, status: j.looted ? 'looted' : 'unexplored' }))
    } : null;

    if (characterForPrompt) {
        if (Array.isArray(characterForPrompt.inventory)) {
            const totalItems = characterForPrompt.inventory.length;
            if (totalItems > MAX_PROMPT_INVENTORY_ITEMS) {
                characterForPrompt.inventory = characterForPrompt.inventory.slice(0, MAX_PROMPT_INVENTORY_ITEMS);
                const hiddenCount = totalItems - MAX_PROMPT_INVENTORY_ITEMS;
                inventoryCondensedNote = `INVENTARIO=Inventário condensado (${totalItems} itens; ${hiddenCount} estáveis e não alterados). Não replique itens inalterados em suas respostas.\n`;
                console.warn(`[aiService] Inventário do personagem condensado de ${totalItems} para ${MAX_PROMPT_INVENTORY_ITEMS} itens no prompt.`);
            }
        }
        if (Array.isArray(characterForPrompt.proficiencies)) {
            const totalProfs = characterForPrompt.proficiencies.length;
            if (totalProfs > MAX_PROMPT_PROFICIENCIES) {
                characterForPrompt.proficiencies = characterForPrompt.proficiencies.slice(0, MAX_PROMPT_PROFICIENCIES);
                proficiencyCondensedNote = `PROFICIENCIAS=Lista condensada (${totalProfs} itens; mantenha consistência apenas com as ${MAX_PROMPT_PROFICIENCIES} exibidas).\n`;
                console.warn(`[aiService] Proficiencias condensadas de ${totalProfs} para ${MAX_PROMPT_PROFICIENCIES} itens no prompt.`);
            }
        }
        if (Array.isArray(characterForPrompt.relationships)) {
            const totalRelationships = characterForPrompt.relationships.length;
            if (totalRelationships > MAX_PROMPT_RELATIONSHIPS) {
                const hiddenCount = totalRelationships - (MAX_PROMPT_RELATIONSHIPS - 1);
                characterForPrompt.relationships = [
                    ...characterForPrompt.relationships.slice(0, MAX_PROMPT_RELATIONSHIPS - 1),
                    { name: `+${hiddenCount} aliados/npcs`, status: 'summarized', affinity: null },
                ];
                relationshipCondensedNote = `RELACIONAMENTOS=Lista resumida (${totalRelationships} registros; consulte banco interno para demais NPCs).\n`;
                console.warn(`[aiService] Relacionamentos condensados de ${totalRelationships} para ${MAX_PROMPT_RELATIONSHIPS} entradas no prompt.`);
            }
        }
        if (typeof characterForPrompt.storySoFar === 'string' && characterForPrompt.storySoFar.length > STORY_SO_FAR_CHAR_LIMIT) {
            characterForPrompt.storySoFar = `${characterForPrompt.storySoFar.slice(0, STORY_SO_FAR_CHAR_LIMIT)}...`;
            storyCondensedNote = `HISTORICO=Resumo truncado (texto completo com ${character.storySoFar.length} caracteres mantido no backend).\n`;
        }
    }

    let characterPayload = characterForPrompt ? { ...characterForPrompt } : null;
    const narrativeDecisionTags = buildNarrativeDecisionTags(character ?? {}, playerAction);
    if (characterPayload && focus === 'narrative') {
        characterPayload = {
            name: characterPayload.name,
            race: characterPayload.race,
            characterClass: characterPayload.characterClass,
            level: characterPayload.level,
            attributes: characterPayload.attributes,
            storySoFar: characterPayload.storySoFar,
            worldState: characterPayload.worldState,
            relationships: characterPayload.relationships?.slice(0, 2),
            ...(narrativeDecisionTags.length ? { decisionTags: narrativeDecisionTags } : {}),
        };
    }
    const characterContext = JSON.stringify(characterPayload ?? {});
    const homebrewSection = homebrewSummary ? `HOMEBREW=${homebrewSummary.trim()}\n` : '';
    const combatContextValue = combatState && combatState.isActive
        ? JSON.stringify(condenseCombatStateForPrompt(combatState))
        : '{}';

    const feedbackSection = validationFeedback
        ? `FEEDBACK=${validationFeedback.trim()}\n`
        : '';

    const summarySection = includeNarrativeBrief && storySummary ? `RESUMO=${storySummary}\n` : '';
    const timelineSection = includeNarrativeBrief && timelineFacts ? `FATOS=${timelineFacts}\n` : '';
    const regionSection = includeStateBrief
        ? (regionGraphSummary
            ? `MAPA_REGIAO=${regionSlug ?? 'desconhecida'}\n${regionGraphSummary.trim()}\n`
            : regionSlug
                ? `MAPA_REGIAO=${regionSlug}\n`
                : '')
        : '';
    const memoryGraph = buildMemoryGraph({
        character,
        world: characterForPrompt?.worldState,
        combatState,
    });
    const memoryGraphSnippet = formatMemoryGraphSnippet(memoryGraph);
    const memoryGraphSection = memoryGraphSnippet ? `${memoryGraphSnippet}\n` : '';
    const scenarioExampleSection = input.exampleSnippet && focus !== 'full'
        ? `EXEMPLO_${focus.toUpperCase()}=${input.exampleSnippet}\n`
        : '';
    const worldStateDigest = JSON.stringify(characterForPrompt?.worldState ?? { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' });
    const climateKeyword = includeStateBrief && characterForPrompt?.worldState?.weather
        ? `CLIMA=${characterForPrompt.worldState.weather}\n`
        : '';
    const timeKeyword = includeStateBrief && characterForPrompt?.worldState?.timeOfDay
        ? `PERIODO=${characterForPrompt.worldState.timeOfDay}\n`
        : '';
    const prevClock = characterForPrompt?.gameClock ?? (character as any)?.gameClock ?? null;
    const gameClockNote = focus === 'state' && prevClock
        ? `RELOGIO_ATUAL=dia ${Number(prevClock.day ?? 0)}, hora ${Number(prevClock.hour ?? 0)}. Não retroceda o relógio; avance apenas quando o tempo passar.\n`
        : '';
    const currencyNote = focus === 'state' && characterForPrompt?.currency
        ? `TESOURO_ATUAL=gp ${Number((characterForPrompt.currency as any).gp ?? 0)} (não reduza sem motivo; adicione ganhos quando lootOffer conceder moedas).\n`
        : '';
    const stateDiffHint = focus === 'state'
        ? 'ESTADO_PARCIAL=Informe apenas campos que mudaram desde o último turno; valores omitidos serão interpretados como "sem alteração".\n'
        : '';
    const hintsSection = input.stateHints?.length
        ? `HINTS_APLICADOS=\n${input.stateHints.map(hint => `- ${hint}`).join('\n')}\n`
        : '';
    const metadataSection = `${phaseLabel}\n${stateDiffHint}${gameClockNote}${currencyNote}${climateKeyword}${timeKeyword}${inventoryCondensedNote}${proficiencyCondensedNote}${relationshipCondensedNote}${storyCondensedNote}${summarySection}${timelineSection}${regionSection}${homebrewSection}${feedbackSection}${hintsSection}`;
    const compactSections = buildCompactPromptSections(input);
    const safeGameLog = typeof gameLog === 'string' && gameLog.trim().length ? gameLog : 'SEM_EVENTOS';

    const mainPrompt = `Responda estritamente com JSON válido. Nenhuma explicação fora do objeto.

${metadataSection ? `${metadataSection}\n` : ''}${compactSections}\n\n### CONTEXTO
${safeGameLog}

### ESTADO DO MUNDO
${worldStateDigest}

### PERSONAGEM
${characterContext}

### COMBATE ATUAL
${combatContextValue}

${memoryGraphSection ? `${memoryGraphSection}` : ''}${scenarioExampleSection ? `${scenarioExampleSection}` : ''}### INSTRUÇÃO
O jogador fez a seguinte ação:
"${playerAction}"

Gere o próximo estado seguindo o formato definido e todas as regras.`;
    const promptWithFocus = focusInstruction
        ? `${focusInstruction}\n\n${mainPrompt}`
        : mainPrompt;
  
    // For Gemma, the full instruction goes into the user prompt
    if (isGemma) {
        const systemInstruction = createSystemInstruction(
            input.useAiHomebrew ?? true,
            input.enableNarrativeRevalidation ?? true
        );
        return `${systemInstruction}\n\n${promptWithFocus}`;
    }

    return promptWithFocus;
}

