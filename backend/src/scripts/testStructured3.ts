import { env } from '../config/env.js';
import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { getGameUpdate } from '../services/aiService.js';

const run = async () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const modelName = process.argv[2] ?? 'gemini-2.5-flash';
  console.log(`[structured-output:test3] Modelo alvo: ${modelName}`);

  await runComplexCampaignScenarios(modelName, apiKey);
};

run().catch(error => {
  console.error('[structured-output:test3] Erro ao executar simulações complexas:', error);
  process.exit(1);
});

async function runComplexCampaignScenarios(modelName: string, apiKey: string) {
  const generationConfig: GenerationConfig = {
    temperature: 0.45,
    topP: 0.9,
    topK: 32,
    maxOutputTokens: 8192,
  };

  const campaignScenarios: { label: string; input: GameMasterFlowInput }[] = [
    {
      label: 'Capítulo 1 - Biblioteca em Colapso',
      input: {
        character: createBaseCharacter({
          journal: [
            'Enigma do Obelisco: decifrar símbolos antes que as estantes desmoronem.',
          ],
        }),
        playerAction: 'Corro entre as estantes instáveis tentando interromper o ritual.',
        gameLog:
          'SISTEMA: O chão treme enquanto o obelisco arcano pulsa energia.\n' +
          'JOGADOR: Procuro o selo de emergência e me arrisco entre destroços mágicos.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        validationFeedback:
          'Garanta continuidade dos objetos descritos nos turnos anteriores e reporte falhas estruturais se detectadas.',
        timelineFacts:
          'Dia 4 - Biblioteca Arcana, seção subterrânea. Desabamento gradual em curso.',
        scenarioLabel: 'Capítulo 1 - Biblioteca em Colapso',
      },
    },
    {
      label: 'Capítulo 2 - Barganha com o Guardião',
      input: {
        character: createBaseCharacter({
          relationships: [
            { npcId: 'borin', name: 'Borin Stonehand', status: 'friendly', affinity: 3 },
            { npcId: 'auria', name: 'Aúria, a Curadora', status: 'neutral', affinity: 0 },
          ],
          shopState: {
            isOpen: true,
            isHaggling: true,
            name: 'Empório Arcanum',
            inventory: [],
            sellPrices: { gp: 120 },
            itemsForSale: [
              { name: 'Poção de Cura Maior', price: 250, currency: 'gp', quantity: 1 },
              { name: 'Pergaminho de Contrafeitiço', price: 180, currency: 'gp', quantity: 1 },
            ],
          },
        }),
        playerAction:
          'Negocio com Borin para resgatar um tomo proibido e pago parte em itens raros.',
        gameLog:
          'NPC BORIN: "Esse tomo vale sua liberdade, Guardião."\n' +
          'JOGADOR: Mostro o medalhão e proponho troca com rolagem de Persuasão.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 2 - Barganha com o Guardião',
      },
    },
    {
      label: 'Capítulo 3 - Cerco à Galeria',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Coordeno meus aliados contra três cultistas e um globo elemental.',
        gameLog:
          'SISTEMA: O círculo de runas ativa dois portais secundários.\n' +
          'ALIADO GOLEM: "Protegerei o flanco esquerdo!"',
        combatState: buildComplexCombatState(),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 3 - Cerco à Galeria',
      },
    },
    {
      label: 'Capítulo 4 - Batalha Final e Rendição',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Chamo o líder cultista à rendição após derrotar seus lacaios.',
        gameLog:
          'SISTEMA: O líder está com 4 HP, cercado pelo golem e pelo Guardião.\n' +
          'JOGADOR: Exijo rendição oferecendo clemência controlada.',
        combatState: buildBossCombatState(),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 4 - Batalha Final e Rendição',
      },
    },
    {
      label: 'Capítulo 5 - Saque e Restauro',
      input: {
        character: createBaseCharacter(),
        playerAction: 'Catalogo os itens do baú ritualístico e registro no diário.',
        gameLog:
          'SISTEMA: O baú se abre após o combate.\n' +
          'JOGADOR: Coletar itens, verificar maldições e distribuir moedas.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 5 - Saque e Restauro',
      },
    },
    {
      label: 'Capítulo 6 - Descanso Estratégico',
      input: {
        character: createBaseCharacter({
          hpCurrent: 14,
          hpMax: 32,
          hitDice: { d8: 3 },
        }),
        playerAction:
          'Faço um descanso curto, gasto dois dados de vida e planejo a próxima incursão.',
        gameLog:
          'SISTEMA: O salão foi assegurado; ruínas ecoam magia residual.\n' +
          'JOGADOR: Atenuo ferimentos e preparo relíquias.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 6 - Descanso Estratégico',
      },
    },
  ];

  for (const scenario of campaignScenarios) {
    console.log(`\n[structured-output:test3] Executando cenário complexo: ${scenario.label}`);
    try {
      const result = await getGameUpdate(scenario.input, modelName, generationConfig, apiKey);
      summarizeResponse(result.response, scenario.label);
    } catch (error) {
      console.error(`[structured-output:test3] Erro no cenário "${scenario.label}":`, error);
    }
  }
}

