// backend/src/services/aiService.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { GameMasterFlowInput, GameMasterResponse, GameMasterResponseSchema } from '../schemas/gameSchemas.js';
import { promptDnD5e } from '../game/prompt5e.js';
import { z } from 'zod';


// Standard non-streaming call
export const runGameMasterTurn = async (
    input: GameMasterFlowInput,
    apiKey: string,
    model: string
): Promise<GameMasterResponse | null> => {
    const dynamicAi = genkit({
        plugins: [googleAI({ apiKey, apiVersion: "v1beta" })],
    });

    const flow = dynamicAi.defineFlow(
        {
            name: 'gameMasterFlow',
            inputSchema: z.any(),
            outputSchema: GameMasterResponseSchema,
        },
        async (input) => {
            const result = await dynamicAi.generate({
                model: `googleai/${model}`,
                prompt: `${promptDnD5e}\n\n${JSON.stringify(input)}`,
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
            });
            return result.output as GameMasterResponse;
        }
    );

    try {
        const response = await flow(input);
        return response;
    } catch (error) {
        console.error("Error in runGameMasterTurn:", error);
        throw error;
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

    const streamingPrompt = `
        Responda em duas partes separadas por um marcador único '--END_OF_STREAM--'.
        1.  Primeiro, escreva APENAS a narração principal (o texto que vai para a 'content' do primeiro 'logEntry' do tipo 'narration'). Não inclua o JSON, apenas o texto puro da história.
        2.  Depois do marcador, forneça o objeto JSON completo e válido (GameMasterResponse), que deve incluir a narração que você já escreveu na primeira parte, além de todas as outras atualizações de estado.

        Exemplo de formato de resposta:
        A porta range e se abre, revelando uma escadaria empoeirada que desce para a escuridão. O cheiro de mofo e terra úmida sobe para encontrá-lo.

        --END_OF_STREAM--
        {
            "logEntries": [{ "type": "narration", "content": "A porta range e se abre, revelando uma escadaria empoeirada que desce para a escuridão. O cheiro de mofo e terra úmida sobe para encontrá-lo." }],
            "actionOptions": ["Descer as escadas com cautela", "Procurar por armadilhas na entrada"]
        }
    `;

    const fullPrompt = `${promptDnD5e}\n\n${JSON.stringify({ ...input, streaming_instructions: streamingPrompt })}`;

    try {
        const { stream, response } = await dynamicAi.generate({
            model: `googleai/${model}`,
            prompt: fullPrompt,
            config: {
                temperature: 1,
                topP: 0.95,
                topK: 64,
                maxOutputTokens: 8192,
            },
            stream: true,
        });

        return { textStream: stream, responsePromise: response };
    } catch(error: any) {
        console.error("Error initiating stream in streamGameMasterTurn:", error);
        // Ensure we always return a valid object, even on error, to prevent crashes upstream.
        // Create an empty async iterator for textStream.
        const emptyAsyncIterator = (async function* () {})();
        return { 
            textStream: emptyAsyncIterator, 
            responsePromise: Promise.reject(error) // Propagate the error in the promise
        };
    }
};
