// backend/src/database/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import 'dotenv/config';

import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { User } from '../entities/User.js';
import { LicenseKey } from '../entities/LicenseKey.js';
import { Character } from '../entities/Character.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { JournalEntry } from '../entities/JournalEntry.js';
import { Quest } from '../entities/Quest.js';
import { Relationship } from '../entities/Relationship.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import { CombatEncounter } from '../entities/CombatEncounter.js';
import { TimelineEvent } from '../entities/TimelineEvent.js';
import { StorySummary } from '../entities/StorySummary.js';
import { CombatantState } from '../entities/CombatantState.js';
import { CombatCooldown } from '../entities/CombatCooldown.js';
import { CombatStatusEffect } from '../entities/CombatStatusEffect.js';
import { CombatLogEntry } from '../entities/CombatLogEntry.js';
import { CombatEntity } from '../entities/CombatEntity.js';
import { ActionLog } from '../entities/ActionLog.js';
import { CampaignArtifact } from '../entities/CampaignArtifact.js';
import { Region } from '../entities/Region.js';
import { RegionLink } from '../entities/RegionLink.js';
import { RegionPointOfInterest } from '../entities/RegionPointOfInterest.js';
import { RegionSnapshot } from '../entities/RegionSnapshot.js';
import { QuestKeyword } from '../entities/QuestKeyword.js';
import { VectorMemoryBacklog } from '../entities/VectorMemoryBacklog.js';
import { SanitizationPattern } from '../entities/SanitizationPattern.js';
import { EnemyTemplate as EnemyTemplateEntity } from '../entities/EnemyTemplate.js';
import { AiFeedbackNote } from '../entities/AiFeedbackNote.js';
import { ScenarioExample } from '../entities/ScenarioExample.js';
import { SrdResource } from '../entities/SrdResource.js';
import { CharacterResource } from '../entities/CharacterResource.js';
import { SessionFact } from '../entities/SessionFact.js';
import { SessionCastMember } from '../entities/SessionCastMember.js';
import { Phase4And5Schema1735689600000 } from './migrations/1735689600000-Phase4And5Schema.js';
import { SessionCastMembers1740000000000 } from './migrations/1740000000000-SessionCastMembers.js';
import { CombatEncounterPhase1741000000000 } from './migrations/1741000000000-CombatEncounterPhase.js';
import { SessionFactTier1742000000000 } from './migrations/1742000000000-SessionFactTier.js';
import { ActionSequenceNarrationCompletion1743000000000 } from './migrations/1743000000000-ActionSequenceNarrationCompletion.js';
import { NarrationCompletion } from '../entities/NarrationCompletion.js';

const migrationsOnly = process.env.DB_MIGRATIONS_ONLY === 'true';
/** Só liga sync com DB_SYNC=true explícito. Dev local: export DB_SYNC=true se quiser auto-schema. */
const synchronize = process.env.DB_SYNC === 'true' && !migrationsOnly;

/**
 * Configuração da fonte de dados para o TypeORM.
 * Lê as credenciais do banco de dados do arquivo .env.
 */
export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    
    synchronize,
    logging: process.env.DB_LOGGING === 'true',
    
    // Lista de todas as entidades que o TypeORM deve gerenciar
    entities: [
        SessaoIA, 
        SessionLog, 
        User, 
        LicenseKey, 
        Character,
        CharacterAttributes,
        CharacterProficiency,
        CharacterItem,
        CharacterSpell,
        JournalEntry,
        Quest,
        Relationship,
        HomebrewContent,
        HomebrewBundle,
        CombatEncounter,
        TimelineEvent,
        StorySummary,
        CombatantState,
        CombatCooldown,
        CombatStatusEffect,
        CombatLogEntry,
        CombatEntity,
        ActionLog,
        CampaignArtifact,
        Region,
        RegionLink,
        RegionPointOfInterest,
        RegionSnapshot,
        QuestKeyword,
        VectorMemoryBacklog,
        SanitizationPattern,
        EnemyTemplateEntity,
        AiFeedbackNote,
        ScenarioExample,
        SrdResource,
        CharacterResource,
        SessionFact,
        SessionCastMember,
        NarrationCompletion,
    ], 
    
    migrations: [
        Phase4And5Schema1735689600000,
        SessionCastMembers1740000000000,
        CombatEncounterPhase1741000000000,
        SessionFactTier1742000000000,
        ActionSequenceNarrationCompletion1743000000000,
    ],
    migrationsTableName: 'typeorm_migrations',
    subscribers: [],
});
