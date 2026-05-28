import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionFactTier1742000000000 implements MigrationInterface {
    name = 'SessionFactTier1742000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE session_facts
            ADD COLUMN tier VARCHAR(16) NOT NULL DEFAULT 'scene'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE session_facts DROP COLUMN tier`);
    }
}
