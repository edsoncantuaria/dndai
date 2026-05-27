import type { OssNarrationResponse } from '../schemas/narration.schema.js';

export type ActionDomain = 'combat' | 'exploration' | 'social' | 'any';

export type RegisteredAction = {
    id: string;
    text: string;
    action: string;
    domain: ActionDomain;
    skill?: string;
};

const COMBAT_ACTIONS: RegisteredAction[] = [
    { id: 'attack_melee', text: 'Atacar corpo a corpo', action: 'attack_melee', domain: 'combat' },
    { id: 'attack_ranged', text: 'Atacar à distância', action: 'attack_ranged', domain: 'combat' },
    { id: 'dodge', text: 'Esquivar (Dodge)', action: 'dodge', domain: 'combat' },
    { id: 'disengage', text: 'Desengajar e recuar', action: 'disengage', domain: 'combat' },
    { id: 'dash', text: 'Correr (Dash)', action: 'dash', domain: 'combat' },
    { id: 'help', text: 'Ajudar aliado', action: 'help', domain: 'combat' },
    { id: 'use_item', text: 'Usar item', action: 'use_item', domain: 'combat' },
    { id: 'cast_spell', text: 'Conjurar magia', action: 'cast_spell', domain: 'combat' },
];

const EXPLORATION_ACTIONS: RegisteredAction[] = [
    { id: 'observe', text: 'Observar o ambiente', action: 'observe', domain: 'exploration' },
    { id: 'investigate', text: 'Investigar algo', action: 'investigate', domain: 'exploration', skill: 'investigation' },
    { id: 'move', text: 'Avançar com cautela', action: 'move', domain: 'exploration' },
    { id: 'listen', text: 'Ouvir e esperar', action: 'listen', domain: 'exploration', skill: 'perception' },
    { id: 'search', text: 'Vasculhar o local', action: 'search', domain: 'exploration' },
];

const SOCIAL_ACTIONS: RegisteredAction[] = [
    { id: 'talk', text: 'Conversar', action: 'talk', domain: 'social', skill: 'persuasion' },
    { id: 'intimidate', text: 'Intimidar', action: 'intimidate', domain: 'social', skill: 'intimidation' },
    { id: 'deceive', text: 'Enganar', action: 'deceive', domain: 'social', skill: 'deception' },
];

const REGISTRY: RegisteredAction[] = [...COMBAT_ACTIONS, ...EXPLORATION_ACTIONS, ...SOCIAL_ACTIONS];

const byId = new Map(REGISTRY.map(a => [a.id, a]));

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 48);
}

function matchRegistered(text: string, domain: ActionDomain): RegisteredAction | null {
    const lower = text.toLowerCase();
    const pool = REGISTRY.filter(a => a.domain === domain || a.domain === 'any');
    for (const entry of pool) {
        if (lower.includes(entry.text.toLowerCase().slice(0, 12))) return entry;
        if (lower.includes(entry.action.replace(/_/g, ' '))) return entry;
    }
    return null;
}

type NormalizedOption = OssNarrationResponse['actionOptions'][number];

/**
 * Normaliza actionOptions para IDs estáveis do registry (motor/UI).
 */
export function normalizeActionOptionsFromRegistry(
    raw: OssNarrationResponse['actionOptions'],
    domain: ActionDomain,
): NormalizedOption[] {
    const defaults =
        domain === 'combat'
            ? COMBAT_ACTIONS.slice(0, 4)
            : domain === 'social'
              ? SOCIAL_ACTIONS.slice(0, 3)
              : EXPLORATION_ACTIONS.slice(0, 4);

    if (!Array.isArray(raw) || raw.length === 0) {
        return defaults.map(d => ({ text: d.text, action: d.id, skill: d.skill }));
    }

    const normalized: NormalizedOption[] = [];
    const seen = new Set<string>();

    for (const item of raw) {
        if (typeof item === 'string') {
            const matched = matchRegistered(item, domain);
            const action = matched?.id ?? slugify(item);
            if (seen.has(action)) continue;
            seen.add(action);
            normalized.push({
                text: item.trim(),
                action,
                skill: matched?.skill,
            });
            continue;
        }
        const text = String(item.text ?? item.action ?? '').trim();
        const actionRaw = String(item.action ?? '').trim();
        const matched = matchRegistered(text || actionRaw, domain);
        const action = matched?.id ?? (byId.has(actionRaw) ? actionRaw : slugify(actionRaw || text));
        const displayText = text.length >= 8 ? text : matched?.text ?? text;
        if (!displayText || seen.has(action)) continue;
        seen.add(action);
        normalized.push({
            text: displayText,
            action,
            skill: item.skill ?? matched?.skill,
        });
    }

    if (normalized.length < 2) {
        for (const d of defaults) {
            if (normalized.length >= 3) break;
            if (seen.has(d.id)) continue;
            normalized.push({ text: d.text, action: d.id, skill: d.skill });
        }
    }

    return normalized.slice(0, 6);
}

export function listRegistryActions(domain?: ActionDomain): RegisteredAction[] {
    if (!domain) return [...REGISTRY];
    return REGISTRY.filter(a => a.domain === domain || a.domain === 'any');
}
