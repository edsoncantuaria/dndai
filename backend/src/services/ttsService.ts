'use strict';

import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { uploadBinaryObject, isObjectStorageEnabled } from './objectStorageService.js';
import {
    resolveNarrationTtsOptions,
    type NarrationTtsOptions,
    type PiperVoiceId,
} from '../config/narrationTts.js';

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '');
const TTS_KEY_PATTERN = /^tts\/[\w\-./]+$/i;

const PIPER_HTTP_URL = (process.env.PIPER_HTTP_URL ?? 'http://127.0.0.1:5500').replace(/\/$/, '');
const PIPER_HTTP_LOCAL_FALLBACK = 'http://127.0.0.1:5500';
const PIPER_BIN_PATH = process.env.PIPER_BIN_PATH ?? '';
const PIPER_MODEL_PATH = process.env.PIPER_MODEL_PATH ?? '';
const MAX_TTS_LENGTH = Number(process.env.PIPER_MAX_CHARACTERS ?? 600);
/** Fallback quando o cliente não envia lengthScale. */
const LENGTH_SCALE = Number(process.env.PIPER_LENGTH_SCALE ?? (1 / 1.2).toFixed(3));

const hasLocalPiper = Boolean(PIPER_BIN_PATH && PIPER_MODEL_PATH);
const hasHttpPiper = Boolean(PIPER_HTTP_URL);
const isTtsEnabled = Boolean((hasHttpPiper || hasLocalPiper) && isObjectStorageEnabled);

export const getTtsStatus = () => ({
  enabled: isTtsEnabled,
  mode: hasHttpPiper ? 'http' : hasLocalPiper ? 'local' : 'off',
  httpUrl: PIPER_HTTP_URL || undefined,
  bin: PIPER_BIN_PATH || undefined,
  model: PIPER_MODEL_PATH || undefined,
  storageReady: isObjectStorageEnabled,
});

export const describeTtsStatus = () => {
  if (!isTtsEnabled) {
    return 'Desativado (configure PIPER_HTTP_URL ou PIPER_BIN_PATH+PIPER_MODEL_PATH e MinIO).';
  }
  if (hasHttpPiper) {
    return `Ativo · Piper HTTP="${PIPER_HTTP_URL}"`;
  }
  return `Ativo · binário="${PIPER_BIN_PATH}" | modelo="${PIPER_MODEL_PATH}"`;
};

export const isTtsAvailable = () => isTtsEnabled;

export const isValidTtsObjectKey = (key: string): boolean => TTS_KEY_PATTERN.test(key);

/** URL pública do backend para streaming (MinIO fica só na rede interna). */
export const buildTtsPlaybackUrl = (key: string): string => {
  const path = `/v2/tts/audio?key=${encodeURIComponent(key)}`;
  if (API_PUBLIC_URL) {
    return `${API_PUBLIC_URL}${path}`;
  }
  return `/api${path}`;
};

const sanitizeNarrationText = (text: string) => {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (MAX_TTS_LENGTH > 0 && trimmed.length > MAX_TTS_LENGTH) {
    return `${trimmed.slice(0, MAX_TTS_LENGTH)}…`;
  }
  return trimmed;
};

export type SynthesizeNarrationOptions = Partial<NarrationTtsOptions>;

const runPiperHttp = async (text: string, opts: SynthesizeNarrationOptions): Promise<Buffer> => {
  const candidates = [PIPER_HTTP_URL];
  if (PIPER_HTTP_URL.includes('://piper:') && PIPER_HTTP_LOCAL_FALLBACK !== PIPER_HTTP_URL) {
    candidates.push(PIPER_HTTP_LOCAL_FALLBACK);
  }

  let lastError: unknown;
  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'faber',
          lengthScale: opts.lengthScale,
        }),
      });
      if (!response.ok) {
        throw new Error(`Piper HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Piper HTTP indisponível.');
};

const voiceModelPaths: Partial<Record<PiperVoiceId, string>> = {
  faber: process.env.PIPER_MODEL_FABER,
  razo: process.env.PIPER_MODEL_RAZO,
  miro: process.env.PIPER_MODEL_MIRO,
  dii: process.env.PIPER_MODEL_DII,
};

const resolveLocalModelPath = (voice: PiperVoiceId): string =>
  voiceModelPaths[voice]?.trim() || PIPER_MODEL_PATH;

const runPiperLocal = async (text: string, opts: SynthesizeNarrationOptions): Promise<Buffer> => {
  const scale = opts.lengthScale ?? LENGTH_SCALE;
  const modelPath = resolveLocalModelPath(opts.voice ?? 'faber');
  return new Promise((resolve, reject) => {
    const tempFile = path.join(tmpdir(), `piper-${randomUUID()}.wav`);
    const args = ['--model', modelPath, '--output_file', tempFile];
    if (!Number.isNaN(scale) && scale > 0) {
      args.push('--length_scale', scale.toString());
    }
    const child = spawn(PIPER_BIN_PATH, args, {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    child.stdin.write(text);
    child.stdin.end();

    child.on('error', error => reject(error));
    child.on('close', async code => {
      if (code !== 0) {
        return reject(new Error(`Piper exited with code ${code}`));
      }
      try {
        const buffer = await fs.readFile(tempFile);
        await fs.unlink(tempFile).catch(() => {});
        resolve(buffer);
      } catch (error) {
        reject(error);
      }
    });
  });
};

const runPiper = async (text: string, opts: SynthesizeNarrationOptions): Promise<Buffer> => {
  if (hasHttpPiper) {
    return runPiperHttp(text, opts);
  }
  if (hasLocalPiper) {
    return runPiperLocal(text, opts);
  }
  throw new Error('Piper não configurado.');
};

export { resolveNarrationTtsOptions };

export type SynthesizedNarration = {
  key: string;
  url: string | null;
  contentType: string;
};

export type SynthesizeNarrationRequest = Partial<SynthesizeNarrationOptions> & {
  settings?: { narrationVoice?: unknown; narrationSpeed?: unknown } | null;
};

export const synthesizeNarrationAudio = async (
  text: string,
  request?: SynthesizeNarrationRequest,
): Promise<SynthesizedNarration | null> => {
  if (!isTtsEnabled) return null;
  const safeText = sanitizeNarrationText(text);
  if (!safeText) return null;
  const fromSettings = resolveNarrationTtsOptions(request?.settings);
  const synthOpts: SynthesizeNarrationOptions = {
    voice: request?.voice ?? fromSettings.voice,
    lengthScale: request?.lengthScale ?? fromSettings.lengthScale,
    playbackRate: request?.playbackRate ?? fromSettings.playbackRate,
  };
  try {
    console.log(
      `[ttsService] Piper voice=${synthOpts.voice} length_scale=${synthOpts.lengthScale} (${safeText.length} chars).`,
    );
    const buffer = await runPiper(safeText, synthOpts);
    const upload = await uploadBinaryObject(buffer, {
      prefix: 'tts',
      contentType: 'audio/wav',
      extension: 'wav',
    });
    console.log(`[ttsService] Áudio sintetizado (${buffer.length} bytes, ${safeText.length} chars).`);
    return {
      key: upload.key,
      url: buildTtsPlaybackUrl(upload.key),
      contentType: upload.contentType,
    };
  } catch (error) {
    console.warn('[ttsService] Falha ao sintetizar narração:', error);
    return null;
  }
};
