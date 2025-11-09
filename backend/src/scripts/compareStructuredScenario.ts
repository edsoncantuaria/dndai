import { GoogleGenAI } from '@google/genai';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';
import { env } from '../config/env.js';
import { GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA } from '../schemas/gameMasterResponseGenerativeSchema.js';
import { GAME_MASTER_SCHEMA_HASH } from '../services/schemaIntegrityService.js';
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';

type PromptLogFile = {
  payload: {
    prompt: string;
    generationConfig?: Record<string, any>;
  };
  systemInstruction?: string;
};

type ScenarioDefinition = {
  label: string;
  request: any;
};

type ScenarioExecutionResult = {
  label: string;
  request: RequestSummary;
  response?: ResponseSummary;
  error?: SerializedError;
};

type RequestSummary = {
  model: string;
  responseMimeType?: string;
  responseJsonSchemaHash?: string;
  responseJsonSchemaTitle?: string;
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  topP?: number;
  topK?: number;
  userPromptLength: number;
  userPromptPreview: string;
  systemInstructionLength?: number;
  systemInstructionPreview?: string;
};

type ResponseSummary = {
  responseId?: string;
  modelVersion?: string;
  finishReason?: string;
  text: string;
  parsedJson?: unknown;
  parseError?: string;
};

type SerializedError = {
  message: string;
  stack?: string;
};

const run = async () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const args = process.argv.slice(2);
  const modelName = args.find(arg => !arg.startsWith('--')) ?? 'gemini-2.5-flash';
  const promptLogArg = args.find(arg => arg.startsWith('--prompt-log='));
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const promptLogPath = promptLogArg ? resolve(process.cwd(), promptLogArg.split('=')[1]) : undefined;
  const defaultOutputPath = resolve(
    process.cwd(),
    `logs/ai/compare-structured-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  const outputPath = outputArg ? resolve(process.cwd(), outputArg.split('=')[1]) : defaultOutputPath;

  console.log(`[compare-structured] Modelo alvo: ${modelName}`);
  if (!promptLogPath) {
    console.warn('[compare-structured] Nenhum --prompt-log fornecido. Use --prompt-log=logs/ai/XYZ-prompt.json');
    process.exit(1);
  }

  const promptLog = loadPromptLog(promptLogPath);
  const ai = new GoogleGenAI({ apiKey });

  const scenarios: ScenarioDefinition[] = [
    {
      label: 'Cenário 4 (script)',
      request: buildScenarioFourRequest(modelName),
    },
    {
      label: 'Prompt Log (aiService)',
      request: buildRequestFromPromptLog(promptLog, modelName),
    },
  ];

  const results: ScenarioExecutionResult[] = [];
  for (const scenario of scenarios) {
    const result = await executeScenario(ai, scenario);
    results.push(result);
  }

  writeReport({
    outputPath,
    promptLogPath,
    modelName,
    results,
  });
};

const buildScenarioFourRequest = (model: string) => ({
  model,
  contents: [
    {
      role: 'user',
      parts: [{ text: buildRealPrompt() }],
    },
  ],
  systemInstruction: {
    role: 'system',
    parts: [{ text: buildFullSystemInstruction() }],
  },
  config: {
    responseMimeType: 'application/json',
    responseJsonSchema: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA,
    responseModalities: ['TEXT'],
    temperature: 0.4,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: 8192,
    stopSequences: ['```', '[FIM_JSON]'],
  },
});

const buildRequestFromPromptLog = (logFile: PromptLogFile, model: string) => {
  if (!logFile.payload?.prompt) {
    throw new Error('Prompt log não possui payload.prompt');
  }
  const contents = [
    {
      role: 'user',
      parts: [{ text: logFile.payload.prompt }],
    },
  ];
  const request: any = {
    model,
    contents,
    config: sanitizeGenerationConfig(logFile.payload.generationConfig ?? {}),
  };
  if (logFile.systemInstruction) {
    request.systemInstruction = {
      role: 'system',
      parts: [{ text: logFile.systemInstruction }],
    };
  }
  return request;
};

const sanitizeGenerationConfig = (config: Record<string, any>) => {
  const cloned = { ...config };
  if (cloned.responseSchema && !cloned.responseJsonSchema) {
    cloned.responseJsonSchema = cloned.responseSchema;
    delete cloned.responseSchema;
  }
  if (typeof cloned.maxOutputTokens !== 'number') {
    cloned.maxOutputTokens = 8192;
  }
  if (!Array.isArray(cloned.responseModalities)) {
    cloned.responseModalities = ['TEXT'];
  }
  return cloned;
};

