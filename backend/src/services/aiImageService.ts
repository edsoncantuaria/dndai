// backend/src/services/aiImageService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import createError from 'http-errors';

interface GenerateImageInput {
    prompt: string;
    model: string; 
    apiKey: string;
}

interface GenerateImageOutput {
    imageUrl: string; // Será uma data URI (base64)
}

export const generateImage = async ({ prompt, model, apiKey }: GenerateImageInput): Promise<GenerateImageOutput> => {
    if (!apiKey) {
        throw createError(401, 'Chave de API do Google não fornecida.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const imageModel = genAI.getGenerativeModel({ model: model });

        // Gera a imagem diretamente com o prompt e modelo fornecidos
        const result = await imageModel.generateContent(prompt);
        const response = await result.response;
        
        // A API para modelos 'imagen' pode retornar os dados de forma diferente.
        // Acessamos o primeiro candidato e extraímos os dados base64 da imagem.
        const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;

        if (!imageData || !imageData.data) {
            console.error('Resposta da API de imagem inesperada:', JSON.stringify(response, null, 2));
            throw new Error("A API não retornou dados de imagem válidos.");
        }
        
        // A imagem vem em base64, então criamos a data URI
        const imageUrl = `data:${imageData.mimeType};base64,${imageData.data}`;

        return { imageUrl };

    } catch (error: any) {
        console.error(`[aiImageService] Erro ao gerar imagem com o modelo ${model}:`, error);
        if (error.message.includes('API key not valid')) {
            throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
        }
        if (error.message.includes('404 Not Found')) {
            throw createError(404, `O modelo de imagem '${model}' não foi encontrado ou não está disponível para sua chave.`);
        }
        throw createError(502, `Falha na comunicação com o serviço de geração de imagem: ${error.message}`);
    }
};
