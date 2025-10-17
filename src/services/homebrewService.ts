// src/services/homebrewService.ts
import { apiClient } from './apiClient';

// Tipos baseados em backend/src/entities/HomebrewContent.ts
export type HomebrewContentType = 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat';

export interface HomebrewContent {
    id: string;
    authorId: number;
    type: HomebrewContentType;
    name: string;
    content: any; // O objeto JSON completo
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: 'user' | 'ai';
    dependencies?: string[];
    bundleId?: string | null;
}

export interface HomebrewBundle {
    id: string;
    authorId: number;
    name: string;
    description: string;
    isPublic: boolean;
    contents: HomebrewContent[];
    createdAt: string;
}

export interface CreateHomebrewData {
    type: HomebrewContentType;
    name: string;
    content: any;
    isPublic?: boolean;
    createdBy?: 'user' | 'ai';
    dependencies?: string[];
}

export interface BundleData {
    name: string;
    description: string;
    contentIds: string[];
    isPublic?: boolean;
}

/**
 * Busca conteúdo homebrew.
 * @param scope 'public', 'mine', ou 'ai' para filtrar o conteúdo.
 * @param type Opcional. Filtra por tipo de conteúdo.
 * @param page A página a ser buscada.
 * @param limit O número de itens por página.
 */
export const listHomebrewContent = async (scope: 'public' | 'mine' | 'ai', type?: HomebrewContentType, page: number = 1, limit: number = 100): Promise<HomebrewContent[]> => {
    const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
    if (type) {
        params.append('type', type);
    }
    // O escopo 'ai' é tratado pelo backend agora.
    if (scope === 'ai') {
        params.append('createdBy', 'ai');
    }

    const endpoint = `/homebrew?${params.toString()}`;
    return apiClient<HomebrewContent[]>(endpoint, { method: 'GET' });
};


/**
 * Cria um novo conteúdo homebrew.
 * @param data Os dados para o novo conteúdo.
 */
export const createHomebrewContent = async (data: CreateHomebrewData): Promise<HomebrewContent> => {
    const response = await apiClient<{ content: HomebrewContent }>('/homebrew', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.content;
};

/**
 * Atualiza um conteúdo homebrew existente.
 * @param id O ID do conteúdo a ser atualizado.
 * @param data Os novos dados para o conteúdo.
 */
export const updateHomebrewContent = async (id: string, data: Partial<CreateHomebrewData>): Promise<HomebrewContent> => {
     const response = await apiClient<{ content: HomebrewContent }>(`/homebrew/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return response.content;
}

/**
 * Busca as dependências de um item homebrew.
 * @param id O ID do conteúdo homebrew.
 */
export const getHomebrewDependencies = async (id: string): Promise<HomebrewContent[]> => {
    return apiClient<HomebrewContent[]>(`/homebrew/${id}/dependencies`);
};

/**
 * Lista os pacotes (bundles) disponíveis.
 * @param scope 'public' para pacotes da comunidade, 'mine' para os pacotes do usuário.
 * @param page A página a ser buscada.
 * @param limit O número de itens por página.
 */
export const listHomebrewBundles = async (scope?: 'public' | 'mine', page: number = 1, limit: number = 100): Promise<HomebrewBundle[]> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (scope) {
        params.append('scope', scope);
    }
    return apiClient<HomebrewBundle[]>(`/homebrew/bundles?${params.toString()}`);
};

/**
 * Cria um novo pacote de conteúdo.
 * @param data Os dados do novo pacote.
 */
export const createHomebrewBundle = async (data: BundleData): Promise<HomebrewBundle> => {
    const response = await apiClient<{ bundle: HomebrewBundle }>('/homebrew/bundles', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.bundle;
};

/**
 * Atualiza um pacote existente.
 * @param id O ID do pacote a ser atualizado.
 * @param data Os novos dados para o pacote.
 */
export const updateHomebrewBundle = async (id: string, data: Partial<BundleData>): Promise<HomebrewBundle> => {
    const response = await apiClient<{ bundle: HomebrewBundle }>(`/homebrew/bundles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return response.bundle;
};

/**
 * Deleta um pacote.
 * @param id O ID do pacote a ser excluído.
 */
export const deleteHomebrewBundle = async (id: string): Promise<void> => {
    await apiClient<void>(`/homebrew/bundles/${id}`, { method: 'DELETE' });
};


/**
 * Obtém o conteúdo de um pacote (bundle) específico.
 * @param id O ID do pacote.
 */
export const getBundleContents = async (id: string): Promise<HomebrewContent[]> => {
    return apiClient<HomebrewContent[]>(`/homebrew/bundles/${id}/contents`);
};

/**
 * Verifica se um nome já existe para evitar duplicatas.
 * @param name O nome a ser verificado.
 * @param type O tipo de conteúdo.
 */
export const checkNameExists = async (name: string, type: HomebrewContentType): Promise<{ exists: boolean }> => {
    return apiClient<{ exists: boolean }>('/homebrew/check-name', {
        method: 'POST',
        body: JSON.stringify({ name, type }),
    });
};
