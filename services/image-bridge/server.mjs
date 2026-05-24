import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  OUTPUT_DIR,
  ensureDirs,
  json,
  loadJobs,
  readJsonBody,
  saveJobs,
  checkSecret,
  slugify,
} from './lib.mjs';

const PORT = Number(process.env.IMAGE_BRIDGE_PORT || 8881);
const SECRET = process.env.IMAGE_BRIDGE_SECRET || '';
const PUBLIC_BASE = (process.env.IMAGE_BRIDGE_PUBLIC_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');

function unauthorized(res) {
  json(res, 401, { error: 'Unauthorized', hint: 'Set header X-Bridge-Secret' });
}

function parsePath(url) {
  return new URL(url, 'http://localhost').pathname;
}

async function handleComplete(jobId, body, store) {
  const job = store.jobs[jobId];
  if (!job) return { status: 404, body: { error: 'Job not found' } };
  if (job.status === 'ready') {
    return { status: 200, body: { job, message: 'Already completed' } };
  }

  const isVideo = job.mediaType === 'video' || body.videoBase64 || body.video_base64;
  const b64 = isVideo
    ? body.videoBase64 || body.video_base64
    : body.imageBase64 || body.image_base64;
  if (!b64 || typeof b64 !== 'string') {
    return {
      status: 400,
      body: { error: isVideo ? 'videoBase64 is required' : 'imageBase64 is required' },
    };
  }

  const buffer = Buffer.from(
    b64.replace(/^data:(image|video)\/[\w+.-]+;base64,/, ''),
    'base64',
  );
  if (buffer.length < 100) {
    return { status: 400, body: { error: 'Invalid media data' } };
  }

  const mime = String(body.mimeType || '');
  let ext = 'png';
  if (isVideo) {
    ext = mime.includes('webm') ? 'webm' : 'mp4';
  } else if (mime.includes('jpeg') || mime.includes('jpg')) {
    ext = 'jpg';
  } else if (mime.includes('webp')) {
    ext = 'webp';
  }
  const filename =
    job.filename || `${slugify(job.prompt)}-${jobId.slice(0, 8)}.${ext}`;
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '-');
  const absolutePath = path.join(OUTPUT_DIR, safeName);
  await fs.writeFile(absolutePath, buffer);

  job.status = 'ready';
  job.completedAt = new Date().toISOString();
  job.filename = safeName;
  job.absolutePath = absolutePath;
  job.url = `${PUBLIC_BASE}/files/${safeName}`;
  job.publicUrl = job.url;

  await saveJobs(store);
  return { status: 200, body: { job } };
}

const dashboardHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Cursor Image Bridge</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f12; color: #e8e6e3; padding: 1.5rem; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 1.25rem; }
    .job { border: 1px solid #333; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    pre { white-space: pre-wrap; background: #1a1a22; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; }
    code { color: #c9a227; }
    .meta { color: #888; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>Image Bridge — jobs pendentes</h1>
  <p class="meta">Tunnel: <code>https://wbhk.cloudive.com.br</code> → localhost:__PORT__</p>
  <div id="list">Carregando…</div>
  <script>
    fetch('/jobs/pending').then(r => r.json()).then(d => {
      const el = document.getElementById('list');
      if (!d.jobs?.length) { el.innerHTML = '<p>Nenhum job pendente.</p>'; return; }
      el.innerHTML = d.jobs.map(j => \`
        <div class="job">
          <div class="meta">\${j.id} · \${j.createdAt}</div>
          <pre>\${j.prompt.replace(/</g,'&lt;')}</pre>
          <p>Complete: <code>POST /jobs/\${j.id}/complete</code></p>
        </div>\`).join('');
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Secret',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  const pathname = parsePath(req.url);

  if (pathname === '/health' && req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'cursor-image-bridge',
      port: PORT,
      tunnel: 'https://wbhk.cloudive.com.br',
      outputDir: OUTPUT_DIR,
    });
  }

  if (!checkSecret(req, SECRET)) {
    return unauthorized(res);
  }

  try {
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(dashboardHtml.replace('__PORT__', String(PORT)));
    }

    const store = await loadJobs();

    if (pathname === '/jobs' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || '').trim();
      if (!prompt) return json(res, 400, { error: 'prompt is required' });

      const id = randomUUID();
      const job = {
        id,
        prompt,
        filename: body.filename ? path.basename(String(body.filename)) : null,
        mediaType: body.mediaType || body.media_type || 'image',
        aspectRatio: body.aspectRatio || body.aspect_ratio || '16:9',
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
        url: null,
        absolutePath: null,
      };
      store.jobs[id] = job;
      await saveJobs(store);
      return json(res, 201, {
        job,
        completeUrl: `${PUBLIC_BASE}/jobs/${id}/complete`,
        hint: 'POST imageBase64 to completeUrl when image is ready',
      });
    }

    if (pathname === '/jobs/pending' && req.method === 'GET') {
      const jobs = Object.values(store.jobs)
        .filter((j) => j.status === 'pending')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return json(res, 200, { jobs, count: jobs.length });
    }

    const jobMatch = pathname.match(/^\/jobs\/([^/]+)$/);
    if (jobMatch && req.method === 'GET') {
      const job = store.jobs[jobMatch[1]];
      if (!job) return json(res, 404, { error: 'Job not found' });
      return json(res, 200, { job });
    }

    const completeMatch = pathname.match(/^\/jobs\/([^/]+)\/complete$/);
    if (completeMatch && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await handleComplete(completeMatch[1], body, store);
      return json(res, result.status, result.body);
    }

    const fileMatch = pathname.match(/^\/files\/([^/]+)$/);
    if (fileMatch && req.method === 'GET') {
      const safe = path.basename(fileMatch[1]);
      const filePath = path.join(OUTPUT_DIR, safe);
      try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(safe).toLowerCase();
        const mimeByExt = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
        };
        const mime = mimeByExt[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
        return res.end(data);
      } catch {
        return json(res, 404, { error: 'File not found' });
      }
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    json(res, 500, { error: err.message || 'Internal error' });
  }
});

await ensureDirs();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Image Bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`Tunnel target: https://wbhk.cloudive.com.br → localhost:${PORT}`);
  console.log(`Output dir: ${OUTPUT_DIR}`);
  if (SECRET) console.log('Auth: X-Bridge-Secret required');
});
