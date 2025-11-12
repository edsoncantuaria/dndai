// backend/src/services/sessaoService.ts
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { IsNull, In, QueryRunner } from 'typeorm';
import createError from 'http-errors';
import { buildFullCharacterObject, cloneCharacter } from './characterService.js';
import * as HomebrewService from './homebrewService.js';
import type { z } from 'zod';
import type { CreateSessaoSchema } from '../schemas/validationSchemas.js';
import { buildTimelineFacts, getStorySummary, getTimeline } from './storyService.js';
import type { Relationship as CharacterRelationship, JournalEntry } from '../types.js';
import { SessionLog } from '../entities/SessionLog.js';
import { TimelineEvent } from '../entities/TimelineEvent.js';
import { StorySummary } from '../entities/StorySummary.js';
import { CombatEncounter } from '../entities/CombatEncounter.js';
import { CombatantState } from '../entities/CombatantState.js';
import { CombatLogEntry } from '../entities/CombatLogEntry.js';
import { CombatCooldown } from '../entities/CombatCooldown.js';
import { CombatStatusEffect } from '../entities/CombatStatusEffect.js';
import * as RegionService from './regionService.js';
import { extractQuestKeywordStrings } from './questKeywordService.js';
import type { RegionLink } from '../entities/RegionLink.js';
import { fetchObjectAsText } from './objectStorageService.js';

interface SessionFactsPayload {
    storySummary: string | null;
    timelineFacts: string | null;
    recentEvents: Array<{
        turn: number;
        timestamp: string;
        action: string;
        summary: string;
        notes?: string;
    }>;
    activeNPCs: Array<{
        npcId?: string;
        name: string;
        status: string;
        affinity: number;
        description?: string;
        quests: Array<{ id: string; title: string; status: string; keywords?: string[] }>;
    }>;
    activeQuests: Array<{
        id: string;
        title: string;
        status: string;
        source: string;
        summary?: string;
    }>;
}

interface SessionReplayPayload {
    fileName: string;
    markdown: string;
}

type RegionPayload = Awaited<ReturnType<typeof RegionService.listRegionsWithDetails>> extends Array<infer T>
  ? T
  : never;

type RegionPoiPayload = RegionPayload extends { pointsOfInterest?: Array<infer P> } ? (P extends object ? P : never) : never;

type WorldMapLink = {
  fromSlug: string;
  toSlug: string;
  travelMode: RegionLink['travelMode'];
  travelTimeMinutes?: number;
  difficulty?: string | null;
  isLocked: boolean;
  metadata?: Record<string, any>;
  discovered: boolean;
};

type VisitedPoiRecord = {
  regionSlug: string;
  poiSlug: string;
  name?: string | null;
};

type WorldMapMarker = {
  id: string;
  type: 'player' | 'npc' | 'quest';
  label: string;
  regionSlug: string;
  poiSlug?: string | null;
  status?: string | null;
  description?: string | null;
  relatedNpcId?: string | null;
  questId?: string | null;
  isDiscovered: boolean;
};

export interface WorldMapSnapshot {
  currentRegionSlug: string | null;
  currentPoiSlug: string | null;
  visitedRegions: string[];
  visitedPois: VisitedPoiRecord[];
  regions: Array<
    RegionPayload & {
      isDiscovered: boolean;
      isCurrent: boolean;
      pointsOfInterest?: Array<
        RegionPoiPayload & {
          isDiscovered: boolean;
        }
      >;
    }
  >;
  links: WorldMapLink[];
  markers: WorldMapMarker[];
  updatedAt: string;
}

