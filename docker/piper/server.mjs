#!/usr/bin/env node
/**
 * API HTTP mínima para o Piper (uso em Docker).
 * POST /synthesize { "text": "..." } → audio/wav
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 5500);
const PIPER_BIN = process.env.PIPER_BIN ?? '/opt/piper/piper';
const PIPER_MODEL = process.env.PIPER_MODEL ?? '';
const MAX_CHARS = Number(process.env.PIPER_MAX_CHARACTERS ?? 600);
const LENGTH_SCALE = Number(process.env.PIPER_LENGTH_SCALE ?? 1.15);

const sanitizeText = (text) => {
  const trimmed = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (MAX_CHARS > 0 && trimmed.length > MAX_CHARS) {
    return `${trimmed.slice(0, MAX_CHARS)}…`;
  }
  return trimmed;
};

const runPiper = (text, outputFile) =>
  new Promise((resolve, reject) => {
    const args = ['--model', PIPER_MODEL, '--output_file', outputFile];
    if (!Number.isNaN(LENGTH_SCALE) && LENGTH_SCALE > 0) {
      args.push('--length_scale', String(LENGTH_SCALE));
    }
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
      if (!PIPER_MODEL) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('PIPER_MODEL not configured');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
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
      const outputFile = path.join(tmpdir(), `piper-${randomUUID()}.wav`);
      await runPiper(text, outputFile);
      const buffer = await readFile(outputFile);
      await unlink(outputFile).catch(() => {});
      res.writeHead(200, { 'Content-Type': 'audio/wav' });
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
  console.log(`[piper-http] listening on :${PORT} model=${PIPER_MODEL}`);
});
