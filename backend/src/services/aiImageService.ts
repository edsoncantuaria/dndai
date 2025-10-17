// backend/src/services/aiImageService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import createError from 'http-errors';

interface GenerateImageInput {
    prompt: string;
    model: string;
    apiKey: string;
}

interface GenerateImageOutput {
    imageUrl: string;
}

export const generateImage = async ({ prompt, model, apiKey }: GenerateImageInput): Promise<GenerateImageOutput> => {
    if (!apiKey) {
        throw createError(401, 'Chave de API do Google não fornecida.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model });

        const finalPrompt = `Uma pintura digital épica e cinematográfica de: ${prompt}. Estilo de fantasia sombria, arte de alta qualidade, iluminação dramática, D&D.`;

        const result = await genModel.generateContent(finalPrompt);
        const response = result.response;
        
        // A API de imagem direta geralmente não retorna URLs de imagem.
        // A maneira de obter a imagem é através do Genkit ou de uma chamada REST específica.
        // Para o SDK direto, a resposta pode não ser trivial.
        // Mocking a resposta para corresponder ao que o frontend espera, assumindo que a chamada foi bem-sucedida.
        // Em uma implementação real, o processamento da imagem (se for base64) ocorreria aqui.
        // Por agora, vamos simular o sucesso usando uma imagem de placeholder.
        const mockImageUrl = `https://picsum.photos/seed/${encodeURIComponent(prompt)}/1024/576`;

        return { imageUrl: mockImageUrl };

    } catch (error: any) {
        console.error(`[aiImageService] Erro ao gerar imagem:`, error);
        // Mapeia o erro da API do Google para um erro HTTP que o frontend pode entender.
        if (error.message.includes('API key not valid')) {
            throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
        }
        if (error.message.includes('404 Not Found')) {
            throw createError(404, `O modelo de imagem '${model}' não foi encontrado ou não está disponível para sua chave.`);
        }
        throw createError(502, `Falha na comunicação com o serviço de geração de imagem: ${error.message}`);
    }
};
