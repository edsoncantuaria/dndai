// backend/src/services/aiImageService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import createError from 'http-errors';
import minioClient from '../database/minio-client.js';
import { v4 as uuidv4 } from 'uuid';

interface GenerateImageInput {
    prompt: string;
    model: string; 
    apiKey: string;
    sessionId?: string | number; // Adicionado sessionId opcional
}

interface GenerateImageOutput {
    imageUrl: string;
}

export const generateImage = async ({ prompt, model, apiKey, sessionId }: GenerateImageInput): Promise<GenerateImageOutput> => {
    if (!apiKey) {
        throw createError(401, 'Chave de API do Google não fornecida.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const imageModel = genAI.getGenerativeModel({ model });

        const generationPrompt = `Uma pintura digital cinematográfica e detalhada de fantasia: ${prompt}. Estilo de arte épico, dramático, com iluminação atmosférica.`;

        const result = await imageModel.generateContent(generationPrompt);
        const response = await result.response;
        
        const firstPart = response.candidates?.[0]?.content?.parts?.[0];
        if (!firstPart || !('inlineData' in firstPart) || !firstPart.inlineData) {
            console.error('Resposta da API de imagem inesperada:', JSON.stringify(response, null, 2));
            throw new Error("A API não retornou dados de imagem válidos.");
        }
        
        const imageData = firstPart.inlineData;
        const imageBuffer = Buffer.from(imageData.data, 'base64');
        const bucketName = process.env.MINIO_BUCKET_NAME || 'cfa';
        const fileExtension = imageData.mimeType.split('/')[1] || 'png';
        
        const objectPath = sessionId ? `sessions/${sessionId}` : 'general';
        const objectName = `${objectPath}/${uuidv4()}.${fileExtension}`;

        if (!minioClient) {
            throw createError(503, 'Serviço de armazenamento de arquivos não está configurado.');
        }

        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            console.log(`[MinIO] Bucket ${bucketName} criado com sucesso.`);
        }

        await minioClient.putObject(bucketName, objectName, imageBuffer, imageBuffer.length, {
            'Content-Type': imageData.mimeType
        });
        
        const useSSL = process.env.MINIO_USE_SSL === 'true';
        const port = process.env.MINIO_PORT;
        const endpoint = process.env.MINIO_ENDPOINT;
        
        const protocol = useSSL ? 'https' : 'http';
        const portString = (useSSL && port === '443') || (!useSSL && port === '80') || !port ? '' : `:${port}`;
        
        const imageUrl = `${protocol}://${endpoint}${portString}/${bucketName}/${objectName}`;

        return { imageUrl };

    } catch (error: any) {
        console.error(`[aiImageService] Erro ao gerar e fazer upload da imagem:`, error);
        if (error.message.includes('API key not valid')) {
            throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
        }
        if (error.message.includes('404 Not Found')) {
            throw createError(404, `O modelo de imagem '${model}' não foi encontrado ou não está disponível para sua chave.`);
        }
        throw createError(502, `Falha no processo de geração de imagem: ${error.message}`);
    }
};
