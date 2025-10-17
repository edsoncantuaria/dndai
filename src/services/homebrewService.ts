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
    bundle?: { name: string, id: string };
}

export interface HomebrewBundle {
    id: string;
    authorId: number;
    name: string;
    description: string;
    isPublic: boolean;
    contents: HomebrewContent[];
    createdAt: string;
    contentCount: number;
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

export const listHomebrewContent = async (scope: 'public' | 'mine', type?: HomebrewContentType, page: number = 1, limit: number = 100): Promise<HomebrewContent[]> => {
    const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
    if (type) {
        params.append('type', type);
    }
    
    // Simplificado: 'ai' é apenas um filtro no backend, o frontend pode tratar como 'public'.
    const endpoint = `/homebrew?${params.toString()}`;
    return apiClient<HomebrewContent[]>(endpoint, { method: 'GET' });
};

export const createHomebrewContent = async (data: CreateHomebrewData): Promise<HomebrewContent> => {
    const response = await apiClient<{ content: HomebrewContent }>('/homebrew', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.content;
};

export const updateHomebrewContent = async (id: string, data: Partial<CreateHomebrewData>): Promise<HomebrewContent> => {
     const response = await apiClient<{ content: HomebrewContent }>(`/homebrew/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return response.content;
}

export const getHomebrewDependencies = async (id: string): Promise<HomebrewContent[]> => {
    return apiClient<HomebrewContent[]>(`/homebrew/${id}/dependencies`);
};

export const listHomebrewBundles = async (scope?: 'public' | 'mine', page: number = 1, limit: number = 100): Promise<HomebrewBundle[]> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (scope) {
        params.append('scope', scope);
    }
    return apiClient<HomebrewBundle[]>(`/homebrew/bundles?${params.toString()}`);
};

export const createHomebrewBundle = async (data: BundleData): Promise<HomebrewBundle> => {
    const response = await apiClient<{ bundle: HomebrewBundle }>('/homebrew/bundles', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.bundle;
};

export const updateHomebrewBundle = async (id: string, data: Partial<BundleData>): Promise<HomebrewBundle> => {
    const response = await apiClient<{ bundle: HomebrewBundle }>(`/homebrew/bundles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return response.bundle;
};

export const deleteHomebrewBundle = async (id: string): Promise<void> => {
    await apiClient<void>(`/homebrew/bundles/${id}`, { method: 'DELETE' });
};

export const getBundleContents = async (id: string): Promise<HomebrewContent[]> => {
    return apiClient<HomebrewContent[]>(`/homebrew/bundles/${id}/contents`);
};

export const checkNameExists = async (name: string, type: HomebrewContentType): Promise<{ exists: boolean }> => {
    return apiClient<{ exists: boolean }>('/homebrew/check-name', {
        method: 'POST',
        body: JSON.stringify({ name, type }),
    });
};
