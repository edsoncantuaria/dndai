'use client';
import { z } from 'zod';

// Schema for PlayerRollRequest
export const PlayerRollRequestSchema = z.object({
    reason: z.string().describe("The reason for the roll (e.g., 'to persuade the guard', 'to dodge the fireball'). This will be displayed to the player."),
    dice: z.string().describe("The dice to roll, in standard notation (e.g., '1d20', '2d6')."),
    modifier: z.number().describe("The total modifier to add to the roll, calculated from character stats."),
    dc: z.number().optional().describe("The Difficulty Class of the check. This is crucial for the player to know what they need to beat. The DC MUST be calculated based on the desired chance of success for the player. Example for a d20 roll with a total +3 modifier (max roll of 23): Easy (60-70% success) -> DC ~8-10. Medium (40-50% success) -> DC ~12-14. Hard (15-20% success) -> DC ~18-20. Impossible (0% success) -> DC > 23."),
    rollType: z.enum(['check', 'save', 'attack', 'damage']).describe("The type of roll being made."),
    advantage: z.boolean().optional().describe("Whether the roll should be made with advantage."),
    disadvantage: z.boolean().optional().describe("Whether the roll should be made with disadvantage.")
}).refine(data => !(data.advantage && data.disadvantage), {
        message: "Uma rolagem não pode ter vantagem e desvantagem ao mesmo tempo",
      });
export type PlayerRollRequest = z.infer<typeof PlayerRollRequestSchema>;


// Schema para uma única entrada no log da aventura.
const LogEntrySchema = z.object({
    type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll']),
    content: z.any(),
    rollResult: z.any().optional(),
}).describe("An entry in the game's adventure log.");

const CombatantBaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    hp: z.number().optional(),
    maxHp: z.number().optional(),
    initiative: z.number(),
    distance: z.number().optional().describe("Distância em metros ou unidades até o alvo principal."),
    isHidden: z.boolean().default(false).describe("Se o combatente está em stealth ou invisível."),
    tempModifiers: z.record(z.string(), z.number()).default({}).describe("Modificadores temporários (vantagem, desvantagem, buffs)."),
    conditions: z.array(z.object({
      name: z.string(),
      durationRounds: z.number().optional(),
      durationMinutes: z.number().optional(),
      concentration: z.boolean().optional(),
      savingThrowEachTurn: z.boolean().optional(),
    })).default([]).describe("Condições ativas no combatente."),
  });

export const FullCombatantSchema = CombatantBaseSchema.extend({
    initiativeRoll: z.number().optional().describe("O valor da rolagem de iniciativa antes de aplicar modificadores."),
    armorClass: z.number().optional().describe("Classe de armadura do combatente."),
    hasMoved: z.boolean().default(false).describe("Se o combatente já se moveu neste turno."),
    hasActed: z.boolean().default(false).describe("Se o combatente já realizou ação neste turno."),
    actionPoints: z.number().default(1).describe("Número de ações restantes neste turno."),
    bonusActionPoints: z.number().default(1).describe("Número de ações bônus disponíveis."),
    rollHistory: z.array(z.object({
      type: z.enum(['initiative', 'attack', 'damage', 'save', 'check']),
      dice: z.string(),
      modifier: z.number().optional(),
      total: z.number(),
      rolls: z.array(z.number()),
      timestamp: z.string().optional(),
      targetDC: z.number().optional(),
      advantage: z.boolean().optional(),
      disadvantage: z.boolean().optional(),
      success: z.boolean().optional(),
      description: z.string(),
      rollType: z.string(),
    })).default([]).describe("Histórico de rolagens do combatente durante o combate."),
    isDead: z.boolean().default(false).describe("Se o combatente está inconsciente ou morto."),
    readyAction: z.string().optional().describe("Ação planejada para o turno."),
  });


export const ExtendedCombatStateSchema = z.object({
    isActive: z.boolean().describe("Se o combate está ativo."),
    round: z.number().describe("Número do round atual."),
    turn: z.number().describe("Índice do combatente que está na vez de agir."),
    combatants: z.array(FullCombatantSchema).describe("Lista completa de combatentes com todas as informações necessárias para combate."),
    initiativeOrder: z.array(z.string()).optional().describe("IDs dos combatentes em ordem de iniciativa."),
    log: z.array(z.object({
      type: z.enum(['combat', 'action', 'system', 'roll']),
      content: z.string(),
      rollResult: z.any().optional(),
      timestamp: z.string().optional(),
    })).default([]).describe("Log detalhado de todas as ações, rolagens e eventos do combate."),
    globalConditions: z.array(z.object({
      name: z.string(),
      durationRounds: z.number().optional(),
      durationMinutes: z.number().optional(),
      description: z.string().optional().describe("Descrição da condição global."),
    })).default([]).describe("Condições que afetam todos os combatentes, como darkness, fog, slow."),
  })
  .refine(data => data.combatants.every(c => c.hp === undefined || c.hp >= 0), {
    message: "HP dos combatentes não pode ser negativo",
  });




const LevelUpStateSchema = z.object({
    isPending: z.boolean(),
    newLevel: z.number(),
    choices: z.any(),
});

const ShopStateSchema = z.object({
    isOpen: z.boolean(),
    isHaggling: z.boolean(),
    name: z.string(),
    inventory: z.any(),
    sellPrices: z.record(z.string(), z.number()),
});

const LootOfferSchema = z.object({
    items: z.any(),
    currency: z.object({ gp: z.number() }),
});

