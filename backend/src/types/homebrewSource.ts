import type { HomebrewContentType } from '../entities/HomebrewContent.js';

/** Como o homebrew se relaciona com o SRD oficial (5e-srd-api). */
export type HomebrewSourceKind = 'original' | 'translation' | 'fork';

/** Metadados persistidos no registro de homebrew. */
export interface HomebrewSourceMeta {
    sourceKind: HomebrewSourceKind;
    /** Recurso SRD (ex: spells, races, equipment). */
    sourceResource?: string | null;
    /** Índice oficial SRD (ex: fireball, elf). */
    sourceIndex?: string | null;
    locale?: string;
}

/** Mapeia tipo de homebrew → coleção na 5e-srd-api (/api/2014/...). */
export const HOMEBREW_TYPE_TO_SRD_RESOURCE: Partial<Record<HomebrewContentType, string>> = {
    race: 'races',
    subrace: 'subraces',
    class: 'classes',
    subclass: 'subclasses',
    spell: 'spells',
    item: 'equipment',
    monster: 'monsters',
    background: 'backgrounds',
    feat: 'feats',
    skill: 'skills',
    feature: 'features',
};

/** Campos que podem ser sobrescritos em traduções (resto vem do SRD). */
export const SRD_TRANSLATABLE_FIELDS: Record<string, string[]> = {
    spells: ['name', 'desc', 'material', 'higher_level', 'casting_time', 'range', 'duration'],
    races: ['name', 'desc', 'age', 'alignment', 'language_desc', 'size_description'],
    subraces: ['name', 'desc'],
    classes: ['name', 'desc'],
    subclasses: ['name', 'desc'],
    backgrounds: ['name', 'desc'],
    equipment: ['name', 'desc', 'special', 'contents'],
    monsters: ['name', 'desc', 'actions', 'legendary_actions', 'special_abilities'],
    feats: ['name', 'desc'],
    skills: ['name', 'desc'],
    traits: ['name', 'desc'],
    features: ['name', 'desc'],
};

/** Campos mínimos esperados em conteúdo original (compatível com SRD). */
export const SRD_REQUIRED_INDEX_FIELDS: Record<string, string[]> = {
    spells: ['index', 'name', 'level', 'school', 'casting_time', 'range', 'duration', 'components'],
    races: ['index', 'name', 'speed'],
    classes: ['index', 'name', 'hit_die'],
    equipment: ['index', 'name'],
    monsters: ['index', 'name', 'size', 'type', 'armor_class', 'hit_points'],
    backgrounds: ['index', 'name'],
    feats: ['index', 'name'],
};
