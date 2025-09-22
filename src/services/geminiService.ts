// services/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest } from '../types';

const apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey) {
  throw new Error("A variável de ambiente VITE_API_KEY não está definida. Por favor, crie um arquivo .env na raiz do seu projeto e adicione VITE_API_KEY=sua_chave_api.");
}
const ai = new GoogleGenAI({ apiKey });
const modelName = 'gemini-1.5-flash'; // Modelo corrigido

// Intermediate type for the raw API response for ShopState
interface GeminiApiShopState extends Omit<ShopState, 'sellPrices'> {
    sellPrices?: { itemId: string; price: number }[];
}

// Intermediate type for the raw API response from Gemini
interface RawGeminiResponse {
    narration?: string;
    updatedCharacter?: Partial<Character>;
    logEntries: Omit<LogEntry, 'id'>[];
    actionOptions: string[];
    combatState?: CombatState;
    levelUpState?: Partial<LevelUpState>;
    shopState?: GeminiApiShopState;
    lootOffer?: LootOffer;
    useHitDiceRequest?: UseHitDiceRequest;
}

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        logEntries: {
            type: Type.ARRAY,
            description: "A list of log entries. Use 'narration' for story, 'combat' for battle messages, 'system' for game state changes, and 'roll' for dice rolls. Provide rich, detailed narration.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, description: "Type: 'narration', 'combat', 'system', 'roll', 'insight'." },
                    content: { type: Type.STRING },
                    rollResult: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            dice: { type: Type.STRING },
                            modifier: { type: Type.INTEGER },
                            total: { type: Type.INTEGER },
                            rolls: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                            success: { type: Type.BOOLEAN, nullable: true },
                            dc: { type: Type.INTEGER, nullable: true },
                            rollType: { type: Type.STRING }
                        },
                        nullable: true
                    }
                }
            }
        },
        updatedCharacter: {
            type: Type.OBJECT,
            description: "An object with ONLY changed character stats (e.g., `hp`, `xp`, `inventory`).",
            properties: {
                hp: { type: Type.OBJECT, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER }, temp: { type: Type.INTEGER } }, nullable: true },
                xp: { type: Type.INTEGER, nullable: true },
                inventory: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, index: { type: Type.STRING }, name: {type: Type.STRING}, quantity: {type: Type.INTEGER}, equipped: {type: Type.BOOLEAN, nullable: true} } }, nullable: true },
                currency: { type: Type.OBJECT, properties: { cp: { type: Type.INTEGER }, sp: { type: Type.INTEGER }, gp: { type: Type.INTEGER } }, nullable: true },
                conditions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { index: { type: Type.STRING }, name: { type: Type.STRING }, desc: { type: Type.ARRAY, items: {type: Type.STRING}} } }, nullable: true },
                deathSaves: { type: Type.OBJECT, properties: { successes: { type: Type.INTEGER }, failures: { type: Type.INTEGER } }, nullable: true },
                // FIX: Replaced empty properties object with a defined schema for spell slot levels to prevent API error.
                spellSlots: {
                    type: Type.OBJECT,
                    description: "Current/max spell slots for each level, e.g. { 'level1': { 'current': 2, 'max': 3 } }",
                    nullable: true,
                    properties: {
                        level1: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level2: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level3: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level4: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level5: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level6: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level7: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level8: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                        level9: { type: Type.OBJECT, nullable: true, properties: { current: { type: Type.INTEGER }, max: { type: Type.INTEGER } } },
                    }
                },
                hitDice: { type: Type.OBJECT, properties: { current: { type: Type.INTEGER }, total: { type: Type.INTEGER } }, nullable: true },
                storySoFar: { type: Type.STRING, nullable: true },
                relationships: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { npcId: {type: Type.STRING}, name: {type: Type.STRING}, description: {type: Type.STRING}, status: {type: Type.STRING} } }, nullable: true },
                journal: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, region: {type: Type.STRING}, summary: {type: Type.STRING} } }, nullable: true },
                currentRegion: { type: Type.STRING, nullable: true },
            },
            nullable: true,
        },
        actionOptions: {
            type: Type.ARRAY,
            description: "A list of 3-5 suggested, concise actions for the player.",
            items: { type: Type.STRING }
        },
        combatState: {
            type: Type.OBJECT,
            description: "The current state of combat. Update only when combat state changes.",
            properties: {
                isActive: { type: Type.BOOLEAN },
                round: { type: Type.INTEGER },
                turn: { type: Type.INTEGER },
                combatants: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            hp: { type: Type.INTEGER, nullable: true },
                            maxHp: { type: Type.INTEGER, nullable: true },
                            ac: { type: Type.INTEGER, nullable: true },
                            initiative: { type: Type.INTEGER },
                            isPlayer: { type: Type.BOOLEAN, nullable: true }
                        }
                    }
                }
            },
            nullable: true,
        },
        levelUpState: {
            type: Type.OBJECT,
            description: "Set isPending to true when character has enough XP to level up.",
            properties: { isPending: { type: Type.BOOLEAN }, newLevel: { type: Type.INTEGER, nullable: true } },
            nullable: true
        },
        shopState: {
            type: Type.OBJECT,
            description: "Set isOpen to true to open the shop UI. Provide inventory and prices. Set isHaggling to true during price negotiation.",
            properties: {
                isOpen: { type: Type.BOOLEAN },
                name: { type: Type.STRING, nullable: true },
                inventory: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            index: { type: Type.STRING },
                            name: { type: Type.STRING },
                            quantity: { type: Type.INTEGER },
                            cost: {
                                type: Type.OBJECT,
                                properties: {
                                    quantity: { type: Type.INTEGER },
                                    unit: { type: Type.STRING },
                                },
                            },
                        },
                    },
                    nullable: true,
                },
                // FIX: Changed schema for sellPrices from an object with dynamic keys to an array of objects to prevent API error.
                sellPrices: {
                    type: Type.ARRAY,
                    description: "List of player items and their sell prices in gold. e.g. [{ 'itemId': '...', 'price': 10 }]",
                    nullable: true,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            itemId: { type: Type.STRING, description: "The unique ID of the player's inventory item." },
                            price: { type: Type.INTEGER, description: "The price in gold pieces the shopkeeper will pay." }
                        },
                        required: ["itemId", "price"]
                    }
                },
                isHaggling: {
                    type: Type.BOOLEAN,
                    description: "Set to true while haggling, false when a final price is set.",
                    nullable: true,
                },
            },
            nullable: true
        },
        lootOffer: {
            type: Type.OBJECT,
            description: "Offer loot to the player instead of adding it directly to their inventory. The UI will prompt them to accept.",
            properties: {
                items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, index: { type: Type.STRING }, name: { type: Type.STRING }, quantity: { type: Type.INTEGER } } } },
                currency: { type: Type.OBJECT, properties: { cp: { type: Type.INTEGER }, sp: { type: Type.INTEGER }, gp: { type: Type.INTEGER } } }
            },
            nullable: true,
        },
        useHitDiceRequest: {
            type: Type.OBJECT,
            description: "Request the player to use their hit dice during a short rest.",
            properties: {
                maxDice: { type: Type.INTEGER },
                hitDieValue: { type: Type.INTEGER },
            },
            nullable: true,
        }
    }
};

