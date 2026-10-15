import type { MigrationInterface, QueryRunner } from 'typeorm';

/** UI persistida (opções, pulso) + progresso do bootstrap do mundo vivo. */
export class SessionUiAndWorldBootstrap1748800000000 implements MigrationInterface {
    name = 'SessionUiAndWorldBootstrap1748800000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS "lastActionOptions" jsonb NULL
        `);
        await queryRunner.query(`
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS "worldPulseSnapshot" jsonb NULL
        `);
        await queryRunner.query(`
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS "worldBootstrap" jsonb NULL
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS "worldBootstrap"`);
        await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS "worldPulseSnapshot"`);
        await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS "lastActionOptions"`);
    }
}
