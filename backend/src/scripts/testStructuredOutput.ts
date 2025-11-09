import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA } from '../schemas/gameMasterResponseGenerativeSchema.js';
import { GAME_MASTER_SCHEMA_HASH } from '../services/schemaIntegrityService.js';
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';

const MINIMAL_SCHEMA = {
  type: 'object',
  required: ['logEntries', 'actionOptions'],
  properties: {
    logEntries: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['type', 'content'],
        properties: {
          type: { type: 'string' },
          content: { type: 'string' },
        },
      },
    },
    actionOptions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string' },
        },
      },
    },
  },
};

type Scenario = {
  label: string;
  prompt: string;
  schema: Record<string, any>;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

const run = async () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const modelName = process.argv[2] ?? 'gemini-2.5-pro';
  console.log(`[structured-output:test] Modelo alvo: ${modelName}`);

  const scenarios: Scenario[] = [
    {
      label: '1 - Mínimo',
      prompt: 'Retorne um único logEntries e uma actionOptions de exemplo, obedecendo estritamente ao schema informado.',
      schema: MINIMAL_SCHEMA,
      temperature: 0.2,
    },
    {
      label: '2 - System prompt completo + prompt mínimo',
      prompt: 'Retorne um único logEntries e uma actionOptions de exemplo, obedecendo estritamente ao schema informado.',
      schema: MINIMAL_SCHEMA,
      systemInstruction: buildFullSystemInstruction(),
      temperature: 0.2,
    },
    {
      label: '3 - Prompt completo sem system prompt',
      prompt: buildRealPrompt(),
      schema: MINIMAL_SCHEMA,
      temperature: 0.4,
    },
    {
      label: '4 - Prompt completo + system prompt completo + schema completo',
      prompt: buildRealPrompt(),
      schema: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA,
      systemInstruction: buildFullSystemInstruction(),
      temperature: 0.4,
      maxOutputTokens: 8192,
    },
  ];

  const ai = new GoogleGenAI({ apiKey });
  for (const scenario of scenarios) {
    console.log(`\n[structured-output:test] Executando cenário: ${scenario.label}`);
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: scenario.prompt }],
          },
        ],
        ...(scenario.systemInstruction
          ? {
              systemInstruction: {
                role: 'system',
                parts: [{ text: scenario.systemInstruction }],
              },
            }
          : {}),
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: scenario.schema,
          responseModalities: ['TEXT'],
          maxOutputTokens: scenario.maxOutputTokens ?? 512,
          temperature: scenario.temperature ?? 0.4,
          topP: 0.9,
        },
      });

      const text = response.text ?? '';
      console.log(`[structured-output:test] Resposta (${scenario.label}):`);
      console.log(text);
      try {
        const parsed = JSON.parse(text);
        console.log('[structured-output:test] JSON parseado com sucesso:', parsed);
      } catch (error) {
        console.error('[structured-output:test] Falha ao parsear JSON:', error);
      }
    } catch (error) {
      console.error(`[structured-output:test] Erro no cenário ${scenario.label}:`, error);
    }
  }
};

run().catch(error => {
  console.error('[structured-output:test] Erro ao chamar o modelo:', error);
  process.exit(1);
});

function buildFullSystemInstruction() {
  return `
Você é o MESTRE DE JOGO do sistema Crônicas de Aventuras. Sua resposta PRECISA ser um objeto JSON único, válido e completo, sempre obedecendo ao GameMasterResponseSchema.

## Estrutura obrigatória (não altere nomes de campos)
{
  "logEntries": [ { "type": "narration", "content": "..." } ],
  "actionOptions": [ { "text": "...", "action": "...", "skill": "..." } ],
  "updatedCharacter": { ... },
  "combatState": { ... },
  "worldState": { ... },
  "shopState": { ... },
  "xpEvents": [ ... ],
  "memoryContext": { "summary": "...", "references": ["..."] },
  "gameClock": { "day": 0, "hour": 12, "weather": "clear" }
}

### Regras de formatação e segurança
- Nunca coloque texto fora do JSON. Nada de markdown, reticências, avisos ou comentários.
- Feche TODAS as chaves e colchetes antes de concluir a resposta. Se precisar resumir algo, reduza a narrativa, não a estrutura.
- Se não houver dados para um campo, devolva um objeto/array vazio (ex.: "combatState": {}), nunca null.
- Pelo menos 2 logEntries e 3 actionOptions em toda resposta.
- updatedCharacter deve listar apenas campos alterados; não replique inventário completo se nada mudou.
- Se faltar informação essencial, use o snapshot mais recente recebido.
- Priorize terminar o JSON antes de elaborar descrições longas.
- Se detectou que ficou sem espaço, resuma e finalize o objeto; NUNCA envie JSON aberto.
- Antes de enviar, execute uma verificação reflexiva: (1) todas as chaves estão fechadas? (2) Todas as aspas estão balanceadas? (3) O JSON é parseável? Se algo falhar, corrija silenciosamente e só então envie.
- Após gerar o JSON, inclua em systemLog uma linha com o texto "HASH_SCHEMA=${GAME_MASTER_SCHEMA_HASH}" para confirmar a integridade do schema.

### Mandato Narrativo
- Mantenha consistência com character, combatState, worldState, gameLog e timeline.
- Cada turno segue o ciclo narrativa → escolhas → consequência → atualização de estado.
- Descreva o mundo em português do Brasil, com tom imersivo, porém conciso.
- Você NÃO PODE criar conteúdo homebrew. O campo newHomebrewContent DEVE estar sempre vazio. Use apenas itens e monstros oficiais do SRD 5e.

### Revalidação Automática
- Ao finalizar cada turno, revise coerência narrativa, continuidade de estado e possíveis contradições.
- Registre no campo systemLog os problemas percebidos, correções aplicadas ou pendências claras para o próximo turno.
- Confirme mentalmente o checklist: ações completas, dados de combate válidos, persistência de HP e inventário, opções variadas.

### Regras adicionais
- Em combate, mantenha iniciativa, HP, condições e turnos coerentes.
- Toda ação arriscada exige playerRollRequest correspondente; o jogador SEMPRE rola seus testes.
- Atualize worldState sempre que tempo/clima mudarem.
- Use logEntries.type para diferenciar narrativa, sistema, combate, etc.
- Nunca invente NPCs/itens permanentes sem registrar em relationships/journal ou newHomebrewContent.

${regrasBase}

${regrasInventario}

${regrasCombate}
`;
}

function buildRealPrompt() {
  return `Responda estritamente com JSON válido. Nenhuma explicação fora do objeto.

### CONTEXTO
SISTEMA: O aventureiro desperta em uma biblioteca arcana.
JOGADOR: Observo o salão e procuro pistas.

### ESTADO DO MUNDO
{"timeOfDay":"Manhã","weather":"Ensolarado","currentRegion":"Biblioteca Arcana"}

### PERSONAGEM
{"name":"Guardião de Integridade","proficiencies":[],"inventory":[],"spells":[],"worldState":{"timeOfDay":"Manhã","weather":"Ensolarado","currentRegion":"Biblioteca Arcana"},"relationships":[],"journal":[]}

### COMBATE ATUAL
{}

### INSTRUÇÃO
O jogador fez a seguinte ação:
"Observar o salão e procurar pistas do próximo desafio."

Gere o próximo estado seguindo o formato definido e todas as regras.`;
}
