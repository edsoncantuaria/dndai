// scripts/diagnoseBackendConnection.js
import https from 'https';
import fetch from 'node-fetch';

const TARGET = process.env.TEST_API_BASE_URL || 'https://backend-5e.edsin-server.space';
const TIMEOUT_MS = 8000;

const TEST_PATHS = [
  '/api/data/races',
  '/api/data/classes',
  '/api/data/spells',
  '/api/data/equipment',
  '/api/data/monsters',
  '/api/auth/login',
];

async function testFetch(endpoint) {
  const url = `${TARGET}${endpoint}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      // Simula navegador com headers típicos
      headers: {
        'Origin': 'https://6000-firebase-studio-1758579208514.cluster-udxxdyopu5c7cwhhtg6mmadhvs.cloudworkstations.dev/',
        'User-Agent': 'API-Diagnostic-Tool/1.0',
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeout);
    const duration = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      console.log(`❌ [${res.status}] ${url} (${duration}ms)`);
      if (res.status === 403 || res.status === 401) console.log('   ↳ ⚠️ Possível problema com autenticação ou CORS.');
      else console.log('   ↳ Conteúdo da resposta:', text.slice(0, 120));
      return { url, status: res.status, ok: false, time: duration };
    }

    const type = res.headers.get('content-type');
    console.log(`✅ ${url} (${duration}ms) - ${type}`);
    return { url, status: res.status, ok: true, time: duration };
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`💀 Falha ao acessar ${url} (${duration}ms): ${err.message}`);

    if (err.type === 'aborted') console.log('   ↳ ⏱ Timeout — servidor demorou demais.');
    if (err.code === 'ECONNREFUSED') console.log('   ↳ 🚫 Conexão recusada — servidor offline.');
    if (err.code === 'ENOTFOUND') console.log('   ↳ 🌐 DNS inválido — domínio não resolvido.');
    if (err.message.includes('self-signed')) console.log('   ↳ 🔒 Certificado SSL autoassinado — navegador bloqueia por segurança.');
    if (err.message.includes('certificate')) console.log('   ↳ ❌ Problema de certificado HTTPS (expirado ou inválido).');
    if (err.message.includes('CORS')) console.log('   ↳ ⚠️ Bloqueio CORS detectado.');

    return { url, ok: false, error: err.message, time: duration };
  }
}

async function testCertificate() {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(TARGET);

    const req = https.request({
      host: url.hostname,
      port: 443,
      method: 'HEAD',
      rejectUnauthorized: false, // ignora erro de certificado
    }, (res) => {
      const cert = res.socket.getPeerCertificate();
      const now = new Date();
      const exp = new Date(cert.valid_to);

      const expDays = Math.round((exp - now) / (1000 * 60 * 60 * 24));

      console.log('\n🔒 Certificado SSL:');
      console.log('   Emitido para:', cert.subject?.CN || '(desconhecido)');
      console.log('   Válido até:', exp.toISOString());
      console.log(`   Expira em ${expDays} dias.`);

      if (expDays < 5) console.log('   ⚠️ Certificado expirando em breve!');
      if (res.statusCode >= 400) console.log(`   ⚠️ Respondeu status ${res.statusCode}`);

      resolve();
    });

    req.on('error', (err) => {
      console.error('   ❌ Falha ao verificar certificado SSL:', err.message);
      resolve();
    });

    req.end();
  });
}

async function runDiagnostics() {
  console.log('🧭 Diagnóstico de conexão com backend D&D API unificada');
  console.log(`   Alvo: ${TARGET}`);
  console.log('---');

  await testCertificate();

  console.log('\n🌐 Testando rotas principais...');
  for (const path of TEST_PATHS) {
    await testFetch(path);
  }

  console.log('\n✅ Diagnóstico concluído.');
  console.log('Se houver erros 💀 ou ❌, verifique os logs acima.');
}

runDiagnostics();
