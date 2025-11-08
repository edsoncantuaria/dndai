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
  requestId: z.string().optional().describe("Identificador único gerado pelo backend para correlacionar o resultado da rolagem."),
}).refine(data => !(data.advantage && data.disadvantage), {
  message: "Uma rolagem não pode ter vantagem e desvantagem ao mesmo tempo",
});
export type PlayerRollRequest = z.infer<typeof PlayerRollRequestSchema>;

/* -------------------------------- LOG ENTRY -------------------------------- */
const LogEntrySchema = z.object({
  type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll']),
  content: z.string().describe("Conteúdo da entrada no log: string simples ou objeto estruturado para tipos especiais."),
  rollResult: z.any().optional().describe("Dados estruturados opcionais para rolagens de dados."),
}).describe("Uma entrada do log de aventura.");

/* -------------------------------- XP EVENTS -------------------------------- */
export const XpEventSchema = z.object({
  type: z.enum(['skill', 'quest']).describe("Origem do XP: sucesso em perícia ou conclusão de missão."),
  dc: z.number().optional().describe("Classe de Dificuldade (DC) do teste, se aplicável."),
  difficulty: z.enum(['very_easy', 'easy', 'medium', 'hard', 'very_hard', 'extreme']).optional().describe("Dificuldade textual do teste, se DC não estiver disponível."),
  questLevel: z.number().optional().describe("Nível do personagem ou missão ao concluir uma quest."),
  description: z.string().optional().describe("Descrição breve do motivo do XP."),
}).describe("Evento de XP que o backend usará para calcular recompensas.");
export type XpEvent = z.infer<typeof XpEventSchema>;

export const ProgressionEventSchema = z.object({
  type: z.enum(['xp_gain', 'level_up']).describe("Tipo de evento de progressão apresentado ao jogador."),
  summary: z.string().describe("Resumo curto exibido no feed de progressão."),
  source: z.string().optional().describe("Fonte da recompensa, como a descrição da perícia ou missão."),
  detail: z.string().optional().describe("Detalhes adicionais do evento."),
  xp: z.number().optional().describe("Quantidade de XP concedida, quando aplicável."),
  level: z.number().optional().describe("Nível alcançado em um marco de progressão."),
}).describe("Evento resumido apresentado ao jogador para acompanhar progresso.");
export type ProgressionEvent = z.infer<typeof ProgressionEventSchema>;

const CooldownEntrySchema = z.object({
  id: z.string().optional().describe("Identificador único da habilidade ou recurso."),
  name: z.string().describe("Nome da habilidade em recarga."),
  remainingRounds: z.number().nonnegative().describe("Rodadas restantes até a recarga completa."),
  totalRounds: z.number().nonnegative().optional().describe("Quantidade total de rodadas necessárias para recarregar."),
  description: z.string().optional().describe("Resumo textual para facilitar decisões."),
  resource: z.string().optional().describe("Tipo de recurso associado (ex.: magia, manobra, tecnologia)."),
});

const StatusEffectSchema = z.object({
  id: z.string().optional().describe("Identificador interno para rastreamento."),
  name: z.string().describe("Nome do efeito ou condição."),
  remainingRounds: z.number().nonnegative().optional().describe("Rodadas restantes até expirar."),
  source: z.string().optional().describe("Origem do efeito (magia, habilidade, item)."),
  description: z.string().optional().describe("Descrição breve do impacto do efeito."),
  severity: z.enum(['leve', 'moderado', 'grave']).optional().describe("Severidade opcional para priorização."),
});

const CombatZoneSchema = z.enum(['perto', 'medio', 'longe', 'coberto']).describe("Faixa tática simplificada de posicionamento.");

