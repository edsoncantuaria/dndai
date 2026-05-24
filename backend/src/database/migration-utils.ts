import type { QueryRunner } from 'typeorm';

export async function tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
    const rows = await queryRunner.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName],
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
}

export async function columnExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
): Promise<boolean> {
    const rows = await queryRunner.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName],
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
}
