import type { DataSource } from 'typeorm';

/** Remove linhas com sessionId inexistente (dev com sync sem game_sessions). */
const SESSION_CHILD_TABLES = [
    'session_region_state',
    'session_region_economy',
    'session_faction_influence',
    'session_faction_state',
    'session_faction_discovery',
    'session_entity_reputation',
    'session_entity_state',
    'session_knowledge',
    'session_quests',
    'session_snapshots',
    'session_memories',
    'session_combat_encounters',
    'session_combatants',
    'session_installed_modules',
    'hero_inventory_items',
    'narration_completions',
    'narrative_summaries',
    'timeline_entries',
    'world_events',
    'rumors',
] as const;

export async function purgeOrphanPenaiSessionRows(ds: DataSource): Promise<number> {
    let total = 0;
    for (const table of SESSION_CHILD_TABLES) {
        try {
            const rows = await ds.query(
                `
                DELETE FROM ${table} child
                WHERE NOT EXISTS (
                    SELECT 1 FROM game_sessions parent WHERE parent.id = child."sessionId"
                )
                RETURNING child."sessionId"
                `,
            );
            const n = Array.isArray(rows) ? rows.length : 0;
            if (n > 0) {
                console.log(`[penai-db] Órfãos removidos de ${table}: ${n}`);
            }
            total += n;
        } catch {
            // tabela pode não existir ainda
        }
    }
    return total;
}