export const getOrCreateSessao = async (data: z.infer<typeof CreateSessaoSchema>, userId: number) => {
    const { nome, characterId } = data;
    
    const characterRepository = AppDataSource.getRepository(Character);
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const userRepository = AppDataSource.getRepository(User);

    const [characterTemplate, user] = await Promise.all([
        characterRepository.findOne({ where: { id: characterId, userId }, loadEagerRelations: false }),
        userRepository.findOneBy({ id: userId }),
    ]);
    
    if (!characterTemplate) {
        throw createError(404, 'Personagem não encontrado ou você não tem permissão para usá-lo.');
    }
    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }

    // A lógica de "get" foi removida. Esta função agora SEMPRE cria uma nova sessão com um personagem clonado.
    // A sessão antiga pode ser continuada pela sua própria rota.
    
    // 1. Clonar o personagem, mantendo o nome original.
    const newCharacterForSession = await cloneCharacter(characterTemplate.id, userId);
    if (!newCharacterForSession) {
        throw createError(500, 'Falha ao clonar o personagem para a nova sessão.');
    }

    // 2. Definir ponto de spawn inicial baseado no pool de cidades
    const spawnRegion = await RegionService.pickRandomSpawnRegion();
    const baseWorldState = (newCharacterForSession.worldState && typeof newCharacterForSession.worldState === 'object')
        ? { ...newCharacterForSession.worldState }
        : {};
    const spawnWorldState: Record<string, any> = {
        ...baseWorldState,
        timeOfDay: baseWorldState.timeOfDay ?? 'Manhã',
        weather: baseWorldState.weather ?? 'Ensolarado',
        currentRegion: spawnRegion.name,
        regionSlug: spawnRegion.slug,
        visitedRegions: [spawnRegion.slug],
        visitedPois: [],
    };
    delete spawnWorldState.poiSlug;
    delete spawnWorldState.poiName;
    newCharacterForSession.worldState = spawnWorldState as any;
    newCharacterForSession.currentRegion = spawnRegion.name;

    // 3. Buscar todas as dependências do conteúdo instalado no usuário
    const dependencyPromises = (user.installedHomebrewIds || []).map(id => HomebrewService.getHomebrewDependencies(id));
    const dependencyArrays = await Promise.all(dependencyPromises);
    const allDependentIds = new Set(dependencyArrays.flat().map(dep => dep.id));
    
    // 4. Criar a nova sessão
    const novaSessao = new SessaoIA();
    novaSessao.nome = nome;
    novaSessao.characterId = newCharacterForSession.id; // Vincula ao NOVO personagem
    novaSessao.userId = userId;
    novaSessao.apiKey = '';
    novaSessao.homebrewContentIds = Array.from(allDependentIds);

    const sessaoSalva = await sessaoRepository.save(novaSessao);
    await characterRepository.update(
        { id: newCharacterForSession.id },
        {
            sessionId: sessaoSalva.id,
            isTemplate: false,
            worldState: spawnWorldState,
            currentRegion: spawnRegion.name,
        }
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey, ...sessaoParaRetorno } = sessaoSalva;
    
    return { sessao: sessaoParaRetorno, isNew: true };
};

export const getSessoesForUser = async (userId: number) => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    return sessaoRepository.find({
        where: { userId, deletedAt: IsNull() },
        relations: ['character'],
        select: {
            id: true,
            nome: true,
            createdAt: true,
            updatedAt: true,
            character: {
                id: true,
                name: true,
                level: true,
                characterClass: true,
                subclassFlavor: true,
                race: true,
            }
        }
    });
};

export const getSessaoDetails = async (sessionId: number, userId?: number) => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    
    const whereClause: any = { id: sessionId, deletedAt: IsNull() };
    if (userId) {
        whereClause.userId = userId;
    }

    const sessao = await sessaoRepository.findOne({
        where: whereClause,
        relations: ['logs', 'character']
    });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão.');
    }

    if (sessao.character) {
        sessao.character = await buildFullCharacterObject(sessao.character, { disableCache: true }) as Character;
        console.log('[getSessaoDetails] personagem carregado', {
            sessionId,
            characterId: sessao.character?.id,
            attributes: sessao.character?.attributes,
            inventory: sessao.character?.inventory?.length,
        });
    }

    await hydrateLogResponses(sessao.logs);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey, ...sessaoSegura } = sessao;
    return sessaoSegura;
};

