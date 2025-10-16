// backend/src/schemas/gameSchemas.ts
import { z } from 'zod';
import { CreateHomebrewSchema } from './validationSchemas.js';

/* -------------------------------- PLAYER ROLL -------------------------------- */
export const PlayerRollRequestSchema = z.object({
  reason: z.string().describe("Motivo da rolagem (ex.: 'persuadir o guarda', 'desviar do fireball'). Exibido ao jogador."),
  dice: z.string().describe("Dados a rolar, no padrão padrão (ex.: '1d20', '2d6')."),
  modifier: z.number().describe("Modificador total da rolagem, calculado a partir dos atributos do personagem."),
  dc: z.number().optional().describe("Classe de Dificuldade (DC) que o jogador precisa superar."),
  rollType: z.enum(['check', 'save', 'attack', 'damage', 'initiative']).describe("Tipo da rolagem."),
  advantage: z.boolean().optional().describe("Indica se a rolagem tem vantagem."),
  disadvantage: z.boolean().optional().describe("Indica se a rolagem tem desvantagem."),
}).refine(data => !(data.advantage && data.disadvantage), {
  message: "Uma rolagem não pode ter vantagem e desvantagem ao mesmo tempo",
});
export type PlayerRollRequest = z.infer<typeof PlayerRollRequestSchema>;

/* -------------------------------- LOG ENTRY -------------------------------- */
const LogEntrySchema = z.object({
  type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll', 'image']),
  content: z.union([
    z.string(),
    z.object({
      text: z.string().optional(),
      imageUrl: z.string().optional(),
      status: z.enum(['generating', 'failed', 'done']).optional(),
      prompt: z.string().optional(),
      meta: z.record(z.any()).optional(),
    }),
  ]).describe("Conteúdo da entrada no log: string simples ou objeto estruturado para tipos especiais."),
  rollResult: z.any().optional().describe("Dados estruturados opcionais para rolagens de dados."),
}).describe("Uma entrada do log de aventura.");

/* -------------------------------- COMBAT -------------------------------- */
export const FullCombatantSchema = z.object({
  id: z.string().describe("ID único do combatente (ex.: 'player', 'goblin-1')."),
  name: z.string().describe("Nome de exibição do combatente."),
  hp: z.object({
    current: z.number().describe("Pontos de vida atuais."),
    max: z.number().describe("Pontos de vida máximos."),
  }).describe("Informações de HP do combatente."),
  ac: z.number().optional().describe("Classe de Armadura."),
  initiative: z.number().optional().describe("Score total de iniciativa."),
  initiativeRoll: z.number().optional().describe("Rolagem bruta de d20 para iniciativa."),
  isPlayer: z.boolean().optional().default(false).describe("Se o combatente é o personagem do jogador."),
  conditions: z.array(z.string()).optional().default([]).describe("Lista de condições ativas (ex.: 'Grappled', 'Poisoned')."),
  distance: z.number().optional().describe("Distância em metros do jogador."),
  hasMoved: z.boolean().default(false).describe("Se o combatente já se moveu neste turno."),
  hasActed: z.boolean().default(false).describe("Se o combatente já realizou uma ação neste turno."),
  actionPoints: z.number().default(1).describe("Número de ações principais disponíveis."),
  bonusActionPoints: z.number().default(1).describe("Número de ações bônus disponíveis."),
  isDead: z.boolean().default(false).describe("Se o combatente está morto ou inconsciente."),
  readyAction: z.string().optional().describe("Descrição da ação preparada para um gatilho."),
  readyWeapon: z.string().optional().describe("Arma usada em ação preparada."),
  readySpell: z.string().optional().describe("Magia usada em ação preparada."),
  tempModifiers: z.any().optional().describe("Modificadores temporários de feitiços ou efeitos."),
  rollHistory: z.array(z.object({
    type: z.enum(['initiative', 'attack', 'damage', 'save', 'check']),
    roll: z.number(),
    total: z.number(),
    modifier: z.number(),
    description: z.string(),
  })).optional().default([]).describe("Histórico de rolagens do combatente."),
});

export const CombatStateSchema = z.object({
  isActive: z.boolean().describe("Indica se o combate está ativo. Deve ser true se houver inimigos não derrotados."),
  round: z.number().describe("Número da rodada atual."),
  turn: z.number().describe("Índice do combatente na ordem de iniciativa."),
  combatants: z.array(FullCombatantSchema).describe("Lista de todos os combatentes."),
  initiativeOrder: z.array(z.string()).optional().describe("IDs dos combatentes ordenados por iniciativa."),
  log: z.array(z.union([z.string(), LogEntrySchema])).optional().default([]).describe("Registro de eventos importantes do combate."),
}).describe("Estado completo do combate.");

