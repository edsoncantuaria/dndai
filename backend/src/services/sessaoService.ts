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
}
