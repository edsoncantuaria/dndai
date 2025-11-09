// backend/src/services/aiCreationService.ts
import { GoogleGenAI } from "@google/genai";
import createError from 'http-errors';
import { EXAMPLES } from '../../data/examples.js';
import { HomebrewContentType } from "../entities/HomebrewContent.js";

interface GenerateHomebrewInput {
    prompt: string;
    type: HomebrewContentType;
    apiKey: string;
}

const MODEL_ID = process.env.HOMEBREW_MODEL_ID || 'gemini-1.5-flash';

const EXAMPLE_FIELD_WHITELIST: Partial<Record<HomebrewContentType, string[]>> = {
    race: ['name', 'ability_bonuses', 'alignment', 'traits', 'languages'],
    subrace: ['name', 'desc', 'starting_proficiencies', 'ability_bonuses'],
    class: ['name', 'hit_die', 'proficiencies', 'saving_throws', 'starting_equipment_options'],
    subclass: ['name', 'subclass_flavor', 'features'],
    spell: ['name', 'desc', 'range', 'components', 'duration', 'casting_time', 'level', 'school'],
    item: ['name', 'equipment_category', 'cost', 'weight', 'desc'],
    monster: ['name', 'size', 'type', 'armor_class', 'hit_points', 'actions', 'abilities'],
    background: ['name', 'feature', 'proficiencies', 'equipment'],
    feat: ['name', 'prerequisites', 'desc'],
    skill: ['name', 'desc'],
    translation: ['name', 'content'],
};

const pickFields = (source: any, fields: string[] = []) => {
    if (!source || typeof source !== 'object') return source;
    if (!fields.length) return source;
    return fields.reduce<Record<string, unknown>>((acc, field) => {
        if (field in source) {
            acc[field] = source[field];
        }
        return acc;
    }, {});
};

export const generateHomebrewContent = async ({ prompt, type, apiKey }: GenerateHomebrewInput) => {
    if (!apiKey) {
        throw createError(401, 'Chave de API do Google não fornecida.');
    }
    
    const whitelist = EXAMPLE_FIELD_WHITELIST[type] ?? ['name', 'desc'];
    const exampleSnippet = EXAMPLES[type]
        ? JSON.stringify(pickFields(EXAMPLES[type], whitelist))
        : "{}";
    const systemPrompt = `
      Você é um especialista em Dungeons & Dragons 5ª Edição e um assistente de criação de conteúdo (homebrew).
      Sua tarefa é converter um prompt de usuário em um objeto JSON estruturado que segue o schema da API D&D 5e.
      Você DEVE retornar APENAS o objeto JSON, sem nenhum texto, explicação ou markdown (\`\`\`json) ao redor dele.
      
      O JSON deve ser completo e conter todos os campos relevantes para o tipo de conteúdo solicitado, mesmo que você precise inferir alguns valores.
      Use o seguinte exemplo como uma referência de estrutura para um conteúdo do tipo '${type}':

      Exemplo de estrutura resumida:
      ${exampleSnippet}

      Traduza todos os nomes, descrições e textos para o Português do Brasil.
      O campo 'index' deve ser uma versão em minúsculas e separada por hífens do nome em inglês.
    `;

    try {
        const genAI = new GoogleGenAI({ apiKey });
        const result = await genAI.models.generateContent({
            model: MODEL_ID,
            contents: [
                { role: "user", parts: [{ text: `Gere o conteúdo para o seguinte pedido:\n\nTipo: ${type}\nPrompt: "${prompt}"` }] },
            ],
            config: {
                responseMimeType: "application/json",
                temperature: 0.5,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: systemPrompt }],
                },
            },
        });

        const jsonText = result.text ?? '';

        if (!jsonText) {
            throw createError(500, "A IA retornou uma resposta vazia.");
        }

        try {
            const content = JSON.parse(jsonText);
            return { content };
        } catch (e) {
            console.error("[aiCreationService] Falha ao analisar JSON da IA:", e, "Texto recebido:", jsonText);
            throw createError(500, "A IA retornou uma resposta em formato JSON inválido.");
        }

    } catch (error: any) {
        console.error(`[aiCreationService] Erro ao chamar a API do Gemini:`, error);
        throw createError(502, `Falha na comunicação com o serviço de IA: ${error.message}`);
    }
};
