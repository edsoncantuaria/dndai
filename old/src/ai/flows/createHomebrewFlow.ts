// src/ai/flows/createHomebrewFlow.ts
'use server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { EXAMPLES } from '@/data/examples';
import { HomebrewContentType, HomebrewSourceKind } from '@/services/homebrewService';

const HomebrewTypeSchema = z.enum([
  'race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat',
]);

const CreateHomebrewInputSchema = z.object({
  prompt: z.string().describe('A descrição em linguagem natural do conteúdo a ser criado.'),
  type: HomebrewTypeSchema.describe('O tipo de conteúdo homebrew a ser gerado.'),
  apiKey: z.string().optional().describe('A chave de API para o Google AI.'),
  sourceKind: z.enum(['original', 'translation', 'fork']).optional().default('original'),
  sourceResource: z.string().optional().nullable(),
  sourceIndex: z.string().optional().nullable(),
  srdBase: z.record(z.any()).optional().nullable(),
  locale: z.string().optional().default('pt-BR'),
});

const CreateHomebrewOutputSchema = z.object({
  content: z.any().describe('Objeto JSON no padrão 5e-srd-api.'),
});

export async function createHomebrewContent(
  input: z.infer<typeof CreateHomebrewInputSchema>,
): Promise<{ content: any } | null> {
  return createHomebrewFlow(input);
}

const TRANSLATABLE_HINT: Record<string, string[]> = {
  spells: ['name', 'desc', 'material', 'higher_level', 'casting_time', 'range', 'duration'],
  races: ['name', 'desc', 'age', 'alignment', 'language_desc', 'size_description'],
  equipment: ['name', 'desc', 'special', 'contents'],
  monsters: ['name', 'desc', 'actions', 'legendary_actions', 'special_abilities'],
};

function buildSystemPrompt(
  type: HomebrewContentType,
  sourceKind: HomebrewSourceKind,
  sourceResource: string | null | undefined,
  srdBase: Record<string, unknown> | null | undefined,
  locale: string,
): string {
  const exampleJson = EXAMPLES[type as keyof typeof EXAMPLES]
    ? JSON.stringify(EXAMPLES[type as keyof typeof EXAMPLES], null, 2)
    : '{}';

  const srdSection = srdBase
    ? `\nRecurso oficial SRD (${sourceResource ?? type}/${String(srdBase.index ?? '')}):\n\`\`\`json\n${JSON.stringify(srdBase, null, 2)}\n\`\`\`\n`
    : '';

  if (sourceKind === 'translation' && srdBase) {
    const fields = TRANSLATABLE_HINT[sourceResource ?? ''] ?? ['name', 'desc'];
    return `
      Você traduz conteúdo D&D 5e para ${locale}, mantendo o schema da 5e-srd-api.
      Retorne APENAS JSON válido, sem markdown.
      Traduza somente: ${fields.join(', ')}.
      Mantenha index e official_index iguais ao SRD (${String(srdBase.index ?? '')}).
      Preserve todos os campos mecânicos (level, damage, AC, etc.) sem alterar valores numéricos ou estruturas de referência.
      ${srdSection}
      Exemplo de estrutura para '${type}':
      ${exampleJson}
    `;
  }

  if (sourceKind === 'fork' && srdBase) {
    return `
      Você cria uma variante (fork) homebrew baseada em um recurso oficial D&D 5e.
      Retorne APENAS JSON válido, sem markdown.
      Use o recurso oficial como base e aplique as modificações pedidas pelo usuário.
      O campo official_index deve ser "${String(srdBase.index ?? '')}".
      O campo index deve ser um slug novo em minúsculas (variante distinta).
      Mantenha compatibilidade com o schema da 5e-srd-api (mesmos tipos de campo).
      ${srdSection}
      Exemplo de estrutura para '${type}':
      ${exampleJson}
    `;
  }

  return `
    Você é especialista em D&D 5e e cria conteúdo homebrew compatível com a 5e-srd-api.
    Retorne APENAS JSON válido, sem markdown.
    O JSON deve ser completo, com todos os campos relevantes para '${type}'.
    Traduza nomes e descrições para ${locale}.
    O campo index deve ser slug em minúsculas separado por hífens.
    Exemplo de estrutura:
    ${exampleJson}
  `;
}

const createHomebrewFlow = ai.defineFlow(
  {
    name: 'createHomebrewFlow',
    inputSchema: CreateHomebrewInputSchema,
    outputSchema: CreateHomebrewOutputSchema,
  },
  async ({ prompt, type, apiKey, sourceKind = 'original', sourceResource, sourceIndex, srdBase, locale = 'pt-BR' }) => {
    const systemPrompt = buildSystemPrompt(type, sourceKind, sourceResource, srdBase ?? null, locale);

    const userPrompt =
      sourceKind === 'translation' && srdBase
        ? `Traduza para ${locale} conforme o pedido:\n"${prompt}"\nTipo: ${type}\nSRD: ${sourceResource}/${sourceIndex ?? srdBase.index}`
        : sourceKind === 'fork' && srdBase
          ? `Crie fork baseado no SRD com estas alterações:\n"${prompt}"\nTipo: ${type}\nSRD: ${sourceResource}/${sourceIndex ?? srdBase.index}`
          : `Gere conteúdo original:\nTipo: ${type}\nPedido: "${prompt}"`;

    const result = await ai.generate({
      model: 'googleai/gemini-1.5-pro',
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        temperature: sourceKind === 'translation' ? 0.3 : 0.5,
        responseMimeType: 'application/json',
      },
      apiKey,
    });

    const jsonText = result.text.trim();

    try {
      const content = JSON.parse(jsonText);
      if (sourceKind === 'translation' && srdBase?.index) {
        content.official_index = String(srdBase.index);
        content.index = String(srdBase.index);
      }
      if (sourceKind === 'fork' && srdBase?.index && !content.official_index) {
        content.official_index = String(srdBase.index);
      }
      return { content };
    } catch (e) {
      console.error('Falha ao analisar JSON da IA:', e, 'Texto recebido:', jsonText);
      throw new Error('A IA retornou uma resposta em formato JSON inválido.');
    }
  },
);
