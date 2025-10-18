// backend/src/services/translationService.ts
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';

export const getTranslations = async (): Promise<Record<string, Record<string, string>>> => {
    const translationRepo = AppDataSource.getRepository(HomebrewContent);
    const translationEntries = await translationRepo.find({
        where: { type: 'translation', authorId: 1 } // Somente do admin
    });

    const translations: Record<string, Record<string, string>> = {};

    translationEntries.forEach(entry => {
        const category = entry.name; // O 'name' do conteúdo de tradução é a categoria.
        if (entry.content && typeof entry.content === 'object') {
            if (!translations[category]) {
                translations[category] = {};
            }
            // O `content` é um objeto do tipo { "original_key": "translated_value", ... }
            Object.assign(translations[category], entry.content);
        }
    });

    return translations;
};
