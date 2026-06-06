/** Shape mínimo de entradas SRD normalizadas (equipment, classes, …). */
export type SrdRecord = {
    index?: string;
    name?: string;
    weapon_category?: string;
    equipment_category?: { index?: string; name?: string };
    armor_category?: string;
    str_minimum?: number;
    stealth_disadvantage?: boolean;
    levels?: unknown[];
    [key: string]: unknown;
};

export function asSrdRecord(value: unknown): SrdRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as SrdRecord;
}
