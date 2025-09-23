// utils/apiUtils.ts

/**
 * Fetches details for a list of items in controlled chunks to avoid API rate limiting.
 * Includes progress reporting.
 * @param items The array of items with an 'index' property (e.g., spells, equipment).
 * @param detailFetcher The async function from DndApiService to call for each item (e.g., getSpellDetails).
 * @param onProgress A callback function to report progress (loaded, total).
 * @param chunkSize The number of items to fetch in each chunk.
 * @param delay The delay in milliseconds between chunks.
 * @returns A promise that resolves to an array of fetched details.
 */
export const fetchDetailsInChunks = async <T extends { index: string }, U>(
    items: T[],
    detailFetcher: (index: string) => Promise<U | null>,
    onProgress: (loaded: number, total: number) => void,
    chunkSize: number = 5,
    delay: number = 200
): Promise<U[]> => {
    const results: U[] = [];
    const totalItems = items.length;
    if (totalItems === 0) {
        onProgress(0, 0);
        return [];
    }
    onProgress(0, totalItems);

    for (let i = 0; i < totalItems; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(item => detailFetcher(item.index));
        
        try {
            const chunkResults = await Promise.all(chunkPromises);
            for (const result of chunkResults) {
                if (result) {
                    results.push(result);
                }
            }
        } catch (error) {
            console.error("Error fetching a chunk of details:", error);
        }

        onProgress(Math.min(i + chunkSize, totalItems), totalItems);

        if (i + chunkSize < totalItems) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return results;
};
