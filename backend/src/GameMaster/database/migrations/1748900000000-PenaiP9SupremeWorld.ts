import type { MigrationInterface, QueryRunner } from 'typeorm';

/** P9–P12: shard, knowledge graph v2, timeline index, session.shardId */
export class PenaiP9SupremeWorld1748900000000 implements MigrationInterface {
    name = 'PenaiP9SupremeWorld1748900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS world_shards (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "regionSlug" varchar(64) NOT NULL UNIQUE,
                "displayName" varchar(120) NOT NULL,
                version int NOT NULL DEFAULT 0,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "updatedAt" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS "shardId" uuid NULL
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS kg_nodes (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "shardId" uuid NULL REFERENCES world_shards(id) ON DELETE SET NULL,
                "nodeType" varchar(32) NOT NULL,
                slug varchar(96) NOT NULL,
                "displayName" varchar(160) NOT NULL,
                "createdAt" timestamptz NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_kg_nodes_shard_type_slug
            ON kg_nodes ("shardId", "nodeType", slug)
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS kg_edges (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "fromNodeId" uuid NOT NULL,
                "toNodeId" uuid NOT NULL,
                relation varchar(48) NOT NULL,
                strength int NOT NULL DEFAULT 0,
                "sinceWorldDay" int NULL,
                "sourceEventId" uuid NULL,
                "sessionId" int NULL,
                "createdAt" timestamptz NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_kg_edges_from_to_rel
            ON kg_edges ("fromNodeId", "toNodeId", relation)
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS timeline_entries (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "shardId" uuid NULL,
                "sessionId" int NULL,
                "eventId" uuid NOT NULL,
                "eventType" varchar(64) NOT NULL,
                "worldDay" int NOT NULL,
                "worldHour" int NOT NULL DEFAULT 0,
                category varchar(48) NOT NULL,
                summary varchar(320) NOT NULL,
                "createdAt" timestamptz NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_timeline_shard_day
            ON timeline_entries ("shardId", "worldDay")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_timeline_session_day
            ON timeline_entries ("sessionId", "worldDay")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS timeline_entries CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS kg_edges CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS kg_nodes CASCADE`);
        await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS "shardId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS world_shards CASCADE`);
    }
}
