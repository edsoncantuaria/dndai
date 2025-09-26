import { z } from 'zod';

// Schema para uma única entrada no log da aventura.
const LogEntrySchema = z.object({
    type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll', 'image']),
    content: z.string().describe("O texto descritivo da narração ou o conteúdo da mensagem."),
}).describe("Uma entrada no log de aventura do jogo.");

const CombatantSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.number().optional(),
    maxHp: z.number().optional(),
    initiative: z.number(),
});

const CombatStateSchema = z.object({
    isActive: z.boolean(),
    round: z.number(),
    turn: z.number(),
    combatants: z.array(CombatantSchema),
});

const LevelUpStateSchema = z.object({
    isPending: z.boolean(),
    newLevel: z.number(),
    choices: z.any().describe("Detalhes das escolhas de level up disponíveis, como aumento de atributo, novas perícias ou magias."),
});

const ShopStateSchema = z.object({
    isOpen: z.boolean(),
    isHaggling: z.boolean(),
    name: z.string(),
    inventory: z.any().describe("Array de itens disponíveis na loja."),
    sellPrices: z.record(z.string(), z.number()).describe("Um objeto mapeando IDs de itens para seus preços de venda."),
});

const LootOfferSchema = z.object({
    items: z.any().describe("Array de itens oferecidos como saque."),
    currency: z.object({ gp: z.number() }),
});

const UseHitDiceRequestSchema = z.object({
    maxDice: z.number().describe("O número máximo de Dados de Vida que o jogador pode gastar."),
    hitDieValue: z.number().describe("O valor do Dado de Vida da classe do personagem (ex: 10 para d10)."),
});

export const GameMasterResponseSchema = z.object({
    logEntries: z.array(LogEntrySchema).optional().describe("Novas entradas para o log da aventura, incluindo narração, mensagens do sistema ou detalhes de combate."),
    actionOptions: z.array(z.union([z.string(), z.object({ text: z.string(), action: z.string() })])).optional().describe("Uma lista de ações sugeridas para o jogador tomar a seguir."),
    updatedCharacter: z.any().optional().describe("Um objeto contendo APENAS os campos do personagem que mudaram devido à última ação. Exemplos: hp, xp, inventory, journal, relationships."),
    combatState: CombatStateSchema.optional().describe("O estado atual do combate, se houver."),
    levelUpState: LevelUpStateSchema.optional().describe("O estado de um level-up pendente para o personagem."),
    shopState: ShopStateSchema.optional().describe("O estado de uma loja, se o jogador estiver atualmente em uma."),
    lootOffer: LootOfferSchema.optional().describe("Uma oferta de saque para o jogador aceitar."),
    useHitDiceRequest: UseHitDiceRequestSchema.optional().describe("Um pedido para o jogador gastar Dados de Vida durante um descanso curto."),
    imagePrompt: z.string().optional().describe("Ocasionalmente, para uma cena importante, forneça um prompt de imagem detalhado (em inglês) para gerar uma ilustração. Ex: 'Dungeons and Dragons 5e style: A tiefling man in a dark cloak watches you from across a tavern, while blurry dwarves dance in the foreground.'"),
    ambientSound: z.string().optional().describe("O ID de uma nova trilha sonora ambiente para tocar, com base na mudança de cena ou humor (ex: 'tavern-lively', 'dungeon-eerie', 'forest-day')."),
}).describe("A resposta do Mestre de Jogo, contendo todas as atualizações para o estado do jogo.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// Schema para os dados que enviamos para a IA.
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("O objeto de estado completo do personagem atual."),
  playerAction: z.string().describe("A ação realizada pelo jogador."),
  gameLog: z.array(LogEntrySchema).describe("As últimas 15 entradas do log do jogo para contexto."),
});

export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;
