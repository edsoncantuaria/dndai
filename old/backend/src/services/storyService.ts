/**
 * Resumos de timeline — PENAI / Gemini PT-BR.
 */
import { renderNarrationPtBr } from '../GameMaster/ai/geminiClient.js';

export async function summarizeTimelinePtBr(snippet: string, apiKey?: string): Promise<string> {
    const result = await renderNarrationPtBr({
        contextPack: {
            locale: 'pt-BR',
            playerAction: 'Resuma em até 3 frases os eventos abaixo para memória de campanha.',
            sessionFacts: [snippet],
            canonFacts: [],
            entities: [],
            regionSlug: null,
        },
        userApiKey: apiKey,
        model: 'gemini-2.5-flash-lite',
    });
    return result.narration;
}
