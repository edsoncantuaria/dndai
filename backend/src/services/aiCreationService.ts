// backend/src/services/aiCreationService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import createError from 'http-errors';
import { EXAMPLES } from '../../data/examples.js';
import { HomebrewContentType } from "../entities/HomebrewContent.js";

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

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-pro-latest',
            systemInstruction: systemPrompt,
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: `Gere o conteúdo para o seguinte pedido:\n\nTipo: ${type}\nPrompt: "${prompt}"` }] }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.5,
            },
        });

        const response = result.response;
        const jsonText = response.text();

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
