// backend/src/services/sessaoService.ts
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { IsNull, In } from 'typeorm';
import createError from 'http-errors';
import { buildFullCharacterObject } from './characterService.js';
import * as HomebrewService from './homebrewService.js';
import type { z } from 'zod';
import type { CreateSessaoSchema } from '../schemas/validationSchemas.js';

export const getOrCreateSessao = async (data: z.infer<typeof CreateSessaoSchema>, userId: number) => {
    const { nome, characterId } = data;
    
    const characterRepository = AppDataSource.getRepository(Character);
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const userRepository = AppDataSource.getRepository(User);

    const [character, user] = await Promise.all([
        characterRepository.findOne({ where: { id: characterId, userId } }),
        userRepository.findOneBy({ id: userId }),
    ]);
    
    if (!character) {
        throw createError(404, 'Personagem não encontrado ou você não tem permissão para usá-lo.');
    }
    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }

    const existingSession = await sessaoRepository.findOne({ where: { characterId, userId, deletedAt: IsNull() } });
    if (existingSession) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKey, ...sessaoParaRetorno } = existingSession;
        return { sessao: sessaoParaRetorno, isNew: false };
    }
    
    // Buscar todas as dependências do conteúdo instalado no usuário
    const dependencyPromises = (user.installedHomebrewIds || []).map(id => HomebrewService.getHomebrewDependencies(id));
    const dependencyArrays = await Promise.all(dependencyPromises);
    const allDependentIds = new Set(dependencyArrays.flat().map(dep => dep.id));
    
    const novaSessao = new SessaoIA();
    novaSessao.nome = nome;
    novaSessao.characterId = character.id;
    novaSessao.userId = userId;
    novaSessao.apiKey = '';
    novaSessao.homebrewContentIds = Array.from(allDependentIds); // Salva a "fotografia" das dependências

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
    const result = await sessaoRepository.softDelete({ id: sessionId, userId });

    if (result.affected === 0) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão para deletá-la.');
    }
};
