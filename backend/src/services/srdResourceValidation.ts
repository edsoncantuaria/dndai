// backend/src/services/srdResourceValidation.ts
const norm = (value?: string) => (value ?? '').toLowerCase().trim();

/** GET /classes/:index — ficha da classe, não progressão de níveis. */
export function isClassDetailRequest(resource: string, index: string): boolean {
    const r = norm(resource);
    const i = norm(index);
    return r === 'classes' && i !== 'levels' && i !== 'spells' && i !== 'features' && !resource.includes('/');
}

export function isValidResourceDetail(resource: string, index: string, data: unknown): boolean {
    if (data == null) return false;

    if (isClassDetailRequest(resource, index)) {
        if (typeof data !== 'object' || Array.isArray(data)) return false;
        const row = data as Record<string, unknown>;
        return typeof row.hit_die === 'number' && typeof row.index === 'string';
    }

    return true;
}
