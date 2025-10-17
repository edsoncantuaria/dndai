// backend/src/schemas/validationSchemas.ts
import { z } from 'zod';

// --- Auth ---
export const RegisterSchema = z.object({
    username: z.string().min(3, "O nome de usuário deve ter pelo menos 3 caracteres.").max(50),
    email: z.string().email("Formato de email inválido."),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export const LoginSchema = z.object({
    email: z.string().email("Formato de email inválido."),
    password: z.string().min(1, "A senha é obrigatória."),
});

// --- License ---
export const ActivateLicenseSchema = z.object({
    key: z.string().min(1, "A chave de licença é obrigatória."),
});

// --- Settings ---
export const GenerationConfigSchema = z.object({
    temperature: z.number().min(0).max(1),
    topP: z.number().min(0).max(1),
    topK: z.number().min(1),
    maxOutputTokens: z.number().min(1),
});

export const SettingsSchema = z.object({
    model: z.string(),
    ttsModel: z.string(),
    imageModel: z.string(),
    ttsVoice: z.string(),
    apiKey: z.string().optional(),
    generationConfig: GenerationConfigSchema,
    volume: z.number().min(0).max(1),
    isMuted: z.boolean(),
    playMenuMusic: z.boolean(),
    useAiHomebrew: z.boolean().default(true),
});

// --- Sessao ---
export const CreateSessaoSchema = z.object({
    nome: z.string().min(1, "O nome da sessão é obrigatório.").max(100),
    characterId: z.number().positive("ID do personagem inválido."),
});

// --- Character ---
const AttributesSchema = z.object({
    strength: z.number(),
    dexterity: z.number(),
    constitution: z.number(),
    intelligence: z.number(),
    wisdom: z.number(),
    charisma: z.number(),
});

const ApiListItemSchema = z.object({
    index: z.string(),
    name: z.string(),
    url: z.string(),
});

const InventoryItemSchema = z.any(); 
const FeatSchema = z.any();

export const NewCharacterInfoSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    sex: z.enum(['Masculino', 'Feminino', 'Outro']),
    hairStyle: z.enum(['Careca', 'Curto', 'Médio', 'Longo']),
    beardStyle: z.enum(['Sem Barba', 'Curta', 'Grande']),
    skinColor: z.enum(['Branca', 'Parda', 'Negra', 'Indígena', 'Amarela']),
    race: z.string().min(1),
    subrace: z.string().nullable(),
    draconicAncestry: z.string().optional(),
    characterClass: z.string().min(1),
    subclassFlavor: z.string().nullable(),
    background: z.string().min(1),
    alignment: z.string().min(1),
    attributes: AttributesSchema,
    proficiencies: z.array(ApiListItemSchema),
    traits: z.array(ApiListItemSchema),
    languages: z.array(z.string()),
    inventory: z.array(InventoryItemSchema),
    spells: z.array(z.string()),
    backstory: z.string(),
    personalityTraits: z.array(z.string()),
    ideal: z.string(),
    bond: z.string(),
    flaw: z.string(),
    feats: z.array(FeatSchema),
    hitDie: z.number(),
    subclass: z.string().nullable(),
    level: z.number().optional().default(1),
    homebrewIds: z.array(z.string()).optional(), // IDs para raça, classe, antecedente.
});

// --- Homebrew ---
export const CreateHomebrewSchema = z.object({
    type: z.enum(['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat']),
    name: z.string().min(1, "O nome do conteúdo é obrigatório."),
    content: z.record(z.any(), z.any()).refine(val => Object.keys(val).length > 0, { message: "O conteúdo não pode estar vazio." }),
    isPublic: z.boolean().optional().default(false),
    createdBy: z.enum(['user', 'ai']).optional().default('user'),
    dependencies: z.array(z.string()).optional(),
});

// --- Bundle ---
export const CreateBundleSchema = z.object({
    name: z.string().min(1, "O nome do pacote é obrigatório."),
    description: z.string().min(1, "A descrição é obrigatória."),
    contentIds: z.array(z.string()).min(1, "O pacote deve ter pelo menos um item."),
});
