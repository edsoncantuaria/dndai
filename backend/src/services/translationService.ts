// backend/src/services/translationService.ts
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { TRANSLATIONS_EQUIPMENT } from '../../data/TranslatorEquipments.js';

export const getTranslations = async (): Promise<Record<string, Record<string, any>>> => {
    const translationRepo = AppDataSource.getRepository(HomebrewContent);
    const translationEntries = await translationRepo.find({
        where: { type: 'translation', authorId: 1 } // Somente do admin
    });

    const translations: Record<string, Record<string, any>> = {
        'Equipment': TRANSLATIONS_EQUIPMENT, // Adiciona diretamente as traduções de equipamento
    };

    translationEntries.forEach(entry => {
        const category = entry.name;
        if (entry.content && typeof entry.content === 'object') {
            if (!translations[category]) {
                translations[category] = {};
            }
            Object.assign(translations[category], entry.content);
        }
    });
    
    return translations;
};
