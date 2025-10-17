// src/ai/flows/createHomebrewFlow.ts
'use server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { EXAMPLES } from '@/data/examples';
import { HomebrewContentType } from '@/services/homebrewService';

const CreateHomebrewInputSchema = z.object({
  prompt: z.string().describe('A descrição em linguagem natural do conteúdo a ser criado.'),
  type: z.enum(['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'])
    .describe('O tipo de conteúdo homebrew a ser gerado.'),
  apiKey: z.string().optional().describe('A chave de API para o Google AI.'),
});

const CreateHomebrewOutputSchema = z.object({
  content: z.any().describe('O objeto JSON completo representando o conteúdo homebrew gerado, aderindo à estrutura da API 5e.')
});

const createHomebrewFlow = ai.defineFlow(
  {
    name: 'createHomebrewFlow',
    inputSchema: CreateHomebrewInputSchema,
    outputSchema: CreateHomebrewOutputSchema,
  },
  async ({ prompt, type, apiKey }) => {
    
    const exampleJson = EXAMPLES[type] ? JSON.stringify(EXAMPLES[type], null, 2) : "{}";

    const systemPrompt = `
      Você é um especialista em Dungeons & Dragons 5ª Edição e um assistente de criação de conteúdo (homebrew).
      Sua tarefa é converter um prompt de usuário em um objeto JSON estruturado que segue o schema da API D&D 5e.
      Você DEVE retornar APENAS o objeto JSON, sem nenhum texto, explicação ou markdown (\`\`\`json) ao redor dele.
      
      O JSON deve ser completo e conter todos os campos relevantes para o tipo de conteúdo solicitado, mesmo que você precise inferir alguns valores.
      Use o seguinte exemplo como uma referência de estrutura para um conteúdo do tipo '${type}':

      Exemplo de Estrutura:
      \`\`\`json
      ${exampleJson}
      \`\`\`

      Traduza todos os nomes, descrições e textos para o Português do Brasil.
      O campo 'index' deve ser uma versão em minúsculas e separada por hífens do nome em inglês.
    `;

    const result = await ai.generate({
      model: 'googleai/gemini-1.5-pro',
      prompt: `Gere o conteúdo para o seguinte pedido:\n\nTipo: ${type}\nPrompt: "${prompt}"`,
      config: { 
        temperature: 0.5,
        responseMimeType: "application/json",
       },
      system: systemPrompt,
      apiKey: apiKey,
    });
    
    const jsonText = result.text.trim();
    
    try {
      const content = JSON.parse(jsonText);
      return { content };
    } catch (e) {
      console.error("Falha ao analisar JSON da IA:", e, "Texto recebido:", jsonText);
      throw new Error("A IA retornou uma resposta em formato JSON inválido.");
    }
  }
);

export async function createHomebrewContent(input: z.infer<typeof CreateHomebrewInputSchema>): Promise<{ content: any } | null> {
    try {
        return await createHomebrewFlow(input);
    } catch (error) {
        console.error("Erro no fluxo createHomebrewContent:", error);
        return null;
    }
}
