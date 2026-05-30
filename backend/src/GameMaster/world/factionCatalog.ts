/**
 * Catálogo fixo de facções (10 arquétipos medievais) + presença no continente Aurathis.
 * Fonte única: POIs, regiões e NPCs canônicos referenciam estes slugs — não criar facções em runtime.
 */
export type FactionArchetype =
    | 'guild_adventurers'
    | 'guild_thieves'
    | 'guild_merchants'
    | 'guild_artisans'
    | 'order_faith'
    | 'circle_druids'
    | 'crown'
    | 'mariners'
    | 'college_arcane'
    | 'mercenary_company';

export type FactionChapter = {
    regionSlug: string;
    poiSlugs: string[];
    /** Papel local: sede secundária, contacto, contrabando, etc. */
    role?: string;
};

export type FactionNotableNpc = {
    slug: string;
    displayName: string;
    poiSlug: string;
    title: string;
};

export type FactionCatalogEntry = {
    slug: string;
    displayName: string;
    archetype: FactionArchetype;
    description: string;
    alignment: string;
    /** Sede principal no mapa canônico */
    headquarters: {
        regionSlug: string;
        poiSlug: string;
        label: string;
    };
    /** Capítulos / contactos em outras regiões */
    chapters?: FactionChapter[];
    /** @deprecated Preferir headquarters + chapters; mantido para compat */
    poiSlugs?: string[];
    notableNpcs?: FactionNotableNpc[];
    rivals?: string[];
    allies?: string[];
};

