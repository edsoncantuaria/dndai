// backend/src/services/narrarService.ts
import { AppDataSource } from '../database/data-source.js';
import { promises as fs } from 'fs';
import path from 'path';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import createError from 'http-errors';
import type { GameMasterResponse, CombatState, ApiSpell, GameMasterFlowInput } from '../schemas/gameSchemas.js';
import { In } from 'typeorm';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import * as HomebrewService from './homebrewService.js';
import { recordArtifactsForSession } from './artifactService.js';
import * as SessaoService from './sessaoService.js';
import redisClient from '../database/redis-client.js';
import { v4 as uuidv4 } from 'uuid';
import { validateGameMasterResponse } from './gameResponseValidator.js';
import { orchestrateGameMasterResponse, generateFallbackResponse } from './gameOrchestrator.js';
import { hydrateInventoryItems, reconcileCurrency } from './inventoryService.js';
import {
    loadCombatEncounterState,
    reconcileCombatStateUpdate,
    projectPublicCombatState,
    type CombatReconciliationResult,
    type LoadedCombatEncounter,
} from './combatStateService.js';
import { applyXpEvents, clampCharacterLevel } from './xpService.js';
import { recordTimelineEventAndSummarize, recordTimelineEvent, generateLevelUpRecap } from './storyService.js';
import type { CombatState as SchemaCombatState } from '../schemas/gameSchemas.js';
import { synthesizeNarrationAudio, buildTtsPlaybackUrl } from './ttsService.js';
import { isImageGenerationAvailable } from './imageGenerationService.js';
import type { AiInteractionMode } from '../types/ai.js';
import { savePendingRollRequest, clearPendingRollRequest, getPendingRollRequest } from './rollRequestService.js';
import { recordUnexpectedAiRoll } from './rollMetricsService.js';
import { runNarrationAiPhases } from '../narration/turnProcessor.js';
import { isMotorOwnedPipeline, stripMotorOwnedFields } from '../narration/motorStateBridge.js';
import { validateByPhaseFocus } from '../ai/responseValidator.js';
import { ensureOssModel } from '../ai-oss/orchestration/narrationPipeline.js';
import { hasResolvableOpenRouterKey } from '../ai-oss/core/apiKeyResolve.js';
import { buildNarrationContext } from '../narration/contextBuilder.js';
import { persistNarrationTurn } from '../narration/persistence.js';
import { buildWorldStateSnapshot } from '../narration/worldStateSnapshot.js';
import { appendSystemLogEntry } from '../narration/systemLog.js';
import { persistValidatedFacts } from './sessionFactService.js';
import { persistPendingLootOffer } from './inventoryMotorService.js';

const PROMPT_LOG_TYPES = new Set(['action', 'narration', 'system', 'combat', 'insight']);
const MAX_PROMPT_LOG_ENTRIES = 12;
const MAX_PROMPT_ENTRY_CHARS = 320;
const truncateText = (value: string, limit = MAX_PROMPT_ENTRY_CHARS) => {
    if (!value) return '';
    return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
};

const persistPhaseSnapshot = async (
    sessaoId: number | undefined,
    phase: 'narrative' | 'state',
    payload: any
) => {
    try {
        const dir = path.join(process.cwd(), 'logs', 'phase-debug');
        await fs.mkdir(dir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sessionLabel = sessaoId ? `session-${sessaoId}` : 'session-unknown';
        const filePath = path.join(dir, `${timestamp}-${sessionLabel}-${phase}.json`);
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (error) {
        console.warn('[phaseDebug] Falha ao gravar snapshot da fase:', error);
    }
};

const unwrapLogPayload = (raw?: string | null): string => {
    if (!raw) return '';
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            if (parsed.storage === 's3' && parsed.key) {
                return `[payload armazenado em ${parsed.key}]`;
            }
            if (typeof parsed.content === 'string') return parsed.content;
            if (typeof parsed.summary === 'string') return parsed.summary;
            return JSON.stringify(parsed);
        }
    } catch {
        // Mantém o texto bruto
    }
    return raw;
};

const buildPromptLogString = (logs: SessionLog[]) => {
    const relevant = logs
        .filter(log => PROMPT_LOG_TYPES.has(log.type))
        .map(log => ({
            role: log.type === 'action' ? 'JOGADOR' : 'MESTRE',
            summary: truncateText(unwrapLogPayload(log.response)),
        }));
    return relevant.slice(-MAX_PROMPT_LOG_ENTRIES).map(entry => `${entry.role}:${entry.summary}`).join('\n');
};


const getPlainTextFromLogEntry = (entry: GameMasterResponse['logEntries'][number]): string | null => {
    if (!entry) return null;
    const resolveContent = (value: any) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') {
            return value.content ?? value.text ?? null;
        }
        return null;
    };

    if (entry.type === 'narration' || entry.type === 'system' || entry.type === 'insight' || entry.type === 'combat') {
        return resolveContent(entry.content);
    }

    if (entry.type === 'roll') {
        const explicitText = resolveContent(entry.content);
        if (explicitText) return explicitText;
        const parts: string[] = [];
        if (entry.rollResult?.description) {
            parts.push(entry.rollResult.description);
        }
        if (typeof entry.rollResult?.total === 'number') {
            const modifier = entry.rollResult.modifier ?? 0;
            parts.push(`Total ${entry.rollResult.total} (${entry.rollResult.dice}${modifier ? ` ${modifier >= 0 ? '+' : '-'} ${Math.abs(modifier)}` : ''}).`);
        }
        if (entry.rollResult?.success === true) {
            parts.push('Resultado: sucesso.');
        } else if (entry.rollResult?.success === false) {
            parts.push('Resultado: falha.');
        }
        return parts.length ? parts.join(' ') : null;
    }

    return null;
};

const attachNarrationAudio = async (response: GameMasterResponse) => {
    if (!response?.logEntries?.length) return;
    for (const entry of response.logEntries) {
        if (!entry || (entry as any).audioUrl) continue;
        const text = getPlainTextFromLogEntry(entry as any);
        if (!text) continue;
        const audio = await synthesizeNarrationAudio(text);
        if (!audio?.key) continue;
        const playbackUrl = audio.url ?? buildTtsPlaybackUrl(audio.key);
        (entry as any).audioUrl = playbackUrl;
        (entry as any).audioKey = audio.key;
        if (typeof entry.content === 'string') {
            entry.content = { content: entry.content, audioUrl: playbackUrl, audioKey: audio.key };
        } else if (entry.content && typeof entry.content === 'object') {
            entry.content.audioUrl = playbackUrl;
            (entry.content as any).audioKey = audio.key;
        } else {
            entry.content = { content: text, audioUrl: playbackUrl, audioKey: audio.key };
        }
    }
};

type AbilityKey = keyof Pick<CharacterAttributes, 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'>;

const normalizeText = (value?: string | null): string =>
    value
        ? value
              .toString()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim()
        : '';

const canonicalWord = (value?: string | null): string =>
    normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

type SkillConfig = {
    key: string;
    ability: AbilityKey;
    keywords: string[];
};

const SKILL_CONFIG: SkillConfig[] = [
    { key: 'athletics', ability: 'strength', keywords: ['atlet'] },
    { key: 'acrobatics', ability: 'dexterity', keywords: ['acroba'] },
    { key: 'sleight-of-hand', ability: 'dexterity', keywords: ['prestidig', 'sleight', 'mao-leve', 'mao leve'] },
    { key: 'stealth', ability: 'dexterity', keywords: ['furtiv', 'stealth'] },
    { key: 'arcana', ability: 'intelligence', keywords: ['arcana'] },
    { key: 'history', ability: 'intelligence', keywords: ['hist', 'history'] },
    { key: 'investigation', ability: 'intelligence', keywords: ['investig'] },
    { key: 'nature', ability: 'intelligence', keywords: ['nature', 'natureza'] },
    { key: 'religion', ability: 'intelligence', keywords: ['relig'] },
    { key: 'animal-handling', ability: 'wisdom', keywords: ['animal', 'adestra', 'handling'] },
    { key: 'insight', ability: 'wisdom', keywords: ['intu', 'insight'] },
    { key: 'medicine', ability: 'wisdom', keywords: ['medici', 'cura'] },
    { key: 'perception', ability: 'wisdom', keywords: ['percep'] },
    { key: 'survival', ability: 'wisdom', keywords: ['sobreviv', 'survival'] },
    { key: 'deception', ability: 'charisma', keywords: ['engan', 'decep'] },
    { key: 'intimidation', ability: 'charisma', keywords: ['intimi'] },
    { key: 'performance', ability: 'charisma', keywords: ['perform', 'apresent'] },
    { key: 'persuasion', ability: 'charisma', keywords: ['persuas', 'convenc'] },
];

