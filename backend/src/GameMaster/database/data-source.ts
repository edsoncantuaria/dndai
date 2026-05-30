import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { penaiEnv } from '../../config/penaiEnv.js';
import { GameSession } from './entities/GameSession.js';
import { WorldEntity } from './entities/WorldEntity.js';
import { SessionEntityState } from './entities/SessionEntityState.js';
import { WorldEvent } from './entities/WorldEvent.js';
import { WorldMemory } from './entities/WorldMemory.js';
import { SessionMemory } from './entities/SessionMemory.js';
import { CanonicalRegion } from './entities/CanonicalRegion.js';
import { CanonicalPoi } from './entities/CanonicalPoi.js';
import { SessionInstalledModule } from './entities/SessionInstalledModule.js';
import { NarrationCompletion } from './entities/NarrationCompletion.js';
import { PenaiLicenseKey } from './entities/PenaiLicenseKey.js';
import { PenaiUser } from './entities/PenaiUser.js';
import { PenaiHomebrewContent } from './entities/HomebrewContent.js';
import { PenaiHomebrewBundle } from './entities/HomebrewBundle.js';
import { CanonicalRegionLink } from './entities/CanonicalRegionLink.js';
import { TravelModeCatalog } from './entities/TravelModeCatalog.js';
import { NarrativeSummary } from './entities/NarrativeSummary.js';
import { Faction } from './entities/Faction.js';
import { Rumor } from './entities/Rumor.js';
import { WorldEntityRelation } from './entities/WorldEntityRelation.js';
import { CanonProposal } from './entities/CanonProposal.js';
import { HeroInventoryItem } from './entities/HeroInventoryItem.js';
import { SessionCombatEncounter } from './entities/SessionCombatEncounter.js';
import { SessionCombatant } from './entities/SessionCombatant.js';
import { SessionFactionState } from './entities/SessionFactionState.js';
import { SessionRegionState } from './entities/SessionRegionState.js';
import { SessionRegionEconomy } from './entities/SessionRegionEconomy.js';
import { SessionFactionInfluence } from './entities/SessionFactionInfluence.js';
import { SessionEntityReputation } from './entities/SessionEntityReputation.js';
import { SessionFactionDiscovery } from './entities/SessionFactionDiscovery.js';
import { SessionKnowledge } from './entities/SessionKnowledge.js';
import { SessionQuest } from './entities/SessionQuest.js';
import { SessionSnapshot } from './entities/SessionSnapshot.js';
import { PenaiP7Baseline1748500000000 } from './migrations/1748500000000-PenaiP7Baseline.js';
import { SessionStoryMetadata1748600000000 } from './migrations/1748600000000-SessionStoryMetadata.js';
import { LastProjectedEventUuid1748700000000 } from './migrations/1748700000000-LastProjectedEventUuid.js';
import { SessionUiAndWorldBootstrap1748800000000 } from './migrations/1748800000000-SessionUiAndWorldBootstrap.js';
import { PenaiP9SupremeWorld1748900000000 } from './migrations/1748900000000-PenaiP9SupremeWorld.js';
import { WorldShardPolitics1748910000000 } from './migrations/1748910000000-WorldShardPolitics.js';
import { WorldShard } from './entities/WorldShard.js';
import { KgNode } from './entities/KgNode.js';
import { KgEdge } from './entities/KgEdge.js';
import { TimelineEntry } from './entities/TimelineEntry.js';

export const PenaiDataSource = new DataSource({
    type: 'postgres',
    url: penaiEnv.DATABASE_URL,
    synchronize: process.env.PENAI_DB_SYNC === 'true',
    logging: process.env.PENAI_DB_LOGGING === 'true',
    entities: [
        PenaiUser,
        PenaiLicenseKey,
        PenaiHomebrewContent,
        PenaiHomebrewBundle,
        GameSession,
        WorldEntity,
        SessionEntityState,
        WorldEvent,
        WorldMemory,
        SessionMemory,
        CanonicalRegion,
        CanonicalPoi,
        SessionInstalledModule,
        NarrationCompletion,
        CanonicalRegionLink,
        TravelModeCatalog,
        NarrativeSummary,
        Faction,
        Rumor,
        WorldEntityRelation,
        CanonProposal,
        HeroInventoryItem,
        SessionCombatEncounter,
        SessionCombatant,
        SessionFactionState,
        SessionRegionState,
        SessionRegionEconomy,
        SessionFactionInfluence,
        SessionEntityReputation,
        SessionFactionDiscovery,
        SessionKnowledge,
        SessionQuest,
        SessionSnapshot,
        WorldShard,
        KgNode,
        KgEdge,
        TimelineEntry,
    ],
    migrations: [
        PenaiP7Baseline1748500000000,
        SessionStoryMetadata1748600000000,
        LastProjectedEventUuid1748700000000,
        SessionUiAndWorldBootstrap1748800000000,
        PenaiP9SupremeWorld1748900000000,
        WorldShardPolitics1748910000000,
    ],
    migrationsTableName: 'penai_migrations',
});

let initialized = false;

export async function initPenaiDatabase(): Promise<void> {
    if (initialized) return;
    await PenaiDataSource.initialize();
    initialized = true;
    console.log('[PENAI] PostgreSQL conectado.');

    if (process.env.PENAI_RUN_MIGRATIONS_ON_BOOT !== 'false') {
        const applied = await PenaiDataSource.runMigrations({ transaction: 'each' });
        if (applied.length > 0) {
            applied.forEach(m => console.log(`[PENAI] Migração aplicada: ${m.name}`));
        }
        const { purgeOrphanPenaiSessionRows } = await import('./purgeOrphanSessionRows.js');
        await purgeOrphanPenaiSessionRows(PenaiDataSource);
    }
    if (process.env.PENAI_SEED_ON_BOOT === 'true') {
        const { seedPenaiWorld } = await import('./seed/seedWorldPtBr.js');
        await seedPenaiWorld();
        try {
            const { seedSrdPtBrHomebrew } = await import('./seed/seedSrdPtBrHomebrew.js');
            await seedSrdPtBrHomebrew();
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(
                '[PENAI] seedSrdPtBrHomebrew ignorado (rode penai:import:foundry-bundle se precisar):',
                msg,
            );
        }
    }
}

export async function isPenaiDatabaseReady(): Promise<{ ok: boolean; message: string }> {
    try {
        if (!PenaiDataSource.isInitialized) {
            return { ok: false, message: 'DataSource não inicializado' };
        }
        await PenaiDataSource.query('SELECT 1');
        return { ok: true, message: 'PostgreSQL OK' };
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'erro desconhecido' };
    }
}
