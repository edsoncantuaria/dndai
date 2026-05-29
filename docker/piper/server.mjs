#!/usr/bin/env node
/**
 * API HTTP mínima para o Piper (uso em Docker).
 * POST /synthesize { "text": "...", "voice": "faber", "lengthScale": 2.5 } → audio/wav
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 5500);
const PIPER_BIN = process.env.PIPER_BIN ?? '/opt/piper/piper/piper';
const DEFAULT_VOICE = process.env.PIPER_DEFAULT_VOICE ?? 'faber';
const MAX_CHARS = Number(process.env.PIPER_MAX_CHARACTERS ?? 600);
/** Fallback global quando o cliente não envia lengthScale. */
const DEFAULT_LENGTH_SCALE = Number(process.env.PIPER_LENGTH_SCALE ?? 1.0);

const VOICES = {
  faber: '/models/pt_BR-faber-medium.onnx',
  razo: '/models/pt-BR-razo-medium.onnx',
  miro: '/models/miro_pt-BR.onnx',
  dii: '/models/dii_pt-BR.onnx',
};

const sanitizeText = (text) => {
  const trimmed = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (MAX_CHARS > 0 && trimmed.length > MAX_CHARS) {
    return `${trimmed.slice(0, MAX_CHARS)}…`;
  }
  return trimmed;
};

const resolveVoiceModel = (voiceId) => {
  const key = String(voiceId ?? DEFAULT_VOICE).toLowerCase();
  return VOICES[key] ?? VOICES[DEFAULT_VOICE] ?? VOICES.faber;
};

const resolveLengthScale = (bodyScale) => {
  const n = Number(bodyScale);
  if (!Number.isNaN(n) && n > 0) return n;
  if (!Number.isNaN(DEFAULT_LENGTH_SCALE) && DEFAULT_LENGTH_SCALE > 0) return DEFAULT_LENGTH_SCALE;
  return 2.5;
};

const runPiper = (text, outputFile, modelPath, lengthScale) =>
  new Promise((resolve, reject) => {
    const args = ['--model', modelPath, '--output_file', outputFile, '--length_scale', String(lengthScale)];
    const child = spawn(PIPER_BIN, args, { stdio: ['pipe', 'inherit', 'inherit'] });
    child.stdin.write(text);
    child.stdin.end();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Piper exited with code ${code}`));
        return;
      }
      resolve();
    });
  });

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      if (!VOICES.faber) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('PIPER_MODEL not configured');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, voices: Object.keys(VOICES) }));
      return;
    }

    if (req.method === 'POST' && req.url === '/synthesize') {
      const body = await readJsonBody(req);
      const text = sanitizeText(body.text);
      if (!text) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('text required');
        return;
      }
      const modelPath = resolveVoiceModel(body.voice);
      const lengthScale = resolveLengthScale(body.lengthScale);
      const outputFile = path.join(tmpdir(), `piper-${randomUUID()}.wav`);
      await runPiper(text, outputFile, modelPath, lengthScale);
      const buffer = await readFile(outputFile);
      await unlink(outputFile).catch(() => {});
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'X-Piper-Voice': String(body.voice ?? DEFAULT_VOICE),
        'X-Piper-Length-Scale': String(lengthScale),
      });
      res.end(buffer);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (error) {
    console.error('[piper-http]', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('synthesis failed');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[piper-http] listening on :${PORT} voices=${Object.keys(VOICES).join(',')}`);
});
