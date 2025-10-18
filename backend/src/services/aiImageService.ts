// backend/src/services/aiImageService.ts
import { GoogleGenerativeAI, FileData } from "@google/generative-ai";
import createError from 'http-errors';
import minioClient from '../database/minio-client.js';
import { v4 as uuidv4 } from 'uuid';
import { streamToBuffer } from "../utils/streamUtils.js";

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
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // CORREÇÃO: Usar o modelo 'imagen-3.0-generate-002' que suporta API Key.
        const imageModel = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' });
        
        const generationPrompt = `Uma pintura digital cinematográfica e detalhada de fantasia: ${prompt}. Estilo de arte épico, dramático, com iluminação atmosférica.`;

        // A API para modelos 'imagen' é diferente.
        const result = await imageModel.generateContent(generationPrompt);
        
        const response = result.response;
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => !!p.fileData) as (FileData | undefined);

        if (!imagePart || !imagePart.fileData) {
            console.error('Resposta da API de imagem inesperada (modelo Imagen):', JSON.stringify(response, null, 2));
            throw new Error("A API não retornou dados de imagem válidos.");
        }
        
        const { mimeType, fileUri } = imagePart.fileData;
        
        // A API do Imagen retorna uma URI assinada para download. Precisamos buscar essa URI.
        const imageResponse = await fetch(fileUri);
        if (!imageResponse.ok || !imageResponse.body) {
            throw new Error(`Falha ao baixar a imagem gerada da URI: ${imageResponse.statusText}`);
        }
        
        const imageBuffer = await streamToBuffer(imageResponse.body);
        const bucketName = process.env.MINIO_BUCKET_NAME || 'cfa';
        const fileExtension = mimeType.split('/')[1] || 'png';
        
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
