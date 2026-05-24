import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionCastMembers1740000000000 implements MigrationInterface {
    name = 'SessionCastMembers1740000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS session_cast_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sessionId INT NOT NULL,
                ownerUserId INT NOT NULL,
                characterId INT NULL,
                displayName VARCHAR(120) NOT NULL,
                role VARCHAR(16) NOT NULL DEFAULT 'npc',
                vitals VARCHAR(20) NOT NULL DEFAULT 'alive',
                sheetSnapshot JSON NULL,
                metadata JSON NULL,
                visibleToParty TINYINT(1) NOT NULL DEFAULT 1,
                createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX IDX_cast_session_name (sessionId, displayName),
                CONSTRAINT FK_cast_session FOREIGN KEY (sessionId) REFERENCES sessoes_ia(id) ON DELETE CASCADE,
                CONSTRAINT FK_cast_owner FOREIGN KEY (ownerUserId) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT FK_cast_character FOREIGN KEY (characterId) REFERENCES characters(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS session_cast_members`);
    }
}
