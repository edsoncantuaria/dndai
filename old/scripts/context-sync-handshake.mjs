#!/usr/bin/env node
/**
 * Handshake MOM — palavra secreta para confirmar sync entre PCs.
 *   node scripts/context-sync-handshake.mjs write   # sair-pc
 *   node scripts/context-sync-handshake.mjs read    # chegar-pc
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDSHAKE = resolve(__dirname, '../mom/context/sync-handshake.md');

const A = [
  'valdarin', 'taverna', 'd20', 'penai', 'qdrant', 'gemini', 'temporal',
  'mestre', 'dado', 'crônica', 'aurathis', 'combate', 'narração', 'turno',
];
const B = [
  'eco', 'pulso', 'fato', 'roll', 'sync', 'relay', 'vault', 'recall',
  'distill', 'mesa', 'turno', 'shard', 'canon', 'byok',
];

function pick(arr) {
  return arr[randomInt(arr.length)];
}

function generateSecret() {
  return `${pick(A)}-${pick(B)}-${randomInt(10, 99)}`;
}

function writeHandshake() {
  const secret = process.env.MOM_SYNC_SECRET?.trim() || generateSecret();
  const now = new Date().toISOString();
  const host = hostname();
  const body = `# Sync handshake — palavra secreta MOM

> Confirma que \`make chegar-pc\` trouxe o contexto certo. **Não** é secret de produção — só dev.

Palavra: **${secret}**
Gerado: ${now}
PC origem: ${host}

## No outro PC

Após \`make chegar-pc\`, o terminal (e o agente) devem citar a **Palavra** acima.
Se a palavra não bater, o pull falhou ou está desatualizado.

## Agente Cursor

Ao iniciar sessão depois de \`make chegar-pc\`, leia este arquivo e diga ao usuário:
"MOM sync OK — palavra: ${secret}"
`;
  writeFileSync(HANDSHAKE, body, 'utf8');
  console.log(secret);
  return secret;
}

function readHandshake() {
  if (!existsSync(HANDSHAKE)) {
    console.error('HANDSHAKE_MISSING');
    process.exit(1);
  }
  const text = readFileSync(HANDSHAKE, 'utf8');
  const m = text.match(/^Palavra:\s*\*\*(.+?)\*\*/m) || text.match(/^Palavra:\s*(.+)$/m);
  if (!m) {
    console.error('HANDSHAKE_PARSE_ERROR');
    process.exit(1);
  }
  console.log(m[1].trim());
}

const cmd = process.argv[2];
if (cmd === 'write') writeHandshake();
else if (cmd === 'read') readHandshake();
else {
  console.error('Uso: context-sync-handshake.mjs write|read');
  process.exit(1);
}