export const FACTION_CATALOG: FactionCatalogEntry[] = [
    {
        slug: 'guilda-aventureiros',
        displayName: 'Guilda dos Aventureiros',
        archetype: 'guild_adventurers',
        description: 'Contratos licenciados, patrulhas e registro de heróis em Aurathis.',
        alignment: 'neutral_good',
        headquarters: {
            regionSlug: 'cidadela-do-aco-luz',
            poiSlug: 'guilda-dos-auroras',
            label: 'Quartel-general dos Guardiões Prismáticos',
        },
        chapters: [
            {
                regionSlug: 'fortaleza-vorngard',
                poiSlugs: ['posto-escolta-mina'],
                role: 'Posto de contratos do gelo',
            },
            {
                regionSlug: 'bastiao-vigia-titanica',
                poiSlugs: ['arsenal-veu'],
                role: 'Recrutamento para expedições ao Véu',
            },
            {
                regionSlug: 'porto-corsario',
                poiSlugs: ['cartorio-contratos'],
                role: 'Cartas de marque pela República',
            },
        ],
        notableNpcs: [
            {
                slug: 'sera-dawnshield',
                displayName: 'Sera Dawnshield',
                poiSlug: 'guilda-dos-auroras',
                title: 'Comandante dos Auroras',
            },
            {
                slug: 'bramm-escolta-norte',
                displayName: 'Bramm Escuta-de-Gelo',
                poiSlug: 'posto-escolta-mina',
                title: 'Factor da Guilda nas Marches',
            },
        ],
        allies: ['coroa-ferro', 'ordem-crepuscular'],
        rivals: ['gremio-sombra'],
    },
    {
        slug: 'gremio-sombra',
        displayName: 'Grêmio da Sombra',
        archetype: 'guild_thieves',
        description: 'Informantes, contrabando e trabalhos discretos; negam existência oficial.',
        alignment: 'chaotic_neutral',
        headquarters: {
            regionSlug: 'porto-corsario',
            poiSlug: 'taverna-vela-negra',
            label: 'Cartografia e contrabando no cais',
        },
        chapters: [
            {
                regionSlug: 'porto-corsario',
                poiSlugs: ['enseada-pirata'],
                role: 'Ancoradouro não oficial',
            },
            {
                regionSlug: 'miragem-zahir',
                poiSlugs: ['bazar-especiarias', 'hammam-dourado'],
                role: 'Rede de especiarias e suborno',
            },
            {
                regionSlug: 'cidadela-do-aco-luz',
                poiSlugs: ['estalagem-vigilia-serena'],
                role: 'Célula dormiente sob licença dos Guardiões',
            },
            {
                regionSlug: 'valdarin-violeta',
                poiSlugs: ['cafe-oraculo'],
                role: 'Troca de segredos com magos',
            },
        ],
        notableNpcs: [
            {
                slug: 'lysandra-vela-negra',
                displayName: 'Lysandra dos Contratos Sombrios',
                poiSlug: 'taverna-vela-negra',
                title: 'Mestra do Grêmio no Porto',
            },
            {
                slug: 'zahir-sussurro-dourado',
                displayName: 'Zahir do Sussurro Dourado',
                poiSlug: 'hammam-dourado',
                title: 'Olhos do Sultão, bolso do Grêmio',
            },
        ],
        rivals: ['guilda-aventureiros', 'coroa-ferro', 'ordem-crepuscular'],
        allies: ['irmandade-mares'],
    },
    {
        slug: 'guilda-mercadores',
        displayName: 'Liga dos Mercadores',
        archetype: 'guild_merchants',
        description: 'Rotas comerciais, armazéns, câmbio e patentes de feira.',
        alignment: 'neutral',
        headquarters: {
            regionSlug: 'porto-corsario',
            poiSlug: 'cartorio-contratos',
            label: 'Registro de cargas e seguros',
        },
        chapters: [
            {
                regionSlug: 'cidadela-do-aco-luz',
                poiSlugs: ['mercado-anel-solar', 'foro-prismatico'],
                role: 'Feira real e arbitragem',
            },
            {
                regionSlug: 'miragem-zahir',
                poiSlugs: ['caravansarai-leste', 'bazar-especiarias'],
                role: 'Caravana leste',
            },
            {
                regionSlug: 'arquipelago-nove-ilhas',
                poiSlugs: ['mercado-peixe-ilhas', 'farol-tempestade'],
                role: 'Feira inter-ilhas',
            },
            {
                regionSlug: 'vila-prata-lua',
                poiSlugs: ['celeiro-coletivo'],
                role: 'Grãos do Vale Prateado',
            },
        ],
        notableNpcs: [
            {
                slug: 'isolde-contadora-velas',
                displayName: 'Isolde Maré-Viva',
                poiSlug: 'palacio-velas',
                title: 'Dogaressa e sócia honorária da Liga',
            },
            {
                slug: 'factor-anel-solar',
                displayName: 'Maestro Corvin Anel-Solar',
                poiSlug: 'mercado-anel-solar',
                title: 'Factor da Liga na Cidadela',
            },
        ],
        allies: ['coroa-ferro', 'irmandade-mares'],
        rivals: ['gremio-sombra'],
    },
    {
        slug: 'oficios-unidos',
        displayName: 'Ofícios Unidos',
        archetype: 'guild_artisans',
        description: 'Mestres ferreiros, tecelões e artífices; monopólio de guildas de ofício.',
        alignment: 'lawful_neutral',
        headquarters: {
            regionSlug: 'cidadela-do-aco-luz',
            poiSlug: 'oficina-sol-forjado',
            label: 'Armaría Sol-Forjado',
        },
        chapters: [
            {
                regionSlug: 'fortaleza-vorngard',
                poiSlugs: ['forja-corvo-geada'],
                role: 'Forja rúnica do norte',
            },
            {
                regionSlug: 'mina-umbra-profunda',
                poiSlugs: ['forja-profunda', 'altar-umbra'],
                role: 'Metal umbra (licença disputada)',
            },
            {
                regionSlug: 'valdarin-violeta',
                poiSlugs: ['bazar-nevoa-violeta'],
                role: 'Componentes e encantamentos',
            },
            {
                regionSlug: 'porto-corsario',
                poiSlugs: ['estaleiro-ancora-mestra'],
                role: 'Carpintaria naval',
            },
        ],
        notableNpcs: [
            {
                slug: 'mestre-harn',
                displayName: 'Mestre Harn',
                poiSlug: 'oficina-sol-forjado',
                title: 'Grão-Mestre do Ofício Solar',
            },
            {
                slug: 'brunna-escama-fria',
                displayName: 'Brunna Escama-Fria',
                poiSlug: 'forja-corvo-geada',
                title: 'Ferreira das Marches',
            },
        ],
        allies: ['guilda-mercadores', 'coroa-ferro'],
        rivals: ['companhia-laminas'],
    },
    {
        slug: 'ordem-crepuscular',
        displayName: 'Ordem do Crepúsculo',
        archetype: 'order_faith',
        description: 'Templários, rituais ao crepúsculo e julgamentos sagrados.',
        alignment: 'lawful_good',
        headquarters: {
            regionSlug: 'cidadela-do-aco-luz',
            poiSlug: 'templo-menor-ixolar',
            label: 'Templo Menor de Ixolar',
        },
        chapters: [
            {
                regionSlug: 'bastiao-vigia-titanica',
                poiSlugs: ['memorial-expedicoes', 'enfermaria-campo'],
                role: 'Hospitalários do Véu',
            },
            {
                regionSlug: 'vila-prata-lua',
                poiSlugs: ['capela-prata-lua'],
                role: 'Missão de Seraphenne',
            },
            {
                regionSlug: 'fortaleza-vorngard',
                poiSlugs: ['templo-anoes-odrun'],
                role: 'Clérigos de Odrun no gelo',
            },
            {
                regionSlug: 'clareira-conclave-verde',
                poiSlugs: ['pocao-cura-viva'],
                role: 'Trégua ritual com druidas',
            },
        ],
        notableNpcs: [
            {
                slug: 'prior-tomas-crepusculo',
                displayName: 'Prior Tomás do Crepúsculo',
                poiSlug: 'templo-menor-ixolar',
                title: 'Prior da Ordem na Cidadela',
            },
            {
                slug: 'irma-veil-memorial',
                displayName: 'Irmã Veil do Memorial',
                poiSlug: 'memorial-expedicoes',
                title: 'Custódia dos caídos no Bastão',
            },
        ],
        allies: ['coroa-ferro', 'guilda-aventureiros', 'circulo-druidas'],
        rivals: ['gremio-sombra', 'colegio-arcano'],
    },
    {
        slug: 'circulo-druidas',
        displayName: 'Círculo Verde',
        archetype: 'circle_druids',
        description: 'Guardiões de bosques, rios e leis antigas da Confederação Ashari.',
        alignment: 'neutral',
        headquarters: {
            regionSlug: 'clareira-conclave-verde',
            poiSlug: 'trono-musgo',
            label: 'Trono de Musgo — Grande Conclave',
        },
        chapters: [
            {
                regionSlug: 'selva-de-ashari',
                poiSlugs: ['altar-de-lichen', 'cachoeira-espiritos', 'ponte-sussurro'],
                role: 'Coração espiritual da selva',
            },
            {
                regionSlug: 'selvas-de-myr',
                poiSlugs: ['santuario-harmonia', 'clareira-driadas'],
                role: 'Pactos com driadas',
            },
            {
                regionSlug: 'bosque-lilas-perpetuo',
                poiSlugs: ['clareira-acordos-fey', 'lago-lilas'],
                role: 'Fronteira feérica',
            },
            {
                regionSlug: 'vila-prata-lua',
                poiSlugs: ['posto-milicia-vale'],
                role: 'Mediação de passagem pelo Vale',
            },
        ],
        notableNpcs: [
            {
                slug: 'kaelith-sussurro-verde',
                displayName: 'Kaelith Sussurro-Verde',
                poiSlug: 'trono-musgo',
                title: 'Grande Druida',
            },
            {
                slug: 'moss-whisper-lichen',
                displayName: 'Moss-whisper do Líquen',
                poiSlug: 'altar-de-lichen',
                title: 'Voz do Altar de Líquen',
            },
        ],
        allies: ['ordem-crepuscular'],
        rivals: ['colegio-arcano', 'oficios-unidos'],
    },
    {
        slug: 'coroa-ferro',
        displayName: 'Coroa de Ferro',
        archetype: 'crown',
        description: 'Autoridade régia unificada: patentes, impostos e soberanos das sete coroas.',
        alignment: 'lawful_neutral',
        headquarters: {
            regionSlug: 'cidadela-do-aco-luz',
            poiSlug: 'palacio-prismatico',
            label: 'Palácio Prismático — Rainha Heliana IV',
        },
        chapters: [
            {
                regionSlug: 'valdarin-violeta',
                poiSlugs: ['torre-conclave-lunar'],
                role: 'Pacto com Arquimaga (neutralidade)',
            },
            {
                regionSlug: 'miragem-zahir',
                poiSlugs: ['palacio-mil-cupulas'],
                role: 'Sultão vassalo comercial',
            },
            {
                regionSlug: 'fortaleza-vorngard',
                poiSlugs: ['salao-thane'],
                role: 'Thane juramentado',
            },
            {
                regionSlug: 'porto-corsario',
                poiSlugs: ['palacio-velas'],
                role: 'República aliada por tratado',
            },
            {
                regionSlug: 'bastiao-vigia-titanica',
                poiSlugs: ['quartel-conselho-veu'],
                role: 'Conselho do Véu (mandato real)',
            },
            {
                regionSlug: 'vila-prata-lua',
                poiSlugs: ['moinho-prata-lua'],
                role: 'Feudo da coroa',
            },
        ],
        notableNpcs: [
            {
                slug: 'rainha-heliana-iv',
                displayName: 'Heliana IV de Helios',
                poiSlug: 'palacio-prismatico',
                title: 'Rainha do Sol Nascente',
            },
            {
                slug: 'thane-gorvald',
                displayName: 'Gorvald Martelo-de-Gelo',
                poiSlug: 'salao-thane',
                title: 'Thane das Marches',
            },
        ],
        allies: ['guilda-mercadores', 'guilda-aventureiros', 'ordem-crepuscular', 'oficios-unidos'],
        rivals: ['gremio-sombra', 'companhia-laminas'],
    },
    {
        slug: 'irmandade-mares',
        displayName: 'Irmandade dos Mares',
        archetype: 'mariners',
        description: 'Capitães, cartas náuticas, faróis e o Código das Nove Âncoras.',
        alignment: 'chaotic_neutral',
        headquarters: {
            regionSlug: 'porto-corsario',
            poiSlug: 'estaleiro-ancora-mestra',
            label: 'Estaleiro Âncora-Mestra',
        },
        chapters: [
            {
                regionSlug: 'arquipelago-nove-ilhas',
                poiSlugs: ['farol-tempestade', 'mercado-peixe-ilhas'],
                role: 'Rotas entre ilhas',
            },
            {
                regionSlug: 'porto-corsario',
                poiSlugs: ['doca-pescadores', 'mercado-peixe-sal'],
                role: 'Tripulações e suprimentos',
            },
            {
                regionSlug: 'cidadela-do-aco-luz',
                poiSlugs: ['cidadela-do-aco-luz-gate'],
                role: 'Taxa de atracação solar',
            },
            {
                regionSlug: 'miragem-zahir',
                poiSlugs: ['caravansarai-leste'],
                role: 'Rota marítima de especiarias',
            },
        ],
        notableNpcs: [
            {
                slug: 'capitao-ancora-mestra',
                displayName: 'Capitão Marek Âncora-Mestra',
                poiSlug: 'estaleiro-ancora-mestra',
                title: 'Almirante informal da Irmandade',
            },
            {
                slug: 'faroleira-tempestade',
                displayName: 'Senna Faroleira',
                poiSlug: 'farol-tempestade',
                title: 'Guardiã do Farol da Tempestade',
            },
        ],
        allies: ['guilda-mercadores', 'gremio-sombra'],
        rivals: ['companhia-laminas'],
    },
    {
        slug: 'colegio-arcano',
        displayName: 'Colégio Arcano',
        archetype: 'college_arcane',
        description: 'Estudos mágicos, licenças de conjuração e arquivo planar do Domínio.',
        alignment: 'neutral',
        headquarters: {
            regionSlug: 'valdarin-violeta',
            poiSlug: 'torre-conclave-lunar',
            label: 'Torre do Conclave Lunar',
        },
        chapters: [
            {
                regionSlug: 'torre-de-aetheryn',
                poiSlugs: ['observatorio-primordial', 'laboratorio-planar'],
                role: 'Pináculo planar',
            },
            {
                regionSlug: 'valdarin-violeta',
                poiSlugs: ['biblioteca-vazia', 'jardim-das-constelacoes'],
                role: 'Arquivo e observação',
            },
            {
                regionSlug: 'cidadela-do-aco-luz',
                poiSlugs: ['academia-prismatica'],
                role: 'Embaixada arcana (licenças solares)',
            },
            {
                regionSlug: 'passagem-veu-partido',
                poiSlugs: ['observatorio-ruina'],
                role: 'Vigília do Véu Titânico',
            },
        ],
        notableNpcs: [
            {
                slug: 'lireth-moondusk',
                displayName: 'Lireth Moondusk',
                poiSlug: 'torre-conclave-lunar',
                title: 'Arquimaga do Domínio',
            },
            {
                slug: 'astromante-primordial',
                displayName: 'Vael Primordiário',
                poiSlug: 'observatorio-primordial',
                title: 'Curador do Observatório',
            },
        ],
        allies: ['coroa-ferro'],
        rivals: ['ordem-crepuscular', 'circulo-druidas'],
    },
    {
        slug: 'companhia-laminas',
        displayName: 'Companhia das Lâminas',
        archetype: 'mercenary_company',
        description: 'Espadas alugadas, escoltas e guarnições sem lealdade fixa além do contrato.',
        alignment: 'neutral',
        headquarters: {
            regionSlug: 'fortaleza-vorngard',
            poiSlug: 'salao-thane',
            label: 'Contratos no Salão do Thane',
        },
        chapters: [
            {
                regionSlug: 'bastiao-vigia-titanica',
                poiSlugs: ['quartel-conselho-veu', 'arsenal-veu'],
                role: 'Mercenários do Véu',
            },
            {
                regionSlug: 'planicie-corvos-geada',
                poiSlugs: ['acampamento-corvo-branco', 'refugio-mineradores'],
                role: 'Escolta de minas',
            },
            {
                regionSlug: 'miragem-zahir',
                poiSlugs: ['jardim-sultao'],
                role: 'Guarda pessoal do Sultão (temporário)',
            },
            {
                regionSlug: 'deserto-coroa-dourada',
                poiSlugs: ['caravana-perdida'],
                role: 'Recuperação de caravanas',
            },
            {
                regionSlug: 'cidadela-do-aco-luz',
                poiSlugs: ['foro-prismatico'],
                role: 'Arbitragem de contratos públicos',
            },
        ],
        notableNpcs: [
            {
                slug: 'capitao-laminas-geada',
                displayName: 'Capitão Rask Lâmina-de-Gelo',
                poiSlug: 'acampamento-corvo-branco',
                title: 'Comandante de campo',
            },
            {
                slug: 'contramestre-vorngard',
                displayName: 'Contramestre Yara Vorngard',
                poiSlug: 'salao-thane',
                title: 'Negociadora de contratos',
            },
        ],
        allies: ['gremio-sombra'],
        rivals: ['coroa-ferro', 'guilda-aventureiros', 'oficios-unidos'],
    },
];

