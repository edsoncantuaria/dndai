import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CombatEncounterPhase1741000000000 implements MigrationInterface {
    name = 'CombatEncounterPhase1741000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE combat_encounters
            ADD COLUMN phase VARCHAR(32) NOT NULL DEFAULT 'IDLE'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE combat_encounters DROP COLUMN phase`);
    }
}
