// backend/src/schemas/validationSchemas.ts
import { z } from 'zod';

// --- Auth ---
const usernameRegex = /^[a-zA-Z0-9]+$/;
const usernameSchema = z.string()
    .trim()
    .min(2, "O nome de usuário deve ter pelo menos 2 caracteres.")
    .max(30, "O nome de usuário deve ter no máximo 30 caracteres.")
    .regex(usernameRegex, "O nome de usuário deve conter apenas letras e números.");

export const RegisterSchema = z.object({
    username: usernameSchema,
    email: z.string().trim().email("Formato de email inválido."),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export const LoginSchema = z.object({
    login: z.string()
        .trim()
        .min(1, "Informe seu email ou nome de usuário.")
        .max(100, "O identificador de login é muito longo.")
        .refine((value) => {
            if (value.includes('@')) {
                return z.string().email().safeParse(value).success;
            }
            return value.length >= 2 && value.length <= 30 && usernameRegex.test(value);
        }, "Informe um email válido ou nome de usuário com letras e números."),
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
    maxOutputTokens: z.number().min(256).max(4096),
});

export const SettingsSchema = z.object({
    model: z.string(),
    ttsModel: z.string(),
    ttsVoice: z.string(),
    narrationVoice: z.enum(['faber', 'razo', 'miro', 'dii']).optional(),
    narrationSpeed: z.enum(['rapido', 'normal', 'lento', 'pausado']).optional(),
    apiKey: z.string().optional(),
    generationConfig: GenerationConfigSchema,
    volume: z.number().min(0).max(1),
    isMuted: z.boolean(),
    playMenuMusic: z.boolean(),
    playAmbientMusic: z.boolean().default(true),
    useAiHomebrew: z.boolean().default(true), // Novo campo
});

// --- Sessao ---
export const CreateSessaoSchema = z.object({
    nome: z.string().min(1, "O nome da sessão é obrigatório.").max(100),
    characterId: z.number().positive("ID do personagem inválido."),
    clientInstanceId: z.string().trim().min(8).max(64).optional(),
    forceNew: z.boolean().optional(),
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
    raceIndex: z.string().min(1).optional(),
    race: z.string().min(1),
    subraceIndex: z.string().nullable().optional(),
    subrace: z.string().nullable(),
    draconicAncestry: z.string().optional(),
    classIndex: z.string().min(1).optional(),
    characterClass: z.string().min(1),
    subclassFlavor: z.string().nullable(),
    backgroundIndex: z.string().min(1).optional(),
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
export const HomebrewSourceKindSchema = z.enum(['original', 'translation', 'fork']);

export const CreateHomebrewSchema = z.object({
    type: z.enum(['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat', 'skill', 'translation']),
    name: z.string().min(1, "O nome do conteúdo é obrigatório."),
    content: z.record(z.any(), z.any()).refine(val => Object.keys(val).length > 0, { message: "O conteúdo não pode estar vazio." }),
    isPublic: z.boolean().optional().default(false),
    createdBy: z.enum(['user', 'ai']).optional().default('user'),
    dependencies: z.array(z.string()).optional(),
    sourceKind: HomebrewSourceKindSchema.optional().default('original'),
    sourceResource: z.string().trim().min(1).max(64).optional().nullable(),
    sourceIndex: z.string().trim().min(1).max(128).optional().nullable(),
    locale: z.string().trim().min(2).max(16).optional().default('pt-BR'),
});

export const CreateFromSrdSchema = z.object({
    type: z.enum(['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat', 'skill']),
    name: z.string().min(1),
    sourceKind: z.enum(['translation', 'fork']),
    sourceResource: z.string().trim().min(1).max(64),
    sourceIndex: z.string().trim().min(1).max(128),
    overrides: z.record(z.any(), z.any()).default({}),
    isPublic: z.boolean().optional().default(false),
    locale: z.string().trim().min(2).max(16).optional().default('pt-BR'),
    dependencies: z.array(z.string()).optional(),
});

// --- Bundle ---
export const CreateBundleSchema = z.object({
    name: z.string().min(1, "O nome do pacote é obrigatório."),
    description: z.string().min(1, "A descrição é obrigatória."),
    contentIds: z.array(z.string()).min(1, "O pacote deve ter pelo menos um item."),
});

export const UpdateBundleSchema = CreateBundleSchema.partial();

const HomebrewContentTypeEnum = z.enum([
    'race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat', 'skill',
]);

export const BundleExportContentSchema = z.object({
    exportKey: z.string().min(1),
    type: HomebrewContentTypeEnum,
    name: z.string().min(1),
    content: z.record(z.any(), z.any()),
    sourceKind: HomebrewSourceKindSchema.optional().default('original'),
    sourceResource: z.string().nullable().optional(),
    sourceIndex: z.string().nullable().optional(),
    locale: z.string().optional(),
    dependencyKeys: z.array(z.string()).optional(),
});

export const BundleExportManifestSchema = z.object({
    formatVersion: z.literal(1),
    exportedAt: z.string(),
    bundle: z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        isPublic: z.boolean().optional(),
    }),
    contents: z.array(BundleExportContentSchema).min(1),
});

export const ImportBundleSchema = z.object({
    manifest: BundleExportManifestSchema,
    makePublic: z.boolean().optional(),
});