const ABILITY_KEYWORDS: Record<AbilityKey, string[]> = {
    strength: ['forca', 'strength', 'str'],
    dexterity: ['destreza', 'dexterity', 'dex'],
    constitution: ['constitu', 'constitution', 'con'],
    intelligence: ['intelig', 'intelligence', 'int'],
    wisdom: ['sabedor', 'sabedoria', 'wisdom', 'wis'],
    charisma: ['carism', 'charisma', 'cha'],
};

const abilityKeywordEntries = Object.entries(ABILITY_KEYWORDS) as Array<[AbilityKey, string[]]>;

type ProficiencySnapshot = {
    skillKeys: Set<string>;
    savingThrows: Set<AbilityKey>;
};

const buildProficiencySnapshot = (character: Character | null | undefined): ProficiencySnapshot => {
    const snapshot: ProficiencySnapshot = {
        skillKeys: new Set<string>(),
        savingThrows: new Set<AbilityKey>(),
    };

    const registerSkill = (value?: string) => {
        const key = canonicalWord(value);
        if (!key) return;
        if (key.startsWith('skill-')) {
            snapshot.skillKeys.add(key.slice(6));
        } else {
            snapshot.skillKeys.add(key);
        }
    };

    const registerSave = (value?: string) => {
        const key = canonicalWord(value);
        if (!key) return;
        if (key.startsWith('saving-throw-')) {
            registerSave(key.slice('saving-throw-'.length));
            return;
        }
        const abilityEntry = abilityKeywordEntries.find(([, keywords]) =>
            keywords.some(keyword => key.includes(keyword))
        );
        if (abilityEntry) {
            snapshot.savingThrows.add(abilityEntry[0]);
        }
    };

    const registerFromText = (value?: string) => {
        const normalized = normalizeText(value);
        if (!normalized) return;
        for (const config of SKILL_CONFIG) {
            if (config.keywords.some(keyword => normalized.includes(keyword)) || normalized.includes(config.key)) {
                registerSkill(config.key);
            }
        }
        const abilityMatch = abilityKeywordEntries.find(([, keywords]) =>
            keywords.some(keyword => normalized.includes(keyword))
        );
        if (abilityMatch && (normalized.includes('save') || normalized.includes('salvaguarda') || normalized.includes('salvamento') || normalized.includes('resistencia'))) {
            snapshot.savingThrows.add(abilityMatch[0]);
        }
    };

    const sourceProficiencies = Array.isArray(character?.proficiencies) ? character!.proficiencies : [];
    if (!sourceProficiencies.length) {
        return snapshot;
    }

    for (const proficiency of sourceProficiencies) {
        if (!proficiency) continue;
        if (typeof proficiency === 'string') {
            registerFromText(proficiency);
            continue;
        }
        const normalizedIndex = canonicalWord(proficiency?.index);
        const normalizedName = canonicalWord(proficiency?.name);
        const normalizedType = canonicalWord(proficiency?.type);

        if (normalizedType.includes('skill')) {
            registerSkill(normalizedIndex || normalizedName);
            registerFromText(proficiency?.name);
            continue;
        }
        if (normalizedType.includes('saving') || normalizedType.includes('resist')) {
            registerSave(normalizedIndex || normalizedName);
            registerFromText(proficiency?.name);
            continue;
        }

        if (normalizedIndex.includes('skill')) registerSkill(normalizedIndex);
        if (normalizedName.includes('skill')) registerSkill(normalizedName);
        if (normalizedIndex.includes('saving-throw') || normalizedIndex.includes('salvaguarda')) registerSave(normalizedIndex);
        if (normalizedName.includes('saving-throw') || normalizedName.includes('salvaguarda')) registerSave(normalizedName);
        registerFromText(proficiency?.name);
    }

    return snapshot;
};

type RollIntent =
    | { ability: AbilityKey; proficiency: 'skill'; skillKey: string }
    | { ability: AbilityKey; proficiency: 'save' }
    | { ability: AbilityKey; proficiency: null };

const inferRollIntent = (request: PlayerRollRequest | null | undefined): RollIntent | null => {
    if (!request?.reason) return null;
    const normalizedReason = normalizeText(request.reason);
    if (!normalizedReason) return null;

    for (const config of SKILL_CONFIG) {
        if (config.keywords.some(keyword => normalizedReason.includes(keyword))) {
            return { ability: config.ability, proficiency: 'skill', skillKey: canonicalWord(config.key) };
        }
    }

    const abilityFromReason = abilityKeywordEntries.find(([, keywords]) =>
        keywords.some(keyword => normalizedReason.includes(keyword))
    );

    if (request.rollType === 'save') {
        if (abilityFromReason) {
            return { ability: abilityFromReason[0], proficiency: 'save' };
        }
        return null;
    }

    if (abilityFromReason) {
        return { ability: abilityFromReason[0], proficiency: null };
    }

    return null;
};

const computeAbilityModifier = (score: number | null | undefined) => {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
        return 0;
    }
    return Math.floor((score - 10) / 2);
};

const getProficiencyBonus = (level: number | null | undefined): number => {
    if (!Number.isFinite(level)) return 2;
    return Math.floor(((level ?? 1) - 1) / 4) + 2;
};

const recalculatePlayerRollModifier = (
    request: PlayerRollRequest,
    character: Character | null | undefined
): number | null => {
    if (!character) return null;
    const intent = inferRollIntent(request);
    if (!intent) return null;
    const attributes = character.attributes;
    if (!attributes) return null;
    const abilityScore = attributes[intent.ability] ?? 10;
    let modifier = computeAbilityModifier(abilityScore);
    const proficiencyBonus = getProficiencyBonus(character.level ?? 1);
    const snapshot = buildProficiencySnapshot(character);

    if (intent.proficiency === 'skill') {
        if (snapshot.skillKeys.has(intent.skillKey)) {
            modifier += proficiencyBonus;
        }
    } else if (intent.proficiency === 'save') {
        if (snapshot.savingThrows.has(intent.ability)) {
            modifier += proficiencyBonus;
        }
    }

    return modifier;
};

const detectAiMode = (playerAction: string, combatState: SchemaCombatState | null | undefined, isInternalAction: boolean): AiInteractionMode => {
    if (combatState?.isActive) return 'combat';

    if (isInternalAction) {
        if (playerAction.toLowerCase().includes('diagn') || playerAction.toLowerCase().includes('auditor')) {
            return 'audit';
        }
        return 'gameplay';
    }

    const normalized = playerAction.toLowerCase();
    const generationHints = ['gere', 'gerar', 'crie', 'criar', 'invente', 'imagine', 'forje', 'desenhe', 'sintetize', 'mount'];
    if (generationHints.some(keyword => normalized.includes(keyword))) {
        return 'generation';
    }

    const auditHints = ['auditoria', 'diagnóstico', 'diagnostico', 'diagnose', 'relatório', 'analise', 'análise estrutural'];
    if (auditHints.some(keyword => normalized.includes(keyword))) {
        return 'audit';
    }

    return 'gameplay';
};


// Função auxiliar para calcular o modificador de um atributo
const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

const ensureArray = <T>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];

const buildDefaultAttributes = (): Pick<CharacterAttributes, 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma' | 'hp' | 'maxHp' | 'ac' | 'conditions'> => ({
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    hp: 10,
    maxHp: 10,
    ac: 10,
    conditions: [],
});

