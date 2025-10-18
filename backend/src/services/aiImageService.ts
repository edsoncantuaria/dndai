// backend/src/services/aiImageService.ts
import createError from 'http-errors';
import minioClient from '../database/minio-client.js';
import { v4 as uuidv4 } from 'uuid';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import 'dotenv/config';

// Inicializa uma instância do Genkit para este serviço
const ai = genkit({
    plugins: [googleAI()],
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});

interface GenerateImageInput {
    prompt: string;
    model: string;
    apiKey: string;
    sessionId?: string | number;
}

interface GenerateImageOutput {
    imageUrl: string;
}

export const generateImage = async ({ prompt, model, apiKey, sessionId }: GenerateImageInput): Promise<GenerateImageOutput> => {
    if (!apiKey) {
        throw createError(401, 'Chave de API do Google não fornecida.');
    }

    try {
        console.log(`[aiImageService] Gerando imagem com o modelo: ${model}`);

        const { media } = await ai.generate({
            model: googleAI.model(model),
            prompt: prompt,
            apiKey: apiKey,
            output: { format: 'media' }, // Solicita a saída como mídia
        });

        if (!media || !media.url || !media.contentType) {
            console.error('Resposta da API de imagem inesperada:', media);
            throw new Error(`A API não retornou dados de imagem válidos.`);
        }
        
        const imageData = media.url; // A URL já é uma data URI base64
        const mimeType = media.contentType;
        const imageBuffer = Buffer.from(imageData.substring(imageData.indexOf(',') + 1), 'base64');
        const bucketName = process.env.MINIO_BUCKET_NAME || 'cfa';
        const fileExtension = mimeType.split('/')[1] || 'png';
        
        const objectPath = sessionId ? `sessions/${sessionId}` : 'general';
        const objectName = `${objectPath}/${uuidv4()}.${fileExtension}`;

        if (!minioClient) {
            throw createError(503, 'Serviço de armazenamento de arquivos (MinIO) não está configurado.');
        }

        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            console.log(`[MinIO] Bucket ${bucketName} criado com sucesso.`);
        }

        await minioClient.putObject(bucketName, objectName, imageBuffer, imageBuffer.length, {
            'Content-Type': mimeType
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
        if (error.message && error.message.includes('API key not valid')) {
            throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
        }
        if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
            throw createError(429, 'Você excedeu seu limite de uso da API de imagem. Por favor, tente novamente mais tarde.');
        }
        throw createError(502, `Falha no processo de geração de imagem: ${error.message}`);
    }
};
