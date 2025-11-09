import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA } from '../schemas/gameMasterResponseGenerativeSchema.js';
import { GAME_MASTER_SCHEMA_HASH } from '../services/schemaIntegrityService.js';
import { regrasBase } from '../game/prompts/regrasBase.js';
import { regrasInventario } from '../game/prompts/regrasInventario.js';
import { regrasCombate } from '../game/prompts/regrasCombate.js';
import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { getGameUpdate } from '../services/aiService.js';

type Scenario =
  | {
      label: string;
      mode: 'direct';
      prompt: string;
      schema?: Record<string, any>;
      systemInstruction?: string;
      temperature?: number;
      maxOutputTokens?: number;
      extraConfig?: Record<string, any>;
    }
  | {
      label: string;
      mode: 'service';
    };

const run = async () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const modelName = process.argv[2] ?? 'gemini-2.5-flash';
  console.log(`[structured-output:test2] Modelo alvo: ${modelName}`);

  const scenarios: Scenario[] = [
    {
      label: '4A - Direto (sem stopSequences)',
      mode: 'direct',
      prompt: buildRealPrompt(),
      schema: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA,
      systemInstruction: buildFullSystemInstruction(),
      temperature: 0.4,
      maxOutputTokens: 8192,
      extraConfig: {},
    },
    // {
    //   label: '4B - Direto (com stopSequences)',
    //   mode: 'direct',
    //   prompt: buildRealPrompt(),
    //   schema: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA,
    //   systemInstruction: buildFullSystemInstruction(),
    //   temperature: 0.4,
    //   maxOutputTokens: 8192,
    //   extraConfig: {
    //     stopSequences: ['```', '[FIM_JSON]'],
    //   },
    // },
    {
      label: '4C - aiService (sem stopSequences)',
      mode: 'service',
    },
  ];

  const ai = new GoogleGenAI({ apiKey });
  for (const scenario of scenarios) {
    console.log(`\n[structured-output:test2] Executando cenário: ${scenario.label}`);
    if (scenario.mode === 'service') {
      await runAiServiceScenario(scenario.label, modelName, apiKey);
      continue;
    }

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
        config: cleanConfig({
          responseMimeType: 'application/json',
          ...(scenario.schema ? { responseJsonSchema: scenario.schema } : {}),
          responseModalities: ['TEXT'],
          maxOutputTokens: scenario.maxOutputTokens ?? 512,
          temperature: scenario.temperature ?? 0.4,
          topP: 0.9,
          ...(scenario.extraConfig ?? {}),
        }),
      });

      const text = response.text ?? '';
      console.log(`[structured-output:test2] Resposta (${scenario.label}):`);
      console.log(text);
      console.log('[structured-output:test2] responseId:', response?.responseId);
      console.log('[structured-output:test2] finishReason:', response?.candidates?.[0]?.finishReason);

      if (/^here is the json requested/i.test(text.trim())) {
        console.warn('[structured-output:test2] Resposta fantasma detectada.');
      }

      try {
        const parsed = JSON.parse(text);
        console.log('[structured-output:test2] JSON parseado com sucesso:', parsed);
      } catch (error) {
        console.error('[structured-output:test2] Falha ao parsear JSON:', error);
      }
    } catch (error) {
      console.error(`[structured-output:test2] Erro no cenário ${scenario.label}:`, error);
    }
  }
};

run().catch(error => {
  console.error('[structured-output:test2] Erro ao chamar o modelo:', error);
  process.exit(1);
});

function cleanConfig(config: Record<string, any>) {
  const clone = { ...config };
  if (clone.stopSequences === undefined) {
    delete clone.stopSequences;
  }
  return clone;
}

async function runAiServiceScenario(label: string, modelName: string, apiKey: string) {
  console.log(`[structured-output:test2] (aiService) ${label}`);
  try {
    const baseInput: GameMasterFlowInput = {
      character: createBaseCharacter(),
      playerAction: 'Observar o salão e procurar pistas do próximo desafio.',
      gameLog: 'SISTEMA: O aventureiro desperta em uma biblioteca arcana.\nJOGADOR: Observo o salão e procuro pistas.',
      mode: 'gameplay',
      useAiHomebrew: false,
      enableNarrativeRevalidation: true,
      scenarioLabel: label,
    };

    const generationConfig: GenerationConfig = {
      temperature: 0.4,
      topP: 0.9,
      topK: 32,
      maxOutputTokens: 8192,
    };

    const result = await getGameUpdate(baseInput, modelName, generationConfig, apiKey);
    console.log('[structured-output:test2][aiService] rawText:', result.rawText || '<vazio>');
    console.log('[structured-output:test2][aiService] logEntries count:', result.response?.logEntries?.length ?? 0);
    await runGameplayServiceScenarios(modelName, apiKey);
  } catch (error) {
    console.error('[structured-output:test2][aiService] Erro:', error);
  }
}

