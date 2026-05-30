export async function ensurePenaiTestDb(): Promise<boolean> {
    if (!process.env.DATABASE_URL) return false;
    try {
        const { initPenaiDatabase } = await import('../GameMaster/database/data-source.js');
        await initPenaiDatabase();
        return true;
    } catch {
        return false;
    }
}
