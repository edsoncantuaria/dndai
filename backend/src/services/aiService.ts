
// backend/src/services/aiService.ts
import { genkit, Genkit, configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Cache em memória para armazenar instâncias de Genkit.
 * A chave do Map é o ID da sessão (SessaoIA.id).
 * O valor é a instância de Genkit configurada para aquela sessão.
 */
const aiInstancesCache = new Map<number, Genkit>();

/**
* Factory de instâncias de IA. Cria ou recupera uma instância de Genkit 
* para uma sessão específica, garantindo que cada sessão use sua própria chave de API.
* 
* @param sessionId O ID da sessão para a qual a instância de IA está sendo criada/recuperada.
* @param apiKey A chave de API do Google Gemini específica para esta sessão.
* @returns Uma instância de Genkit configurada.
*/
export function getOrCreateAiInstance(sessionId: number, apiKey: string): Genkit {
    // 1. Verifica se já existe uma instância em cache para esta sessão.
    if (aiInstancesCache.has(sessionId)) {
        console.log(`[aiService] Retornando instância de IA em cache para a sessão ${sessionId}.`);
        return aiInstancesCache.get(sessionId)!;
    }

    // 2. Se não houver, cria uma nova instância de Genkit.
    console.log(`[aiService] Criando nova instância de IA para a sessão ${sessionId}.`);
    
    // O `genkit()` cria um objeto de configuração isolado.
    // Usamos um nome de plugin único para cada instância para evitar conflitos internos no Genkit.
    const newAiInstance = genkit({
        plugins: [
            googleAI({
                apiKey: apiKey,
            }),
        ],
        // Desabilitar o tracing em produção para melhor performance, a menos que seja necessário para debug.
        enableTracingAndMetrics: process.env.NODE_ENV === 'development',
        // O log pode ser configurado para 'debug', 'info', 'warn', 'error'.
        logLevel: 'info',
    });

    // 3. Armazena a nova instância no cache.
    aiInstancesCache.set(sessionId, newAiInstance);

    return newAiInstance;
}

/**
 * Remove uma instância de IA do cache.
 * Isso pode ser útil quando uma sessão é encerrada ou deletada, para liberar memória.
 * @param sessionId O ID da sessão a ser removida do cache.
 */
export function clearAiInstanceFromCache(sessionId: number): void {
    if (aiInstancesCache.has(sessionId)) {
        aiInstancesCache.delete(sessionId);
        console.log(`[aiService] Instância de IA para a sessão ${sessionId} foi removida do cache.`);
    }
}
