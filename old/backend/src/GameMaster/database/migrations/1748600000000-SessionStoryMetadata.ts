import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Metadados de crônica em session_memories (tom, tipo, sequência). */
export class SessionStoryMetadata1748600000000 implements MigrationInterface {
    name = 'SessionStoryMetadata1748600000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE session_memories
            ADD COLUMN IF NOT EXISTS "storyKind" varchar(16) NULL
        `);
        await queryRunner.query(`
            ALTER TABLE session_memories
            ADD COLUMN IF NOT EXISTS "storyTone" varchar(32) NULL
        `);
        await queryRunner.query(`
            ALTER TABLE session_memories
            ADD COLUMN IF NOT EXISTS "actionSequence" int NULL
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE session_memories DROP COLUMN IF EXISTS "actionSequence"`);
        await queryRunner.query(`ALTER TABLE session_memories DROP COLUMN IF EXISTS "storyTone"`);
        await queryRunner.query(`ALTER TABLE session_memories DROP COLUMN IF EXISTS "storyKind"`);
    }
}
