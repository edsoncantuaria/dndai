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
import { PenaiHomebrewContent } from './entities/HomebrewContentPenai.js';
import { PenaiHomebrewBundle } from './entities/HomebrewBundlePenai.js';
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
    ],
    migrations: [],
});

let initialized = false;

export async function initPenaiDatabase(): Promise<void> {
    if (initialized) return;
    await PenaiDataSource.initialize();
    initialized = true;
    console.log('[PENAI] PostgreSQL conectado.');
    if (process.env.PENAI_SEED_ON_BOOT === 'true') {
        const { seedPenaiWorld } = await import('./seed/seedWorldPtBr.js');
        await seedPenaiWorld();
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
