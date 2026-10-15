/**
 * Converte eventos técnicos do log em fatos legíveis para o jogador (PT-BR).
 */

import { getFactionCatalogEntry } from '../world/factionCatalog.js';

export type HumanizeContext = {
    regionNames?: Record<string, string>;
};

export type HumanizedWorldEvent = {
    id: string;
    type: string;
    category: string;
    subject?: string;
    summary: string;
    at: string;
    importance: number;
};

type RawEvent = {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    createdAt: Date;
};

function regionLabel(slug: unknown, ctx?: HumanizeContext): string {
    if (typeof slug !== 'string' || !slug.trim()) return 'região desconhecida';
    return ctx?.regionNames?.[slug] ?? slug.replace(/-/g, ' ');
}

function clip(text: string, max: number): string {
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

function str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

/** Eventos puramente técnicos — não aparecem em “Fatos registrados”. */
const HIDDEN_TYPES = new Set([
    'TURN_NARRATED',
    'COMBAT_NARRATION_DEFERRED',
    'NARRATION_COMPLETED',
    'COMBAT_ACTION_REQUESTED',
    'FACTION_TICK',
    'WITNESSED',
    'KNOWLEDGE_SPREAD',
    'ENTITY_ARCHIVED',
]);

export function humanizeWorldEvent(
    ev: RawEvent,
    ctx?: HumanizeContext,
): HumanizedWorldEvent | null {
    if (HIDDEN_TYPES.has(ev.type)) return null;

    const p = ev.payload ?? {};
    const at = ev.createdAt?.toISOString?.() ?? new Date().toISOString();
    const base = { id: ev.id, type: ev.type, at };

    switch (ev.type) {
        case 'SESSION_CREATED': {
            const nome = str(p.nome) || 'Nova campanha';
            const reg = str(p.spawnRegionName) || regionLabel(p.spawnRegionSlug, ctx);
            return {
                ...base,
                category: 'Início',
                subject: nome,
                summary: `Campanha iniciada em ${reg}.`,
                importance: 90,
            };
        }
        case 'HERO_CREATED': {
            const name = str(p.displayName) || 'Herói';
            return {
                ...base,
                category: 'Herói',
                subject: name,
                summary: `${name} entrou na história com equipamento inicial.`,
                importance: 85,
            };
        }
        case 'HERO_EQUIPPED': {
            const items = Array.isArray(p.items) ? p.items.map(String).join(', ') : 'equipamento';
            return {
                ...base,
                category: 'Herói',
                summary: `Equipamento inicial: ${clip(items, 80)}.`,
                importance: 40,
            };
        }
        case 'PLAYER_ACTION_SUBMITTED': {
            const action = str(p.playerAction);
            if (!action) return null;
            const seq = p.actionSequence != null ? ` · turno ${p.actionSequence}` : '';
            return {
                ...base,
                category: 'Ação',
                subject: `Você${seq}`,
                summary: clip(action, 200),
                importance: 55,
            };
        }
        case 'TRAVEL_STARTED': {
            const to = regionLabel(p.toRegionSlug ?? p.regionSlug, ctx);
            const mode = str(p.travelMode) || 'viagem';
            return {
                ...base,
                category: 'Viagem',
                summary: `Partida em direção a ${to} (${mode}).`,
                importance: 75,
            };
        }
        case 'TRAVEL_COMPLETED': {
            const to = regionLabel(p.regionSlug ?? p.targetPoiSlug, ctx);
            const km = p.distanceKm != null ? ` — ${p.distanceKm} km` : '';
            return {
                ...base,
                category: 'Viagem',
                summary: `Chegada em ${to}${km}.`,
                importance: 80,
            };
        }
        case 'REST_COMPLETED': {
            const rest = str(p.restType) || 'descanso';
            return {
                ...base,
                category: 'Descanso',
                summary: `Descanso concluído (${rest}).`,
                importance: 70,
            };
        }
        case 'COMBAT_STARTED':
            return {
                ...base,
                category: 'Combate',
                summary: str(p.reason) || 'Um combate começou.',
                importance: 85,
            };
        case 'ROLL_RESOLVED': {
            const total = p.rollTotal != null ? String(p.rollTotal) : '';
            const ok = p.rollSuccess === true ? 'sucesso' : p.rollSuccess === false ? 'falha' : '';
            const parts = [str(p.reason), total && `total ${total}`, ok].filter(Boolean);
            return {
                ...base,
                category: 'Rolagem',
                summary: parts.length ? clip(parts.join(' — '), 160) : 'Rolagem resolvida.',
                importance: 72,
            };
        }
        case 'NPC_ROUTINE': {
            const name = str(p.displayName) || 'NPC';
            const desc = str(p.description);
            const status = str(p.status);
            const verb = status === 'active' ? 'está' : 'acabou de';
            return {
                ...base,
                category: 'NPC',
                subject: name,
                summary: desc
                    ? `${name} ${verb} ${desc.toLowerCase()}.`
                    : `${name} agiu nos bastidores.`,
                importance: 65,
            };
        }
        case 'NPC_GOAL_SELECTED':
        case 'NPC_ACTION_EXECUTED': {
            const name = str(p.displayName) || 'NPC';
            const goal = str(p.goalDescription) || str(p.action);
            return {
                ...base,
                category: 'NPC',
                subject: name,
                summary: goal ? `${name}: ${clip(goal, 120)}` : `${name} tomou uma iniciativa.`,
                importance: 62,
            };
        }
        case 'NPC_TURN_READY':
            return {
                ...base,
                category: 'Combate',
                subject: str(p.displayName) || 'Inimigo',
                summary: 'Aguardando ação de um combatente.',
                importance: 35,
            };
        case 'RUMOR_SPREAD': {
            const title = str(p.title);
            const body = str(p.body);
            return {
                ...base,
                category: 'Rumor',
                subject: title || undefined,
                summary: clip(body || title || 'Um rumor circula na região.', 160),
                importance: 68,
            };
        }
        case 'QUEST_STARTED': {
            const title = str(p.title) || str(p.questSlug) || 'missão';
            return {
                ...base,
                category: 'Missão',
                subject: title,
                summary: `Nova missão: ${title}.`,
                importance: 78,
            };
        }
        case 'QUEST_STAGE_ADVANCED': {
            const title = str(p.title) || str(p.questSlug) || 'missão';
            const stage = p.stage != null ? ` (estágio ${p.stage})` : '';
            return {
                ...base,
                category: 'Missão',
                subject: title,
                summary: `Progresso em «${title}»${stage}.`,
                importance: 76,
            };
        }
        case 'LOOT_CLAIMED':
            return {
                ...base,
                category: 'Loot',
                summary: str(p.summary) || 'Itens ou ouro adicionados ao inventário.',
                importance: 74,
            };
        case 'ITEM_EQUIPPED':
            return {
                ...base,
                category: 'Equipamento',
                summary: str(p.itemName)
                    ? `Equipou ${p.itemName}.`
                    : 'Item equipado.',
                importance: 60,
            };
        case 'HERO_XP_GAIN': {
            const xp = p.xp != null ? `+${p.xp} XP` : 'XP ganho';
            const lvl = p.newLevel != null ? ` — nível ${p.newLevel}` : '';
            return {
                ...base,
                category: 'Progresso',
                summary: `${xp}${lvl}.`,
                importance: 77,
            };
        }
        case 'CREATURE_SLAIN': {
            const name = str(p.creatureName) || str(p.targetSlug) || 'criatura';
            return {
                ...base,
                category: 'Combate',
                subject: name,
                summary: `${name} foi derrotado.`,
                importance: 73,
            };
        }
        case 'REGION_MOOD_CHANGED': {
            const reg = regionLabel(p.regionSlug, ctx);
            return {
                ...base,
                category: 'Região',
                subject: reg,
                summary: `O clima em ${reg} mudou (medo ${p.fear ?? '?'}, prosperidade ${p.prosperity ?? '?'}).`,
                importance: 50,
            };
        }
        case 'PRICE_CHANGED':
        case 'SUPPLY_SHORTAGE': {
            const item = str(p.itemSlug) || 'mercadorias';
            const reg = regionLabel(p.regionSlug, ctx);
            return {
                ...base,
                category: 'Economia',
                subject: reg,
                summary:
                    ev.type === 'SUPPLY_SHORTAGE'
                        ? `Escassez de ${item} em ${reg}.`
                        : `Preços de ${item} oscilaram em ${reg}.`,
                importance: 45,
            };
        }
        case 'JOURNAL_ENTRY':
            return {
                ...base,
                category: 'Diário',
                summary: clip(str(p.text) || str(p.title) || 'Entrada no diário.', 160),
                importance: 58,
            };
        case 'CANON_PROPOSED':
            return {
                ...base,
                category: 'Canon',
                summary: `Proposta canônica: ${clip(str(p.displayName) || str(p.kind) || 'descoberta', 80)}.`,
                importance: 42,
            };
        case 'CANON_APPROVED':
            return {
                ...base,
                category: 'Canon',
                summary: 'Uma descoberta foi aceita no cânone da campanha.',
                importance: 55,
            };
        case 'ENTITY_SPAWNED':
        case 'ENTITY_REUSED': {
            const name = str(p.displayName) || 'personagem';
            return {
                ...base,
                category: 'Personagem',
                subject: name,
                summary:
                    ev.type === 'ENTITY_REUSED'
                        ? `${name} reapareceu na cena.`
                        : `${name} surgiu na cena.`,
                importance: 52,
            };
        }
        case 'ENTITY_PROMOTED':
            return {
                ...base,
                category: 'Personagem',
                subject: str(p.displayName) || undefined,
                summary: 'Um NPC passou a ter mais relevância na campanha.',
                importance: 48,
            };
        case 'ENTITY_RETIRED':
            return {
                ...base,
                category: 'Personagem',
                summary: 'Um personagem saiu de cena.',
                importance: 44,
            };
        case 'FACTION_REPUTATION': {
            const factionSlug = str(p.factionSlug) || '';
            const label =
                getFactionCatalogEntry(factionSlug)?.displayName ??
                (factionSlug ? factionSlug.replace(/-/g, ' ') : 'facção');
            const delta = p.delta != null ? Number(p.delta) : 0;
            const dir = delta >= 0 ? 'melhorou' : 'piorou';
            return {
                ...base,
                category: 'Reputação',
                subject: label,
                summary: `Reputação com ${label} ${dir}.`,
                importance: 56,
            };
        }
        default: {
            const payloadSummary = str(p.summary) || str(p.description) || str(p.message);
            if (payloadSummary) {
                return {
                    ...base,
                    category: 'Campanha',
                    summary: clip(payloadSummary, 160),
                    importance: 30,
                };
            }
            return null;
        }
    }
}

export function humanizeWorldEvents(
    events: RawEvent[],
    ctx?: HumanizeContext,
): HumanizedWorldEvent[] {
    const out: HumanizedWorldEvent[] = [];
    let lastSummary = '';

    for (const ev of events) {
        const h = humanizeWorldEvent(ev, ctx);
        if (!h) continue;
        if (h.type === 'PLAYER_ACTION_SUBMITTED' && h.summary === lastSummary) continue;
        lastSummary = h.summary;
        out.push(h);
    }

    return out
        .sort((a, b) => b.importance - a.importance || b.at.localeCompare(a.at))
        .slice(0, 20);
}