const summarizeResponse = (response: any, label: string) => {
  const logCount = response?.logEntries?.length ?? 0;
  const actionCount = response?.actionOptions?.length ?? 0;
  const lootOffer = response?.lootOffer ? 'sim' : 'não';
  const shopState = response?.shopState ? 'sim' : 'não';
  const roll = response?.playerRollRequest ? response.playerRollRequest.reason : 'não';
  const combatActive = response?.combatState?.isActive ?? false;
  const memorySummary = response?.memoryContext?.summary
    ? response.memoryContext.summary.slice(0, 60)
    : '<sem memória>';

  console.log(
    `  ↳ ${label}: logEntries=${logCount}, actionOptions=${actionCount}, ` +
      `combate=${combatActive ? 'ativo' : 'inativo'}, loot=${lootOffer}, shop=${shopState}, roll=${roll}, memória="${memorySummary}"`
  );
};

type CharacterOverrides = Partial<ReturnType<typeof createBaseCharacter>>;

function createBaseCharacter(overrides: CharacterOverrides = {}) {
  const base = {
    id: 'sample-character',
    name: 'Guardião de Integridade',
    level: 3,
    worldState: {
      timeOfDay: 'Manhã',
      weather: 'Ensolarado',
      currentRegion: 'Biblioteca Arcana',
    },
    inventory: [
      { id: 'dagger-a', name: 'Adaga do Assassino', quantity: 1, equipped: true },
      { id: 'dagger-b', name: 'Adaga do Assassino', quantity: 1, equipped: true },
      { id: 'kit-explorer', name: 'Kit do Explorador', quantity: 1 },
    ],
    relationships: [
      { npcId: 'golem-vigia', name: 'Golem Vigia', status: 'ally', affinity: 4 },
    ],
    journal: [
      'Entrada 12: Suspender ritual no subsolo.',
      'Entrada 13: Recuperar tomo dos cultistas.',
    ],
  };

  return { ...base, ...overrides };
}

function buildComplexCombatState() {
  return {
    isActive: true,
    round: 2,
    turn: 1,
    combatants: [
      {
        id: 'player',
        name: 'Guardião',
        attitude: 'ally',
        hp: { current: 22, max: 27 },
        ac: 16,
        isPlayer: true,
        conditions: ['Concentrando'],
      },
      {
        id: 'golem',
        name: 'Golem Vigia',
        attitude: 'ally',
        hp: { current: 28, max: 30 },
        ac: 18,
        notes: 'Protegendo o corredor leste.',
      },
      {
        id: 'cultist-1',
        name: 'Cultista Sombrio',
        attitude: 'hostile',
        hp: { current: 8, max: 12 },
        ac: 13,
      },
      {
        id: 'cultist-2',
        name: 'Cultista Arqueiro',
        attitude: 'hostile',
        hp: { current: 12, max: 12 },
        ac: 14,
        conditions: ['Inspirado'],
      },
      {
        id: 'elemental',
        name: 'Globo Elemental',
        attitude: 'hostile',
        hp: { current: 20, max: 20 },
        ac: 15,
        notes: 'Canaliza relâmpagos intermitentes.',
      },
    ],
    initiativeOrder: ['cultist-2', 'player', 'elemental', 'golem', 'cultist-1'],
  };
}

function buildBossCombatState() {
  return {
    isActive: true,
    round: 4,
    turn: 2,
    combatants: [
      {
        id: 'player',
        name: 'Guardião',
        attitude: 'ally',
        hp: { current: 18, max: 27 },
        ac: 16,
        isPlayer: true,
      },
      {
        id: 'cultist-lider',
        name: 'Suma-Vigia Kaldrax',
        attitude: 'hostile',
        hp: { current: 4, max: 40 },
        ac: 17,
        conditions: ['Sangrando'],
      },
      {
        id: 'golem',
        name: 'Golem Vigia',
        attitude: 'ally',
        hp: { current: 18, max: 30 },
        ac: 18,
      },
    ],
    initiativeOrder: ['player', 'cultist-lider', 'golem'],
  };
}
