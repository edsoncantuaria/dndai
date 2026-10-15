import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Status de sessão (morte/abandono) + vínculo ao template do cofre. */
export class SessionDeathAndVault1748920000000 implements MigrationInterface {
    name = 'SessionDeathAndVault1748920000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS "sessionStatus" varchar(24) NOT NULL DEFAULT 'active'
        `);
        await queryRunner.query(`
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS "vaultTemplateId" uuid NULL
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS "vaultTemplateId"`);
        await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS "sessionStatus"`);
    }
}