export const deleteSessao = async (sessionId: number, userId: number) => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepository.findOneBy({ id: sessionId, userId });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão para deletá-la.');
    }

    const characterIdToDelete = sessao.characterId;

    // Soft delete da sessão
    await sessaoRepository.softDelete({ id: sessionId, userId });

    // Hard delete do personagem associado, se houver
    if (characterIdToDelete) {
        const characterRepo = AppDataSource.getRepository(Character);
        await characterRepo.delete({ id: characterIdToDelete, userId });
    }
};

export const updateHomebrewInstallation = async (sessionId: number, userId: number, homebrewId: string, action: 'install' | 'uninstall') => {
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({ where: { id: sessionId, userId } });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada.');
    }

    // Obter todas as dependências do item, incluindo ele mesmo
    const dependencies = await HomebrewService.getHomebrewDependencies(homebrewId);
    const allIds = dependencies.map(dep => dep.id);

    let currentIds = new Set(sessao.homebrewContentIds || []);

    if (action === 'install') {
        allIds.forEach(id => currentIds.add(id));
    } else {
        allIds.forEach(id => currentIds.delete(id));
    }
    
    sessao.homebrewContentIds = Array.from(currentIds);

    await sessaoRepo.save(sessao);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey, ...sessaoSegura } = sessao;
    return sessaoSegura;
};

const findSessaoWithCharacter = async (sessionId: number, userId: number) => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepository.findOne({
        where: { id: sessionId, userId, deletedAt: IsNull() },
        relations: ['character'],
    });
    if (!sessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão.');
    }
    return sessao;
};

const prepareCharacterSnapshot = async (character: Character | null) => {
    if (!character) return null;
    return await buildFullCharacterObject(character, { disableCache: true }) as Character;
};

const flattenJournalEntries = (entries?: JournalEntry[]): JournalEntry[] => {
    if (!entries) return [];
    const result: JournalEntry[] = [];
    for (const entry of entries) {
        if (!entry) continue;
        result.push(entry);
        if (entry.subLocations?.length) {
            result.push(...flattenJournalEntries(entry.subLocations));
        }
    }
    return result;
};

const resolveOffloadedResponse = async (raw?: string | null): Promise<string | null> => {
    if (!raw) return raw ?? null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.storage === 's3' && typeof parsed.key === 'string') {
            const restored = await fetchObjectAsText(parsed.key);
            return restored ?? raw;
        }
    } catch {
        // not an offloaded pointer; keep raw text
    }
    return raw;
};

const hydrateLogResponses = async (logs?: SessionLog[] | null) => {
    if (!logs?.length) return;
    await Promise.all(
        logs.map(async log => {
            const resolved = await resolveOffloadedResponse(log.response);
            if (resolved) {
                log.response = resolved;
            }
        })
    );
};

export const getSessaoFacts = async (sessionId: number, userId: number): Promise<SessionFactsPayload> => {
    const sessao = await findSessaoWithCharacter(sessionId, userId);
    const characterSnapshot = await prepareCharacterSnapshot(sessao.character);

    // 💡 A lógica de resumo agora busca o resumo e, se não encontrar, gera um na hora.
    const storySummary = await getStorySummary(sessionId);
    const timelineFacts = await buildTimelineFacts(sessionId);
    const timeline = await getTimeline(sessionId);


    const recentEvents = timeline.slice(-6).map(event => ({
        turn: event.turn,
        timestamp: event.timestamp,
        action: event.action,
        summary: event.summary,
        notes: event.notes,
    }));

    const relationships: CharacterRelationship[] = Array.isArray((characterSnapshot as any)?.relationships)
        ? (characterSnapshot as any).relationships
        : [];

    const activeNPCs = relationships
        .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
        .slice(0, 6)
        .map(rel => ({
            npcId: rel.npcId,
            name: rel.name,
            status: rel.status,
            affinity: rel.affinity,
            description: rel.description,
            quests: (rel.quests || []).map(quest => ({
                id: quest.id,
                title: quest.title,
                status: quest.status,
                keywords: extractQuestKeywordStrings(quest?.keywords as any[]),
            })),
        }));

    const questEntries: Array<{
        id: string;
        title: string;
        status: string;
        source: string;
        summary?: string;
        keywords?: string[];
    }> = [];

    for (const rel of relationships) {
        for (const quest of rel.quests || []) {
            if (quest.status === 'completed') continue;
            questEntries.push({
                id: quest.id,
                title: quest.title,
                status: quest.status,
                source: rel.name,
                summary: quest.objectives?.[0],
                keywords: extractQuestKeywordStrings(quest?.keywords as any[]),
            });
        }
    }

    const journalEntries = flattenJournalEntries((characterSnapshot as any)?.journal);
    for (const entry of journalEntries) {
        if (entry.looted) continue;
        questEntries.push({
            id: entry.id,
            title: entry.name,
            status: 'in-progress',
            source: entry.region || 'Desconhecido',
            summary: entry.summary,
        });
    }

    return {
        storySummary: storySummary || null,
        timelineFacts: timelineFacts || null,
        recentEvents,
        activeNPCs,
        activeQuests: questEntries.slice(0, 8),
    };
};