/* -------------------------------- GAME STATES -------------------------------- */
export const LevelUpStateSchema = z.object({
  isPending: z.boolean(),
  newLevel: z.number(),
  choices: z.any(),
}).nullable().optional();

export const ShopStateSchema = z.object({
  isOpen: z.boolean(),
  isHaggling: z.boolean(),
  name: z.string(),
  inventory: z.any(),
  sellPrices: z.any(),
}).nullable().optional();

export const LootOfferSchema = z.object({
  items: z.any(),
  currency: z.object({ gp: z.number() }),
}).nullable().optional();

export const UseHitDiceRequestSchema = z.object({
  maxDice: z.number(),
  hitDieValue: z.number(),
}).nullable().optional();

/* -------------------------------- INVENTORY -------------------------------- */
export const InventoryItemSchema = z.object({
  name: z.string(),
  quantity: z.number().min(1),
  equipped: z.boolean().optional().describe("Se o item está equipado atualmente."),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

/* -------------------------------- JOURNAL / QUEST / RELATIONSHIP -------------------------------- */
const JournalEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  region: z.string(),
  summary: z.string(),
  looted: z.boolean(),
});

const QuestSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  objectives: z.array(z.string()),
});

const RelationshipSchema = z.object({
  npcId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['hostile', 'unfriendly', 'neutral', 'friendly', 'ally']),
  affinity: z.number(),
  quests: z.array(QuestSchema).optional(),
});

/* -------------------------------- WORLD STATE -------------------------------- */
const WorldStateSchema = z.object({
  timeOfDay: z.enum(['Manhã', 'Tarde', 'Noite']).describe("Período do dia."),
  weather: z.enum(['Ensolarado', 'Nublado', 'Chuva', 'Tempestade', 'Neve', 'Nevoeiro']).describe("Condições climáticas."),
  currentRegion: z.string().optional().describe("Região atual do jogador."),
}).describe("Estado global do mundo.");

/* -------------------------------- GAME MASTER RESPONSE -------------------------------- */
export const GameMasterResponseSchema = z.object({
  logEntries: z.array(LogEntrySchema).optional().default([]).describe("Novas entradas do log de aventura."),
  actionOptions: z.array(z.union([
    z.string(),
    z.object({ text: z.string(), action: z.string(), skill: z.string().optional() }),
  ])).optional().default([]).describe("Ações sugeridas para o jogador."),
  updatedCharacter: z.any().optional().describe("Campos do personagem modificados pela última ação."),
  combatState: CombatStateSchema.optional().default({ isActive: false, round: 0, turn: 0, combatants: [], initiativeOrder: [], log: [] }).describe("Estado completo do combate, se ativo."),
  playerRollRequest: PlayerRollRequestSchema.nullable().optional().describe("Solicitação de rolagem para o jogador, se necessária."),
  ambientSound: z.string().optional().describe("ID do som ambiente (ex.: 'forest_night')."),
  systemLog: z.string().optional().nullable().describe("Log opcional para explicar decisões do GM."),
  levelUpState: LevelUpStateSchema.nullable().optional(),
  shopState: ShopStateSchema.nullable().optional(),
  lootOffer: LootOfferSchema.nullable().optional(),
  useHitDiceRequest: UseHitDiceRequestSchema.nullable().optional(),
  worldState: WorldStateSchema.optional().describe("Atualizações do estado global do mundo."),
  newHomebrewContent: z.array(CreateHomebrewSchema).optional().default([]).describe("Conteúdos homebrew criados pelo GM."),
}).describe("Resposta completa do Game Master a uma ação do jogador.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

/* -------------------------------- GAME MASTER FLOW INPUT -------------------------------- */
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("Resumo do estado atual do personagem."),
  playerAction: z.string().describe("Ação tomada pelo jogador."),
  gameLog: z.string().describe("Resumo do histórico recente do jogo em JSON."),
  combatState: CombatStateSchema.optional().describe("Estado do combate atual, se ativo."),
  installedHomebrew: z.array(z.any()).optional().describe("Homebrew ativos na sessão (raças, classes, monstros, etc.)."),
});
export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;