async function runGameplayServiceScenarios(modelName: string, apiKey: string) {
  const baseSimulations: { label: string; input: GameMasterFlowInput; generationConfig?: GenerationConfig }[] = [
    {
      label: 'Combate Ativo - Investida',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Avanço contra o cultista líder e o ataco com minha espada longa.',
        gameLog: 'SISTEMA: Um grupo de cultistas apareceu e a luta começou.\nJOGADOR: Preparar ataque.',
        combatState: buildCombatState(true),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Combate Ativo - Investida',
      },
    },
    {
      label: 'Combate Encerrado - Rendição',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Ordeno que o último cultista se renda e encerro o conflito.',
        gameLog: 'SISTEMA: Restou apenas um inimigo assustado.\nJOGADOR: Ordeno rendição.',
        combatState: buildCombatState(true),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Combate Encerrado - Rendição',
      },
    },
    {
      label: 'Loot Pós-Batalha',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Revisto o baú ornamentado para descobrir o que os cultistas guardavam.',
        gameLog: 'SISTEMA: A batalha terminou e um baú permanece no altar.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Loot Pós-Batalha',
      },
    },
    {
      label: 'Shopping - Negociação',
      input: {
        character: {
          ...createBaseCharacter(),
          shopState: {
            isOpen: true,
            isHaggling: false,
            name: 'Empório Arcanum',
            inventory: [],
          },
        },
        playerAction: 'Quero negociar poções de cura com o mercador do Empório Arcanum.',
        gameLog: 'SISTEMA: Você entra em uma loja mágica movimentada.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Shopping - Negociação',
      },
    },
    {
      label: 'Roll Request - Desarmar armadilha',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Tento desarmar cuidadosamente a armadilha rúnica diante de mim.',
        gameLog: 'SISTEMA: Uma armadilha brilhante bloqueia o caminho.\nNPC: “Você está seguro?”',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Roll Request - Desarmar armadilha',
      },
    },
    {
      label: 'Narrativa de Falha/Acerto',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Comunico que rolei um 5 no teste de furtividade; temo que os guardas possam ter me ouvido.',
        gameLog: 'JOGADOR: Rolei 5 no d20 ao tentar me esconder atrás das estantes.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Narrativa de Falha/Acerto',
      },
    },
    {
      label: 'Descanso Curto - Uso de Dados de Vida',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Faço um descanso curto e uso meus dados de vida para recuperar energia.',
        gameLog: 'SISTEMA: Após horas de tensão, o grupo faz uma pausa nas galerias da biblioteca.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Descanso Curto - Uso de Dados de Vida',
      },
    },
    {
      label: 'Combate - Sucesso Crítico',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Informo que rolei 20 no ataque contra o cultista restante.',
        gameLog: 'JOGADOR: Rolei 20 natural ao atacar o cultista.',
        combatState: buildCombatState(true),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Combate - Sucesso Crítico',
      },
    },
    {
      label: 'Combate - Falha Crítica',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Informo que rolei 1 no ataque e temo pelas consequências.',
        gameLog: 'JOGADOR: Rolei 1 ao atacar, minha arma escapou das mãos.',
        combatState: buildCombatState(true),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Combate - Falha Crítica',
      },
    },
    {
      label: 'Conclusão de Quest / XP',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Relato ao patrono que o enigma da biblioteca foi resolvido; solicito minha recompensa.',
        gameLog: 'SISTEMA: O patrono aguarda na entrada, curioso pelos resultados.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Conclusão de Quest / XP',
      },
    },
    {
      label: 'Interação Social - Persuasão',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Tento persuadir o bibliotecário fantasmagórico a liberar acesso à ala secreta.',
        gameLog: 'NPC: "A ala secreta está proibida para mortais."',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Interação Social - Persuasão',
      },
    },
    {
      label: 'Exploração - Passagem Secreta',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Investigo a estante em busca do mecanismo que revela a passagem oculta.',
        gameLog: 'SISTEMA: O pó denuncia marcas recentes perto da estante curva.\nJOGADOR: Procuro chaves ocultas.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Exploração - Passagem Secreta',
      },
    },
    {
      label: 'Downtime - Crafting Alquímico',
      input: {
        character: {
          ...createBaseCharacter(),
          inventory: [
            { name: 'Ervas Luminescentes', quantity: 2 },
            { name: 'Frascos Vazios', quantity: 3 },
          ],
          journal: ['Projeto: Destilar poção detecta-magias avançada.'],
        },
        playerAction: 'Inicio um projeto de alquimia para destilar uma poção experimental.',
        gameLog: 'SISTEMA: O laboratório improvisado vibra com energia arcana.\nJOGADOR: Ajusto o calor do cadinho.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        timelineFacts: 'Dia 5 - Oficina Arcana subterrânea.',
        scenarioLabel: 'Downtime - Crafting Alquímico',
      },
    },
    {
      label: 'Combate - Iniciativa Complexa',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Reorganizo a linha de frente enquanto mantenho pressão nos cultistas.',
        gameLog: 'SISTEMA: O combate escalou com reforços inimigos surgindo das sombras.',
        combatState: {
          isActive: true,
          round: 3,
          turn: 1,
          combatants: [
            {
              id: 'player',
              name: 'Guardião',
              attitude: 'ally',
              hp: { current: 18, max: 27 },
              ac: 16,
              isPlayer: true,
              isDead: false,
              conditions: ['Concentrando'],
            },
            {
              id: 'cultist-1',
              name: 'Cultista Sombrio',
              attitude: 'hostile',
              hp: { current: 6, max: 12 },
              ac: 13,
              isPlayer: false,
              isDead: false,
            },
            {
              id: 'cultist-2',
              name: 'Cultista com Lança',
              attitude: 'hostile',
              hp: { current: 12, max: 12 },
              ac: 14,
              isPlayer: false,
              isDead: false,
              conditions: ['Inspirado'],
            },
            {
              id: 'golem',
              name: 'Golem Vigia',
              attitude: 'ally',
              hp: { current: 30, max: 30 },
              ac: 18,
              isPlayer: false,
              isDead: false,
            },
          ],
          initiativeOrder: ['cultist-2', 'player', 'cultist-1', 'golem'],
        },
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Combate - Iniciativa Complexa',
      },
    },
    {
      label: 'Viagem - Clima Hostil',
      input: {
        character: {
          ...createBaseCharacter(),
          worldState: {
            timeOfDay: 'Noite',
            weather: 'Tempestade',
            currentRegion: 'Planícies Tempestuosas',
          },
        },
        playerAction: 'Procuro abrigo e tento proteger o equipamento da tempestade arcana.',
        gameLog: 'SISTEMA: Raios azuis cortam os céus enquanto o vento uiva entre as dunas.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Viagem - Clima Hostil',
      },
    },
  ];

  const simulations = baseSimulations.map(simulation => ({
    ...simulation,
    input: {
      ...simulation.input,
      scenarioLabel: simulation.input.scenarioLabel ?? simulation.label,
    },
  }));

  const generationConfig: GenerationConfig = {
    temperature: 0.4,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: 8192,
  };

  for (const scenario of simulations) {
    console.log(`\n[structured-output:test2][aiService] Executando simulação: ${scenario.label}`);
    try {
      const result = await getGameUpdate(scenario.input, modelName, scenario.generationConfig ?? generationConfig, apiKey);
      logServiceSummary(result.response);
    } catch (error) {
      console.error(`[structured-output:test2][aiService] Erro na simulação "${scenario.label}":`, error);
    }
  }
}