const formatDateTime = (value: Date | string | undefined): string => {
    if (!value) return 'Desconhecido';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return 'Desconhecido';
    return date.toLocaleString('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const sanitizeFileName = (value: string) => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40) || 'sessao';
};

export const generateSessionReplayMarkdown = async (
    sessionId: number,
    userId: number
): Promise<SessionReplayPayload> => {
    const sessao = await findSessaoWithCharacter(sessionId, userId);
    const characterSnapshot = await prepareCharacterSnapshot(sessao.character);

    const [storySummary, timelineFacts, timeline] = await Promise.all([
        getStorySummary(sessionId),
        buildTimelineFacts(sessionId),
        getTimeline(sessionId),
    ]);

    const heroLines: string[] = [];
    if (characterSnapshot) {
        heroLines.push(`- **Nome:** ${characterSnapshot.name}`);
        heroLines.push(`- **Classe:** ${characterSnapshot.characterClass}${characterSnapshot.subclassFlavor ? ` (${characterSnapshot.subclassFlavor})` : ''}`);
        heroLines.push(`- **Nível:** ${characterSnapshot.level}`);
        heroLines.push(`- **Raça:** ${characterSnapshot.race}${characterSnapshot.subrace ? ` (${characterSnapshot.subrace})` : ''}`);
        if (characterSnapshot.alignment) {
            heroLines.push(`- **Alinhamento:** ${characterSnapshot.alignment}`);
        }
    }

    const recentEvents = timeline.slice(-12).map(event => `- Turno ${event.turn}: ${event.summary}${event.notes ? ` (${event.notes})` : ''}`);
    const xpEvents = timeline
        .filter(event => event.action === 'Recompensa de XP')
        .slice(-10)
        .map(event => `- ${event.summary}`);

    const markdownSections: string[] = [
        `# Crônicas de ${sessao.nome}`,
        `_Gerado em ${formatDateTime(new Date())}_`,
        `## Herói`,
        heroLines.length ? heroLines.join('\n') : 'Informações do herói indisponíveis.',
        `## Resumo Atual`,
        storySummary || 'Ainda não há um resumo consolidado desta jornada.',
        `## Fatos Relevantes`,
        timelineFacts || 'Nenhum fato destacado recentemente.',
        `## Eventos Recentes`,
        recentEvents.length ? recentEvents.join('\n') : 'Nenhum evento registrado.',
        `## Recompensas Recentes`,
        xpEvents.length ? xpEvents.join('\n') : 'Nenhuma recompensa registrada nos últimos turnos.',
    ];

    return {
        fileName: `replay-${sanitizeFileName(sessao.nome)}.md`,
        markdown: markdownSections.join('\n\n').trim(),
    };
};

export const renameSessao = async (sessionId: number, userId: number, nome: string) => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepository.findOne({
        where: { id: sessionId, userId, deletedAt: IsNull() },
    });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão.');
    }

    sessao.nome = nome.trim();
    const updated = await sessaoRepository.save(sessao);
    const { apiKey, ...sessaoSemApi } = updated;
    return sessaoSemApi;
};