/* -------------------------------- COMBAT -------------------------------- */
export const CombatAttitudeSchema = z.enum(['hostile', 'neutral', 'ally']).describe("Postura do combatente em relação ao jogador.");
export const FullCombatantSchema = z.object({
  id: z.string().describe("ID único do combatente (ex.: 'player', 'goblin-1')."),
  name: z.string().describe("Nome de exibição do combatente."),
  hp: z.object({
    current: z.number().describe("Pontos de vida atuais."),
    max: z.number().describe("Pontos de vida máximos."),
  }).describe("Informações de HP do combatente."),
  ac: z.number().optional().describe("Classe de Armadura."),
  initiative: z.number().optional().describe("Score total de iniciativa."),
  isPlayer: z.boolean().optional().default(false).describe("Se o combatente é o personagem do jogador."),
  conditions: z.array(z.string()).optional().default([]).describe("Lista de condições ativas (ex.: 'Grappled', 'Poisoned')."),
  statusEffects: z.array(StatusEffectSchema).optional().default([]).describe("Efeitos detalhados com duração e origem."),
  cooldowns: z.array(CooldownEntrySchema).optional().default([]).describe("Habilidades em recarga e seus tempos restantes."),
  distance: z.number().optional().describe("Distância em metros do jogador."),
  zone: CombatZoneSchema.optional().describe("Categoria de alcance (perto/médio/longe/coberto)."),
  hasMoved: z.boolean().default(false).describe("Se o combatente já se moveu neste turno."),
  hasActed: z.boolean().default(false).describe("Se o combatente já realizou uma ação neste turno."),
  actionPoints: z.number().default(1).describe("Número de ações principais disponíveis."),
  bonusActionPoints: z.number().default(1).describe("Número de ações bônus disponíveis."),
  isDead: z.boolean().default(false).describe("Se o combatente está morto ou inconsciente."),
  readyAction: z.string().optional().describe("Descrição da ação preparada para um gatilho."),
  tempModifiers: z.any().optional().describe("Modificadores temporários de feitiços ou efeitos."),
  attitude: CombatAttitudeSchema.optional().default('neutral').describe("Relação atual com o personagem do jogador."),
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

export type CombatAttitude = z.infer<typeof CombatAttitudeSchema>;
export type FullCombatant = z.infer<typeof FullCombatantSchema>;
export type CombatState = z.infer<typeof CombatStateSchema>;

/* -------------------------------- GAME STATES -------------------------------- */
export const LevelUpStateSchema = z.object({
  isPending: z.boolean(),
  newLevel: z.number(),
  choices: z.any(),
});

export const ShopStateSchema = z.object({
  isOpen: z.boolean(),
  isHaggling: z.boolean(),
  name: z.string(),
  inventory: z.any(),
  sellPrices: z.any(),
});

export const LootOfferSchema = z.object({
  items: z.any(),
  currency: z.object({ gp: z.number() }),
});

export const UseHitDiceRequestSchema = z.object({
  maxDice: z.number(),
  hitDieValue: z.number(),
});

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
  timeOfDay: z.string().describe("Período do dia (ex: Manhã, Final da Tarde, Noite)."),
  weather: z.string().describe("Condições climáticas (ex: Ensolarado, Nublado, Chuva)."),
  currentRegion: z.string().optional().describe("Região atual do jogador."),
}).describe("Estado global do mundo.");

/* -------------------------------- GAME MASTER RESPONSE -------------------------------- */
export const GameMasterResponseSchema = z.object({
  logEntries: z.array(LogEntrySchema).optional().default([]).describe("Novas entradas do log de aventura."),
  actionOptions: z.array(z.union([
    z.string(),
    z.object({ text: z.string(), action: z.string(), skill: z.string().optional() }),
  ])).optional().default([]).describe("Ações sugeridas para o jogador."),
  updatedCharacter: z.object({}).catchall(z.any()).optional().describe("Campos do personagem modificados pela última ação."),
  combatState: CombatStateSchema.nullable().optional().describe("Estado completo do combate, se ativo."),
  playerRollRequest: PlayerRollRequestSchema.nullable().optional().describe("Solicitação de rolagem para o jogador, se necessária."),
  ambientSound: z.string().optional().describe("ID do som ambiente (ex.: 'forest_night')."),
  systemLog: z.string().optional().nullable().describe("Log opcional para explicar decisões do GM."),
  levelUpState: LevelUpStateSchema.nullable().optional(),
  shopState: ShopStateSchema.nullable().optional(),
  lootOffer: LootOfferSchema.nullable().optional(),
  useHitDiceRequest: UseHitDiceRequestSchema.nullable().optional(),
  worldState: WorldStateSchema.optional().describe("Atualizações do estado global do mundo."),
  newHomebrewContent: z.array(CreateHomebrewSchema).optional().default([]).describe("Conteúdos homebrew criados pelo GM."),
  xpEvents: z.array(XpEventSchema).optional().describe("Lista de eventos de XP para o sistema validar e aplicar."),
  progressionFeed: z.array(ProgressionEventSchema).optional().describe("Feed resumido com ganhos de XP e marcos de progressão para o jogador."),
}).describe("Resposta completa do Game Master a uma ação do jogador.");


export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

/* -------------------------------- GAME MASTER FLOW INPUT -------------------------------- */
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("Resumo do estado atual do personagem."),
  playerAction: z.string().describe("Ação tomada pelo jogador."),
  gameLog: z.string().describe("Resumo do histórico recente do jogo em JSON."),
  combatState: CombatStateSchema.optional().describe("Estado do combate atual, se ativo."),
  homebrewSummary: z.string().optional().describe("Resumo textual do conteúdo homebrew instalado para esta sessão."),
  validationFeedback: z.string().optional().describe("Feedback adicional sobre inconsistências detectadas para orientar a próxima resposta."),
  useAiHomebrew: z.boolean().optional().describe("Se a IA tem permissão para criar conteúdo homebrew."),
  enableNarrativeRevalidation: z.boolean().optional().describe("Ativa instruções extras para revalidar continuidade narrativa e lógica a cada resposta."),
  timelineFacts: z.string().optional().describe("Linha do tempo resumida com eventos relevantes da sessão."),
  mode: z.enum(['gameplay', 'combat', 'generation', 'audit']).optional().describe("Modo de interação que orienta limites de tokens e parâmetros do modelo."),
});
export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;