const createBaseCharacter = () => ({
  id: 'sample-character',
  name: 'Guardião de Integridade',
  level: 3,
  worldState: {
    timeOfDay: 'Manhã',
    weather: 'Ensolarado',
    currentRegion: 'Biblioteca Arcana',
  },
  inventory: [],
  relationships: [],
  journal: [],
});

const buildCombatState = (isActive: boolean) => ({
  isActive,
  round: 1,
  turn: 0,
  combatants: [
    {
      id: 'player',
      name: 'Guardião',
      attitude: 'ally',
      hp: { current: 24, max: 24 },
      ac: 16,
      isPlayer: true,
      isDead: false,
    },
    {
      id: 'cultist-1',
      name: 'Cultista Sombrio',
      attitude: 'hostile',
      hp: { current: 12, max: 12 },
      ac: 13,
      isPlayer: false,
      isDead: false,
    },
  ],
});

const logServiceSummary = (response: any) => {
  const combatState = response?.combatState;
  const lootOffer = response?.lootOffer;
  const shopState = response?.shopState;
  const roll = response?.playerRollRequest;

  console.log('  ↳ combatState.isActive:', combatState?.isActive ?? '<none>');
  console.log('  ↳ combatants:', combatState?.combatants?.length ?? 0);
  console.log('  ↳ lootOffer:', lootOffer ? 'sim' : 'não');
  console.log('  ↳ shopState:', shopState ? 'sim' : 'não');
  console.log('  ↳ playerRollRequest:', roll ? `${roll.reason ?? 'pedido'}` : 'não');
};

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