export const cloneSessao = async (sessionId: number, userId: number, queryRunner: QueryRunner) => {
    const sessaoRepo = queryRunner.manager.getRepository(SessaoIA);

    const originalSessao = await sessaoRepo.findOne({
        where: { id: sessionId, userId, deletedAt: IsNull() },
        relations: ['logs', 'timelineEvents', 'storySummaries', 'combatEncounters', 'combatEncounters.combatants', 'combatEncounters.combatants.cooldowns', 'combatEncounters.combatants.statusEffects', 'combatEncounters.logs']
    });

    if (!originalSessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão.');
    }

    const clonedCharacter = await cloneCharacter(originalSessao.characterId, userId, queryRunner);
    if (!clonedCharacter) {
        throw createError(500, 'Falha ao clonar o personagem da sessão.');
    }

    const cloneName = `${originalSessao.nome} (Clone)`.slice(0, 100);
    const novaSessao = sessaoRepo.create({
        nome: cloneName,
        userId,
        characterId: clonedCharacter.id,
        apiKey: '', // ApiKey nunca é clonada
        homebrewContentIds: originalSessao.homebrewContentIds ?? [],
    });
    const sessaoClonada = await sessaoRepo.save(novaSessao);
    await queryRunner.manager.getRepository(Character).update({ id: clonedCharacter.id }, { sessionId: sessaoClonada.id, isTemplate: false });

    // Replicar logs
    if (originalSessao.logs?.length) {
        const newLogs = originalSessao.logs.map(log => {
            const { id, sessao, ...logData } = log;
            return queryRunner.manager.create(SessionLog, { ...logData, sessaoId: sessaoClonada.id });
        });
        await queryRunner.manager.save(newLogs);
    }

    // Replicar eventos da timeline
    if (originalSessao.timelineEvents?.length) {
        const newEvents = originalSessao.timelineEvents.map(event => {
            const { id, sessao, ...eventData } = event;
            return queryRunner.manager.create(TimelineEvent, { ...eventData, sessaoId: sessaoClonada.id });
        });
        await queryRunner.manager.save(newEvents);
    }
    
    // Replicar resumo da história
    if (originalSessao.storySummaries?.length) {
        const newSummaries = originalSessao.storySummaries.map(summary => {
            const { id, sessao, ...summaryData } = summary;
            return queryRunner.manager.create(StorySummary, { ...summaryData, sessaoId: sessaoClonada.id });
        });
        await queryRunner.manager.save(newSummaries);
    }

    // Replicar encontros de combate
    if(originalSessao.combatEncounters?.length > 0) {
        const combatRepo = queryRunner.manager.getRepository(CombatEncounter);
        const combatantRepo = queryRunner.manager.getRepository(CombatantState);
        const combatLogRepo = queryRunner.manager.getRepository(CombatLogEntry);
        for(const encounter of originalSessao.combatEncounters) {
            const { id, sessao, sessaoId, combatants, logs, ...encounterData } = encounter;
            const newEncounter = combatRepo.create({ ...encounterData, sessaoId: sessaoClonada.id });
            const savedEncounter = await combatRepo.save(newEncounter);
            
            // Replicar combatentes e seus estados aninhados
            if(combatants?.length) {
                 for(const combatant of combatants) {
                    const { id: combatantId, encounter: _encounter, encounterId, cooldowns, statusEffects, ...combatantData } = combatant;
                    const newCombatant = combatantRepo.create({
                        ...combatantData,
                        encounterId: savedEncounter.id,
                        cooldowns: cooldowns?.map(cooldown => {
                            const { id: cooldownId, combatant: _combatant, ...cooldownData } = cooldown;
                            return queryRunner.manager.create(CombatCooldown, cooldownData);
                        }) ?? [],
                        statusEffects: statusEffects?.map(effect => {
                            const { id: effectId, combatant: _combatant, ...effectData } = effect;
                            return queryRunner.manager.create(CombatStatusEffect, effectData);
                        }) ?? [],
                    });
                    await combatantRepo.save(newCombatant);
                }
            }
            
            // Replicar logs de combate
            if(logs?.length) {
                const newCombatLogs = logs.map(log => {
                    const {id: logId, encounter: _encounter, encounterId, ...logData} = log;
                    return combatLogRepo.create({...logData, encounterId: savedEncounter.id});
                });
                await combatLogRepo.save(newCombatLogs);
            }
        }
    }

    const { apiKey, ...sessaoSemApi } = sessaoClonada;
    return { sessao: sessaoSemApi };
};

