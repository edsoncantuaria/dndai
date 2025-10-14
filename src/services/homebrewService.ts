// src/services/homebrewService.ts
import { apiClient } from './apiClient';

// Tipos baseados em backend/src/entities/HomebrewContent.ts
export type HomebrewContentType = 'race' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat';

export interface HomebrewContent {
    id: string;
    authorId: number;
    type: HomebrewContentType;
    name: string;
    content: any; // O objeto JSON completo
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateHomebrewData {
    type: HomebrewContentType;
    name: string;
    content: any;
    isPublic?: boolean;
}

/**
 * Busca conteúdo homebrew.
 * @param scope 'public' para conteúdo da comunidade, 'mine' para conteúdo do usuário logado.
 * @param type Opcional. Filtra por tipo de conteúdo.
 */
export const listHomebrewContent = async (
    scope: 'public' | 'mine',
    type?: HomebrewContentType
): Promise<HomebrewContent[]> => {
    let endpoint = `/homebrew?scope=${scope}`;
    if (type) {
        endpoint += `&type=${type}`;
    }
    return apiClient<HomebrewContent[]>(endpoint, { method: 'GET' });
};

/**
 * Cria um novo conteúdo homebrew.
 * @param data Os dados para o novo conteúdo.
 */
export const createHomebrewContent = async (data: CreateHomebrewData): Promise<{ content: HomebrewContent }> => {
    return apiClient<{ content: HomebrewContent }>('/homebrew', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};