type InventoryForDerivedStats = {
    id?: string;
    name?: string;
    equipped?: boolean;
    armor_class?: {
        base?: number;
        dex_bonus?: boolean;
        max_bonus?: number;
    };
    equipment_category?: {
        index?: string | null;
    };
};

const calculateArmorClassFromInventory = (
    inventory: InventoryForDerivedStats[],
    dexScore: number
) => {
    let baseAc = 10;
    let bestArmor: InventoryForDerivedStats | null = null;

    for (const item of inventory) {
        if (!item?.equipped || !item.armor_class?.base) continue;
        if (!bestArmor || (item.armor_class.base ?? 0) > (bestArmor.armor_class?.base ?? 0)) {
            bestArmor = item;
        }
    }

    let dexBonusAllowed = true;
    let maxDexBonus: number | null = null;
    if (bestArmor?.armor_class) {
        baseAc = bestArmor.armor_class.base ?? baseAc;
        dexBonusAllowed = bestArmor.armor_class.dex_bonus ?? true;
        maxDexBonus = typeof bestArmor.armor_class.max_bonus === 'number'
            ? bestArmor.armor_class.max_bonus
            : null;
    }

    let dexMod = calculateModifier(dexScore);
    if (!dexBonusAllowed) {
        dexMod = 0;
    } else if (maxDexBonus !== null) {
        dexMod = Math.min(dexMod, maxDexBonus);
    }

    const hasShield = inventory.some(
        item => item?.equipped && item.equipment_category?.index === 'shields'
    );

    const computedAc = (baseAc || 10) + dexMod + (hasShield ? 2 : 0);
    return {
        value: Math.max(10, computedAc),
        source: bestArmor?.name || (hasShield ? 'Escudo' : 'Base'),
    };
};

const mapCharacterToOptimizedPayload = (fullCharacter: Character) => {
    const attributes = fullCharacter.attributes ?? (buildDefaultAttributes() as CharacterAttributes);
    const proficiencies = ensureArray(fullCharacter.proficiencies);
    const isProficientInPerception = proficiencies.some(p => p?.name?.toLowerCase().includes('perception'));
    const isProficientInInsight = proficiencies.some(p => p?.name?.toLowerCase().includes('insight'));
    const isProficientInInvestigation = proficiencies.some(p => p?.name?.toLowerCase().includes('investigation'));

    const proficiencyBonus = Math.floor((fullCharacter.level - 1) / 4) + 2;
    const wisdomMod = calculateModifier(attributes.wisdom);
    const intelligenceMod = calculateModifier(attributes.intelligence);

    const passivePerception = 10 + wisdomMod + (isProficientInPerception ? proficiencyBonus : 0);
    const passiveInsight = 10 + wisdomMod + (isProficientInInsight ? proficiencyBonus : 0);
    const passiveInvestigation = 10 + intelligenceMod + (isProficientInInvestigation ? proficiencyBonus : 0);

    const inventory = ensureArray(fullCharacter.items).map(item => ({
        ...(item?.itemData || {}),
        id: item?.id?.toString(),
        quantity: item?.quantity ?? item?.itemData?.quantity ?? 1,
        equipped: item?.equipped ?? false,
    }));

    const currency = reconcileCurrency(null, fullCharacter.coins as Record<string, unknown>);
    let currentWeight = 0;
    for (const item of inventory) {
        const weight = Number((item as any).weight ?? (item as any).itemData?.weight ?? 0) || 0;
        const qty = Number((item as any).quantity ?? 1) || 1;
        currentWeight += weight * qty;
    }
    const carryingCapacity = Math.max(0, (attributes.strength ?? 10) * 15);

    const spells = ensureArray(fullCharacter.spells)
        .map(s => (s as any)?.spellName ?? (s as any)?.name ?? null)
        .filter(Boolean) as string[];
    const worldStateSnapshot = buildWorldStateSnapshot(fullCharacter);

    const derivedAc = calculateArmorClassFromInventory(
        inventory as InventoryForDerivedStats[],
        attributes.dexterity ?? 10
    );
    const normalizedHpCurrent = typeof attributes.hp === 'number'
        ? attributes.hp
        : (typeof attributes.maxHp === 'number' && attributes.maxHp > 0 ? attributes.maxHp : 10);
    const normalizedHpMax = typeof attributes.maxHp === 'number' && attributes.maxHp > 0
        ? attributes.maxHp
        : normalizedHpCurrent;

    const normalizedAttributes = {
        ...attributes,
        hp: normalizedHpCurrent,
        maxHp: normalizedHpMax,
        ac: derivedAc.value,
        conditions: attributes.conditions || [],
    };

    return {
        id: fullCharacter.id,
        name: fullCharacter.name,
        race: fullCharacter.race,
        characterClass: fullCharacter.characterClass,
        level: fullCharacter.level,
        xp: fullCharacter.xp ?? 0,
        attributes: normalizedAttributes,
        passivePerception,
        passiveInsight,
        passiveInvestigation,
        proficiencies: proficiencies.map(p => p?.name).filter(Boolean),
        feats: fullCharacter.feats ?? [],
        inventory,
        currency,
        currentWeight,
        carryingCapacity,
        spells: spells as unknown as ApiSpell[],
        storySoFar: fullCharacter.storySoFar ?? '',
        worldState: worldStateSnapshot,
        factionReputation: fullCharacter.factionReputation ?? {},
        relationships: ensureArray(fullCharacter.relationships),
        journal: ensureArray(fullCharacter.journal),
        currentRegion: fullCharacter.currentRegion ?? fullCharacter.worldState?.currentRegion,
    };
};

/**
 * Traduz um objeto de conteúdo homebrew em uma string de resumo para a IA.
 * @param content O objeto de conteúdo homebrew.
 * @returns Uma string de resumo ou null se o conteúdo for inválido.
 */
const HOMEbrew_TYPE_PRIORITY: Record<HomebrewContent['type'], number> = {
    monster: 0,
    subclass: 1,
    class: 2,
    race: 3,
    subrace: 4,
    feat: 5,
    spell: 6,
    item: 7,
    background: 8,
    skill: 9,
    translation: 10,
};

const HOMEbrew_TYPE_LABELS: Record<HomebrewContent['type'], string> = {
    monster: 'monstro homebrew',
    subclass: 'subclasse homebrew',
    class: 'classe homebrew',
    race: 'raça homebrew',
    subrace: 'sub-raça homebrew',
    feat: 'talento homebrew',
    spell: 'magia homebrew',
    item: 'item homebrew',
    background: 'antecedente homebrew',
    skill: 'perícia homebrew',
    translation: 'tradução customizada',
};

const HOMEbrew_TYPE_PLURALS: Record<HomebrewContent['type'], string> = {
    monster: 'monstros homebrew',
    subclass: 'subclasses homebrew',
    class: 'classes homebrew',
    race: 'raças homebrew',
    subrace: 'sub-raças homebrew',
    feat: 'talentos homebrew',
    spell: 'magias homebrew',
    item: 'itens homebrew',
    background: 'antecedentes homebrew',
    skill: 'perícias homebrew',
    translation: 'traduções customizadas',
};

const MAX_HOMEbrew_SUMMARY_LINES = 10;
const MAX_HOMEbrew_SUMMARY_LENGTH = 1100;
const MAX_HOMEbrew_ENTRY_LENGTH = 220;

const parseHomebrewPayload = (content: HomebrewContent): Record<string, any> | null => {
    const raw = content?.content;

    if (!raw) return null;

    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.warn(`[Homebrew] Falha ao fazer parse do conteúdo ${content.id}:`, error);
            return null;
        }
    }

    return raw;
};

const sanitizeSummary = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncateSummary = (value: string, maxLength: number): string => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