const normalizeSlug = (value?: string | null) => RegionService.slugify(value) || '';

const normalizeVisitedRegions = (values: unknown): string[] => {
    if (!Array.isArray(values)) return [];
    return values
        .map(item => (typeof item === 'string' ? normalizeSlug(item) : ''))
        .filter((slug): slug is string => Boolean(slug));
};

const normalizeVisitedPois = (values: unknown): VisitedPoiRecord[] => {
    if (!Array.isArray(values)) return [];
    return values
        .map(item => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, any>;
            const regionSlug = normalizeSlug(record.regionSlug ?? record.region ?? record.city);
            const poiSlug = normalizeSlug(record.poiSlug ?? record.slug ?? record.poi ?? record.name);
            if (!regionSlug || !poiSlug) return null;
            return {
                regionSlug,
                poiSlug,
                name: record.name ?? record.poiName ?? null,
            };
        })
        .filter((poi): poi is VisitedPoiRecord => Boolean(poi));
};

export const getWorldMapSnapshot = async (sessionId: number, userId: number): Promise<WorldMapSnapshot> => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const characterRepository = AppDataSource.getRepository(Character);
    const sessao = await sessaoRepository.findOne({
        where: { id: sessionId, userId, deletedAt: IsNull() },
        relations: ['character'],
    });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão.');
    }
    if (!sessao.character) {
        throw createError(400, 'Sessão sem personagem associado.');
    }
    const characterWithRelations = await characterRepository.findOne({
        where: { id: sessao.character.id },
        relations: ['relationships', 'relationships.quests', 'relationships.quests.keywords'],
    });
    const relationships = characterWithRelations?.relationships ?? [];
    const relationshipByNpcId = new Map<string, (typeof relationships)[number]>();
    relationships.forEach(rel => {
        if (rel?.npcId) relationshipByNpcId.set(rel.npcId, rel);
    });

    const worldState = (sessao.character.worldState ?? {}) as Record<string, any>;
    const visitedRegions = normalizeVisitedRegions(worldState.visitedRegions);
    const visitedRegionSet = new Set(visitedRegions);
    const visitedPoisRaw = normalizeVisitedPois(worldState.visitedPois);
    const visitedPoiMap = new Map<string, VisitedPoiRecord>();
    visitedPoisRaw.forEach(poi => {
        const key = `${poi.regionSlug}::${poi.poiSlug}`;
        if (!visitedPoiMap.has(key)) visitedPoiMap.set(key, poi);
    });
    const visitedPois = Array.from(visitedPoiMap.values());
    const visitedPoiSet = new Set(visitedPoiMap.keys());
    const currentRegionSlug =
        normalizeSlug(worldState.regionSlug ?? worldState.currentRegionSlug ?? worldState.currentRegion) ||
        normalizeSlug(sessao.character.currentRegion);
    const currentPoiSlug = normalizeSlug(worldState.poiSlug ?? worldState.poiName);

    if (!visitedRegionSet.size && currentRegionSlug) {
        visitedRegionSet.add(currentRegionSlug);
    }

    const regions = await RegionService.listRegionsWithDetails();
    const enrichedRegions = regions.map(region => ({
        ...region,
        isDiscovered: visitedRegionSet.has(region.slug),
        isCurrent: region.slug === currentRegionSlug,
        pointsOfInterest: (region.pointsOfInterest ?? []).map(poi => ({
            ...poi,
            isDiscovered: visitedPoiSet.has(`${region.slug}::${poi.slug}`),
        })),
    }));

    const edgeMap = new Map<string, WorldMapLink>();
    regions.forEach(region => {
        region.neighbors
            ?.filter(neighbor => neighbor.direction === 'outgoing' && neighbor.targetRegionSlug)
            ?.forEach(neighbor => {
                const fromSlug = region.slug;
                const toSlug = neighbor.targetRegionSlug!;
                const key = [fromSlug, toSlug].sort().join('::');
                if (edgeMap.has(key)) return;
                edgeMap.set(key, {
                    fromSlug,
                    toSlug,
                    travelMode: neighbor.travelMode,
                    travelTimeMinutes: neighbor.travelTimeMinutes,
                    difficulty: neighbor.difficulty,
                    isLocked: neighbor.isLocked,
                    metadata: neighbor.metadata,
                    discovered: visitedRegionSet.has(fromSlug) && visitedRegionSet.has(toSlug),
                });
            });
    });

    const markers: WorldMapMarker[] = [];
    const pushMarker = (marker: Omit<WorldMapMarker, 'isDiscovered'>) => {
        const regionSlug = normalizeSlug(marker.regionSlug);
        if (!regionSlug) return;
        markers.push({
            ...marker,
            regionSlug,
            poiSlug: marker.poiSlug ? normalizeSlug(marker.poiSlug) || null : marker.poiSlug ?? null,
            isDiscovered: visitedRegionSet.has(regionSlug),
        });
    };

    if (currentRegionSlug) {
        pushMarker({
            id: `player:${sessao.character.id}`,
            type: 'player',
            label: sessao.character.name,
            regionSlug: currentRegionSlug,
            poiSlug: currentPoiSlug || null,
            description: 'Posição atual do grupo',
            status: null,
        });
    }

    const normalizedNpcLocations = Array.isArray(worldState.npcLocations) ? worldState.npcLocations : [];
    const seenNpcIds = new Set<string>();
    normalizedNpcLocations.forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        const npcId = typeof entry.npcId === 'string' ? entry.npcId : undefined;
        const rel = npcId ? relationshipByNpcId.get(npcId) : undefined;
        const regionSlug = normalizeSlug(entry.regionSlug ?? rel?.regionSlug);
        if (!regionSlug) return;
        const poiSlug = normalizeSlug(entry.poiSlug ?? rel?.poiSlug) || null;
        const label = entry.name ?? rel?.name ?? npcId ?? 'NPC';
        pushMarker({
            id: npcId ? `npc:${npcId}` : `npc:${label}:${regionSlug}`,
            type: 'npc',
            label,
            regionSlug,
            poiSlug,
            status: rel?.status ?? null,
            description: entry.notes ?? rel?.description ?? null,
            relatedNpcId: npcId ?? null,
        });
        if (npcId) seenNpcIds.add(npcId);
    });

    relationships.forEach(rel => {
        if (!rel?.npcId || seenNpcIds.has(rel.npcId)) return;
        const regionSlug = normalizeSlug(rel.regionSlug);
        if (!regionSlug) return;
        pushMarker({
            id: `npc:${rel.npcId}`,
            type: 'npc',
            label: rel.name,
            regionSlug,
            poiSlug: normalizeSlug(rel.poiSlug) || null,
            status: rel.status,
            description: rel.description ?? null,
            relatedNpcId: rel.npcId,
        });
        seenNpcIds.add(rel.npcId);
    });

    relationships.forEach(rel => {
        if (!rel?.quests?.length) return;
        const regionSlug = normalizeSlug(rel.regionSlug);
        if (!regionSlug) return;
        rel.quests.forEach(quest => {
            if (!quest || quest.status !== 'active') return;
            pushMarker({
                id: `quest:${quest.id}`,
                type: 'quest',
                label: quest.title,
                regionSlug,
                poiSlug: normalizeSlug(rel.poiSlug) || null,
                status: quest.status,
                description: quest.objectives?.[0] ?? null,
                relatedNpcId: rel.npcId ?? null,
                questId: quest.id,
            });
        });
    });

    return {
        currentRegionSlug: currentRegionSlug || null,
        currentPoiSlug: currentPoiSlug || null,
        visitedRegions: Array.from(visitedRegionSet),
        visitedPois,
        regions: enrichedRegions,
        links: Array.from(edgeMap.values()),
        markers,
        updatedAt: new Date().toISOString(),
    };
};