const systemInstruction = `You are a creative and fair Dungeon Master for a solo Dungeons & Dragons 5th Edition text-based RPG. Your goal is to create a compelling, ongoing story that reacts to the player's choices.
- **Storytelling:** Weave a rich narrative. Describe the world, the people, and the consequences of the player's actions vividly.
- **Rules:** Adhere to D&D 5e rules for combat, skill checks, and character abilities, but prioritize story and fun over rigid rule-following. You are responsible for all dice rolls.
- **Player Agency:** Always present the player with meaningful choices. Use 'actionOptions' to suggest possible next steps.
- **Character State:** You are responsible for tracking all character and game state. Return ONLY the changed parts of the character state in 'updatedCharacter'.
- **JSON Output:** You MUST respond with a valid JSON object that strictly follows the provided schema. Do not include any text or formatting outside of the JSON object.
- **Combat:** When combat begins, populate the 'combatState'. Roll initiative for all creatures. On each turn, describe the actions of the NPCs and the state of the battlefield. Apply tactical rules like advantage on attacks against prone targets.
- **Resting:** During a short rest, ask the player if they want to spend Hit Dice. If so, use 'useHitDiceRequest'. During a long rest, restore HP, half of the total Hit Dice, and all spell slots.
- **Economy:** When the player enters a shop, open the 'shopState'. Provide the shop's inventory and set the 'sellPrices' for the player's items. If the player haggles, update the prices and set 'isHaggling' to true until a deal is made.
- **Language:** The game is in Brazilian Portuguese. All your narration and text must be in pt-BR.`;

// Public interface for the service, uses application domain types.
export interface GeminiResponse {
    narration?: string;
    updatedCharacter?: Partial<Character>;
    logEntries: Omit<LogEntry, 'id'>[];
    actionOptions: string[];
    combatState?: CombatState;
    levelUpState?: Partial<LevelUpState>;
    shopState?: ShopState;
    lootOffer?: LootOffer;
    useHitDiceRequest?: UseHitDiceRequest;
}

export const getGameUpdate = async (
    character: Character,
    playerAction: string,
    fullLog: LogEntry[]
): Promise<GeminiResponse | null> => {
    try {
        const characterSummary = {
            ...character,
            // Avoid sending potentially huge data if not needed
            inventory: character.inventory.map(({ id, name, quantity, equipped }) => ({ id, name, quantity, equipped })),
            classLevelsData: undefined,
            subclassLevelsData: undefined,
        };

        const prompt = `
            O estado atual do personagem é: ${JSON.stringify(characterSummary)}
            As últimas 10 entradas do log da aventura são: ${JSON.stringify(fullLog.slice(-10))}
            A ação do jogador é: "${playerAction}"

            Com base nisso, continue a aventura.
        `;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const rawData = JSON.parse(jsonText) as RawGeminiResponse;

        // Transform the raw API response into the application's domain types
        const transformedData: GeminiResponse = {
            ...rawData,
            shopState: rawData.shopState ? {
                ...rawData.shopState,
                sellPrices: (rawData.shopState.sellPrices || []).reduce((acc, item) => {
                    acc[item.itemId] = item.price;
                    return acc;
                }, {} as Record<string, number>)
            } : undefined,
        };
        
        return transformedData;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
};

export const getInitialStory = async (character: Character): Promise<GeminiResponse | null> => {
    const action = "A aventura começa. Onde eu estou e o que está acontecendo?";
    return getGameUpdate(character, action, []);
}
