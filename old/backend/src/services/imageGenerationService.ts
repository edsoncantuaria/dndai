import { env } from '../config/env.js';
import { uploadBinaryObject, getSignedObjectUrl } from './objectStorageService.js';

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_IMAGE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;
const IMAGE_FEATURE_ENABLED = (process.env.ENABLE_IMAGE_GENERATION ?? '').toLowerCase() === 'true';

export type GeneratedImage = {
  key: string;
  url: string | null;
  size: number;
  contentType: string;
};

const resolveApiKey = (providedKey?: string | null) => {
  const normalized = providedKey?.trim();
  if (normalized) return normalized;
  const fromEnv = env.GEMINI_API_KEY?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : null;
};

const isImageServiceEnabled = (apiKey?: string) =>
  IMAGE_FEATURE_ENABLED && Boolean(resolveApiKey(apiKey));

const pickFileExtension = (mimeType?: string | null) => {
  if (!mimeType) return 'png';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
};

export const generateSceneImage = async (prompt: string, apiKey?: string): Promise<GeneratedImage | null> => {
  if (!IMAGE_FEATURE_ENABLED) {
    console.info('[imageGenerationService] Geração de imagens desabilitada.');
    return null;
  }
  const resolvedKey = resolveApiKey(apiKey);
  if (!resolvedKey) {
    console.warn('[imageGenerationService] Chave de API não configurada; não é possível gerar imagens.');
    return null;
  }
  if (!prompt || !prompt.trim()) {
    console.warn('[imageGenerationService] Prompt vazio para geração de imagem.');
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_IMAGE_ENDPOINT}?key=${resolvedKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt.trim() }],
          },
        ],
      }),
    });
  } catch (error) {
    console.error('[imageGenerationService] Falha ao chamar Gemini Image API:', error);
    throw new Error('Falha na chamada à API do Gemini.');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => null);
    console.error('[imageGenerationService] Erro da API do Gemini:', response.status, errorText);
    throw new Error(`Gemini Image API retornou status ${response.status}.`);
  }

  const payload = await response.json();
  const inlinePart = payload?.candidates?.[0]?.content?.parts?.find(
    (part: any) => part?.inlineData?.data
  );

  if (!inlinePart?.inlineData?.data) {
    console.error('[imageGenerationService] Resposta sem dados de imagem válidos.');
    throw new Error('Resposta do Gemini não contém imagem.');
  }

  const mimeType = inlinePart.inlineData.mimeType || 'image/png';
  const buffer = Buffer.from(inlinePart.inlineData.data, 'base64');
  const extension = pickFileExtension(mimeType);

  const upload = await uploadBinaryObject(buffer, {
    prefix: 'images',
    contentType: mimeType,
    extension,
  });

  return upload;
};

export const isImageGenerationAvailable = (apiKey?: string) => isImageServiceEnabled(apiKey);

export const getSignedImageUrl = async (key: string) => {
  if (!key) return null;
  return getSignedObjectUrl(key);
};
