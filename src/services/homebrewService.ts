// src/services/homebrewService.ts
import { apiClient } from './apiClient';

export type HomebrewSourceKind = 'original' | 'translation' | 'fork';

// Tipos baseados em backend/src/entities/HomebrewContent.ts
export type HomebrewContentType = 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat' | 'skill' | 'translation';

export interface HomebrewContent {
    id: string;
    authorId: number;
    author?: { id: number, username: string };
    type: HomebrewContentType;
    name: string;
    content: any;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: 'user' | 'ai';
    dependencies?: string[];
    bundleId?: string | null;
    bundle?: { name: string, id: string };
    sourceKind?: HomebrewSourceKind;
    sourceResource?: string | null;
    sourceIndex?: string | null;
    locale?: string;
}

export interface SrdListResponse {
    count: number;
    results: { index: string; name: string; url?: string }[];
}

export interface SrdTypeMapResponse {
    map: Record<string, string>;
    apiVersion: string;
}

export interface HomebrewBundle {
    id: string;
    authorId: number;
    author?: { id: number, username: string };
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
    sourceKind?: HomebrewSourceKind;
    sourceResource?: string | null;
    sourceIndex?: string | null;
    locale?: string;
}

export interface CreateFromSrdData {
    type: Exclude<HomebrewContentType, 'translation'>;
    name: string;
    sourceKind: 'translation' | 'fork';
    sourceResource: string;
    sourceIndex: string;
    overrides?: Record<string, unknown>;
    isPublic?: boolean;
    locale?: string;
    dependencies?: string[];
}

export interface BundleExportManifest {
    formatVersion: 1;
    exportedAt: string;
    bundle: {
        name: string;
        description: string;
        isPublic?: boolean;
    };
    contents: {
        exportKey: string;
        type: HomebrewContentType;
        name: string;
        content: Record<string, unknown>;
        sourceKind?: HomebrewSourceKind;
        sourceResource?: string | null;
        sourceIndex?: string | null;
        locale?: string;
        dependencyKeys?: string[];
    }[];
}

export interface BundleData {
    name: string;
    description: string;
    contentIds: string[];
    isPublic?: boolean;
}

export const listHomebrewContent = async (scope: 'public' | 'mine', createdBy?: 'user' | 'ai', type?: HomebrewContentType, page: number = 1, limit: number = 100): Promise<HomebrewContent[]> => {
    const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
    if (type) {
        params.append('type', type);
    }
    if (createdBy) {
        params.append('createdBy', createdBy);
    }
    
    const endpoint = `/v2/homebrew?${params.toString()}`;
    const response = await apiClient<{ content: HomebrewContent[] }>(endpoint, { method: 'GET' });
    return response.content ?? [];
};

export const createHomebrewContent = async (data: CreateHomebrewData): Promise<HomebrewContent> => {
    const response = await apiClient<{ content: HomebrewContent }>('/v2/homebrew', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.content;
};

export const updateHomebrewContent = async (id: string, data: Partial<CreateHomebrewData>): Promise<HomebrewContent> => {
     const response = await apiClient<{ content: HomebrewContent }>(`/v2/homebrew/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return response.content;
}

export const getHomebrewDetails = async (id: string): Promise<HomebrewContent | null> => {
    try {
        const response = await apiClient<{ content: HomebrewContent }>(`/v2/homebrew/${id}`, { method: 'GET' });
        return response.content;
    } catch {
        return null;
    }
};

export const getHomebrewDependencies = async (id: string): Promise<HomebrewContent[]> => {
    const response = await apiClient<{ dependencies: HomebrewContent[] }>(`/v2/homebrew/${id}/dependencies`);
    return response.dependencies ?? [];
};

export const listBundles = async (scope?: 'public' | 'mine', page: number = 1, limit: number = 100): Promise<HomebrewBundle[]> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (scope) {
        params.append('scope', scope);
    }
    const response = await apiClient<{ bundles: HomebrewBundle[] }>(`/v2/homebrew/bundles?${params.toString()}`);
    return response.bundles ?? [];
};

export const createBundle = async (data: BundleData): Promise<HomebrewBundle> => {
    const response = await apiClient<{ bundle: HomebrewBundle }>('/v2/homebrew/bundles', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.bundle;
};

export const updateBundle = async (id: string, data: Partial<BundleData>): Promise<HomebrewBundle> => {
    const response = await apiClient<{ bundle: HomebrewBundle }>(`/v2/homebrew/bundles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return response.bundle;
};

export const deleteBundle = async (id: string): Promise<void> => {
    await apiClient<void>(`/v2/homebrew/bundles/${id}`, { method: 'DELETE' });
};

export const getBundleContents = async (id: string): Promise<HomebrewContent[]> => {
    const response = await apiClient<{ contents: HomebrewContent[] }>(`/v2/homebrew/bundles/${id}/contents`);
    return response.contents ?? [];
};

export const checkNameExists = async (name: string, type: HomebrewContentType): Promise<{ exists: boolean }> => {
    return apiClient<{ exists: boolean }>('/v2/homebrew/check-name', {
        method: 'POST',
        body: JSON.stringify({ name, type }),
    });
};

export const updateUserHomebrew = async (homebrewId: string, action: 'install' | 'uninstall') => {
    return apiClient<{ user: any, message: string }>(`/v2/users/me/homebrew`, {
        method: 'PATCH',
        body: JSON.stringify({ homebrewId, action }),
    });
};

export const getSrdTypeMap = async (): Promise<SrdTypeMapResponse> => {
    return apiClient<SrdTypeMapResponse>('/v2/homebrew/srd/types', { method: 'GET' });
};

export const listSrdResource = async (resource: string): Promise<SrdListResponse> => {
    return apiClient<SrdListResponse>(`/v2/homebrew/srd/${encodeURIComponent(resource)}`, { method: 'GET' });
};

export const getSrdResourceDetail = async (resource: string, index: string): Promise<Record<string, unknown>> => {
    return apiClient<Record<string, unknown>>(
        `/v2/homebrew/srd/${encodeURIComponent(resource)}/${encodeURIComponent(index)}`,
        { method: 'GET' },
    );
};

export const createHomebrewFromSrd = async (data: CreateFromSrdData): Promise<HomebrewContent> => {
    const response = await apiClient<{ content: HomebrewContent }>('/v2/homebrew/from-srd', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return response.content;
};

export interface ImportBundlePayload {
    manifest: BundleExportManifest;
    makePublic?: boolean;
}

export const exportBundle = async (bundleId: string): Promise<BundleExportManifest> => {
    return apiClient<BundleExportManifest>(`/v2/homebrew/bundles/${encodeURIComponent(bundleId)}/export`, {
        method: 'GET',
    });
};

export const importBundle = async (payload: ImportBundlePayload): Promise<HomebrewBundle> => {
    const response = await apiClient<{ bundle: HomebrewBundle; contentCount: number }>('/v2/homebrew/bundles/import', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return response.bundle;
};

/** @deprecated use createBundle */
export const createHomebrewBundle = createBundle;
/** @deprecated use updateBundle */
export const updateHomebrewBundle = updateBundle;
