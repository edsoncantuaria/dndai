'use strict';

import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { uploadBinaryObject, isObjectStorageEnabled } from './objectStorageService.js';

const PIPER_BIN_PATH = process.env.PIPER_BIN_PATH ?? '';
const PIPER_MODEL_PATH = process.env.PIPER_MODEL_PATH ?? '';
const MAX_TTS_LENGTH = Number(process.env.PIPER_MAX_CHARACTERS ?? 600);
const LENGTH_SCALE = Number(process.env.PIPER_LENGTH_SCALE ?? 1.15);

const isTtsEnabled = Boolean(PIPER_BIN_PATH && PIPER_MODEL_PATH && isObjectStorageEnabled);

export const getTtsStatus = () => ({
  enabled: isTtsEnabled,
  bin: PIPER_BIN_PATH,
  model: PIPER_MODEL_PATH,
  storageReady: isObjectStorageEnabled,
});

export const describeTtsStatus = () => {
  if (!isTtsEnabled) {
    return 'Desativado (verifique PIPER_BIN_PATH, PIPER_MODEL_PATH e armazenamento de objetos).';
  }
  return `Ativo · binário="${PIPER_BIN_PATH}" | modelo="${PIPER_MODEL_PATH}"`;
};

export const isTtsAvailable = () => isTtsEnabled;

const sanitizeNarrationText = (text: string) => {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (MAX_TTS_LENGTH > 0 && trimmed.length > MAX_TTS_LENGTH) {
    return `${trimmed.slice(0, MAX_TTS_LENGTH)}…`;
  }
  return trimmed;
};

const runPiper = async (text: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(tmpdir(), `piper-${randomUUID()}.wav`);
    const args = ['--model', PIPER_MODEL_PATH, '--output_file', tempFile];
    if (!Number.isNaN(LENGTH_SCALE) && LENGTH_SCALE > 0) {
      args.push('--length_scale', LENGTH_SCALE.toString());
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

export type SynthesizedNarration = {
  key: string;
  url: string | null;
  contentType: string;
};

export const synthesizeNarrationAudio = async (text: string): Promise<SynthesizedNarration | null> => {
  if (!isTtsEnabled) return null;
  const safeText = sanitizeNarrationText(text);
  if (!safeText) return null;
  try {
    console.log(`[ttsService] Iniciando síntese Piper (${safeText.length} caracteres).`);
    const buffer = await runPiper(safeText);
    const upload = await uploadBinaryObject(buffer, {
      prefix: 'tts',
      contentType: 'audio/wav',
      extension: 'wav',
    });
    console.log(`[ttsService] Áudio sintetizado (${buffer.length} bytes, ${safeText.length} chars).`);
    return upload;
  } catch (error) {
    console.warn('[ttsService] Falha ao sintetizar narração:', error);
    return null;
  }
};
