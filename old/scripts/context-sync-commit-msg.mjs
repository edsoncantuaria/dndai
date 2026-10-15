#!/usr/bin/env node
/**
 * Gera mensagem de commit para context-sync (make sair-pc).
 * Ordem: Cursor Agent (se logado) → Gemini (GEMINI_API_KEY) → heurística local.
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MOM = resolve(ROOT, 'mom');

function loadEnvKey() {
  for (const p of [resolve(ROOT, '.env'), resolve(ROOT, 'backend/.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^(?:export\s+)?GEMINI_API_KEY=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return process.env.GEMINI_API_KEY || '';
}

function git(cmd, cwd = ROOT) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function gatherContext() {
  const momStatus = git('git status --porcelain -- context/ README.md', MOM);
  const rootStatus = git(
    'git status --porcelain -- mom docs/ .cursor/prompts/mom-maintain-context.md .cursor/rules/dndai-mom-context.mdc .cursor/rules/dndai-documentation-architect.mdc .cursor/rules/dndai-documentation-hub.mdc .cursor/skills/dndai-mom-context/ .gitmodules Makefile scripts/context-sync.sh scripts/context-sync-commit-msg.mjs',
  );
  const momDiff = git('git diff --no-color --stat -- context/ README.md', MOM);
  const rootDiff = git(
    'git diff --no-color --stat -- mom docs/ .cursor/prompts/ .cursor/rules/dndai-mom-context.mdc .cursor/rules/dndai-documentation-architect.mdc .cursor/skills/dndai-mom-context/ .gitmodules Makefile scripts/context-sync.sh scripts/context-sync-commit-msg.mjs',
  );

  const files = [...momStatus, ...rootStatus]
    .split('\n')
    .filter(Boolean)
    .map((l) => l.replace(/^\?\?\s+|\s+[MADRCU!?]+\s+/g, ' ').trim())
    .filter((f) => f.length > 0);

  return { momStatus, rootStatus, momDiff, rootDiff, files: [...new Set(files)] };
}

function sanitizeMessage(raw) {
  if (!raw) return '';
  const line = raw
    .split('\n')
    .map((l) => l.replace(/^[-*>\s]+/, '').replace(/`/g, '').trim())
    .find((l) => l.length > 0 && !l.startsWith('#'));
  if (!line) return '';
  const msg = line.replace(/^["']|["']$/g, '').slice(0, 72);
  if (/^(distill|docs):/i.test(msg)) return msg;
  if (/^distill\b/i.test(msg) || /^docs\b/i.test(msg)) return msg;
  return `distill: ${msg}`.slice(0, 72);
}

function buildPrompt(ctx) {
  return `Gere UMA linha de commit git em português (máx 72 chars) para sincronizar contexto de desenvolvimento MOM entre PCs.

Formato obrigatório: distill: … ou docs: …
Sem markdown, sem aspas, sem explicação extra — só a linha do commit.

Arquivos alterados:
${ctx.files.slice(0, 30).join('\n') || '(nenhum listado)'}

Status mom:
${ctx.momStatus || '(limpo)'}

Status dndai:
${ctx.rootStatus || '(limpo)'}

Diff mom (stat):
${ctx.momDiff || '(vazio)'}

Diff dndai (stat):
${ctx.rootDiff || '(vazio)'}`;
}

function heuristic(ctx) {
  const names = ctx.files
    .map((f) => f.replace(/^mom\/context\//, '').replace(/\.md$/, ''))
    .filter((f) => f && !f.endsWith('INDEX'));
  if (names.length === 0) {
    if (ctx.files.some((f) => f.includes('INDEX'))) return 'distill: atualiza INDEX MOM';
    if (ctx.files.some((f) => f.startsWith('docs/'))) return 'docs: atualiza documentação viva';
    return `distill: contexto MOM ${new Date().toISOString().slice(0, 10)}`;
  }
  const slug = names.slice(0, 2).join(', ');
  return `distill: ${slug}`.slice(0, 72);
}

function tryCursorAgent(prompt) {
  try {
    const statusOut = execSync('cursor agent status 2>&1', { encoding: 'utf8' });
    if (!statusOut.includes('Logged in')) return '';
  } catch {
    return '';
  }

  const r = spawnSync(
    'cursor',
    ['agent', '-p', '--mode', 'ask', '--output-format', 'text', prompt],
    { cwd: ROOT, encoding: 'utf8', timeout: 120_000, maxBuffer: 1024 * 1024 },
  );
  if (r.status !== 0) return '';
  return sanitizeMessage(r.stdout || '');
}

async function tryGemini(prompt) {
  const key = loadEnvKey();
  if (!key) return '';

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 80 },
    });
    return sanitizeMessage(result.response.text());
  } catch {
    return '';
  }
}

async function main() {
  const ctx = gatherContext();
  const prompt = buildPrompt(ctx);

  if (!ctx.momStatus && !ctx.rootStatus) {
    const momAhead = git('git rev-list --count @{u}..HEAD 2>/dev/null', MOM);
    const rootAhead = git('git rev-list --count @{u}..HEAD 2>/dev/null', ROOT);
    if ((momAhead && momAhead !== '0') || (rootAhead && rootAhead !== '0')) {
      console.log('distill: sync contexto MOM (commits pendentes)');
      return;
    }
  }

  let msg = tryCursorAgent(prompt);
  if (!msg) msg = await tryGemini(prompt);
  if (!msg) msg = heuristic(ctx);

  console.log(msg);
}

main().catch(() => {
  console.log(`distill: contexto MOM ${new Date().toISOString().slice(0, 10)}`);
  process.exit(0);
});
