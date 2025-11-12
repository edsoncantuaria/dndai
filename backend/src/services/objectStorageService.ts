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
  MINIO_ENABLED,
} = process.env;

const bucketName = MINIO_BUCKET_NAME || 'chronicles';
const isMinioEnabled = (MINIO_ENABLED ?? 'true').toLowerCase() !== 'false';
const hasCredentials = Boolean(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY);

const minioClient =
  isMinioEnabled && hasCredentials
    ? new Client({
        endPoint: MINIO_ENDPOINT!,
        port: MINIO_PORT ? Number(MINIO_PORT) : 443,
        useSSL: MINIO_USE_SSL !== 'false',
        accessKey: MINIO_ACCESS_KEY!,
        secretKey: MINIO_SECRET_KEY!,
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
  if (!isMinioEnabled) {
    const message = 'Armazenamento de objetos desabilitado via MINIO_ENABLED=false.';
    console.warn(`[objectStorage] ${message}`);
    return { ok: true, message };
  }

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

interface UploadBinaryOptions {
  prefix?: string;
  contentType?: string;
  filename?: string;
  extension?: string;
}

export const uploadBinaryObject = async (
  buffer: Buffer,
  { prefix = 'assets', contentType = 'application/octet-stream', extension, filename }: UploadBinaryOptions = {}
): Promise<{ key: string; url: string | null; size: number; contentType: string }> => {
  if (!buffer?.length || !minioClient) {
    throw new Error('Armazenamento de objetos não configurado.');
  }
  const ready = await ensureBucket();
  if (!ready) {
    throw new Error('Não foi possível preparar o bucket MinIO.');
  }

  const safeExt =
    extension ??
    (filename && filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1) : undefined);
  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExt ? `.${safeExt}` : ''}`;

  await minioClient.putObject(bucketName, key, buffer, {
    'Content-Type': contentType,
  });

  return {
    key,
    url: getObjectUrl(key),
    size: buffer.length,
    contentType,
  };
};

export const deleteObject = async (key?: string | null) => {
  if (!key || !minioClient) return;
  const ready = await ensureBucket();
  if (!ready) return;
  try {
    await minioClient.removeObject(bucketName, key);
  } catch (error) {
    console.warn('[objectStorage] Falha ao remover objeto do MinIO:', error);
  }
};

export const fetchObjectAsText = async (key?: string | null): Promise<string | null> => {
  if (!key || !minioClient) return null;
  const ready = await ensureBucket();
  if (!ready) return null;
  return new Promise(resolve => {
    minioClient.getObject(bucketName, key, (err, dataStream) => {
      if (err || !dataStream) {
        console.warn('[objectStorage] Falha ao recuperar objeto do MinIO:', err);
        return resolve(null);
      }
      const chunks: Buffer[] = [];
      dataStream.on('data', chunk => chunks.push(chunk));
      dataStream.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
      dataStream.on('error', streamErr => {
        console.warn('[objectStorage] Erro durante leitura do objeto MinIO:', streamErr);
        resolve(null);
      });
    });
  });
};
