import { AppDataSource } from '../database/data-source.js';
import { syncResourcesForAllCharacters } from '../services/characterResourceService.js';

async function main() {
    await AppDataSource.initialize();
    try {
        const reports = await syncResourcesForAllCharacters();
        reports.forEach((report, index) => {
            const prefix = `[character-resource-sync] #${index + 1} (characterId=${report.characterId}${report.characterName ? `, name=${report.characterName}` : ''})`;
            if (report.skippedReason) {
                console.warn(`${prefix} skipped (${report.skippedReason})`);
            } else {
                console.log(
                    `${prefix} -> class=${report.classIndex} created=${report.created} updated=${report.updated} removed=${report.removed} targets=${report.totalDefined}`
                );
            }
        });
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

main().catch(error => {
    console.error('[character-resource-sync] Unexpected failure', error);
    process.exit(1);
});
