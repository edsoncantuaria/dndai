import type { MigrationInterface, QueryRunner } from 'typeorm';

/** world_events.id é UUID — cursor de projeção não pode ser bigint. */
export class LastProjectedEventUuid1748700000000 implements MigrationInterface {
    name = 'LastProjectedEventUuid1748700000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE game_sessions
            ALTER COLUMN "lastProjectedEventId" TYPE uuid USING NULL
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE game_sessions
            ALTER COLUMN "lastProjectedEventId" TYPE bigint USING NULL
        `);
    }
}
