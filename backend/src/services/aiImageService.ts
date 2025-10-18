// backend/src/services/aiImageService.ts
import createError from 'http-errors';
import minioClient from '../database/minio-client.js';
import { v4 as uuidv4 } from 'uuid';

// Definindo a interface aqui porque a importação é dinâmica
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
        // Importação dinâmica exatamente como solicitado
        const genAIModule = await import("https://esm.sh/@google/genai@0.15.0");
        const GoogleGenerativeAI = genAIModule.GoogleGenerativeAI;
        const Modality = genAIModule.Modality;

        const genAI = new GoogleGenerativeAI(apiKey);

        const response = await genAI.models.generateContent({
            model: model, // Usa o modelo passado como parâmetro
            contents: prompt, // Usa o prompt diretamente
            config: { 
                responseModalities: [Modality.TEXT, Modality.IMAGE] 
            }
        });

        // Extrai a parte da imagem da resposta
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!imagePart || !('inlineData' in imagePart) || !imagePart.inlineData) {
            console.error('Resposta da API de imagem inesperada:', JSON.stringify(response, null, 2));
            const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
            const blockReason = response.promptFeedback?.blockReason;
            if (blockReason) {
                 throw new Error(`A geração de imagem foi bloqueada. Motivo: ${blockReason}`);
            }
            throw new Error(`A API não retornou dados de imagem válidos. Resposta de texto recebida: "${textPart || 'Nenhuma'}"`);
        }
        
        const imageData = imagePart.inlineData;
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
        if (error.message && error.message.includes('API key not valid')) {
            throw createError(401, 'Sua chave de API do Google não é válida. Verifique-a nas configurações.');
        }
        if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
            throw createError(429, 'Você excedeu seu limite de uso da API de imagem. Por favor, tente novamente mais tarde.');
        }
        throw createError(502, `Falha no processo de geração de imagem: ${error.message}`);
    }
};