/** POIs que revelam cada facção ao visitar */
export function getFactionDiscoveryPoiSlugs(entry: FactionCatalogEntry): string[] {
    const set = new Set<string>();
    set.add(entry.headquarters.poiSlug);
    for (const ch of entry.chapters ?? []) {
        for (const p of ch.poiSlugs) set.add(p);
    }
    for (const n of entry.notableNpcs ?? []) {
        set.add(n.poiSlug);
    }
    for (const p of entry.poiSlugs ?? []) set.add(p);
    return [...set];
}

for (const entry of FACTION_CATALOG) {
    entry.poiSlugs = getFactionDiscoveryPoiSlugs(entry);
}

const bySlug = new Map(FACTION_CATALOG.map(e => [e.slug, e]));

export function getFactionCatalogEntry(slug: string): FactionCatalogEntry | undefined {
    return bySlug.get(slug);
}

export function isCatalogFaction(slug: string): boolean {
    return bySlug.has(slug);
}

export function listCatalogFactionSlugs(): string[] {
    return FACTION_CATALOG.map(e => e.slug);
}

export function findFactionsByPoiSlug(poiSlug: string): FactionCatalogEntry[] {
    const norm = poiSlug.trim().toLowerCase();
    return FACTION_CATALOG.filter(e =>
        getFactionDiscoveryPoiSlugs(e).some(p => p.toLowerCase() === norm),
    );
}

export function findFactionsByRegionSlug(regionSlug: string): FactionCatalogEntry[] {
    const norm = regionSlug.trim().toLowerCase();
    return FACTION_CATALOG.filter(e => {
        if (e.headquarters.regionSlug.toLowerCase() === norm) return true;
        return (e.chapters ?? []).some(ch => ch.regionSlug.toLowerCase() === norm);
    });
}

/** Visão agregada para API / documentação */
export function describeFactionWorldBindings(): Array<{
    slug: string;
    displayName: string;
    headquarters: FactionCatalogEntry['headquarters'];
    chapters: FactionChapter[];
    poiSlugs: string[];
    notableNpcs: FactionNotableNpc[];
    rivals: string[];
    allies: string[];
}> {
    return FACTION_CATALOG.map(e => ({
        slug: e.slug,
        displayName: e.displayName,
        headquarters: e.headquarters,
        chapters: e.chapters ?? [],
        poiSlugs: getFactionDiscoveryPoiSlugs(e),
        notableNpcs: e.notableNpcs ?? [],
        rivals: e.rivals ?? [],
        allies: e.allies ?? [],
    }));
}
