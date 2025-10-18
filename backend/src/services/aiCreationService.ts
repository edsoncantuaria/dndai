// backend/src/services/aiCreationService.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from 'ai';
import createError from 'http-errors';
import { EXAMPLES } from '../../data/examples.js';
import { HomebrewContentType } from "../entities/HomebrewContent.js";
import { z } from 'zod';

interface GenerateHomebrewInput {
    prompt: string;
    type: HomebrewContentType;
    apiKey: string;
}

export const generateHomebrewContent = async ({ prompt, type, apiKey }: GenerateHomebrewInput) => {
    if (!apiKey) {
        throw createError(401, 'Chave de API do Google não fornecida.');
    }
    
    const exampleJson = EXAMPLES[type] ? JSON.stringify(EXAMPLES[type], null, 2) : "{}";
    const systemPrompt = `
      Você é um especialista em Dungeons & Dragons 5ª Edição e um assistente de criação de conteúdo (homebrew).
      Sua tarefa é converter um prompt de usuário em um objeto JSON estruturado que segue o schema da API D&D 5e.
      Você DEVE retornar APENAS o objeto JSON, sem nenhum texto, explicação ou markdown (\`\`\`json) ao redor dele.
      
      O JSON deve ser completo e conter todos os campos relevantes para o tipo de conteúdo solicitado, mesmo que você precise inferir alguns valores.
      Use o seguinte exemplo como uma referência de estrutura para um conteúdo do tipo '${type}':

      Exemplo de Estrutura:
      \`\`\`json
      ${exampleJson}
      \`\`\`

      Traduza todos os nomes, descrições e textos para o Português do Brasil.
      O campo 'index' deve ser uma versão em minúsculas e separada por hífens do nome em inglês.
    `;
    
    // Cria uma instância dinâmica do provedor com a chave de API do usuário
    const google = createGoogleGenerativeAI({ apiKey });

    try {
        const { object } = await generateObject({
            model: google('gemini-1.5-pro-latest'),
            system: systemPrompt,
            prompt: `Gere o conteúdo para o seguinte pedido:\n\nTipo: ${type}\nPrompt: "${prompt}"`,
            schema: z.any(),
        });

        return { content: object };

    } catch (error: any) {
        console.error(`[aiCreationService] Erro ao chamar a API do Gemini:`, error);
        if (error.message && (error.message.includes('API key not valid') || error.message.includes('API key is missing'))) {
            throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
        }
        if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
            throw createError(429, 'Você excedeu seu limite de uso da API. Por favor, tente novamente mais tarde.');
        }
        throw createError(502, `Falha na comunicação com o serviço de IA: ${error.message}`);
    }
};
