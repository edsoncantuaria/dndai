// backend/src/services/objectStorageService.ts
import { Client } from 'minio';
import { randomUUID } from 'crypto';

const {
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_PUBLIC_ENDPOINT,
  MINIO_PUBLIC_PORT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
  MINIO_BUCKET_NAME,
  MINIO_ENABLED,
  MINIO_SIGNED_URL_TTL,
} = process.env;

const bucketName = MINIO_BUCKET_NAME || 'chronicles';
const isMinioEnabled = (MINIO_ENABLED ?? 'true').toLowerCase() !== 'false';
const hasCredentials = Boolean(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY);
const signedUrlTtlSeconds = Math.max(60, Number(MINIO_SIGNED_URL_TTL ?? 60 * 60)); // default 1 hora

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

const resolvePublicHost = () => MINIO_PUBLIC_ENDPOINT?.trim() || MINIO_ENDPOINT;
const resolvePublicPort = () => {
  const raw = MINIO_PUBLIC_PORT?.trim() || MINIO_PORT;
  return raw ? Number(raw) : undefined;
};

const buildObjectBaseUrl = (host: string, port?: number) => {
  const scheme = MINIO_USE_SSL === 'false' ? 'http' : 'https';
  const portSuffix = port && port !== 80 && port !== 443 ? `:${port}` : '';
  return `${scheme}://${host}${portSuffix}`;
};

const buildDirectObjectUrl = (key: string) => {
  const host = resolvePublicHost();
  const port = resolvePublicPort();
  return `${buildObjectBaseUrl(host!, port)}/${bucketName}/${key}`;
};

/** Reescreve host/porta de URLs assinadas para acesso pelo browser (ex.: minio → localhost). */
const rewriteUrlForPublicAccess = (url: string): string => {
  if (!MINIO_ENDPOINT) return url;
  const publicHost = resolvePublicHost();
  const internalPort = MINIO_PORT ? Number(MINIO_PORT) : undefined;
  const publicPort = resolvePublicPort();
  const internalBase = buildObjectBaseUrl(MINIO_ENDPOINT, internalPort);
  const publicBase = buildObjectBaseUrl(publicHost!, publicPort);
  if (internalBase === publicBase) return url;
  return url.split(internalBase).join(publicBase);
};

export const getObjectUrl = (key: string) => {
  if (!minioClient) return null;
  return buildDirectObjectUrl(key);
};

const presignObject = (key: string, expiresInSeconds: number) =>
  new Promise<string>((resolve, reject) => {
    if (!minioClient) return reject(new Error('MinIO client indisponível.'));
    minioClient.presignedGetObject(bucketName, key, expiresInSeconds, (err, url) => {
      if (err || !url) return reject(err ?? new Error('URL assinada vazia.'));
      resolve(url);
    });
  });

export const getSignedObjectUrl = async (key: string, expiresInSeconds = signedUrlTtlSeconds) => {
  if (!minioClient) return null;
  const ready = await ensureBucket();
  if (!ready) return null;
  try {
    const signed = await presignObject(key, expiresInSeconds);
    return rewriteUrlForPublicAccess(signed);
  } catch (error) {
    console.warn(`[objectStorage] Falha ao gerar URL assinada para ${key}:`, error);
    return buildDirectObjectUrl(key);
  }
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

  const signedUrl = await getSignedObjectUrl(key).catch(() => null);

  return {
    key,
    url: signedUrl ?? getObjectUrl(key),
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

export type StoredObjectPayload = {
    buffer: Buffer;
    contentType: string;
    size: number;
};

export const fetchObjectBuffer = async (key?: string | null): Promise<StoredObjectPayload | null> => {
    if (!key || !minioClient) return null;
    const ready = await ensureBucket();
    if (!ready) return null;

    return new Promise(resolve => {
        minioClient!.statObject(bucketName, key, (statErr, stat) => {
            if (statErr || !stat) {
                console.warn('[objectStorage] Objeto não encontrado:', key, statErr);
                return resolve(null);
            }
            minioClient!.getObject(bucketName, key, (err, dataStream) => {
                if (err || !dataStream) {
                    console.warn('[objectStorage] Falha ao ler objeto:', key, err);
                    return resolve(null);
                }
                const chunks: Buffer[] = [];
                dataStream.on('data', chunk => chunks.push(chunk as Buffer));
                dataStream.on('end', () => {
                    resolve({
                        buffer: Buffer.concat(chunks),
                        contentType: stat.metaData?.['content-type'] ?? stat.metaData?.['Content-Type'] ?? 'application/octet-stream',
                        size: stat.size,
                    });
                });
                dataStream.on('error', streamErr => {
                    console.warn('[objectStorage] Erro na leitura do stream:', streamErr);
                    resolve(null);
                });
            });
        });
    });
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
