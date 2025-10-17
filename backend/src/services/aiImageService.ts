// backend/src/services/aiImageService.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import createError from 'http-errors';

interface GenerateImageInput {
    prompt: string;
    model: string; // Embora o modelo venha do cliente, vamos usar um otimizado para imagem aqui.
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
        // Usaremos o gemini-1.5-pro que tem uma excelente capacidade de interpretação de prompt para gerar prompts de imagem
        const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        // O modelo de imagem real
        const imageModel = genAI.getGenerativeModel({ model: "imagen-3.0-generate-002" });

        // 1. Refinar o prompt do usuário para criar um prompt de imagem mais rico
        const imagePromptRefinement = await textModel.generateContent(
            `Refine o seguinte prompt de usuário em um prompt de geração de imagem detalhado e cinematográfico para um cenário de fantasia sombria, estilo D&D. Foque em iluminação dramática, texturas realistas e uma composição épica. Prompt do usuário: "${prompt}"`
        );
        const refinedPrompt = imagePromptRefinement.response.text();
        
        console.log(`[aiImageService] Prompt refinado: ${refinedPrompt}`);

        // 2. Gerar a imagem com o prompt refinado
        const result = await imageModel.generateContent({
            prompt: refinedPrompt,
            // Adicionar um prefixo comum para melhorar o estilo
            // prompt: `Uma pintura digital épica e cinematográfica de: ${refinedPrompt}. Estilo de fantasia sombria, arte de alta qualidade, iluminação dramática, D&D.`,
            count: 1, // Gerar uma imagem
            mime_type: "image/jpeg"
        });

        const firstImage = result.response.images?.[0];

        if (!firstImage || !firstImage.image) {
            throw new Error("A API não retornou dados de imagem válidos.");
        }
        
        // A imagem vem em base64, então criamos a data URI
        const imageUrl = `data:image/jpeg;base64,${firstImage.image}`;

        return { imageUrl };

    } catch (error: any) {
        console.error(`[aiImageService] Erro ao gerar imagem:`, error);
        if (error.message.includes('API key not valid')) {
            throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
        }
        if (error.message.includes('404 Not Found')) {
            throw createError(404, `O modelo de imagem '${model}' não foi encontrado ou não está disponível para sua chave.`);
        }
        throw createError(502, `Falha na comunicação com o serviço de geração de imagem: ${error.message}`);
    }
};
