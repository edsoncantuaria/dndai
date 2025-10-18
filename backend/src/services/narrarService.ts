// backend/src/services/narrarService.ts
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { getGameUpdate } from './aiService.js';
import createError from 'http-errors';
import type { GameMasterResponse, CombatState, ApiSpell } from '../schemas/gameSchemas.js';
import { In } from 'typeorm';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import * as HomebrewService from './homebrewService.js';
import { mergeCharacterUpdates } from './safeMerge.js';
import * as SessaoService from './sessaoService.js';
import redisClient from '../database/redis-client.js';


// Função auxiliar para calcular o modificador de um atributo
const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

/**
 * Traduz um objeto de conteúdo homebrew em uma string de resumo para a IA.
 * @param content O objeto de conteúdo homebrew.
 * @returns Uma string de resumo ou null se o conteúdo for inválido.
 */
const summarizeHomebrewForAI = (content: HomebrewContent): string | null => {
    if (!content || !content.content) return null;

    const data = content.content;
    const type = content.type;
    let summary = `[${type.toUpperCase()}] ${data.name}: `;

    try {
        switch (type) {
            case 'spell':
                summary += `${data.desc?.[0] || ''} (Nível ${data.level}, Escola: ${data.school?.name || 'Desconhecida'}).`;
                break;
            case 'item':
                 summary += `${data.desc?.[0] || 'Um item.'}`;
                 if (data.rarity) summary += ` (Raridade: ${data.rarity.name})`;
                 break;
            case 'monster':
                summary += `ND ${data.challenge_rating || '?'}. ${data.size || ''} ${data.type || ''}. PV: ${data.hit_points || '?'}. CA: ${data.armor_class?.[0]?.value || data.armor_class || '?'}.`;
                break;
            default:
                summary += `${(data.desc?.[0] || data.desc || 'Conteúdo personalizado.')?.substring(0, 150)}...`;
                break;
        }
        return summary;
    } catch (e) {
        console.warn(`Falha ao sumarizar o conteúdo homebrew: ${data.name}`, e);
        return null;
    }
};


// Constrói um objeto de personagem otimizado para a IA.
const buildOptimizedCharacterForAI = async (characterId: number) => {
    const characterRepo = AppDataSource.getRepository(Character);
    const fullCharacter = await characterRepo.findOne({
        where: { id: characterId },
        relations: ["attributes", "proficiencies", "items", "spells", "journal", "journal.subLocations", "relationships", "relationships.quests"],
    });

    if (!fullCharacter || !fullCharacter.attributes) return null;
    
    const proficiencyBonus = Math.floor((fullCharacter.level - 1) / 4) + 2;
    const wisdomMod = calculateModifier(fullCharacter.attributes.wisdom);
    const intelligenceMod = calculateModifier(fullCharacter.attributes.intelligence);
    
    const proficiencies = Array.isArray(fullCharacter.proficiencies) ? fullCharacter.proficiencies : [];
    const isProficientInPerception = proficiencies.some(p => p?.name?.toLowerCase().includes('perception'));
    const isProficientInInsight = proficiencies.some(p => p?.name?.toLowerCase().includes('insight'));
    const isProficientInInvestigation = proficiencies.some(p => p?.name?.toLowerCase().includes('investigation'));

    const passivePerception = 10 + wisdomMod + (isProficientInPerception ? proficiencyBonus : 0);
    const passiveInsight = 10 + wisdomMod + (isProficientInInsight ? proficiencyBonus : 0);
    const passiveInvestigation = 10 + intelligenceMod + (isProficientInInvestigation ? proficiencyBonus : 0);

    const inventory = Array.isArray(fullCharacter.items) ? fullCharacter.items.map(item => ({...item.itemData, equipped: item.equipped})) : [];
    const spells = Array.isArray(fullCharacter.spells) ? fullCharacter.spells.map(s => s?.spellName).filter(Boolean) : [];

    return {
        id: fullCharacter.id,
        name: fullCharacter.name,
        race: fullCharacter.race,
        characterClass: fullCharacter.characterClass,
        level: fullCharacter.level,
        attributes: {
            strength: fullCharacter.attributes.strength,
            dexterity: fullCharacter.attributes.dexterity,
            constitution: fullCharacter.attributes.constitution,
            intelligence: fullCharacter.attributes.intelligence,
            wisdom: fullCharacter.attributes.wisdom,
            charisma: fullCharacter.attributes.charisma,
            hp: fullCharacter.attributes.hp,
            ac: fullCharacter.attributes.ac,
            conditions: fullCharacter.attributes.conditions || [],
        },
        passivePerception,
        passiveInsight,
        passiveInvestigation,
        proficiencies: proficiencies.map(p => p?.name).filter(Boolean),
        inventory,
        spells: spells as ApiSpell[], // Cast to ApiSpell array
        feats: fullCharacter.feats || [],
        journal: fullCharacter.journal || [],
        relationships: fullCharacter.relationships || [],
        storySoFar: fullCharacter.storySoFar || "",
        worldState: fullCharacter.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' },
        factionReputation: fullCharacter.factionReputation || {},
        currentRegion: fullCharacter.currentRegion || "",
    };
};

