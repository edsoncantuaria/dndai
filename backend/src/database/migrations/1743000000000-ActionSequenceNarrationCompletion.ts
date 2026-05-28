import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionSequenceNarrationCompletion1743000000000 implements MigrationInterface {
    name = 'ActionSequenceNarrationCompletion1743000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sessoes_ia
            ADD COLUMN actionSequence INT NOT NULL DEFAULT 0
        `);
        await queryRunner.query(`
            CREATE TABLE narration_completions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sessionId INT NOT NULL,
                actionId VARCHAR(64) NOT NULL,
                actionSequence INT NULL,
                completedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE KEY UQ_narration_completion_session_action (sessionId, actionId),
                KEY IDX_narration_completion_session_seq (sessionId, actionSequence)
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS narration_completions`);
        await queryRunner.query(`ALTER TABLE sessoes_ia DROP COLUMN actionSequence`);
    }
}