const UseHitDiceRequestSchema = z.object({
    maxDice: z.number(),
    hitDieValue: z.number(),
});

// Itens do inventário com propriedades de uso/equipamento
export const InventoryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().min(1),
    weight: z.number().optional(),
    equipped: z.boolean().optional().describe("Se o item está atualmente equipado."),
    consumable: z.boolean().optional().describe("Se o item pode ser consumido."),
    usable: z.boolean().optional().describe("Se o item pode ser usado em ações específicas."),
    recoverable: z.boolean().optional().describe("Se o item ou recursos (como flechas) podem ser recuperados após uso."),
    cost: z.object({
        unit: z.string(),
        quantity: z.number(),
    }).optional(),
    restrictions: z.array(z.string()).optional().describe("Regras ou requisitos que impedem equipar ou usar o item."),
});

export type InventoryItem = z.infer<typeof InventoryItemSchema>;

// Expansão do ShopState para suportar compra/venda com detalhes
export const ShopItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    cost: z.object({
        unit: z.string(),
        quantity: z.number(),
    }),
    availableQuantity: z.number().optional(),
    restrictions: z.array(z.string()).optional(),
});

export type ShopItem = z.infer<typeof ShopItemSchema>;

// Loot detalhado
export const LootItemSchema = InventoryItemSchema; // reusar schema de inventário
export type LootItem = InventoryItem;


export const GameMasterResponseSchema = z.object({
    logEntries: z.array(LogEntrySchema).optional().describe("New entries for the adventure log, including narration, system messages, or combat details."),
    actionOptions: z.array(z.union([z.string(), z.object({ text: z.string(), action: z.string(), skill: z.string().optional() })])).optional().describe("A list of suggested actions for the player to take next."),
    updatedCharacter: z.any().optional().describe("An object containing ONLY the character fields that have been changed by the last action."),
    combatState: ExtendedCombatStateSchema.optional().describe("O estado completo do combate, incluindo iniciativa, turnos, distância, ações e condições."), // aqui usamos o novo schema
    levelUpState: LevelUpStateSchema.optional().describe("The state of a pending level-up for the character."),
    playerRollRequest: PlayerRollRequestSchema.optional().describe("If the Game Master needs the player to roll dice for a skill check, saving throw, or attack, this object MUST be populated. This is the ONLY way to make the player roll dice."),
    shopState: ShopStateSchema.optional().describe("The state of a shop, if the player is currently in one."),
    lootOffer: LootOfferSchema.optional().describe("An offer of loot for the player to accept."),
    useHitDiceRequest: UseHitDiceRequestSchema.optional().describe("A request for the player to spend hit dice during a short rest."),
    ambientSound: z.string().optional().describe("The ID of the ambient sound to play (e.g., 'forest_night', 'dungeon_i', 'none' for silence). This should be chosen from the available `ambient-sounds.json` file to match the current scene's atmosphere."),
    systemLog: z.string().optional().describe("Optional log where the GM explains decisions, e.g., DC choice, damage calculation, NPC rolls."),
    worldState: z.object({
        weather: z.string().optional(),
        timeOfDay: z.string().optional(),
        ongoingEvents: z.array(z.string()).optional(),
    }).optional().describe("Global world state variables to track persistent environment and events."),
    factionReputation: z.record(z.string(), z.number()).optional().describe("Tracks the player's reputation with different factions. Negative values indicate hostility."),
    conditions: z.array(z.object({
        name: z.string(),
        durationRounds: z.number().optional(),
        durationMinutes: z.number().optional(),
        concentration: z.boolean().optional(),
        savingThrowEachTurn: z.boolean().optional(),
    })).optional().describe("Ongoing conditions, effects, and status ailments on characters or NPCs."),
    modularRules: z.array(z.enum(['realism', 'cinematic', 'coreCombat', 'worldPersistence', 'exploration', 'downtime', 'social'])).optional().describe("Active rule modules that modify gameplay mechanics or narrative style."),
    inventoryUpdates: z.array(InventoryItemSchema).optional().describe("Atualizações do inventário resultantes de ações do jogador (equipar, desequipar, consumir, recuperar flechas, vender, comprar, loot). O Mestre valida tudo antes de enviar."),
    shopTransactionResult: z.object({
        success: z.boolean(),
        message: z.string().optional(),
    }).optional().describe("Resultado da tentativa de comprar ou vender itens."),
    lootResult: z.object({
        success: z.boolean(),
        message: z.string().optional(),
        itemsGained: z.array(LootItemSchema).optional(),
        currencyGained: z.object({ gp: z.number() }).optional(),
    }).optional().describe("Resultado do loot, baú ou corpo, incluindo itens e moedas adquiridas."),

}).describe("The Game Master's response, containing all updates to the game state.");

export type GameMasterResponse = z.infer<typeof GameMasterResponseSchema>;

// Schema para os dados que enviamos para a IA.
export const GameMasterFlowInputSchema = z.object({
  character: z.any().describe("The entire current character state object."),
  playerAction: z.string().describe("The action taken by the player. If this action is the result of a dice roll, it will be prefixed with 'O resultado da minha rolagem de...'"),
  gameLog: z.array(LogEntrySchema).describe("The last 15 entries of the game log."),
  combatState: ExtendedCombatStateSchema.optional().describe("The current state of combat, if active.")
});

export type GameMasterFlowInput = z.infer<typeof GameMasterFlowInputSchema>;

      
