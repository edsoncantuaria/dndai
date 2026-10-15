/**
 * Sincroniza equipamento mecânico dos antecedentes PT com SRD/PHB (5e-srd-api).
 * Uso: tsx backend/scripts/syncBackgroundEquipment.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backgroundsPath = join(__dirname, '../data/backgrounds.json');
const srdRawPath = join(__dirname, '../../data/srd/2014/raw/backgrounds.json');

type EqRef = { index: string; name: string; url: string };
type FixedItem = { equipment: EqRef; quantity: number };
type EquipChoice = Record<string, unknown>;

const eq = (index: string, name: string): EqRef => ({
    index,
    name,
    url: `/api/equipment/${index}`,
});

const cat = (index: string, name: string) => ({
    option_set_type: 'equipment_category',
    equipment_category: { index, name, url: `/api/equipment-categories/${index}` },
});

const counted = (index: string, name: string, count = 1) => ({
    option_type: 'counted_reference',
    count,
    of: eq(index, name),
});

const MECHANICAL: Record<
    string,
    { starting_equipment: FixedItem[]; starting_equipment_options: EquipChoice[] }
> = {
    acolyte: {
        starting_equipment: [
            { equipment: eq('clothes-common', 'Roupas Comuns'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: 'Um símbolo sagrado',
                from: cat('holy-symbols', 'Símbolos Sagrados'),
            },
        ],
    },
    criminal: {
        starting_equipment: [
            { equipment: eq('crowbar', 'Pé de cabra'), quantity: 1 },
            { equipment: eq('clothes-dark-common-hooded', 'Roupas escuras comuns com capuz'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: 'Um conjunto de jogos',
                from: cat('gaming-sets', 'Conjuntos de Jogos'),
            },
        ],
    },
    entertainer: {
        starting_equipment: [
            { equipment: eq('clothes-costume', 'Roupas de Fantasia'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: 'Um instrumento musical',
                from: cat('musical-instruments', 'Instrumentos Musicais'),
            },
            {
                choose: 1,
                type: 'equipment',
                desc: 'Favor de um admirador',
                from: {
                    option_set_type: 'options_array',
                    options: [
                        counted('love-letter', 'Carta de amor'),
                        counted('lock-of-hair', 'Mecha de cabelo'),
                        counted('trinket-from-an-admirer', 'Bugiganga de um admirador'),
                    ],
                },
            },
        ],
    },
    'folk-hero': {
        starting_equipment: [
            { equipment: eq('shovel', 'Pá'), quantity: 1 },
            { equipment: eq('iron-pot', 'Pote de Ferro'), quantity: 1 },
            { equipment: eq('clothes-common', 'Roupas Comuns'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: 'Ferramentas de artesão (um tipo à sua escolha)',
                from: cat('artisans-tools', 'Ferramentas de Artesão'),
            },
        ],
    },
    'guild-artisan': {
        starting_equipment: [
            { equipment: eq('letter-from-your-guild', 'Carta da sua Guilda'), quantity: 1 },
            { equipment: eq('clothes-travelers', 'Roupas de Viajante'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: 'Ferramentas de artesão (um tipo à sua escolha)',
                from: cat('artisans-tools', 'Ferramentas de Artesão'),
            },
        ],
    },
    noble: {
        starting_equipment: [
            { equipment: eq('clothes-fine', 'Roupas Finas'), quantity: 1 },
            { equipment: eq('signet-ring', 'Anel de Sinete'), quantity: 1 },
            { equipment: eq('scroll-of-pedigree', 'Pergaminho de Linhagem'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: 'Um conjunto de jogos',
                from: cat('gaming-sets', 'Conjuntos de Jogos'),
            },
        ],
    },
    outlander: {
        starting_equipment: [
            { equipment: eq('hunting-trap', 'Armadilha de Caça'), quantity: 1 },
            { equipment: eq('trophy-from-an-animal-you-killed', 'Troféu de um animal que você matou'), quantity: 1 },
            { equipment: eq('clothes-travelers', 'Roupas de Viajante'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: '(a) um cajado ou (b) qualquer arma simples',
                from: {
                    option_set_type: 'options_array',
                    options: [
                        counted('staff', 'Cajado'),
                        {
                            option_type: 'choice',
                            choice: {
                                choose: 1,
                                type: 'equipment',
                                desc: 'Qualquer arma simples',
                                from: cat('simple-weapons', 'Armas Simples'),
                            },
                        },
                    ],
                },
            },
        ],
    },
    sailor: {
        starting_equipment: [
            { equipment: eq('belaying-pin-club', 'Pino de Amarração (Clava)'), quantity: 1 },
            { equipment: eq('rope-silk-50-feet', 'Corda de Seda (15 metros)'), quantity: 1 },
            { equipment: eq('lucky-charm', 'Amuleto da Sorte'), quantity: 1 },
            { equipment: eq('clothes-common', 'Roupas Comuns'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: '(a) uma adaga ou (b) uma espada curta',
                from: {
                    option_set_type: 'options_array',
                    options: [
                        counted('dagger', 'Adaga'),
                        counted('shortsword', 'Espada Curta'),
                    ],
                },
            },
        ],
    },
    soldier: {
        starting_equipment: [
            { equipment: eq('insignia-of-rank', 'Insígnia de Patente'), quantity: 1 },
            { equipment: eq('trophy-from-a-fallen-enemy', 'Troféu de um Inimigo Caído'), quantity: 1 },
            { equipment: eq('bone-dice-set', 'Conjunto de Dados de Osso'), quantity: 1 },
            { equipment: eq('clothes-common', 'Roupas Comuns'), quantity: 1 },
            { equipment: eq('pouch', 'Bolsa'), quantity: 1 },
        ],
        starting_equipment_options: [
            {
                choose: 1,
                type: 'equipment',
                desc: '(a) uma arma marcial e um escudo ou (b) duas armas marciais',
                from: {
                    option_set_type: 'options_array',
                    options: [
                        {
                            option_type: 'multiple',
                            items: [
                                {
                                    option_type: 'choice',
                                    choice: {
                                        choose: 1,
                                        type: 'equipment',
                                        desc: 'Uma arma marcial',
                                        from: cat('martial-weapons', 'Armas Marciais'),
                                    },
                                },
                                counted('shield', 'Escudo'),
                            ],
                        },
                        {
                            option_type: 'choice',
                            choice: {
                                choose: 2,
                                type: 'equipment',
                                desc: 'Duas armas marciais',
                                from: cat('martial-weapons', 'Armas Marciais'),
                            },
                        },
                    ],
                },
            },
        ],
    },
};

function loadSrdAcolyte(): EquipChoice[] | null {
    try {
        const raw = JSON.parse(readFileSync(srdRawPath, 'utf-8')) as Array<Record<string, unknown>>;
        const acolyte = raw.find(b => b.index === 'acolyte');
        return (acolyte?.starting_equipment_options as EquipChoice[]) ?? null;
    } catch {
        return null;
    }
}

const data = JSON.parse(readFileSync(backgroundsPath, 'utf-8')) as {
    results: Array<Record<string, unknown>>;
};

const srdAcolyteOpts = loadSrdAcolyte();
if (srdAcolyteOpts?.length && MECHANICAL.acolyte) {
    MECHANICAL.acolyte.starting_equipment_options = srdAcolyteOpts.map(o => ({
        ...o,
        desc: (o as { desc?: string }).desc ?? 'Um símbolo sagrado',
    }));
}

let updated = 0;
for (const bg of data.results) {
    const index = String(bg.index ?? '');
    const patch = MECHANICAL[index];
    if (!patch) continue;
    bg.starting_equipment = patch.starting_equipment;
    bg.starting_equipment_options = patch.starting_equipment_options;
    updated++;
}

writeFileSync(backgroundsPath, `${JSON.stringify(data, null, 4)}\n`, 'utf-8');
console.log(`[syncBackgroundEquipment] ${updated} antecedentes atualizados em ${backgroundsPath}`);
