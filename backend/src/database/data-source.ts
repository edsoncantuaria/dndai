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
import { CampaignArtifact } from '../entities/CampaignArtifact.js';
import { Region } from '../entities/Region.js';
import { RegionLink } from '../entities/RegionLink.js';
import { RegionPointOfInterest } from '../entities/RegionPointOfInterest.js';
import { RegionSnapshot } from '../entities/RegionSnapshot.js';
import { QuestKeyword } from '../entities/QuestKeyword.js';


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
    
    /**
     * `synchronize: true` cria o esquema do banco de dados automaticamente
     * com base nas entidades. Ótimo para desenvolvimento, mas para produção
     * é recomendado usar migrações (`synchronize: false`).
     */
    synchronize: true,
    logging: false, // Mude para true para ver as queries SQL no console
    
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
        CampaignArtifact,
        Region,
        RegionLink,
        RegionPointOfInterest,
        RegionSnapshot,
        QuestKeyword,
    ], 
    
    migrations: [],
    subscribers: [],
});
