/**
 * Catálogo de NPCs mock — conteúdo narrativo por região (Cursor Auto).
 * Gera 20 NPCs/região com ficha SRD completa; exportado para JSON via script.
 */
import type { AutoCanonNpcMockEntry, AutoCanonNpcMockFile } from './autoCanonNpcMockTypes.js';
import type { EntityTier } from '../../database/entities/types/EntityTier.js';
import type { NpcAtributosPt } from '../npcSheet.js';

type NpcBlueprint = {
    givenName: string;
    roleTitle: string;
    role: string;
    description: string;
    goal: string;
    tier: EntityTier;
    characterClass: AutoCanonNpcMockEntry['characterClass'];
    isSpellcaster: boolean;
    spells?: string[];
    mainWeaponSlug?: string;
    atributos: NpcAtributosPt;
    maxHp?: number;
    level?: number;
};

function entry(b: NpcBlueprint): AutoCanonNpcMockEntry {
    return {
        ...b,
        armorClass: b.level ? 10 + Math.floor((b.atributos.destreza - 10) / 2) : undefined,
    };
}

/** 20 NPCs por região — nomes únicos, descrições ligadas ao bioma. */
export const AUTO_CANON_NPC_BY_REGION: Record<string, { regionName: string; npcs: NpcBlueprint[] }> = {
    'selva-de-ashari': {
        regionName: 'Selva de Ashari',
        npcs: [
            entry({ givenName: 'Faelar', roleTitle: 'Guardião das Árvores', role: 'guarda', tier: 'MAJOR', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'longsword', atributos: { forca: 15, destreza: 12, constituicao: 16, inteligencia: 11, sabedoria: 14, carisma: 10 }, maxHp: 30, level: 5, description: 'Elfo de passos silenciosos que patrulha trilhas antigas; cicatrizes de garras na couraça.', goal: 'Impedir que madeireiros ashari entrem no coração da mata.' }),
            entry({ givenName: 'Nyala', roleTitle: 'Xamã dos Espíritos', role: 'sacerdote', tier: 'MAJOR', characterClass: 'cleric', isSpellcaster: true, spells: ['sacred-flame', 'cure-wounds', 'bless'], mainWeaponSlug: 'mace', atributos: { forca: 10, destreza: 11, constituicao: 13, inteligencia: 12, sabedoria: 17, carisma: 14 }, maxHp: 24, level: 4, description: 'Carrega totens de osso e ervas; fala com ancestrais antes de cada decisão da tribo.', goal: 'Restaurar o pacto entre clãs da selva e os espíritos da copa.' }),
            entry({ givenName: 'Rakan', roleTitle: 'Caçador de Pistas', role: 'caçador', tier: 'SECONDARY', characterClass: 'rogue', isSpellcaster: false, mainWeaponSlug: 'shortbow', atributos: { forca: 11, destreza: 16, constituicao: 12, inteligencia: 13, sabedoria: 15, carisma: 9 }, maxHp: 18, level: 3, description: 'Lê sinais de lama e folha; conhece atalhos que mapas imperiais ignoram.', goal: 'Rastrear predadores que passaram a caçar viajantes ashari.' }),
            entry({ givenName: 'Iri', roleTitle: 'Curandeira de Casca', role: 'curandeiro', tier: 'SECONDARY', characterClass: 'cleric', isSpellcaster: true, spells: ['spare-the-dying', 'cure-wounds'], mainWeaponSlug: 'quarterstaff', atributos: { forca: 9, destreza: 12, constituicao: 14, inteligencia: 11, sabedoria: 16, carisma: 13 }, maxHp: 16, level: 2, description: 'Faz cataplasmas com seiva de árvore-sangue; atende feridos em palhoços suspensos.', goal: 'Catalogar plantas raras antes da estação das chuvas vermelhas.' }),
            entry({ givenName: 'Torren', roleTitle: 'Escriba da Guilda Verde', role: 'informante', tier: 'INCIDENTAL', characterClass: 'bard', isSpellcaster: true, spells: ['vicious-mockery', 'prestidigitation'], mainWeaponSlug: 'dagger', atributos: { forca: 8, destreza: 14, constituicao: 10, inteligencia: 14, sabedoria: 12, carisma: 15 }, maxHp: 10, level: 1, description: 'Registra rotas de comércio ilegal de madeira em cadernos cifrados.', goal: 'Vender informação ao maior lance sem ser descoberto.' }),
            entry({ givenName: 'Maela', roleTitle: 'Dona do Refúgio Suspenso', role: 'taverneiro', tier: 'SECONDARY', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'dagger', atributos: { forca: 10, destreza: 11, constituicao: 12, inteligencia: 12, sabedoria: 13, carisma: 16 }, maxHp: 14, level: 2, description: 'Taverna em plataformas de madeira viva; serve hidromel fermentado em folha de bananeira.', goal: 'Manter neutralidade entre patrulhas ashari e contrabandistas.' }),
            entry({ givenName: 'Voss', roleTitle: 'Capitão da Milícia Verde', role: 'capitão', tier: 'MAJOR', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'longsword', atributos: { forca: 16, destreza: 13, constituicao: 15, inteligencia: 11, sabedoria: 12, carisma: 13 }, maxHp: 32, level: 5, description: 'Veterano de escaramuças na borda; treina recrutas com lanças de madeira endurecida.', goal: 'Conter incursões do Pacto da Sombra sem declarar guerra aberta.' }),
            entry({ givenName: 'Liora', roleTitle: 'Erudita dos Círculos', role: 'mago', tier: 'SECONDARY', characterClass: 'wizard', isSpellcaster: true, spells: ['fire-bolt', 'mage-hand', 'shield'], mainWeaponSlug: 'quarterstaff', atributos: { forca: 8, destreza: 13, constituicao: 11, inteligencia: 17, sabedoria: 14, carisma: 10 }, maxHp: 14, level: 3, description: 'Estuda runas em troncos fossilizados; evita fogo aberto na selva.', goal: 'Decifrar um anel de pedra que pulsa à noite.' }),
            entry({ givenName: 'Dain', roleTitle: 'Mercador de Ervas', role: 'comércio', tier: 'INCIDENTAL', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'shortsword', atributos: { forca: 10, destreza: 12, constituicao: 11, inteligencia: 13, sabedoria: 12, carisma: 14 }, maxHp: 10, level: 1, description: 'Carroça leve puxada por muares; vende especiarias a postos de fronteira.', goal: 'Fechar contrato com alquimistas de Aurathis.' }),
            entry({ givenName: 'Sera', roleTitle: 'Olheira da Trilha', role: 'ladino', tier: 'INCIDENTAL', characterClass: 'rogue', isSpellcaster: false, mainWeaponSlug: 'shortbow', atributos: { forca: 9, destreza: 15, constituicao: 10, inteligencia: 12, sabedoria: 13, carisma: 11 }, maxHp: 9, level: 1, description: 'Adolescente que avisa caravanas sobre pontes podres e ninhos de harpias.', goal: 'Juntar moeda para comprar arco de verdade.' }),
            entry({ givenName: 'Haldor', roleTitle: 'Mestre da Forja Viva', role: 'artesão', tier: 'SECONDARY', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'mace', atributos: { forca: 15, destreza: 10, constituicao: 14, inteligencia: 12, sabedoria: 11, carisma: 10 }, maxHp: 20, level: 3, description: 'Forja ferramentas com metal reciclado e resina; respeitado pelos druidas locais.', goal: 'Provar que metal e floresta podem coexistir.' }),
            entry({ givenName: 'Bruna', roleTitle: 'Acólita do Bosque', role: 'acólito', tier: 'INCIDENTAL', characterClass: 'cleric', isSpellcaster: true, spells: ['sacred-flame'], mainWeaponSlug: 'mace', atributos: { forca: 10, destreza: 10, constituicao: 12, inteligencia: 11, sabedoria: 15, carisma: 12 }, maxHp: 11, level: 1, description: 'Recém-iniciada; canta hinos ao amanhecer para acalmar feras menores.', goal: 'Ser aceita no círculo de Nyala.' }),
            entry({ givenName: 'Kael', roleTitle: 'Batedor de Fronteira', role: 'batedor', tier: 'SECONDARY', characterClass: 'rogue', isSpellcaster: false, mainWeaponSlug: 'spear', atributos: { forca: 12, destreza: 15, constituicao: 13, inteligencia: 12, sabedoria: 14, carisma: 9 }, maxHp: 17, level: 3, description: 'Marca árvores com tinta solúvel; reporta movimentação de orcs ao crepúsculo.', goal: 'Encontrar quem cortou o sinal de ontem.' }),
            entry({ givenName: 'Yara', roleTitle: 'Pescadora do Rio Esmeralda', role: 'pescador', tier: 'INCIDENTAL', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'spear', atributos: { forca: 11, destreza: 13, constituicao: 12, inteligencia: 10, sabedoria: 14, carisma: 11 }, maxHp: 10, level: 1, description: 'Conhece poços onde peixes-luz aparecem; troca isca por boatos.', goal: 'Pagar dívida de rede rasgada por piranha gigante.' }),
            entry({ givenName: 'Orin', roleTitle: 'Cartógrafo Itinerante', role: 'cartógrafo', tier: 'INCIDENTAL', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'dagger', atributos: { forca: 8, destreza: 12, constituicao: 10, inteligencia: 15, sabedoria: 13, carisma: 11 }, maxHp: 8, level: 1, description: 'Atualiza mapas para a Confederação; evita rotas marcadas com crânios.', goal: 'Publicar mapa sem erros que custem vidas.' }),
            entry({ givenName: 'Thora', roleTitle: 'Veterana das Cinzas Verdes', role: 'veterano', tier: 'MAJOR', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'longsword', atributos: { forca: 17, destreza: 11, constituicao: 16, inteligencia: 10, sabedoria: 13, carisma: 12 }, maxHp: 38, level: 6, description: 'Sobreviveu a incêndio mágico; ensina recrutas a ler vento e fumaça.', goal: 'Encontrar o mago que queimou sua aldeia natal.' }),
            entry({ givenName: 'Cedric', roleTitle: 'Menestrel de Trilha', role: 'bardo', tier: 'INCIDENTAL', characterClass: 'bard', isSpellcaster: true, spells: ['vicious-mockery', 'healing-word'], mainWeaponSlug: 'shortsword', atributos: { forca: 9, destreza: 14, constituicao: 10, inteligencia: 12, sabedoria: 11, carisma: 16 }, maxHp: 9, level: 1, description: 'Canta baladas de heróis ashari em tavernas suspensas.', goal: 'Compor canção que unifique clãs rivais.' }),
            entry({ givenName: 'Petra', roleTitle: 'Tecelã de Casca', role: 'comércio', tier: 'SECONDARY', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'dagger', atributos: { forca: 9, destreza: 14, constituicao: 11, inteligencia: 13, sabedoria: 12, carisma: 13 }, maxHp: 12, level: 2, description: 'Tece armaduras leves de fibra e resina; exporta para Porto Corsário.', goal: 'Abrir loja fixa em Aurathis.' }),
            entry({ givenName: 'Niall', roleTitle: 'Sentinela do Vale', role: 'guarda', tier: 'INCIDENTAL', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'spear', atributos: { forca: 14, destreza: 12, constituicao: 13, inteligencia: 10, sabedoria: 12, carisma: 9 }, maxHp: 12, level: 2, description: 'Guarda posto de vigia em árvore oca; dorme em rede.', goal: 'Ser promovido a patrulha central.' }),
            entry({ givenName: 'Zara', roleTitle: 'Ferreira de Lâminas Leves', role: 'ferreiro', tier: 'SECONDARY', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'shortsword', atributos: { forca: 14, destreza: 13, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 11 }, maxHp: 18, level: 3, description: 'Afia facas para caçadores; desconfia de magia arcana.', goal: 'Forjar lâmina que não enferruje na umidade da selva.' }),
        ],
    },
};

export function toMockFile(slug: string, pack: { regionName: string; npcs: NpcBlueprint[] }): AutoCanonNpcMockFile {
    return {
        regionSlug: slug,
        regionName: pack.regionName,
        source: 'cursor-auto',
        generatedAt: new Date().toISOString(),
        npcs: pack.npcs.map(entry),
    };
}
