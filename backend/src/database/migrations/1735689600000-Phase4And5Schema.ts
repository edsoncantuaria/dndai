import type { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists, tableExists } from '../migration-utils.js';

/**
 * Migração incremental idempotente (Fases 4–5).
 * Em dev com DB_SYNC=true o TypeORM já pode ter criado o esquema; em prod use apenas migrações.
 */
export class Phase4And5Schema1735689600000 implements MigrationInterface {
    name = 'Phase4And5Schema1735689600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasSessionFacts = await tableExists(queryRunner, 'session_facts');
        if (!hasSessionFacts) {
            await queryRunner.query(`
                CREATE TABLE session_facts (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    sessaoId INT NOT NULL,
                    characterId INT NULL,
                    category VARCHAR(32) NOT NULL,
                    subject VARCHAR(120) NULL,
                    fact TEXT NOT NULL,
                    regionSlug VARCHAR(120) NULL,
                    npcId VARCHAR(120) NULL,
                    questId VARCHAR(120) NULL,
                    source VARCHAR(16) NOT NULL DEFAULT 'ai',
                    isActive TINYINT(1) NOT NULL DEFAULT 1,
                    createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX IDX_session_facts_sessao_active (sessaoId, isActive),
                    INDEX IDX_session_facts_sessao_category (sessaoId, category),
                    CONSTRAINT FK_session_facts_sessao FOREIGN KEY (sessaoId) REFERENCES sessoes_ia(id) ON DELETE CASCADE,
                    CONSTRAINT FK_session_facts_character FOREIGN KEY (characterId) REFERENCES characters(id) ON DELETE CASCADE
                ) ENGINE=InnoDB
            `);
        }

        if (!(await columnExists(queryRunner, 'characters', 'coins'))) {
            await queryRunner.query(`
                ALTER TABLE characters
                ADD COLUMN coins LONGTEXT NULL COMMENT 'Moedas autoritativas pp/gp/ep/sp/cp (JSON)'
            `);
        }

        if (!(await columnExists(queryRunner, 'sessoes_ia', 'pendingLootOffer'))) {
            await queryRunner.query(`
                ALTER TABLE sessoes_ia
                ADD COLUMN pendingLootOffer JSON NULL COMMENT 'Loot pendente até claim-loot'
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, 'sessoes_ia', 'pendingLootOffer')) {
            await queryRunner.query(`ALTER TABLE sessoes_ia DROP COLUMN pendingLootOffer`);
        }
        if (await columnExists(queryRunner, 'characters', 'coins')) {
            await queryRunner.query(`ALTER TABLE characters DROP COLUMN coins`);
        }
        if (await tableExists(queryRunner, 'session_facts')) {
            await queryRunner.query(`DROP TABLE session_facts`);
        }
    }
}
