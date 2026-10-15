#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const BRIDGE_URL = (process.env.IMAGE_BRIDGE_URL || 'https://wbhk.cloudive.com.br').replace(/\/$/, '');
const BRIDGE_SECRET = process.env.IMAGE_BRIDGE_SECRET || '';

async function bridgeFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (BRIDGE_SECRET) headers['X-Bridge-Secret'] = BRIDGE_SECRET;

  const res = await fetch(`${BRIDGE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

function formatJob(job) {
  if (!job) return 'Job não encontrado.';
  const lines = [
    `id: ${job.id}`,
    `status: ${job.status}`,
    `prompt: ${job.prompt}`,
    `createdAt: ${job.createdAt}`,
  ];
  if (job.url) lines.push(`url: ${job.url}`);
  if (job.publicUrl && job.publicUrl !== job.url) lines.push(`publicUrl: ${job.publicUrl}`);
  if (job.absolutePath) lines.push(`path: ${job.absolutePath}`);
  if (job.completedAt) lines.push(`completedAt: ${job.completedAt}`);
  return lines.join('\n');
}

const server = new Server(
  { name: 'cursor-image-bridge', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'bridge_health',
      description: 'Verifica se o Image Bridge está acessível via túnel (wbhk.cloudive.com.br → localhost:8881).',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'request_image',
      description:
        'Cria um job de imagem pendente no bridge (túnel wbhk). App externo gera e POST /jobs/:id/complete. Imagem em ~/.cursor/image-bridge/output/.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Descrição da imagem a gerar' },
          filename: { type: 'string', description: 'Nome do arquivo opcional (ex: hero-tavern.png)' },
          aspect_ratio: {
            type: 'string',
            enum: ['1:1', '16:9', '9:16', '4:3', '3:2'],
            default: '16:9',
          },
          media_type: {
            type: 'string',
            enum: ['image', 'video'],
            default: 'image',
            description: 'image = foto; video = o app no AI Studio deve devolver videoBase64',
          },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'get_image_job',
      description: 'Consulta status de um job (pending | ready).',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'UUID do job retornado por request_image' },
        },
        required: ['job_id'],
      },
    },
    {
      name: 'list_pending_jobs',
      description: 'Lista jobs aguardando geração/upload (para o app ouvinte no túnel).',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'wait_image_job',
      description:
        'Aguarda job ficar ready (poll no bridge). Use após request_image quando o app externo completa o upload.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: { type: 'string' },
          timeout_seconds: { type: 'number', default: 300 },
          poll_interval_seconds: { type: 'number', default: 3 },
        },
        required: ['job_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'bridge_health') {
      const data = await bridgeFetch('/health');
      return {
        content: [{ type: 'text', text: JSON.stringify({ bridgeUrl: BRIDGE_URL, ...data }, null, 2) }],
      };
    }

    if (name === 'request_image') {
      const prompt = z.object({
        prompt: z.string().min(1),
        filename: z.string().optional(),
        aspect_ratio: z.string().optional(),
        media_type: z.enum(['image', 'video']).optional(),
      }).parse(args || {});

      const data = await bridgeFetch('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.prompt,
          filename: prompt.filename,
          aspectRatio: prompt.aspect_ratio || '16:9',
          mediaType: prompt.media_type || 'image',
        }),
      });
      return {
        content: [
          {
            type: 'text',
            text: [
              'Job criado. Aguardando app externo completar via túnel.',
              formatJob(data.job),
              `completeUrl: ${data.completeUrl || `${BRIDGE_URL}/jobs/${data.job?.id}/complete`}`,
            ].join('\n'),
          },
        ],
      };
    }

    if (name === 'get_image_job') {
      const { job_id } = z.object({ job_id: z.string().uuid() }).parse(args || {});
      const data = await bridgeFetch(`/jobs/${job_id}`);
      return { content: [{ type: 'text', text: formatJob(data.job) }] };
    }

    if (name === 'list_pending_jobs') {
      const data = await bridgeFetch('/jobs/pending');
      const summary = (data.jobs || [])
        .map((j) => `- ${j.id} (${j.createdAt}): ${j.prompt.slice(0, 80)}…`)
        .join('\n');
      return {
        content: [
          {
            type: 'text',
            text: data.count
              ? `${data.count} pendente(s):\n${summary}`
              : 'Nenhum job pendente.',
          },
        ],
      };
    }

    if (name === 'wait_image_job') {
      const { job_id, timeout_seconds, poll_interval_seconds } = z
        .object({
          job_id: z.string().uuid(),
          timeout_seconds: z.number().default(300),
          poll_interval_seconds: z.number().default(3),
        })
        .parse(args || {});

      const deadline = Date.now() + timeout_seconds * 1000;
      while (Date.now() < deadline) {
        const data = await bridgeFetch(`/jobs/${job_id}`);
        if (data.job?.status === 'ready') {
          return {
            content: [
              {
                type: 'text',
                text: `Imagem pronta.\n${formatJob(data.job)}`,
              },
            ],
          };
        }
        await new Promise((r) => setTimeout(r, poll_interval_seconds * 1000));
      }
      throw new Error(`Timeout após ${timeout_seconds}s — job ainda pending`);
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Erro: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