const summarizeHomebrewForAI = (content: HomebrewContent): { summary: string; type: HomebrewContent['type']; key?: string } | null => {
    if (!content || content.type === 'translation') return null;

    const data = parseHomebrewPayload(content);
    if (!data) return null;

    const type = content.type;
    let summary = `[${type.toUpperCase()}] ${data.name || content.name}: `;

    try {
        switch (type) {
            case 'spell': {
                const firstLine = Array.isArray(data.desc) ? data.desc[0] : data.desc;
                summary += `${firstLine || 'Magia personalizada.'}`;
                if (data.level != null) summary += ` (Nível ${data.level}`;
                if (data.school?.name) {
                    summary += data.level != null ? `, Escola: ${data.school.name})` : ` (Escola: ${data.school.name})`;
                } else if (data.level != null) {
                    summary += `)`;
                }
                break;
            }
            case 'item': {
                 const firstLine = Array.isArray(data.desc) ? data.desc[0] : data.desc;
                 summary += `${firstLine || 'Item personalizado.'}`;
                 if (data.rarity?.name) summary += ` (Raridade: ${data.rarity.name})`;
                 break;
            }
            case 'monster': {
                const ac = Array.isArray(data.armor_class) ? data.armor_class[0]?.value : data.armor_class;
                summary += `ND ${data.challenge_rating ?? '?'}. ${data.size || ''} ${data.type || ''}. PV: ${data.hit_points ?? '?'} / CA: ${ac ?? '?'}.`;
                break;
            }
            default: {
                const firstLine = Array.isArray(data.desc) ? data.desc[0] : data.desc;
                const fallback = typeof firstLine === 'string' ? firstLine : 'Conteúdo personalizado.';
                summary += truncateSummary(fallback, 150);
                break;
            }
        }

        const normalizedSummary = sanitizeSummary(truncateSummary(summary, MAX_HOMEbrew_ENTRY_LENGTH));
        if (!normalizedSummary) return null;

        const key = (data.official_index || data.index || content.id || content.name || '').toString().toLowerCase();
        return { summary: normalizedSummary, type, key };
    } catch (e) {
        console.warn(`Falha ao sumarizar o conteúdo homebrew: ${data.name || content.name}`, e);
        return null;
    }
};

