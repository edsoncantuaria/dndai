import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WorldShardPolitics1748910000000 implements MigrationInterface {
    name = 'WorldShardPolitics1748910000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE world_shards
            ADD COLUMN IF NOT EXISTS "politicsState" varchar(24) NOT NULL DEFAULT 'stable'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE world_shards DROP COLUMN IF EXISTS "politicsState"`);
    }
}
