export const GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        logEntries: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: true,
                properties: {
                    type: { type: "string" },
                    content: { type: "string" },
                    rollResult: { type: ["object", "string", "number", "null", "array"] },
                },
                required: ["type", "content"],
            },
        },
        actionOptions: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: true,
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
        systemLog: { type: ["string", "null"] },
        worldState: {
            type: ["object", "null"],
            additionalProperties: true,
        },
        combatState: {
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
        xpEvents: {
            type: ["array", "null"],
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        progressionFeed: {
            type: ["array", "null"],
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        gameClock: {
            type: ["object", "null"],
            additionalProperties: true,
        },
        memoryContext: {
            type: ["object", "null"],
            additionalProperties: true,
        },
        newHomebrewContent: {
            type: ["array", "null"],
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        playerRollRequest: {
            type: ["object", "null"],
            additionalProperties: true,
        },
    },
    required: ["logEntries", "actionOptions", "updatedCharacter"],
};
