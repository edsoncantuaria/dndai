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

export const generateImage = async ({ prompt, model, apiKey }: GenerateImageInput): Promise<GenerateImageOutput | null> => {
    if (!apiKey) {
        throw createError(401, 'Chave de API do Google não fornecida.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // ATENÇÃO: A geração de imagem com o SDK Node.js (`@google/generative-ai`)
        // para modelos como 'imagen' ainda é experimental ou pode não estar disponível
        // da mesma forma que no Genkit. O código abaixo é uma tentativa baseada na
        // estrutura do `generateContent`, mas pode falhar.
        // A abordagem mais confiável seria usar o endpoint REST diretamente.
        // Por enquanto, o controlador está MOCKANDO a resposta.
        const genModel = genAI.getGenerativeModel({ model });

        const finalPrompt = `Uma pintura digital épica e cinematográfica de: ${prompt}. Estilo de fantasia sombria, arte de alta qualidade, iluminação dramática, D&D.`;

        const result = await genModel.generateContent(finalPrompt);
        const response = result.response;
        
        // Esta parte é hipotética. A resposta real da API pode ser diferente.
        const imageData = response.candidates?.[0]?.content?.parts?.[0] as any;
        if (imageData && imageData.inlineData) {
            const imageUrl = `data:${imageData.inlineData.mimeType};base64,${imageData.inlineData.data}`;
            return { imageUrl };
        }

        throw createError(500, "A resposta da IA de imagem não continha dados de imagem válidos no formato esperado.");

    } catch (error: any) {
        console.error(`[aiImageService] Erro ao gerar imagem:`, error);
        throw createError(502, `Falha na comunicação com o serviço de geração de imagem: ${error.message}`);
    }
};
