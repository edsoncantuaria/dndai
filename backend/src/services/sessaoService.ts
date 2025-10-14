// backend/src/services/sessaoService.ts
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { IsNull } from 'typeorm';
import createError from 'http-errors';
import { buildFullCharacterObject } from './characterService.js';
import type { z } from 'zod';
import type { CreateSessaoSchema } from '../schemas/validationSchemas.js';

export const getOrCreateSessao = async (data: z.infer<typeof CreateSessaoSchema>, userId: number) => {
    const { nome, characterId, homebrewIds } = data;
    
    const characterRepository = AppDataSource.getRepository(Character);
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const userRepository = AppDataSource.getRepository(User);

    const character = await characterRepository.findOne({ where: { id: characterId, userId } });
    if (!character) {
        throw createError(404, 'Personagem não encontrado ou você não tem permissão para usá-lo.');
    }

    const existingSession = await sessaoRepository.findOne({ where: { characterId, userId, deletedAt: IsNull() } });
    if (existingSession) {
        // Se a sessão já existe, atualizamos os homebrews instalados.
        existingSession.homebrewContentIds = homebrewIds || [];
        const sessaoAtualizada = await sessaoRepository.save(existingSession);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKey, ...sessaoParaRetorno } = sessaoAtualizada;
        return { sessao: sessaoParaRetorno, isNew: false };
    }

    const user = await userRepository.findOneBy({ id: userId });
    const keyToUse = user?.settings?.apiKey;
    if (!keyToUse) {
        throw createError(400, 'Nenhuma chave de API encontrada nas suas configurações. Adicione uma antes de criar a sessão.');
    }

    const novaSessao = new SessaoIA();
    novaSessao.nome = nome;
    novaSessao.characterId = character.id;
    novaSessao.userId = userId;
    novaSessao.apiKey = keyToUse;
    novaSessao.homebrewContentIds = homebrewIds || []; // Salva os IDs de homebrew

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
            homebrewContentIds: true,
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

export const getSessaoDetails = async (sessionId: number, userId: number) => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepository.findOne({
        where: { id: sessionId, userId, deletedAt: IsNull() },
        relations: ['logs', 'character']
    });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão.');
    }

    if (sessao.character) {
        // Rebuild the full character object to match frontend expectations
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


export const updateHomebrewInstallation = async (sessionId: number, userId: number, homebrewId: string, action: 'install' | 'uninstall') => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepository.findOne({ where: { id: sessionId, userId } });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada ou você não tem permissão.');
    }

    let currentHomebrewIds = sessao.homebrewContentIds || [];

    if (action === 'install') {
        if (!currentHomebrewIds.includes(homebrewId)) {
            currentHomebrewIds.push(homebrewId);
        }
    } else if (action === 'uninstall') {
        currentHomebrewIds = currentHomebrewIds.filter(id => id !== homebrewId);
    }
    
    sessao.homebrewContentIds = [...new Set(currentHomebrewIds)]; // Garante unicidade

    const updatedSessao = await sessaoRepository.save(sessao);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey, ...sessaoParaRetorno } = updatedSessao;
    return sessaoParaRetorno;
}
