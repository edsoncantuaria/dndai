/**
 * Structured Output schema enviado ao Gemini.
 * Mantém os principais campos do GameMasterResponse sem ultrapassar
 * o limite de profundidade do modelo (schema intencionalmente raso).
 */
/**
 * Structured Output schema enviado ao Gemini.
 * Mantém os campos críticos do GameMasterResponse com profundidade
 * controlada. A validação completa continua sendo feita via Zod
 * (GameMasterResponseSchema) após o sanitizador.
 */
export const GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    logEntries: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          content: { type: "string" },
          rollResult: { type: ["object", "null"], additionalProperties: true },
        },
        required: ["type", "content"],
      },
    },
    actionOptions: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          action: { type: "string" },
          skill: { type: "string" },
        },
        required: ["text"],
      },
    },
    updatedCharacter: {
      type: "object",
      additionalProperties: true,
    },
    combatState: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        isActive: { type: "boolean" },
        round: { type: "number" },
        turn: { type: "number" },
        summary: { type: "string" },
        combatants: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              attitude: { type: "string" },
              isPlayer: { type: "boolean" },
              isDead: { type: "boolean" },
              hpCurrent: { type: "number" },
              hpMax: { type: "number" },
              ac: { type: "number" },
              distance: { type: "number" },
              zone: { type: "string" },
              notes: { type: "string" },
            },
            required: ["id", "name"],
          },
        },
      },
      required: ["isActive"],
    },
    playerRollRequest: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        reason: { type: "string" },
        dice: { type: "string" },
        modifier: { type: "number" },
        dc: { type: "number" },
        rollType: { type: "string" },
        advantage: { type: "boolean" },
        disadvantage: { type: "boolean" },
      },
    },
    worldState: {
      type: "object",
      additionalProperties: false,
      properties: {
        timeOfDay: { type: "string" },
        weather: { type: "string" },
        currentRegion: { type: "string" },
        regionSlug: { type: "string" },
        poiSlug: { type: "string" },
        poiName: { type: "string" },
        visitedRegions: {
          type: "array",
          items: { type: "string" },
        },
        visitedPois: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              regionSlug: { type: "string" },
              poiSlug: { type: "string" },
              name: { type: "string" },
            },
            required: ["regionSlug", "poiSlug"],
          },
        },
        npcLocations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              npcId: { type: "string" },
              name: { type: "string" },
              regionSlug: { type: "string" },
              poiSlug: { type: "string" },
              notes: { type: "string" },
            },
            required: ["npcId"],
          },
        },
      },
      required: ["timeOfDay", "weather"],
    },
    gameClock: {
      type: "object",
      additionalProperties: false,
      properties: {
        day: { type: "number" },
        hour: { type: "number" },
        weather: { type: "string" },
      },
    },
    memoryContext: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        references: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    xpEvents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          description: { type: "string" },
          xp: { type: "number" },
        },
        required: ["type"],
      },
    },
    progressionFeed: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          summary: { type: "string" },
          detail: { type: "string" },
          xp: { type: "number" },
          level: { type: "number" },
        },
        required: ["type", "summary"],
      },
    },
    newHomebrewContent: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    levelUpState: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    shopState: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    lootOffer: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    useHitDiceRequest: {
      type: ["object", "null"],
      additionalProperties: true,
    },
    systemLog: { type: ["string", "null"] },
    _meta: {
      type: "object",
      additionalProperties: false,
      properties: {
        hash: { type: "string" },
        schemaVersion: { type: "number" },
        integrityNotes: {
          anyOf: [
            { type: "string" },
            {
              type: "array",
              items: { type: "string" },
            },
          ],
        },
      },
    },
  },
  required: ["logEntries", "actionOptions", "updatedCharacter"],
};

export const NARRATIVE_PHASE_GENERATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    logEntries: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.logEntries,
    actionOptions: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.actionOptions,
    systemLog: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.systemLog,
  },
  required: ["logEntries", "actionOptions"],
};

const zeroArraySchema = {
  type: "array",
  minItems: 0,
  maxItems: 0,
  items: false,
};

export const STATE_PHASE_GENERATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    logEntries: zeroArraySchema,
    actionOptions: zeroArraySchema,
    updatedCharacter: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.updatedCharacter,
    worldState: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.worldState,
    combatState: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.combatState,
    playerRollRequest: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.playerRollRequest,
    xpEvents: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.xpEvents,
    progressionFeed: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.progressionFeed,
    newHomebrewContent: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.newHomebrewContent,
    levelUpState: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.levelUpState,
    shopState: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.shopState,
    lootOffer: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.lootOffer,
    useHitDiceRequest: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.useHitDiceRequest,
    gameClock: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.gameClock,
    memoryContext: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.memoryContext,
    systemLog: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties.systemLog,
    _meta: GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA.properties._meta,
  },
  required: ["logEntries", "actionOptions"],
};
