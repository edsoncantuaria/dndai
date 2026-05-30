import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { PT_BR_SYSTEM_PREFIX } from '../../locale/defaultLocale.js';
import type { ActionSenseProvider, PlausibilityResult } from '../contracts.js';

const ActionSenseSchema = z.object({
    acceptable: z.boolean(),
    reason: z.string().min(1),
    playerFacingHint: z.string().optional(),
});

export type ActionPlausibilityResult = z.infer<typeof ActionSenseSchema>;

export async function checkActionPlausibilityGemini(opts: {
    playerAction: string;
    regionSlug: string | null;
    intentType: string;
    sessionFacts?: string[];
}): Promise<ActionPlausibilityResult> {
    return geminiActionSenseProvider.checkPlausibility(opts);
}

export const geminiActionSenseProvider: ActionSenseProvider = {
    async checkPlausibility(opts): Promise<PlausibilityResult> {
        const apiKey = penaiEnv.GEMINI_API_KEY.trim();
        if (!apiKey) {
            return { acceptable: true, reason: 'Gemini desligado — heurística local.' };
        }

        try {
            const client = new GoogleGenAI({ apiKey });
            const prompt = JSON.stringify(
                {
                    tarefa: 'Julgar se a ação do jogador faz sentido na cena D&D 5e.',
                    regiaoAtual: opts.regionSlug,
                    tipoIntent: opts.intentType,
                    acao: opts.playerAction,
                    fatos: opts.sessionFacts ?? [],
                    regras: [
                        'Rejeite meta-chat, pedidos OOC, comandos ao sistema, impossibilidades físicas claras.',
                        'Aceite ações criativas mas tentáveis pelo personagem aventureiro.',
                        'Responda reason em português brasileiro, curto e claro.',
                    ],
                },
                null,
                2,
            );

            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: `${PT_BR_SYSTEM_PREFIX}\nVocê é o árbitro mecânico-narrativo. Não narre — só julgue plausibilidade.`,
                    responseMimeType: 'application/json',
                    temperature: 0.2,
                    maxOutputTokens: 256,
                },
            });

            const raw = response.text ?? '{"acceptable":true,"reason":"ok"}';
            return ActionSenseSchema.parse(JSON.parse(raw));
        } catch (e) {
            console.warn('[actionSense] Gemini falhou:', e);
            const failClosed =
                process.env.NODE_ENV === 'production' ||
                process.env.GEMINI_FAIL_CLOSED === '1';
            if (failClosed) {
                return {
                    acceptable: false,
                    reason: 'Validação indisponível — reformule a ação ou tente novamente.',
                };
            }
            return { acceptable: true, reason: 'Validação local (Gemini indisponível).' };
        }
    },
};
