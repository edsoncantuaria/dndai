// backend/src/services/aiService.ts
import { genkit, type GenkitOptions } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { GameMasterFlowInput, GameMasterFlowInputSchema, GameMasterResponse, GameMasterResponseSchema } from '../schemas/gameSchemas.js';
import { promptDnD5e } from '../game/prompt5e.js';
import { z } from 'zod';


// Schema for the final structured data payload in a streaming response
const StreamingGameMasterResponseSchema = z.object({
    logEntries: GameMasterResponseSchema.shape.logEntries,
    actionOptions: GameMasterResponseSchema.shape.actionOptions,
    updatedCharacter: GameMasterResponseSchema.shape.updatedCharacter,
    combatState: GameMasterResponseSchema.shape.combatState,
    playerRollRequest: GameMasterResponseSchema.shape.playerRollRequest,
    ambientSound: GameMasterResponseSchema.shape.ambientSound,
    imagePrompt: GameMasterResponseSchema.shape.imagePrompt,
    systemLog: GameMasterResponseSchema.shape.systemLog,
    levelUpState: GameMasterResponseSchema.shape.levelUpState,
    shopState: GameMasterResponseSchema.shape.shopState,
    lootOffer: GameMasterResponseSchema.shape.lootOffer,
    useHitDiceRequest: GameMasterResponseSchema.shape.useHitDiceRequest,
});

type StreamingGameMasterResponse = z.infer<typeof StreamingGameMasterResponseSchema>;


const gameMasterFlow = (apiKey: string, model: string) => {
    // Configure Genkit with the dynamic API key
    const dynamicAi = genkit({
        plugins: [
            googleAI({ apiKey, apiVersion: "v1beta" }),
        ],
    });

    return dynamicAi.defineFlow(
        {
            name: 'gameMasterFlow',
            inputSchema: GameMasterFlowInputSchema,
            outputSchema: GameMasterResponseSchema,
        },
        async (input) => {
            const { stream, response } = await dynamicAi.generate({
                model: `googleai/${model}`,
                prompt: {
                    system: promptDnD5e,
                    user: JSON.stringify(input),
                },
                config: {
                    temperature: 1,
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 8192,
                },
                output: {
                    format: 'json',
                    schema: GameMasterResponseSchema,
                },
                stream: true,
            });
            
            // This part is tricky with streaming JSON. We'll handle JSON parsing on the client.
            // For now, let's assume the non-streaming path returns the full object.
            // The streaming implementation will be in a separate function.
            const result = await response;
            return result.output as GameMasterResponse;
        }
    );
};

// Standard non-streaming call
export const runGameMasterTurn = async (
    input: GameMasterFlowInput,
    apiKey: string,
    model: string
): Promise<GameMasterResponse | null> => {
    try {
        const flow = gameMasterFlow(apiKey, model);
        const response = await flow(input);
        return response;
    } catch (error) {
        console.error("Error in runGameMasterTurn:", error);
        throw error; // Re-throw to be caught by the error middleware
    }
};

// New streaming call
export const streamGameMasterTurn = async (
    input: GameMasterFlowInput,
    apiKey: string,
    model: string
) => {
    const dynamicAi = genkit({
        plugins: [googleAI({ apiKey, apiVersion: 'v1beta' })],
    });
    
    // Create a prompt that specifically asks for the narrative text first,
    // then the JSON object. This helps in separating the stream.
    const streamingPrompt = `
        Responda em duas partes separadas por um marcador único '###JSON_PAYLOAD###'.
        1.  Primeiro, escreva a entrada de log de narração principal (logEntries com type: 'narration').
        2.  Depois do marcador, forneça o objeto JSON completo (GameMasterResponse), incluindo a narração que você já escreveu na primeira parte.

        Exemplo de formato de resposta:
        A porta range e se abre...

        ###JSON_PAYLOAD###
        {
            "logEntries": [{ "type": "narration", "content": "A porta range e se abre..." }],
            "actionOptions": ["Entrar", "Esperar"]
        }
    `;

    const { stream, response } = await dynamicAi.generate({
        model: `googleai/${model}`,
        prompt: {
            system: promptDnD5e,
            user: JSON.stringify({ ...input, streaming_instructions: streamingPrompt }),
        },
        config: {
            temperature: 1,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 8192,
        },
        stream: true,
    });

    return { textStream: stream, responsePromise: response };
};