const buildHomebrewSummaryBlock = (installedContent: HomebrewContent[]): string => {
    if (!Array.isArray(installedContent) || installedContent.length === 0) {
        return '';
    }

    const dedupe = new Set<string>();
    const summaries: NonNullable<ReturnType<typeof summarizeHomebrewForAI>>[] = [];

    for (const content of installedContent) {
        const entry = summarizeHomebrewForAI(content);
        if (!entry) continue;
        if (entry.key && dedupe.has(entry.key)) continue;
        summaries.push(entry);
        if (entry.key) {
            dedupe.add(entry.key);
        }
    }

    if (summaries.length === 0) return '';

    const sorted = summaries.sort((a, b) => {
        const priorityDiff = (HOMEbrew_TYPE_PRIORITY[a.type] ?? 99) - (HOMEbrew_TYPE_PRIORITY[b.type] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return a.summary.localeCompare(b.summary);
    });

    const lines: string[] = [];
    let usedChars = 0;
    const overflow = new Map<HomebrewContent['type'], number>();

    for (const entry of sorted) {
        const projectedLength = usedChars + entry.summary.length + 3; // bullet + newline
        if (lines.length < MAX_HOMEbrew_SUMMARY_LINES && projectedLength <= MAX_HOMEbrew_SUMMARY_LENGTH) {
            lines.push(entry.summary);
            usedChars = projectedLength;
        } else {
            overflow.set(entry.type, (overflow.get(entry.type) ?? 0) + 1);
        }
    }

    if (overflow.size > 0) {
        const overflowParts = Array.from(overflow.entries()).map(([type, count]) => {
            const baseLabel = HOMEbrew_TYPE_LABELS[type] || 'conteúdo homebrew';
            const pluralLabel = count > 1 ? (HOMEbrew_TYPE_PLURALS[type] || `${baseLabel}s`) : baseLabel;
            return `${count} ${pluralLabel}`;
        });
        lines.push(`Resumo adicional: ${overflowParts.join(', ')}`);
    }

    if (lines.length === 0) return '';

    return `\n\n### Regras e Conteúdo Customizado Ativo (Homebrew)\n- ${lines.join('\n- ')}\n`;
};


// Constrói um objeto de personagem otimizado para a IA.
export const buildOptimizedCharacterForAI = async (characterId: number) => {
    // Sempre busca do banco para garantir dados consistentes
    const characterRepo = AppDataSource.getRepository(Character);
    const fullCharacter = await characterRepo
        .createQueryBuilder('character')
        .select([
            'character',
            'attributes',
            'proficiencies',
            'items',
            'spells',
            'journal',
            'journalSubLocations',
            'relationships',
            'relationshipQuests',
        ])
        .addSelect('character.id', 'Character_id')
        .leftJoinAndSelect('character.attributes', 'attributes')
        .leftJoinAndSelect('character.proficiencies', 'proficiencies')
        .leftJoinAndSelect('character.items', 'items')
        .leftJoinAndSelect('character.spells', 'spells')
        .leftJoinAndSelect('character.journal', 'journal')
        .leftJoinAndSelect('journal.subLocations', 'journalSubLocations')
        .leftJoinAndSelect('character.relationships', 'relationships')
        .leftJoinAndSelect('relationships.quests', 'relationshipQuests')
        .leftJoinAndSelect('relationshipQuests.keywords', 'questKeywords')
        .where('character.id = :id', { id: characterId })
        .getOne();

    let characterForAI: any = null;

    if (fullCharacter?.attributes) {
        characterForAI = mapCharacterToOptimizedPayload(fullCharacter);
    } else {
        console.warn(`[buildOptimizedCharacterForAI] Personagem ${characterId} retornou sem atributos completos. Aplicando fallback enxuto.`);
        const fallbackBase =
            fullCharacter ??
            (await characterRepo
                .createQueryBuilder('character')
                .leftJoinAndSelect('character.attributes', 'attributes')
                .where('character.id = :id', { id: characterId })
                .getOne());

        if (fallbackBase) {
            if (!fallbackBase.attributes) {
                const attrRepo = AppDataSource.getRepository(CharacterAttributes);
                const attrs = await attrRepo.findOne({ where: { characterId } });
                fallbackBase.attributes = attrs ?? (buildDefaultAttributes() as CharacterAttributes);
            }
            fallbackBase.items = ensureArray(fallbackBase.items);
            fallbackBase.spells = ensureArray(fallbackBase.spells);
            fallbackBase.proficiencies = ensureArray(fallbackBase.proficiencies);
            fallbackBase.relationships = ensureArray(fallbackBase.relationships);
            fallbackBase.journal = ensureArray(fallbackBase.journal);
            fallbackBase.feats = ensureArray(fallbackBase.feats);
            characterForAI = mapCharacterToOptimizedPayload(fallbackBase);
        }
    }

    if (!characterForAI) {
        console.error(`[buildOptimizedCharacterForAI] Não foi possível montar snapshot otimizado para o personagem ${characterId}.`);
        return null;
    }

    return characterForAI;
};

export const processPlayerTurn = async (
    sessionId: number,
    userId: number,
    playerAction: string,
    apiKey: string,
    currentCombatState?: CombatState,
    useAiHomebrew?: boolean,
    stateHints?: string[],
    actionId?: string
): Promise<GameMasterResponse> => {
    let isTestRun = false;
    let sessao: SessaoIA | null = null;
   let user: User | null = null;
    let characterForAI: any = null;
    let homebrewSummaryForAI = "";
    let combatReconciliation: CombatReconciliationResult | null = null;
    
    const sessionCacheKey = `session:${sessionId}:homebrew_summary`;

    let storySummaryForPrompt: string | null = null;

    if (sessionId === -1) {
        isTestRun = true;
        user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
        characterForAI = {
            id: 1, name: 'Herói de Teste', race: 'Humano', characterClass: 'Guerreiro', level: 1,
            attributes: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, hp: 10, ac: 10, conditions: [] },
            proficiencies: [], inventory: [], spells: [], storySoFar: '',
            worldState: { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Plano de Testes', regionSlug: 'plano-de-testes', visitedRegions: ['plano-de-testes'] },
            relationships: [], journal: [], factionReputation: {}, currentRegion: 'Plano de Testes',
            passivePerception: 10, passiveInsight: 10, passiveInvestigation: 10,
            xp: 0,
        };
    } else {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const userRepository = AppDataSource.getRepository(User);

        user = await userRepository.findOneBy({ id: userId });
        sessao = await sessaoRepository.findOne({ where: { id: sessionId, userId }, relations: ["character"] });

        if (!sessao || !sessao.character) {
            throw createError(404, 'Sessão de IA ou personagem não encontrado.');
        }

        characterForAI = await buildOptimizedCharacterForAI(sessao.character.id);
        if (!characterForAI) {
            throw createError(500, 'Falha ao carregar os dados completos do personagem para a IA.');
        }

        // Tenta buscar o resumo do cache
        let cachedSummary: string | null = null;
        if (redisClient && redisClient.isOpen) {
            cachedSummary = await redisClient.get(sessionCacheKey);
        }

        if (cachedSummary) {
            console.log(`[Cache] HIT: Resumo de homebrew para sessão ${sessionId}.`);
            homebrewSummaryForAI = cachedSummary;
        } else {
             console.log(`[Cache] MISS: Gerando resumo para sessão ${sessionId}.`);
            if (sessao.homebrewContentIds && sessao.homebrewContentIds.length > 0) {
                const installedContent = await HomebrewService.getMultipleHomebrewContentByIds(sessao.homebrewContentIds);
                homebrewSummaryForAI = buildHomebrewSummaryBlock(installedContent);
                if (homebrewSummaryForAI) {
                    // Salva o novo resumo no cache por 24 horas
                     if (redisClient && redisClient.isOpen) {
                        await redisClient.set(sessionCacheKey, homebrewSummaryForAI, { EX: 86400 });
                    }
                }
            }
        }
    }

    if (!hasResolvableOpenRouterKey(apiKey)) {
        throw createError(
            400,
            'Chave OpenRouter ausente. Adicione OPENROUTER_KEY1..N no servidor ou configure nas Configurações.',
        );
    }

    const modelToUse = ensureOssModel(
        user?.settings?.model || process.env.AI_DEFAULT_MODEL?.trim() || undefined,
    );
    const generationConfig = user?.settings?.generationConfig || {};
    
    const recentLogs = isTestRun ? [] : await AppDataSource.getRepository(SessionLog).find({
        where: { sessaoId: sessao!.id },
        order: { timestamp: 'DESC' }, 
        take: 20,
    });
    
    const chronologicalLogs = recentLogs.reverse();
    const compactGameLog = buildPromptLogString(chronologicalLogs) || 'SEM_EVENTOS';

    const narrationContext = !isTestRun && sessao
        ? await buildNarrationContext({
            sessionId: sessao.id,
            character: sessao.character,
            characterForAI,
            playerAction,
            compactGameLog,
            apiKey,
            isTestRun,
        })
        : {
            enrichedGameLog: compactGameLog,
            regionContext: null,
        };

    const enrichedGameLog = narrationContext.enrichedGameLog;
    storySummaryForPrompt = narrationContext.storySummary ?? null;
    const timelineFactsForPrompt = narrationContext.timelineFacts ?? null;
    const regionPromptContext = narrationContext.regionContext;
    const regionGraphSummary = narrationContext.regionGraphSummary;

    const isInternalAction = playerAction.startsWith("Recarregar estado atual")
        || playerAction.startsWith("A aventura começa.")
        || playerAction.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades");

    let loadedCombat: LoadedCombatEncounter = { encounterId: null, state: null };
    let motorCombatRewards: Awaited<
        ReturnType<typeof import('./combatMotorService.js').runMotorCombatPipeline>
    >['rewards'];
    if (!isTestRun && sessao) {
        loadedCombat = await loadCombatEncounterState(sessao.id);
    }
    if (!loadedCombat.state && currentCombatState && currentCombatState.isActive) {
        const bootstrap = reconcileCombatStateUpdate(null, currentCombatState);
        if (bootstrap.canonicalState) {
            loadedCombat.state = bootstrap.canonicalState;
        }
    }

    const promptCombatState = projectPublicCombatState(loadedCombat.state) ??
        (currentCombatState && currentCombatState.isActive ? currentCombatState : null);

    let latestNarrationSummary = '';

    const aiMode = detectAiMode(playerAction, promptCombatState ?? currentCombatState, isInternalAction);
    const stateHintsFromContext: string[] = [];
    if (sessao?.id) {
        const pendingRoll = await getPendingRollRequest(sessao.id);
        if (pendingRoll) {
            stateHintsFromContext.push(
                `[Roll] Aguardando resposta do jogador para ${pendingRoll.reason || pendingRoll.rollType}`
            );
        }
    }
    if (promptCombatState?.isActive) {
        stateHintsFromContext.push('[Combat] Conflito ativo, mantenha foco em combate.');
    }
    let castAndWorldHints: string[] = [];
    if (!isTestRun && sessao?.id) {
        try {
            const { getCastSummaryForSession, getWorldPresenceHints, syncSessionCastFromWorld } = await import(
                './sessionCastService.js'
            );
            await syncSessionCastFromWorld(sessao.id, userId, {
                combatState: promptCombatState as { isActive?: boolean; combatants?: unknown[] } | null,
            });
            const castBlock = await getCastSummaryForSession(sessao.id);
            if (castBlock) castAndWorldHints.push(castBlock);
            const regionSlug =
                (characterForAI?.worldState as { regionSlug?: string })?.regionSlug ??
                narrationContext.regionSlug ??
                null;
            castAndWorldHints.push(...(await getWorldPresenceHints(sessao.id, userId, regionSlug)));
        } catch (castErr) {
            console.warn('[narrarService] Falha ao montar elenco/mundo:', castErr);
        }
    }

    const normalizedStateHints = [
        ...(stateHints ?? []),
        ...stateHintsFromContext,
        ...castAndWorldHints,
    ]
        .map(hint => hint?.trim())
        .filter(Boolean);
    const latestStateHint = normalizedStateHints.length
        ? normalizedStateHints[normalizedStateHints.length - 1]
        : undefined;

    const sessionKey = sessao ? String(sessao.id) : undefined;

    const gameMasterFlowInput = {
        character: characterForAI,
        playerAction,
        gameLog: enrichedGameLog,
        combatState: promptCombatState ?? undefined,
        useAiHomebrew: useAiHomebrew ?? true,
        enableNarrativeRevalidation: true,
        homebrewSummary: homebrewSummaryForAI || undefined,
        storySummary: storySummaryForPrompt || undefined,
        timelineFacts: timelineFactsForPrompt || undefined,
        layeredMemorySummary: narrationContext.layeredMemorySummary,
        regionSlug: regionPromptContext?.slug ?? narrationContext.regionSlug ?? undefined,
        regionGraphSummary: regionGraphSummary ?? undefined,
        discoveredRoutes: regionPromptContext?.discoveredRoutes ?? narrationContext.discoveredRoutes,
        visitedRegions: regionPromptContext?.visitedRegions ?? narrationContext.visitedRegions,
        mode: aiMode,
        sessionId: sessionKey,
        stateHints: latestStateHint ? [latestStateHint] : undefined,
        suppressRollRequest: true,
    };

    const appendSystemNote = (response: GameMasterResponse, note: string) => {
        if (!note) return;
        response.systemLog = response.systemLog ? `${response.systemLog}\n${note}` : note;
    };

    let stateVersionForPrompt = 0;
    if (!isTestRun && sessao?.id) {
        try {
            const { loadStateVersion } = await import('./stateVersionService.js');
            stateVersionForPrompt = await loadStateVersion(sessao.id);
        } catch (versionErr) {
            console.warn('[narrarService] stateVersion indisponível para cache de prompt:', versionErr);
        }
    }

    const orchestrated = await runNarrationAiPhases({
        baseInput: gameMasterFlowInput,
        playerAction,
        characterForAI,
        modelToUse,
        generationConfig,
        apiKey,
        sessionId: sessionKey,
        scenarioLabel: gameMasterFlowInput.scenarioLabel,
        actionId,
        stateVersion: stateVersionForPrompt,
    });

    const narrativePhase = orchestrated.narrativePhase;
    const statePhase = orchestrated.statePhase ?? {
        response: {} as GameMasterResponse,
        rawText: null,
        validationIssues: [],
        attempts: 0,
        retryCount: 0,
        usedFallback: false,
        focus: 'state' as const,
        warnings: [],
        suppressRollRequest: gameMasterFlowInput.suppressRollRequest ?? false,
        latencyMs: 0,
    };

    const pipelineMode = orchestrated.pipelineMode;
    const motorOwnsState = isMotorOwnedPipeline(pipelineMode);

    if (motorOwnsState) {
        appendSystemNote(
            orchestrated.mergedResponse,
            '[Pipeline] Modo narration_only: estado no motor; IA só narrativa e opções.',
        );
    }

    const narrativeIssues = narrativePhase.usedFallback || narrativePhase.validationIssues.length || narrativePhase.warnings.length;
    if (narrativeIssues) {
        await persistPhaseSnapshot(sessao?.id, 'narrative', {
            warnings: narrativePhase.warnings,
            validationIssues: narrativePhase.validationIssues,
            response: narrativePhase.response,
            rawText: narrativePhase.rawText,
            attempts: narrativePhase.attempts,
        });
    }
    const stateIssues = statePhase.usedFallback || statePhase.validationIssues.length || statePhase.warnings.length;
    if (stateIssues) {
        await persistPhaseSnapshot(sessao?.id, 'state', {
            warnings: statePhase.warnings,
            validationIssues: statePhase.validationIssues,
            response: statePhase.response,
            rawText: statePhase.rawText,
            attempts: statePhase.attempts,
        });
    }

    const mergedResponse: GameMasterResponse = orchestrated.mergedResponse;

    const combinedValidation = motorOwnsState
        ? validateByPhaseFocus(mergedResponse, 'narrative')
        : validateGameMasterResponse(mergedResponse, { character: characterForAI });
    const combinedFallbackNeeded = !combinedValidation.valid;

    let finalIssues = combinedValidation.valid
        ? (statePhase.validationIssues.length ? statePhase.validationIssues : narrativePhase.validationIssues)
        : combinedValidation.issues;
    let finalUsedFallback = combinedFallbackNeeded || narrativePhase.usedFallback || statePhase.usedFallback;
    let finalRawText = statePhase.rawText ?? narrativePhase.rawText;
    const totalAttempts = narrativePhase.attempts + statePhase.attempts;

    let finalFromModel: GameMasterResponse;
    if (combinedFallbackNeeded) {
        const fallbackResponse = generateFallbackResponse({ character: characterForAI }, playerAction, combinedValidation.issues);
        const { response: orchestratedFallback } = orchestrateGameMasterResponse(fallbackResponse, { character: characterForAI });
        finalFromModel = orchestratedFallback;
    } else {
        const { response: orchestratedResponse } = orchestrateGameMasterResponse(mergedResponse, { character: characterForAI });
        finalFromModel = orchestratedResponse;
    }

    if (!combinedFallbackNeeded && !narrativePhase.usedFallback && narrativePhase.retryCount > 0) {
        appendSystemNote(finalFromModel, `[Validador] Fase narrativa ajustada após ${narrativePhase.retryCount + 1} tentativa(s).`);
    }
    if (!combinedFallbackNeeded && !statePhase.usedFallback && statePhase.retryCount > 0) {
        appendSystemNote(finalFromModel, `[Validador] Fase de estado ajustada após ${statePhase.retryCount + 1} tentativa(s).`);
    }
    if (finalUsedFallback && finalIssues.length) {
        appendSystemNote(finalFromModel, `[Validador] Fallback acionado. Problemas detectados: ${finalIssues.join('; ')}`);
    }

    let aiResponse = motorOwnsState ? stripMotorOwnedFields(finalFromModel) : finalFromModel;

    if (motorOwnsState) {
        const {
            enforceNarrativeOnlyResponse,
            sanitizeActionOptionsForPlayerAgency,
        } = await import('../ai/narrativeContract.js');
        const { cleaned, stripped } = enforceNarrativeOnlyResponse(aiResponse);
        aiResponse = cleaned;
        aiResponse.actionOptions = sanitizeActionOptionsForPlayerAgency(aiResponse.actionOptions);
        if (stripped.length) {
            appendSystemNote(
                aiResponse,
                `[Contrato narrativo] Campos ignorados (motor autoritativo): ${stripped.join(', ')}`,
            );
        }
    }

    if (!finalUsedFallback && !isTestRun && sessao) {
        const rawFacts = (narrativePhase.response as any).newFacts;
        if (Array.isArray(rawFacts) && rawFacts.length) {
            const factResult = await persistValidatedFacts({
                sessaoId: sessao.id,
                characterId: sessao.character?.id,
                facts: rawFacts,
                source: 'ai',
                currentRegionSlug: regionPromptContext?.slug ?? narrationContext.regionSlug ?? null,
            });
            if (factResult.rejected.length) {
                appendSystemNote(
                    aiResponse,
                    `[Memória] ${factResult.rejected.length} fato(s) descartado(s) na validação.`,
                );
            }
            if (factResult.accepted.length) {
                appendSystemNote(
                    aiResponse,
                    `[Memória] ${factResult.accepted.length} novo(s) fato(s) registrado(s).`,
                );
            }
        }
        delete (aiResponse as any).newFacts;
    }
    const rawText = finalRawText;
    const validationIssues = finalIssues;
    const usedFallback = finalUsedFallback;
    const attempts = totalAttempts;

    if (!finalUsedFallback && !motorOwnsState) {
        combatReconciliation = reconcileCombatStateUpdate(
            loadedCombat.state,
            aiResponse.combatState as any
        );
        aiResponse.combatState = combatReconciliation.publicState as any;
        if (combatReconciliation.telemetry.length) {
            const telemetryNote = combatReconciliation.telemetry
                .map(msg => `[Combate] ${msg}`)
                .join('\n');
            aiResponse.systemLog = aiResponse.systemLog
                ? `${aiResponse.systemLog}\n${telemetryNote}`
                : telemetryNote;

            const autoResolution = combatReconciliation.telemetry.find(msg =>
                msg.toLowerCase().includes('encerrado automaticamente')
            );
            if (autoResolution) {
                const fallbackNarration = 'O combate se encerra rapidamente assim que a poeira baixa. Você recupera o fôlego e avalia os próximos passos.';
                aiResponse.logEntries = [
                    ...(aiResponse.logEntries ?? []),
                    { type: 'system', content: autoResolution },
                    { type: 'narration', content: fallbackNarration }
                ];
            }
        }
    } else if (!finalUsedFallback && motorOwnsState && !isTestRun && sessao) {
        const { runMotorCombatPipeline } = await import('./combatMotorService.js');
        const motorCombat = await runMotorCombatPipeline({
            sessaoId: sessao.id,
            encounterId: loadedCombat.encounterId,
            stored: loadedCombat.state,
            clientCombat: currentCombatState ?? null,
            characterId: sessao.character?.id,
        });
        loadedCombat.state = motorCombat.canonicalState;
        loadedCombat.encounterId = motorCombat.encounterId;
        combatReconciliation = {
            canonicalState: motorCombat.canonicalState,
            publicState: motorCombat.publicState,
            changed: motorCombat.changed,
            telemetry: motorCombat.telemetry,
        };
        aiResponse.combatState = motorCombat.publicState as any;
        for (const note of motorCombat.telemetry) {
            appendSystemNote(aiResponse, note);
        }
        if (motorCombat.rewards) {
            motorCombatRewards = motorCombat.rewards;
            aiResponse.lootOffer = motorCombat.rewards.lootOffer as any;
        }
        if (motorCombat.combatEnded && sessao.character?.id) {
            const charRepo = AppDataSource.getRepository(Character);
            const fresh = await charRepo.findOne({
                where: { id: sessao.character.id },
                select: ['id', 'xp', 'level'],
            });
            if (fresh) {
                characterForAI.xp = fresh.xp ?? characterForAI.xp;
                characterForAI.level = fresh.level ?? characterForAI.level;
            }
        }
    } else if (!finalUsedFallback && motorOwnsState) {
        combatReconciliation = {
            canonicalState: loadedCombat.state,
            publicState: loadedCombat.state ? projectPublicCombatState(loadedCombat.state) : null,
            changed: false,
            telemetry: [],
        };
        aiResponse.combatState = combatReconciliation.publicState as any;
    } else {
        combatReconciliation = { canonicalState: loadedCombat.state, publicState: loadedCombat.state ? projectPublicCombatState(loadedCombat.state) : null, changed: false, telemetry: [] };
    }

    const progressionFeed: Array<{
        type: 'xp_gain' | 'level_up';
        xp?: number;
        level?: number;
        summary: string;
        source?: string;
        detail?: string;
    }> = [];

    if (motorCombatRewards?.xpAwarded) {
        progressionFeed.push({
            type: 'xp_gain',
            xp: motorCombatRewards.xpAwarded,
            summary: `+${motorCombatRewards.xpAwarded} XP — vitória em combate`,
            source: 'motor-combat',
        });
    }

    let xpResult = {
        totalXpAwarded: 0,
        summaries: [] as string[],
        details: [] as Array<{ type: string; xp: number; source: string; label: string; description?: string }>,
    };

    if (!finalUsedFallback && !motorOwnsState) {
        xpResult = applyXpEvents(
            { xp: characterForAI.xp ?? 0, level: characterForAI.level ?? 1 } as any,
            (aiResponse as any).xpEvents
        );
        if (xpResult.totalXpAwarded > 0) {
            const newXpTotal = (characterForAI.xp ?? 0) + xpResult.totalXpAwarded;
            aiResponse.updatedCharacter = {
                ...(aiResponse.updatedCharacter || {}),
                xp: newXpTotal,
            };
            const xpSummary = xpResult.summaries.join(' ');
            aiResponse.systemLog = aiResponse.systemLog
                ? `${aiResponse.systemLog}\n[XP] ${xpSummary}`
                : `[XP] ${xpSummary}`;
            aiResponse.logEntries = [
                ...(aiResponse.logEntries ?? []),
                { type: 'system', content: `Você recebeu ${xpResult.totalXpAwarded} XP.` },
            ];
        }

        if (xpResult.details.length) {
            for (const detail of xpResult.details) {
                progressionFeed.push({
                    type: 'xp_gain',
                    xp: detail.xp,
                    summary: `+${detail.xp} XP – ${detail.label}`,
                    source: detail.source,
                    detail: detail.description,
                });
            }

            if (!isTestRun && sessao) {
                for (const detail of xpResult.details) {
                    const timelineSummary = `Recebeu +${detail.xp} XP. Origem: ${detail.source}${detail.description ? ` — ${detail.description}` : ''}`;
                    await recordTimelineEvent(sessao.id, {
                        timestamp: new Date().toISOString(),
                        action: 'Recompensa de XP',
                        summary: timelineSummary,
                        notes: undefined,
                    });
                }
            }
        }
    } else {
        (aiResponse as any).xpEvents = undefined;
    }

    if (!motorOwnsState && aiResponse.updatedCharacter?.level !== undefined) {
        const rawLevel = Number(aiResponse.updatedCharacter.level);
        const cappedLevel = clampCharacterLevel(rawLevel);
        if (Number.isFinite(rawLevel) && cappedLevel !== rawLevel) {
            aiResponse.updatedCharacter.level = cappedLevel;
            aiResponse.systemLog = appendSystemLogEntry(
                aiResponse.systemLog,
                `[Progresso] O nível foi limitado a ${cappedLevel}.`
            );
        }
    }

    let newStorySummaryForLog: string | null = null;
    let levelUpRecap: string | null = null;

    if (!isTestRun && sessao) {
        const currentLevel = characterForAI.level ?? 1;
        const updatedLevel = aiResponse.updatedCharacter?.level ?? currentLevel;

        if (updatedLevel > currentLevel) {
            levelUpRecap = await generateLevelUpRecap(sessao.id, apiKey);

            progressionFeed.push({
                type: 'level_up',
                level: updatedLevel,
                summary: `Nível ${updatedLevel} alcançado!`,
                detail: levelUpRecap ?? undefined,
            });

            await recordTimelineEvent(sessao.id, {
                timestamp: new Date().toISOString(),
                action: `Marco de Nível ${updatedLevel}`,
                summary: `O herói alcança o nível ${updatedLevel}.`,
                notes: levelUpRecap ?? undefined,
            });

            aiResponse.systemLog = aiResponse.systemLog
                ? `${aiResponse.systemLog}\n[Progressão] Nível ${updatedLevel} alcançado.`
                : `[Progressão] Nível ${updatedLevel} alcançado.`;

            aiResponse.logEntries = [
                ...(aiResponse.logEntries ?? []),
                {
                    type: 'system',
                    content: `Sua jornada rendeu frutos: você alcançou o nível ${updatedLevel}!`,
                },
            ];
        }
    }

    if (!isTestRun && sessao) {
        const normalize = (text: string | undefined | null, limit = 400) =>
            text ? text.replace(/\s+/g, ' ').trim().slice(0, limit) : '';

        const narrationEntries = (aiResponse.logEntries || []).filter(entry => entry?.type === 'narration');
        const mainNarration = normalize(narrationEntries[0]?.content);
        latestNarrationSummary = mainNarration;
        const extraNarration = narrationEntries.slice(1, 3).map(entry => normalize(entry?.content, 200)).filter(Boolean).join(' ');

        const notesPieces: string[] = [];
        if (xpResult.totalXpAwarded > 0) {
            notesPieces.push(xpResult.summaries.join(' '));
        }
        if (combatReconciliation.telemetry.length) {
            notesPieces.push(combatReconciliation.telemetry.join(' '));
        }
        if (aiResponse.systemLog) {
            notesPieces.push(normalize(aiResponse.systemLog, 200));
        }
        if (levelUpRecap) {
            notesPieces.push(normalize(levelUpRecap, 300));
        }

        const timelineEvent = {
            timestamp: new Date().toISOString(),
            action: normalize(playerAction, 200),
            summary: [mainNarration, extraNarration].filter(Boolean).join(' ').trim() || 'Narrativa indisponível.',
            notes: notesPieces.filter(Boolean).join(' | ') || undefined,
        };

        const { summary: newStorySummary } = await recordTimelineEventAndSummarize(sessao.id, timelineEvent, apiKey);
        if (newStorySummary) {
            newStorySummaryForLog = newStorySummary;
            aiResponse.updatedCharacter = {
                ...(aiResponse.updatedCharacter || {}),
                storySoFar: newStorySummary,
            };
        }
    }

    if (progressionFeed.length) {
        (aiResponse as any).progressionFeed = progressionFeed;
    } else {
        delete (aiResponse as any).progressionFeed;
    }

    if (motorOwnsState && !isTestRun && sessao?.character) {
        const { attachMotorProgressionToResponse } = await import('./progressionMotorService.js');
        const { leveledUp, newLevel } = attachMotorProgressionToResponse(aiResponse, {
            level: characterForAI.level,
            xp: characterForAI.xp,
        });
        if (leveledUp && newLevel) {
            appendSystemNote(aiResponse, `[Motor] Nível ${newLevel} detectado por XP — confirme na ficha.`);
        }
    }

    const allowHomebrewContent = useAiHomebrew ?? true;

    if (aiResponse.updatedCharacter?.inventory && Array.isArray(aiResponse.updatedCharacter.inventory)) {
        const { items: hydratedItems, metrics } = await hydrateInventoryItems(
            aiResponse.updatedCharacter.inventory as any[],
            userId,
            Array.isArray(characterForAI?.inventory) ? characterForAI.inventory : undefined,
            { allowHomebrew: allowHomebrewContent }
        );
        (aiResponse.updatedCharacter as any).inventory = hydratedItems;
        const currentCurrency = reconcileCurrency(
            (aiResponse.updatedCharacter as any).currency,
            metrics.currency
        );
        (aiResponse.updatedCharacter as any).currency = currentCurrency;
        (aiResponse.updatedCharacter as any).currentWeight = metrics.totalWeight;
    }

    if (!motorOwnsState && aiResponse.shopState?.inventory && Array.isArray(aiResponse.shopState.inventory)) {
        const { items: sanitizedShopItems } = await hydrateInventoryItems(
            aiResponse.shopState.inventory as any[],
            userId,
            undefined,
            { allowHomebrew: allowHomebrewContent }
        );
        aiResponse.shopState.inventory = sanitizedShopItems;
        if (aiResponse.shopState.sellPrices && typeof aiResponse.shopState.sellPrices === 'object') {
            const validIds = new Set(sanitizedShopItems.map(item => String(item.id)));
            const filteredPrices: Record<string, number> = {};
            for (const [itemId, value] of Object.entries(aiResponse.shopState.sellPrices)) {
                if (!validIds.has(itemId)) continue;
                const numericValue = Number(value);
                if (Number.isFinite(numericValue) && numericValue >= 0) {
                    filteredPrices[itemId] = numericValue;
                }
            }
            aiResponse.shopState.sellPrices = filteredPrices;
        }
    }

    if (motorOwnsState && !isTestRun && sessao?.character?.id) {
        const { attachMotorShopToResponse } = await import('./shopMotorService.js');
        const { getMotorLootOfferForClient } = await import('./lootMotorService.js');
        await attachMotorShopToResponse(aiResponse, sessao.character.id);
        const pendingLoot = await getMotorLootOfferForClient(sessao.id);
        if (pendingLoot && !aiResponse.combatState?.isActive) {
            aiResponse.lootOffer = pendingLoot as any;
        }
    }

    if (!motorOwnsState && aiResponse.lootOffer?.items && Array.isArray(aiResponse.lootOffer.items)) {
        const { items: sanitizedLootItems } = await hydrateInventoryItems(
            aiResponse.lootOffer.items as any[],
            userId,
            undefined,
            { allowHomebrew: allowHomebrewContent }
        );
        aiResponse.lootOffer.items = sanitizedLootItems;
        if (aiResponse.lootOffer.currency && typeof aiResponse.lootOffer.currency === 'object') {
            const currency = aiResponse.lootOffer.currency as Record<string, unknown>;
            for (const [coin, value] of Object.entries(currency)) {
                const numericValue = Number(value);
                currency[coin] = Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
            }
        }
        if (!aiResponse.lootOffer.items.length && (!aiResponse.lootOffer.currency || Object.values(aiResponse.lootOffer.currency).every(val => (val as number) <= 0))) {
            aiResponse.lootOffer = null;
        }
        if (!isTestRun && sessao?.character && aiResponse.lootOffer?.items?.length) {
            const currentRegionSlug =
                (aiResponse.worldState as any)?.regionSlug ??
                (sessao.character.worldState as any)?.regionSlug ??
                sessao.character.worldState?.currentRegion ??
                null;
            const poiSlug = (aiResponse.worldState as any)?.poiSlug ?? null;
            const artifactInputs = aiResponse.lootOffer.items.map(item => ({
                name: item.name,
                description: item.description,
                rarity: item.rarity,
                metadata: item.properties ?? undefined,
                keywords: Array.isArray(item.properties?.tags) ? item.properties.tags : undefined,
                originLabel: gameMasterFlowInput.scenarioLabel ?? aiResponse.memoryContext?.summary ?? '',
                sourceType: 'loot' as const,
                regionSlug: currentRegionSlug,
                pointOfInterestSlug: poiSlug,
            }));
            await recordArtifactsForSession(sessao.character.id, sessao.id, artifactInputs);
        }
        if (!motorOwnsState && !isTestRun && sessao && aiResponse.lootOffer) {
            await persistPendingLootOffer(sessao.id, aiResponse.lootOffer as Record<string, unknown>);
        }
    }
    
    const { runNarrativeGmValidator } = await import('./narrativeGmValidator.js');
    aiResponse = runNarrativeGmValidator(aiResponse, {
        memorySummary: storySummaryForPrompt ?? newStorySummaryForLog ?? undefined,
    });
    await attachNarrationAudio(aiResponse);
    
    if (aiResponse.imagePrompt && isImageGenerationAvailable(apiKey)) {
        const imageEntryExists = aiResponse.logEntries?.some(entry => entry?.type === 'image');
        if (!imageEntryExists) {
            const imageEntry = {
                id: uuidv4(),
                type: 'image' as const,
                content: {
                    status: 'generating',
                    prompt: aiResponse.imagePrompt,
                    requestedAt: new Date().toISOString(),
                },
            };
            aiResponse.logEntries = [...(aiResponse.logEntries ?? []), imageEntry];
        } else if (aiResponse.logEntries) {
            aiResponse.logEntries = aiResponse.logEntries.map(entry => {
                if (entry?.type === 'image' && entry.content && typeof entry.content === 'object' && !entry.content.prompt) {
                    entry.content.prompt = aiResponse.imagePrompt;
                }
                return entry;
            });
        }
    }

    const pendingRollForSession = sessao ? await getPendingRollRequest(sessao.id) : null;
    // Fase 0: apenas o motor de regras emite rolagens; a IA nunca cria playerRollRequest.
    const allowAiRollRequest = false;

    if (aiResponse.playerRollRequest && !allowAiRollRequest) {
        const reason = statePhase.suppressRollRequest ? 'suppress-roll-request' : 'pending-roll-exists';
        if (sessao?.id || sessionId) {
            recordUnexpectedAiRoll(sessao?.id ?? sessionId, reason);
        }
        aiResponse.playerRollRequest = undefined;
        appendSystemNote(
            aiResponse,
            statePhase.suppressRollRequest
                ? '[RollGuard] Solicitação de rolagem descartada: o motor não está aguardando rolagens neste turno.'
                : '[RollGuard] Solicitação de rolagem descartada: já existe uma rolagem pendente para esta sessão.'
        );
    } else if (aiResponse.playerRollRequest) {
        const recalculatedModifier = recalculatePlayerRollModifier(aiResponse.playerRollRequest, characterForAI);
        if (
            recalculatedModifier !== null &&
            recalculatedModifier !== aiResponse.playerRollRequest.modifier
        ) {
            aiResponse.playerRollRequest.modifier = recalculatedModifier;
            aiResponse.systemLog = appendSystemLogEntry(
                aiResponse.systemLog,
                `[Regras] Modificador ajustado para ${recalculatedModifier >= 0 ? '+' : ''}${recalculatedModifier} com base nos atributos atuais.`
            );
        }
    }

    if (isTestRun || !sessao) {
        return aiResponse;
    }

    if (aiResponse.playerRollRequest) {
        const requestId = uuidv4();
        aiResponse.playerRollRequest.requestId = requestId;
        await savePendingRollRequest(
            sessao.id,
            userId,
            {
                ...aiResponse.playerRollRequest,
                requestId,
            },
            {
                actionId: actionId ?? requestId,
                intentType: 'narration',
                metadata: {
                    scenarioLabel: gameMasterFlowInput.scenarioLabel,
                    playerAction: playerAction.slice(0, 200),
                },
            },
        );
        return aiResponse;
    }

    await clearPendingRollRequest(sessao.id);

    return persistNarrationTurn({
        sessao,
        userId,
        apiKey,
        aiResponse,
        playerAction,
        rawText,
        attempts,
        validationIssues,
        usedFallback,
        latestStateHint,
        normalizedStateHints,
        isInternalAction,
        newStorySummaryForLog,
        combatReconciliation,
        loadedCombat,
        motorOwnsState,
        latestNarrationSummary,
        sessionCacheKey,
    });
};
