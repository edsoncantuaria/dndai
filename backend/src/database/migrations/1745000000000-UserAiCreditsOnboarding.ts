import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAiCreditsOnboarding1745000000000 implements MigrationInterface {
    name = 'UserAiCreditsOnboarding1745000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            ADD COLUMN aiCreditsRemaining INT NOT NULL DEFAULT 0,
            ADD COLUMN aiCreditsUsed INT NOT NULL DEFAULT 0
        `);
        const grant = Number(process.env.AI_INCLUDED_CREDITS_DEFAULT ?? 30);
        const safeGrant = Number.isFinite(grant) && grant > 0 ? Math.floor(grant) : 30;
        await queryRunner.query(
            `UPDATE users SET aiCreditsRemaining = ${safeGrant} WHERE aiCreditsRemaining = 0`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE users
            DROP COLUMN aiCreditsRemaining,
            DROP COLUMN aiCreditsUsed
        `);
    }
}
