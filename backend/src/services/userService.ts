// backend/src/services/userService.ts
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import createError from 'http-errors';
import type { SettingsSchema } from '../schemas/validationSchemas.js';
import type { z } from 'zod';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import { In } from 'typeorm';
import { invalidateUserCache as invalidateUnifiedDataCache } from './unifiedDataService.js';

export const getUserProfile = async (userId: number) => {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ 
        where: { id: userId },
        relations: ["licenseKey"] 
    });

    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userData } = user;
    return userData;
};

export const updateUserSettings = async (userId: number, newSettings: z.infer<typeof SettingsSchema>) => {
    const userRepository = AppDataSource.getRepository(User);
    // A chave de API agora é gerenciada pelo frontend, então vamos garantir que ela não seja salva aqui.
    const { apiKey, ...settingsToSave } = newSettings;
    const result = await userRepository.update(userId, { settings: settingsToSave });

    if(result.affected === 0) {
        throw createError(404, 'Usuário não encontrado para atualizar as configurações.');
    }
};

export const setHomebrewDisclaimerAsAcknowledged = async (userId: number) => {
    const userRepository = AppDataSource.getRepository(User);
    const result = await userRepository.update(userId, { acknowledgedHomebrewDisclaimer: true });
    if (result.affected === 0) {
        throw createError(404, 'Usuário não encontrado para atualizar a confirmação.');
    }
};

export const updateUserHomebrewInstallation = async (userId: number, itemId: string, action: 'install' | 'uninstall') => {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });

    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }
    
    // Verifica se o ID pertence a um conteúdo ou a um pacote
    const contentRepo = AppDataSource.getRepository(HomebrewContent);
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    
    const content = await contentRepo.findOneBy({ id: itemId });
    const bundle = await bundleRepo.findOne({ where: { id: itemId }, relations: ['contents'] });


    if (!content && !bundle) {
        throw createError(404, 'Conteúdo ou Pacote Homebrew não encontrado.');
    }
    
    if (content && !content.isPublic && content.authorId !== userId) {
        throw createError(403, 'Você não tem permissão para instalar este conteúdo privado.');
    }
    if (bundle && !bundle.isPublic && bundle.authorId !== userId) {
         throw createError(403, 'Você não tem permissão para instalar este pacote privado.');
    }

    let currentIds = new Set(user.installedHomebrewIds || []);

    if (action === 'install') {
        currentIds.add(itemId);
    } else { // uninstall
        currentIds.delete(itemId);
        // Se for um pacote, remove também todos os conteúdos associados a ele.
        if (bundle && bundle.contents) {
            const contentIdsToRemove = bundle.contents.map(c => c.id);
            contentIdsToRemove.forEach(id => currentIds.delete(id));
        }
    }
    
    user.installedHomebrewIds = Array.from(currentIds);
    await invalidateUserCache(userId);

    const savedUser = await userRepo.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResponse } = savedUser;
    return userResponse;
};


export const invalidateUserCache = async (userId: number) => {
    await invalidateUnifiedDataCache(userId);
    // Adicionar lógica para invalidar outros caches relacionados ao usuário, se houver
    console.log(`[Cache] Cache invalidado para o usuário ${userId}.`);
};
