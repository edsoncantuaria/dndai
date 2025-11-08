// backend/src/services/objectStorageService.ts
import { Client } from 'minio';
import { randomUUID } from 'crypto';

const {
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
  MINIO_BUCKET_NAME,
} = process.env;

const bucketName = MINIO_BUCKET_NAME || 'chronicles';

const minioClient =
  MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY
    ? new Client({
        endPoint: MINIO_ENDPOINT,
        port: MINIO_PORT ? Number(MINIO_PORT) : 443,
        useSSL: MINIO_USE_SSL !== 'false',
        accessKey: MINIO_ACCESS_KEY,
        secretKey: MINIO_SECRET_KEY,
      })
    : null;

let bucketPrepared = false;

const ensureBucket = async () => {
  if (!minioClient) return false;
  if (bucketPrepared) return true;
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, '');
    }
    bucketPrepared = true;
    return true;
  } catch (error) {
    console.error('[objectStorage] Não foi possível preparar o bucket MinIO:', error);
    return false;
  }
};

export const isObjectStorageEnabled = !!minioClient;

export const checkObjectStorageHealth = async (): Promise<{ ok: boolean; message: string }> => {
  if (!minioClient) {
    const message = 'Cliente MinIO não configurado. Variáveis de ambiente ausentes.';
    console.warn(`[objectStorage] ${message}`);
    return { ok: false, message };
  }

  const ready = await ensureBucket();
  if (!ready) {
    const message = 'Não foi possível preparar o bucket padrão.';
    console.error(`[objectStorage] ${message}`);
    return { ok: false, message };
  }

  try {
    await minioClient.listBuckets();
    const message = `Conexão com MinIO verificada com sucesso (bucket "${bucketName}").`;
    console.log(`[objectStorage] ${message}`);
    return { ok: true, message };
  } catch (error) {
    const message = `Falha ao validar credenciais do MinIO: ${(error as Error).message}`;
    console.error(`[objectStorage] ${message}`, error);
    return { ok: false, message };
  }
};

interface OffloadOptions {
  prefix?: string;
  contentType?: string;
}

export const offloadLargePayload = async (
  rawContent: string,
  { prefix = 'logs', contentType = 'application/json' }: OffloadOptions = {}
): Promise<string | null> => {
  if (!rawContent || !minioClient) return null;
  const ready = await ensureBucket();
  if (!ready) return null;

  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.json`;
  try {
    const buffer = Buffer.from(rawContent, 'utf8');
    await minioClient.putObject(bucketName, key, buffer, {
      'Content-Type': contentType,
    });
    return JSON.stringify({
      storage: 's3',
      provider: 'minio',
      bucket: bucketName,
      key,
      contentType,
      size: buffer.length,
    });
  } catch (error) {
    console.error('[objectStorage] Falha ao enviar payload para o MinIO:', error);
    return null;
  }
};

export const getObjectUrl = (key: string) => {
  if (!minioClient) return null;
  return `${MINIO_USE_SSL === 'false' ? 'http' : 'https'}://${MINIO_ENDPOINT}/${bucketName}/${key}`;
};
