import type { ActionIntent } from '../../rules/actionIntentService.js';
import type { SkillCheckIntentPayload } from '../../rules/types.js';
import { createGameplayModelAdapter, resolveAiProvider } from '../../ai/providerFactory.js';

type ClassifyPayload = {
    needsRoll?: boolean;
    intentType?: 'skill-check' | 'none';
    skillIndex?: string;
    difficulty?: SkillCheckIntentPayload['difficulty'];
    reason?: string;
};

const SYSTEM = `Você é um Mestre de D&D 5e que classifica ações para o motor de regras.
Responda APENAS JSON: {"needsRoll":boolean,"intentType":"skill-check"|"none","skillIndex":"index-srd-em-ingles","difficulty":"easy"|"medium"|"hard"|null,"reason":"..."}

Regras:
- needsRoll=true só se há incerteza e consequência mecânica (não para conversa casual).
- skillIndex = perícia que FAZ SENTIDO para a intenção, não a palavra citada pelo jogador se estiver errada.
  Ex.: "acrobacia para enganar" → deception; "persuadir com intimidação" → persuasion ou intimidation conforme tom.
- Índices SRD: stealth, perception, athletics, acrobatics, deception, persuasion, intimidation, insight, investigation, arcana, history, religion, nature, medicine, animal-handling, survival, performance, sleight-of-hand.
- Conversa sem teste, movimento trivial ou ações impossíveis → needsRoll=false, intentType=none.`;

/**
 * @deprecated Desligado em produção OSS (`DM_LLM_CLASSIFY=false`). Consome cota free extra.
 * Classificação leve via LLM quando heurística PT não detecta perícia.
 */
export async function classifyFreeActionWithLlm(
    playerAction: string,
    apiKey: string,
): Promise<ActionIntent | null> {
    if (!playerAction.trim() || !apiKey.trim()) return null;

    const model =
        process.env.DM_CLASSIFY_MODEL?.trim() ||
        (resolveAiProvider('meta-llama/llama-3.3-70b-instruct:free') === 'openrouter'
            ? 'meta-llama/llama-3.3-70b-instruct:free'
            : 'gemini-2.5-flash');

    try {
        const adapter = createGameplayModelAdapter(apiKey, model);
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `Ação do jogador:\n${playerAction.slice(0, 800)}` }],
                },
            ],
            config: {
                temperature: 0.2,
                maxOutputTokens: 256,
                responseMimeType: 'application/json',
            },
        };
        const systemInstruction = {
            role: 'system' as const,
            parts: [{ text: SYSTEM }],
        };
        const raw = await adapter.generateContent(body, systemInstruction);
        const text =
            typeof (raw as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
                ?.candidates?.[0]?.content?.parts?.[0]?.text === 'string'
                ? (raw as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> })
                      .candidates[0].content.parts[0].text
                : JSON.stringify(raw);

        const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text) as ClassifyPayload;
        if (!parsed.needsRoll || parsed.intentType !== 'skill-check' || !parsed.skillIndex?.trim()) {
            return null;
        }

        const payload: SkillCheckIntentPayload = {
            skillIndex: parsed.skillIndex.trim().toLowerCase(),
            difficulty: parsed.difficulty ?? undefined,
        };
        return { type: 'skill-check', payload };
    } catch (err) {
        console.warn('[freeActionLlmClassifier] Falha:', err);
        return null;
    }
}
