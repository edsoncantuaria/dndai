// backend/src/services/narrarService.ts
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import createError from 'http-errors';
import type { GameMasterResponse, CombatState, ApiSpell } from '../schemas/gameSchemas.js';
import { In } from 'typeorm';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import * as HomebrewService from './homebrewService.js';
import { mergeCharacterUpdates } from './safeMerge.js';
import * as SessaoService from './sessaoService.js';
import redisClient from '../database/redis-client.js';
import { v4 as uuidv4 } from 'uuid';
import { getGameUpdate } from './aiService.js';
import { validateGameMasterResponse } from './gameResponseValidator.js';
import { orchestrateGameMasterResponse, generateFallbackResponse } from './gameOrchestrator.js';
import { hydrateInventoryItems, reconcileCurrency } from './inventoryService.js';


// Função auxiliar para calcular o modificador de um atributo
const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

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
const buildOptimizedCharacterForAI = async (characterId: number, useCache: boolean = true) => {
    const cacheKey = `character:${characterId}:optimized`;

    // 1. Tenta buscar do cache
    if (useCache && redisClient && redisClient.isOpen) {
        try {
            const cachedCharacter = await redisClient.get(cacheKey);
            if (cachedCharacter) {
                console.log(`[Cache] HIT: Carregando personagem otimizado ${characterId} do cache.`);
                return JSON.parse(cachedCharacter);
            }
        } catch (error) {
            console.error(`[Cache] Erro ao buscar personagem otimizado ${characterId}:`, error);
        }
    }
    
    // 2. Se não encontrar no cache, busca no DB
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

    const characterForAI = {
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
        spells: spells as ApiSpell[],
        feats: fullCharacter.feats || [],
        journal: fullCharacter.journal || [],
        relationships: fullCharacter.relationships || [],
        storySoFar: fullCharacter.storySoFar || "",
        worldState: fullCharacter.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' },
        factionReputation: fullCharacter.factionReputation || {},
        currentRegion: fullCharacter.currentRegion || "",
    };

    // 3. Salva no cache antes de retornar
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.set(cacheKey, JSON.stringify(characterForAI), { EX: 3600 }); // Cache por 1 hora
            console.log(`[Cache] SET: Personagem otimizado ${characterId} salvo no cache.`);
        } catch (error) {
            console.error(`[Cache] Erro ao salvar personagem otimizado ${characterId}:`, error);
        }
    }
    
    return characterForAI;
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
    
    const sessionCacheKey = `session:${sessionId}:homebrew_summary`;

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
        playerAction,
        gameLog: JSON.stringify(chronologicalLogs),
        combatState: currentCombatState,
        useAiHomebrew: useAiHomebrew ?? true,
        enableNarrativeRevalidation: true,
        homebrewSummary: homebrewSummaryForAI || undefined,
    };

    const appendSystemNote = (response: GameMasterResponse, note: string) => {
        if (!note) return;
        response.systemLog = response.systemLog ? `${response.systemLog}\n${note}` : note;
    };

    const runValidatedGameUpdate = async () => {
        const MAX_VALIDATION_ATTEMPTS = 3;
        let attempts = 0;
        let calls = 0;
        let validationFeedback: string | undefined;
        let latestIssues: string[] = [];
        let rawText: string | null = null;
        let finalFromModel: GameMasterResponse | null = null;
        let usedFallback = false;

        while (attempts < MAX_VALIDATION_ATTEMPTS) {
            calls += 1;
            const { response: candidate, rawText: currentRaw } = await getGameUpdate(
                { ...gameMasterFlowInput, validationFeedback },
                modelToUse,
                generationConfig,
                apiKey
            );
            rawText = currentRaw;
            const validation = validateGameMasterResponse(candidate, { character: characterForAI });
            if (validation.valid) {
                finalFromModel = candidate;
                latestIssues = [];
                break;
            }
            latestIssues = validation.issues;
            validationFeedback = `Foram detectadas inconsistências: ${validation.issues.join('; ')}. Corrija-as e responda novamente seguindo estritamente o schema JSON.`;
            attempts += 1;
        }

        if (!finalFromModel) {
            finalFromModel = generateFallbackResponse({ character: characterForAI }, playerAction, latestIssues);
            usedFallback = true;
        }

        const { response: orchestratedResponse } = orchestrateGameMasterResponse(finalFromModel, { character: characterForAI });

        if (!usedFallback && attempts > 1) {
            appendSystemNote(orchestratedResponse, `[Validador] Resposta reajustada após ${attempts} tentativa(s).`);
        }
        if (usedFallback && latestIssues.length > 0) {
            appendSystemNote(orchestratedResponse, `[Validador] Fallback acionado. Problemas detectados: ${latestIssues.join('; ')}`);
        }

        return {
            response: orchestratedResponse,
            rawText,
            validationIssues: latestIssues,
            attempts: calls,
            usedFallback,
        };
    };

    const { response: aiResponse, rawText, validationIssues, attempts, usedFallback } = await runValidatedGameUpdate();

    if (aiResponse.updatedCharacter?.inventory && Array.isArray(aiResponse.updatedCharacter.inventory)) {
        const { items: hydratedItems, metrics } = await hydrateInventoryItems(
            aiResponse.updatedCharacter.inventory as any[],
            userId
        );
        (aiResponse.updatedCharacter as any).inventory = hydratedItems;
        const currentCurrency = reconcileCurrency(
            (aiResponse.updatedCharacter as any).currency,
            metrics.currency
        );
        (aiResponse.updatedCharacter as any).currency = currentCurrency;
        (aiResponse.updatedCharacter as any).currentWeight = metrics.totalWeight;
    }
    
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
        if (rawText) {
            const rawLog = new SessionLog();
            Object.assign(rawLog, {
                sessaoId: sessao.id,
                prompt: 'GM Raw Response',
                response: rawText,
                type: 'gm_raw',
            });
            await logRepository.save(rawLog);
        }
        const validationLog = new SessionLog();
        Object.assign(validationLog, {
            sessaoId: sessao.id,
            prompt: 'GM Validation',
            response: JSON.stringify({ attempts, issues: validationIssues, fallback: usedFallback }),
            type: 'gm_validation',
        });
        await logRepository.save(validationLog);
        
        const isInternalAction = playerAction.startsWith("Recarregar estado atual") || playerAction.startsWith("A aventura começa.") || playerAction.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades");
        
        if(!isInternalAction) {
            const playerLogEntry = new SessionLog();
            Object.assign(playerLogEntry, { sessaoId: sessao.id, prompt: 'Player Action', response: playerAction, type: 'action' });
            await logRepository.save(playerLogEntry);
        }
        
        const stateForLog: Partial<GameMasterResponse> = { ...aiResponse };
        delete stateForLog.logEntries;
        const stateLogEntry = new SessionLog();
        Object.assign(stateLogEntry, {
            sessaoId: sessao.id,
            prompt: 'GM Full State',
            response: JSON.stringify(stateForLog),
            type: 'state',
        });
        await logRepository.save(stateLogEntry);

        if (aiResponse.logEntries) {
            for (const entry of aiResponse.logEntries) {
                let contentToSave = entry.content;
                
                if(entry.type === 'image' && typeof entry.content === 'object' && entry.content.status === 'generating') {
                    try {
                        const result = await getGameUpdate({
                            ...gameMasterFlowInput,
                            playerAction: `Gere uma imagem para o seguinte prompt: ${entry.content.prompt}`
                        }, 'gemini-1.5-flash-latest', { temperature: 0.3, ...generationConfig }, apiKey);
                        // Supondo que a IA retorne a URL da imagem no log
                        const imageUrl = result.response.logEntries?.find(le => le.type === 'image')?.content.imageUrl;
                        contentToSave = { ...entry.content, status: 'done', imageUrl: imageUrl };
                    } catch (imageError: any) {
                        console.error(`[narrarService] Falha ao gerar imagem inline:`, imageError);
                        contentToSave = { ...entry.content, status: 'failed', text: `Falha ao gerar imagem: ${imageError.message}`};
                    }
                }
                const contentString = typeof contentToSave === 'object' ? JSON.stringify(contentToSave) : contentToSave;
                if (contentString) {
                    const newLog = new SessionLog();
                    Object.assign(newLog, {
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
                        if (redisClient && redisClient.isOpen) {
                            await redisClient.del(sessionCacheKey);
                        }
                    }
                } catch (error) {
                    console.error(`[narrarService] Falha ao salvar conteúdo Homebrew da IA:`, error);
                }
            }
        }

        const updatesToPersist = { ...aiResponse.updatedCharacter, worldState: aiResponse.worldState };
        if (Object.keys(updatesToPersist).length > 1 || (updatesToPersist.worldState && Object.keys(updatesToPersist.worldState).length > 0)) { 
             await mergeCharacterUpdates(sessao.character!.id, updatesToPersist, queryRunner);
             // Invalida o cache otimizado após a atualização
            if (redisClient && redisClient.isOpen) {
                await redisClient.del(`character:${sessao.character!.id}:optimized`);
                await redisClient.del(sessionCacheKey);
            }
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

    