const executeScenario = async (ai: GoogleGenAI, scenario: ScenarioDefinition): Promise<ScenarioExecutionResult> => {
  console.log(`\n[compare-structured] Executando: ${scenario.label}`);
  try {
    const response = await ai.models.generateContent(scenario.request);
    const text = logResponse(scenario.label, response);
    const summary: ScenarioExecutionResult = {
      label: scenario.label,
      request: summarizeRequest(scenario.request),
      response: summarizeResponse(response, text),
    };
    return summary;
  } catch (error: any) {
    console.error(`[compare-structured] Erro no cenário ${scenario.label}:`, error);
    return {
      label: scenario.label,
      request: summarizeRequest(scenario.request),
      error: serializeError(error),
    };
  }
};

const logResponse = (label: string, response: any) => {
  const text = typeof response?.text === 'function' ? response.text() : response?.text ?? '';
  console.log(`[compare-structured] Resposta (${label}):`);
  console.log(text);
  try {
    const parsed = JSON.parse(text);
    console.log('[compare-structured] JSON parseado com sucesso:', parsed);
  } catch (error) {
    console.error('[compare-structured] Falha ao parsear JSON:', error);
  }
  return text;
};

const loadPromptLog = (filePath: string): PromptLogFile => {
  const data = readFileSync(filePath, 'utf8');
  return JSON.parse(data) as PromptLogFile;
};

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

const summarizeRequest = (request: any): RequestSummary => {
  const config = request?.config ?? {};
  const systemInstructionText = extractPartsText(request?.systemInstruction?.parts);
  const userPrompt = extractPartsText(request?.contents?.flatMap((entry: any) => entry?.parts ?? []));
  const schemaHash = config?.responseJsonSchema
    ? hashString(JSON.stringify(config.responseJsonSchema))
    : undefined;

  return {
    model: request?.model ?? 'unknown',
    responseMimeType: config?.responseMimeType,
    responseJsonSchemaHash: schemaHash,
    responseJsonSchemaTitle: config?.responseJsonSchema?.title,
    maxOutputTokens: config?.maxOutputTokens,
    temperature: config?.temperature,
    stopSequences: config?.stopSequences,
    topP: config?.topP,
    topK: config?.topK,
    userPromptLength: userPrompt.length,
    userPromptPreview: buildPreview(userPrompt),
    systemInstructionLength: systemInstructionText ? systemInstructionText.length : undefined,
    systemInstructionPreview: systemInstructionText ? buildPreview(systemInstructionText) : undefined,
  };
};

const summarizeResponse = (response: any, text: string): ResponseSummary => {
  const candidate = Array.isArray(response?.candidates) ? response.candidates[0] : undefined;
  let parsed: unknown;
  let parseError: string | undefined;
  if (text && text.trim().length) {
    try {
      parsed = JSON.parse(text);
    } catch (error: any) {
      parseError = String(error?.message ?? error);
    }
  }
  return {
    responseId: response?.responseId,
    modelVersion: response?.modelVersion,
    finishReason: candidate?.finishReason,
    text,
    parsedJson: parsed,
    parseError,
  };
};

const extractPartsText = (parts: any[] | undefined): string => {
  if (!Array.isArray(parts) || parts.length === 0) return '';
  return parts
    .map(part => {
      if (typeof part === 'string') return part;
      if (part?.text) return String(part.text);
      return '';
    })
    .filter(Boolean)
    .join('\n');
};

const buildPreview = (text: string, limit: number = 240) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
};

const hashString = (value: string) => createHash('sha256').update(value).digest('hex');

const serializeError = (error: any): SerializedError => ({
  message: typeof error?.message === 'string' ? error.message : String(error),
  stack: typeof error?.stack === 'string' ? error.stack : undefined,
});

const writeReport = ({
  outputPath,
  promptLogPath,
  modelName,
  results,
}: {
  outputPath: string;
  promptLogPath: string;
  modelName: string;
  results: ScenarioExecutionResult[];
}) => {
  const payload = {
    generatedAt: new Date().toISOString(),
    modelName,
    promptLogPath,
    schemaHash: GAME_MASTER_SCHEMA_HASH,
    scenarios: results,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[compare-structured] Relatório salvo em ${outputPath}`);
};

run().catch(error => {
  console.error('[compare-structured] Erro ao executar comparação:', error);
  process.exit(1);
});
