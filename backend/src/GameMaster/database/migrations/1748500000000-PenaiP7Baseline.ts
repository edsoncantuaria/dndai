import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Baseline P7 — overlays de campanha e colunas de survival. Idempotente para dev com sync. */
export class PenaiP7Baseline1748500000000 implements MigrationInterface {
    name = 'PenaiP7Baseline1748500000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE world_entities
            ADD COLUMN IF NOT EXISTS "entityTier" varchar(16) NOT NULL DEFAULT 'INCIDENTAL'
        `);

        await queryRunner.query(`
            ALTER TABLE session_memories
            ADD COLUMN IF NOT EXISTS "importanceScore" int NOT NULL DEFAULT 50
        `);
        await queryRunner.query(`
            ALTER TABLE session_memories
            ADD COLUMN IF NOT EXISTS "lastReferencedAt" timestamptz NULL
        `);
        await queryRunner.query(`
            ALTER TABLE session_memories
            ADD COLUMN IF NOT EXISTS "decayedAt" timestamptz NULL
        `);

        await queryRunner.query(`
            ALTER TABLE session_entity_state
            ADD COLUMN IF NOT EXISTS "lastSeenGameDay" int NULL
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_region_state (
                id serial PRIMARY KEY,
                "sessionId" int NOT NULL,
                "regionSlug" varchar(64) NOT NULL,
                fear int NOT NULL DEFAULT 20,
                prosperity int NOT NULL DEFAULT 50,
                crime int NOT NULL DEFAULT 30,
                resources jsonb NOT NULL DEFAULT '{}',
                "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
                UNIQUE ("sessionId", "regionSlug")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_region_economy (
                id serial PRIMARY KEY,
                "sessionId" int NOT NULL,
                "regionSlug" varchar(64) NOT NULL,
                "itemSlug" varchar(64) NOT NULL,
                "basePrice" numeric(10,2) NOT NULL DEFAULT 10,
                "currentPrice" numeric(10,2) NOT NULL DEFAULT 10,
                scarcity int NOT NULL DEFAULT 0,
                UNIQUE ("sessionId", "regionSlug", "itemSlug")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_faction_influence (
                id serial PRIMARY KEY,
                "sessionId" int NOT NULL,
                "factionSlug" varchar(64) NOT NULL,
                "regionSlug" varchar(64) NOT NULL,
                influence int NOT NULL DEFAULT 0,
                UNIQUE ("sessionId", "factionSlug", "regionSlug")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_entity_reputation (
                id serial PRIMARY KEY,
                "sessionId" int NOT NULL,
                "worldEntityId" uuid NOT NULL,
                "targetSlug" varchar(64) NOT NULL,
                score int NOT NULL DEFAULT 0,
                UNIQUE ("sessionId", "worldEntityId", "targetSlug")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_knowledge (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "sessionId" int NOT NULL,
                "holderEntityId" uuid NOT NULL,
                "factKey" varchar(128) NOT NULL,
                "factText" text NOT NULL,
                source varchar(16) NOT NULL DEFAULT 'witnessed',
                "learnedAt" timestamptz NOT NULL DEFAULT NOW(),
                UNIQUE ("sessionId", "holderEntityId", "factKey")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_quests (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "sessionId" int NOT NULL,
                "questSlug" varchar(64) NOT NULL,
                title varchar(160) NOT NULL,
                status varchar(32) NOT NULL DEFAULT 'active',
                stage int NOT NULL DEFAULT 0,
                payload jsonb NOT NULL DEFAULT '{}',
                "startedAt" timestamptz NOT NULL DEFAULT NOW(),
                "advancedAt" timestamptz NULL,
                UNIQUE ("sessionId", "questSlug")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_snapshots (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "sessionId" int NOT NULL,
                "actionSequence" int NOT NULL DEFAULT 0,
                payload jsonb NOT NULL,
                "createdAt" timestamptz NOT NULL DEFAULT NOW()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_session_snapshots_session
            ON session_snapshots ("sessionId")
        `);

        const fkTables = [
            'session_region_state',
            'session_region_economy',
            'session_faction_influence',
            'session_entity_reputation',
            'session_knowledge',
            'session_quests',
            'session_snapshots',
        ];
        for (const table of fkTables) {
            await queryRunner.query(`
                DO $$ BEGIN
                    ALTER TABLE ${table}
                    ADD CONSTRAINT "FK_${table}_session"
                    FOREIGN KEY ("sessionId") REFERENCES game_sessions(id) ON DELETE CASCADE;
                EXCEPTION WHEN duplicate_object THEN NULL;
                END $$
            `);
        }
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS session_snapshots CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_quests CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_knowledge CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_entity_reputation CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_faction_influence CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_region_economy CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS session_region_state CASCADE`);
        await queryRunner.query(
            `ALTER TABLE session_entity_state DROP COLUMN IF EXISTS "lastSeenGameDay"`,
        );
    }
}
