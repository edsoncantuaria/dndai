// backend/src/services/aiCreationService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from 'zod';
import createError from 'http-errors';
import { EXAMPLES } from '../../data/examples.js';
import { HomebrewContentType } from "../entities/HomebrewContent.js";

const CreateHomebrewInputSchema = z.object({
  prompt: z.string(),
  type: z.enum(['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat']),
  apiKey: z.string(),
});

export const createHomebrewContent = async (input: z.infer<typeof CreateHomebrewInputSchema>): Promise<{ content: any }> => {
    const { prompt, type, apiKey } = input;

    if (!apiKey) {
        throw createError(400, "A chave de API do Google é necessária.");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-pro',
        });

        const exampleJson = EXAMPLES[type] ? JSON.stringify(EXAMPLES[type], null, 2) : "{}";

        const systemInstruction = `
          Você é um especialista em Dungeons & Dragons 5ª Edição e um assistente de criação de conteúdo (homebrew).
          Sua tarefa é converter um prompt de usuário em um objeto JSON estruturado que segue o schema da API D&D 5e (documentada em openapi.yaml).
          
          Regras Obrigatórias:
          1.  Você DEVE retornar APENAS o objeto JSON, sem nenhum texto, explicação ou markdown (\`\`\`json) ao redor dele.
          2.  O JSON deve ser completo e conter todos os campos relevantes para o tipo de conteúdo solicitado, inferindo valores quando necessário para manter a estrutura.
          3.  Use o seguinte exemplo como uma referência de estrutura para um conteúdo do tipo '${type}':
              \`\`\`json
              ${exampleJson}
              \`\`\`
          4.  Traduza todos os nomes, descrições e textos para o Português do Brasil.
          5.  O campo 'index' deve ser uma versão em minúsculas e separada por hífens do nome em inglês do conteúdo, se aplicável, ou uma versão similar do nome em português.
        `;
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: `Gere o conteúdo para o seguinte pedido:\n\nTipo: ${type}\nPrompt: "${prompt}"` }] }],
            systemInstruction: {
                role: "system",
                parts: [{ text: systemInstruction }],
            },
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.5,
            }
        });
        
        const response = result.response;
        const jsonText = response.text();
        
        if (!jsonText) {
            throw createError(500, 'A IA retornou uma resposta vazia.');
        }

        try {
            const content = JSON.parse(jsonText);
            return { content };
        } catch (e: any) {
            console.error("Falha ao analisar JSON da IA:", e, "Texto recebido:", jsonText);
            throw createError(500, `A IA retornou um formato JSON inválido. Tente novamente. Erro: ${e.message}`);
        }

    } catch (error: any) {
        console.error('[aiCreationService] Erro ao chamar a API do Gemini:', error);
        if (error.message.includes('API key not valid')) {
            throw createError(401, 'A chave de API fornecida é inválida.');
        }
        throw createError(500, `Erro de comunicação com o serviço de IA: ${error.message}`);
    }
};
