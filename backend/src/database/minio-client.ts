// backend/src/database/minio-client.ts
import { Client } from 'minio';
import 'dotenv/config';

const endpoint = process.env.MINIO_ENDPOINT;
const port = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 9000;
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;

let minioClient: Client | null = null;

if (endpoint && accessKey && secretKey) {
    try {
        minioClient = new Client({
            endPoint: endpoint,
            port: port,
            useSSL: useSSL,
            accessKey: accessKey,
            secretKey: secretKey
        });
        console.log(`[MinIO] Cliente configurado para o endpoint: ${endpoint}:${port}`);
    } catch (error) {
        console.error("[MinIO] Falha ao criar o cliente MinIO:", error);
    }
} else {
    console.warn("AVISO: Credenciais do MinIO não estão completamente definidas no .env. O upload de arquivos estará desabilitado.");
}

export default minioClient;
