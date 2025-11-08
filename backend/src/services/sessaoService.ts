// backend/src/services/sessaoService.ts
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { IsNull, In } from 'typeorm';
import createError from 'http-errors';
import { buildFullCharacterObject, cloneCharacter } from './characterService.js';
import * as HomebrewService from './homebrewService.js';
import type { z } from 'zod';
import type { CreateSessaoSchema } from '../schemas/validationSchemas.js';
import { buildTimelineFacts, getStorySummary, getTimeline } from './storyService.js';
import type { Relationship as CharacterRelationship, JournalEntry } from '../types.js';

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
        quests: Array<{ id: string; title: string; status: string }>;
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

export const getOrCreateSessao = async (data: z.infer<typeof CreateSessaoSchema>, userId: number) => {
    const { nome, characterId } = data;
    
    const characterRepository = AppDataSource.getRepository(Character);
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const userRepository = AppDataSource.getRepository(User);

    const [characterTemplate, user] = await Promise.all([
        characterRepository.findOne({ where: { id: characterId, userId } }),
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
    const newCharacterForSession = await cloneCharacter(characterTemplate.id, userId, characterTemplate.name);
    if (!newCharacterForSession) {
        throw createError(500, 'Falha ao clonar o personagem para a nova sessão.');
    }

    // 2. Buscar todas as dependências do conteúdo instalado no usuário
    const dependencyPromises = (user.installedHomebrewIds || []).map(id => HomebrewService.getHomebrewDependencies(id));
    const dependencyArrays = await Promise.all(dependencyPromises);
    const allDependentIds = new Set(dependencyArrays.flat().map(dep => dep.id));
    
    // 3. Criar a nova sessão
    const novaSessao = new SessaoIA();
    novaSessao.nome = nome;
    novaSessao.characterId = newCharacterForSession.id; // Vincula ao NOVO personagem
    novaSessao.userId = userId;
    novaSessao.apiKey = '';
    novaSessao.homebrewContentIds = Array.from(allDependentIds);

    const sessaoSalva = await sessaoRepository.save(novaSessao);
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
        sessao.character = await buildFullCharacterObject(sessao.character) as Character;
    }

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
    return await buildFullCharacterObject(character) as Character;
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
            })),
        }));

    const questEntries: Array<{
        id: string;
        title: string;
        status: string;
        source: string;
        summary?: string;
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