export const processPlayerTurn = async (
    sessionId: number, 
    userId: number, 
    playerAction: string, 
    apiKey: string, 
    currentCombatState?: CombatState, 
    useAiHomebrew?: boolean
): Promise<GameMasterResponse> => {
    let isTestRun = false;
    let sessao: SessaoIA | null = null;
    let user: User | null = null;
    let characterForAI: any = null;
    let homebrewSummaryForAI = "";
    
    const cacheKey = `session:${sessionId}:homebrew_summary`;

    if (sessionId === -1) {
        isTestRun = true;
        user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
        characterForAI = {
            id: 1, name: 'Herói de Teste', race: 'Humano', characterClass: 'Guerreiro', level: 1,
            attributes: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, hp: 10, ac: 10, conditions: [] },
            proficiencies: [], inventory: [], spells: [], storySoFar: '', worldState: { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Plano de Testes' },
            relationships: [], journal: [], factionReputation: {}, currentRegion: 'Plano de Testes',
            passivePerception: 10, passiveInsight: 10, passiveInvestigation: 10,
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
            cachedSummary = await redisClient.get(cacheKey);
        }

        if (cachedSummary) {
            console.log(`[Cache] HIT: Resumo de homebrew para sessão ${sessionId}.`);
            homebrewSummaryForAI = cachedSummary;
        } else {
             console.log(`[Cache] MISS: Gerando resumo para sessão ${sessionId}.`);
            if (sessao.homebrewContentIds && sessao.homebrewContentIds.length > 0) {
                const installedContent = await HomebrewService.getMultipleHomebrewContentByIds(sessao.homebrewContentIds);
                const summaries = installedContent.map(summarizeHomebrewForAI).filter(Boolean);
                if (summaries.length > 0) {
                    homebrewSummaryForAI = `\n\n### Regras e Conteúdo Customizado Ativo (Homebrew)\n- ${summaries.join('\n- ')}\n`;
                    // Salva o novo resumo no cache por 24 horas
                     if (redisClient && redisClient.isOpen) {
                        await redisClient.set(cacheKey, homebrewSummaryForAI, { EX: 86400 }); 
                    }
                }
            }
        }
    }
    
    if (!apiKey) {
        throw createError(400, 'A chave de API não está configurada para este usuário. Por favor, adicione-a em "Configurações".');
    }
    
    const modelToUse = user?.settings?.model || "gemini-1.5-flash-latest";
    const generationConfig = user?.settings?.generationConfig || {};
    
    const recentLogs = isTestRun ? [] : await AppDataSource.getRepository(SessionLog).find({
        where: { sessaoId: sessao!.id },
        order: { timestamp: 'DESC' }, 
        take: 10,
    });
    
    const chronologicalLogs = recentLogs.reverse().map(log => ({
        role: log.type === 'action' ? 'user' : 'model',
        content: log.response
    }));

    const gameMasterFlowInput = {
        character: characterForAI,
        playerAction: `${playerAction}${homebrewSummaryForAI}`, // Adiciona o resumo homebrew ao final da ação do jogador
        gameLog: JSON.stringify(chronologicalLogs),
        combatState: currentCombatState,
        useAiHomebrew: useAiHomebrew ?? true,
    };

    const aiResponse = await getGameUpdate(gameMasterFlowInput, modelToUse, generationConfig, apiKey);
    
    if (isTestRun || !sessao) {
        return aiResponse;
    }

    if (aiResponse.playerRollRequest) {
        return aiResponse;
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const logRepository = queryRunner.manager.getRepository(SessionLog);
        
        const isInternalAction = playerAction.startsWith("Recarregar estado atual") || playerAction.startsWith("A aventura começa.") || playerAction.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades");
        
        if(!isInternalAction) {
            const playerLog = new SessionLog();
            Object.assign(playerLog, { id: uuidv4(), sessaoId: sessao.id, prompt: 'Player Action', response: playerAction, type: 'action' });
            await logRepository.save(playerLog);
        }
        
        const stateForLog: Partial<GameMasterResponse> = { ...aiResponse };
        delete stateForLog.logEntries;
        const stateLog = new SessionLog();
        Object.assign(stateLog, {
            id: uuidv4(),
            sessaoId: sessao.id,
            prompt: 'GM Full State',
            response: JSON.stringify(stateForLog),
            type: 'state',
        });
        await logRepository.save(stateLog);

        if (aiResponse.logEntries) {
            for (const entry of aiResponse.logEntries) {
                let contentToSave = entry.content;
                // If it's a generation request, handle it now
                if(entry.type === 'image' && typeof entry.content === 'object' && entry.content.status === 'generating') {
                    try {
                        const imageService = await import('./aiImageService.js');
                        const result = await imageService.generateImage({
                            prompt: entry.content.prompt,
                            model: user?.settings?.imageModel || 'imagen-3.0-generate-002',
                            apiKey,
                            sessionId: sessao.id,
                        });
                        contentToSave = { ...entry.content, status: 'done', imageUrl: result.imageUrl };
                    } catch (imageError: any) {
                        console.error(`[narrarService] Falha ao gerar imagem inline:`, imageError);
                        contentToSave = { ...entry.content, status: 'failed', text: `Falha ao gerar imagem: ${imageError.message}`};
                    }
                }
                const contentString = typeof contentToSave === 'object' ? JSON.stringify(contentToSave) : contentToSave;
                if (contentString) {
                    const newLog = new SessionLog();
                    Object.assign(newLog, {
                        id: uuidv4(),
                        sessaoId: sessao.id,
                        prompt: 'GM Narration',
                        response: contentString,
                        type: entry.type || 'narration',
                        rollResult: entry.rollResult,
                    });
                    await logRepository.save(newLog);
                }
            }
        }

        if (aiResponse.newHomebrewContent && Array.isArray(aiResponse.newHomebrewContent)) {
            for (const newContent of aiResponse.newHomebrewContent) {
                try {
                    const existing = await HomebrewService.checkIfNameExists(newContent.name, newContent.type);
                    if (!existing) {
                       const saved = await HomebrewService.createHomebrewContent(userId, { ...newContent, isPublic: true, createdBy: 'ai' });
                       await SessaoService.updateHomebrewInstallation(sessao.id, userId, saved.id, 'install');
                    }
                } catch (error) {
                    console.error(`[narrarService] Falha ao salvar conteúdo Homebrew da IA:`, error);
                }
            }
        }

        const updatesToPersist = { ...aiResponse.updatedCharacter, worldState: aiResponse.worldState };
        if (Object.keys(updatesToPersist).length > 1 || (updatesToPersist.worldState && Object.keys(updatesToPersist.worldState).length > 0)) { 
             await mergeCharacterUpdates(sessao.character!.id, updatesToPersist, queryRunner);
        }
        
        await queryRunner.commitTransaction();
        return aiResponse;
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error("Erro na transação de narração:", error);
        throw createError(500, 'Falha ao salvar o progresso da aventura.');
    } finally {
        await queryRunner.release();
    }
};
