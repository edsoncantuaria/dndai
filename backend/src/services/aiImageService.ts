// backend/src/services/aiImageService.ts
import createError from 'http-errors';
import minioClient from '../database/minio-client.js';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

interface GenerateImageInput {
    prompt: string;
    model: string; // Embora o modelo esteja fixo no exemplo, mantemos para futura flexibilidade
    apiKey: string;
    sessionId?: string | number;
}

interface GenerateImageOutput {
    imageUrl: string;
}

export const generateImage = async ({ prompt, model, apiKey, sessionId }: GenerateImageInput): Promise<GenerateImageOutput> => {
    if (!apiKey) {
        throw createError(401, 'A chave de API do Google não foi fornecida.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const imageGenerationModel = genAI.getGenerativeModel({ model: "imagen-3.0-generate-002" });

        console.log(`[aiImageService] Gerando imagem com o modelo: imagen-3.0-generate-002`);

        // A nova API retorna um buffer diretamente
        const result = await imageGenerationModel.generateContent(prompt);
        const response = result.response;
        const imagePart = response.candidates?.[0]?.content.parts[0];

        if (!imagePart || !('inlineData' in imagePart)) {
             console.error('Resposta da API de imagem inesperada:', response);
            throw new Error(`A API não retornou dados de imagem válidos.`);
        }
        
        const imageData = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType;

        const imageBuffer = Buffer.from(imageData, 'base64');
        const bucketName = process.env.MINIO_BUCKET_NAME || 'cfa';
        const fileExtension = mimeType.split('/')[1] || 'jpeg';
        
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
