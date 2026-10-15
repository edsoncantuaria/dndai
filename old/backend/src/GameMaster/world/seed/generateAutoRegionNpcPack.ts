/**
 * Gera 20 NPCs/região com ficha SRD — narrativa temática por bioma (Cursor Auto).
 */
import type { EntityTier } from '../../database/entities/types/EntityTier.js';
import type { NpcAtributosPt } from '../npcSheet.js';
import { takeUniqueGivenNames } from '../npcGlobalGivenNamePool.js';

type Blueprint = {
    givenName: string;
    roleTitle: string;
    role: string;
    tier: EntityTier;
    characterClass: 'fighter' | 'rogue' | 'wizard' | 'cleric' | 'bard' | 'commoner';
    isSpellcaster: boolean;
    spells?: string[];
    mainWeaponSlug?: string;
    atributos: NpcAtributosPt;
    maxHp: number;
    level: number;
    desc: string;
    goal: string;
};

const ROLE_PACK: Omit<Blueprint, 'givenName' | 'desc' | 'goal'>[] = [
    { roleTitle: 'Guarda do Portão', role: 'guarda', tier: 'INCIDENTAL', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'longsword', atributos: { forca: 14, destreza: 12, constituicao: 13, inteligencia: 10, sabedoria: 11, carisma: 10 }, maxHp: 12, level: 2 },
    { roleTitle: 'Mestre da Forja', role: 'artesão', tier: 'SECONDARY', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'mace', atributos: { forca: 15, destreza: 10, constituicao: 14, inteligencia: 12, sabedoria: 11, carisma: 10 }, maxHp: 20, level: 3 },
    { roleTitle: 'Mercador de Especiarias', role: 'comércio', tier: 'SECONDARY', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'shortsword', atributos: { forca: 10, destreza: 12, constituicao: 11, inteligencia: 13, sabedoria: 12, carisma: 14 }, maxHp: 14, level: 2 },
    { roleTitle: 'Escriba da Guilda', role: 'informante', tier: 'INCIDENTAL', characterClass: 'bard', isSpellcaster: true, spells: ['vicious-mockery'], mainWeaponSlug: 'dagger', atributos: { forca: 8, destreza: 14, constituicao: 10, inteligencia: 14, sabedoria: 12, carisma: 15 }, maxHp: 10, level: 1 },
    { roleTitle: 'Dona da Taverna', role: 'taverneiro', tier: 'SECONDARY', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'dagger', atributos: { forca: 10, destreza: 11, constituicao: 12, inteligencia: 12, sabedoria: 13, carisma: 16 }, maxHp: 14, level: 2 },
    { roleTitle: 'Caçador da Região', role: 'caçador', tier: 'INCIDENTAL', characterClass: 'rogue', isSpellcaster: false, mainWeaponSlug: 'shortbow', atributos: { forca: 11, destreza: 16, constituicao: 12, inteligencia: 12, sabedoria: 14, carisma: 9 }, maxHp: 11, level: 2 },
    { roleTitle: 'Curandeira do Bairro', role: 'curandeiro', tier: 'SECONDARY', characterClass: 'cleric', isSpellcaster: true, spells: ['cure-wounds', 'spare-the-dying'], mainWeaponSlug: 'quarterstaff', atributos: { forca: 9, destreza: 12, constituicao: 13, inteligencia: 11, sabedoria: 16, carisma: 13 }, maxHp: 16, level: 2 },
    { roleTitle: 'Capitão da Milícia', role: 'capitão', tier: 'MAJOR', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'longsword', atributos: { forca: 16, destreza: 13, constituicao: 15, inteligencia: 11, sabedoria: 12, carisma: 13 }, maxHp: 32, level: 5 },
    { roleTitle: 'Sacerdotisa do Templo', role: 'sacerdote', tier: 'SECONDARY', characterClass: 'cleric', isSpellcaster: true, spells: ['sacred-flame', 'bless'], mainWeaponSlug: 'mace', atributos: { forca: 10, destreza: 10, constituicao: 12, inteligencia: 11, sabedoria: 17, carisma: 14 }, maxHp: 18, level: 3 },
    { roleTitle: 'Olheiro da Guilda', role: 'ladino', tier: 'INCIDENTAL', characterClass: 'rogue', isSpellcaster: false, mainWeaponSlug: 'shortbow', atributos: { forca: 9, destreza: 15, constituicao: 10, inteligencia: 12, sabedoria: 13, carisma: 11 }, maxHp: 9, level: 1 },
    { roleTitle: 'Erudito Arcano', role: 'mago', tier: 'SECONDARY', characterClass: 'wizard', isSpellcaster: true, spells: ['fire-bolt', 'mage-hand', 'magic-missile'], mainWeaponSlug: 'quarterstaff', atributos: { forca: 8, destreza: 13, constituicao: 11, inteligencia: 17, sabedoria: 13, carisma: 10 }, maxHp: 14, level: 3 },
    { roleTitle: 'Menestrel Viajante', role: 'bardo', tier: 'INCIDENTAL', characterClass: 'bard', isSpellcaster: true, spells: ['vicious-mockery', 'healing-word'], mainWeaponSlug: 'shortsword', atributos: { forca: 9, destreza: 14, constituicao: 10, inteligencia: 12, sabedoria: 11, carisma: 16 }, maxHp: 9, level: 1 },
    { roleTitle: 'Ferreiro do Bairro', role: 'ferreiro', tier: 'SECONDARY', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'shortsword', atributos: { forca: 14, destreza: 12, constituicao: 13, inteligencia: 11, sabedoria: 10, carisma: 11 }, maxHp: 18, level: 3 },
    { roleTitle: 'Pescador do Cais', role: 'pescador', tier: 'INCIDENTAL', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'spear', atributos: { forca: 11, destreza: 13, constituicao: 12, inteligencia: 10, sabedoria: 13, carisma: 11 }, maxHp: 10, level: 1 },
    { roleTitle: 'Cartógrafo da Cidade', role: 'cartógrafo', tier: 'INCIDENTAL', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'dagger', atributos: { forca: 8, destreza: 12, constituicao: 10, inteligencia: 15, sabedoria: 13, carisma: 11 }, maxHp: 8, level: 1 },
    { roleTitle: 'Sentinela da Muralha', role: 'guarda', tier: 'INCIDENTAL', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'spear', atributos: { forca: 13, destreza: 12, constituicao: 13, inteligencia: 10, sabedoria: 12, carisma: 9 }, maxHp: 12, level: 2 },
    { roleTitle: 'Tecelã de Seda', role: 'comércio', tier: 'SECONDARY', characterClass: 'commoner', isSpellcaster: false, mainWeaponSlug: 'dagger', atributos: { forca: 9, destreza: 14, constituicao: 11, inteligencia: 13, sabedoria: 12, carisma: 13 }, maxHp: 12, level: 2 },
    { roleTitle: 'Veterano de Guerra', role: 'veterano', tier: 'MAJOR', characterClass: 'fighter', isSpellcaster: false, mainWeaponSlug: 'longsword', atributos: { forca: 17, destreza: 11, constituicao: 16, inteligencia: 10, sabedoria: 13, carisma: 12 }, maxHp: 36, level: 6 },
    { roleTitle: 'Acólito do Santuário', role: 'acólito', tier: 'INCIDENTAL', characterClass: 'cleric', isSpellcaster: true, spells: ['sacred-flame'], mainWeaponSlug: 'mace', atributos: { forca: 10, destreza: 10, constituicao: 12, inteligencia: 11, sabedoria: 15, carisma: 12 }, maxHp: 11, level: 1 },
    { roleTitle: 'Batedor dos Trilhos', role: 'batedor', tier: 'SECONDARY', characterClass: 'rogue', isSpellcaster: false, mainWeaponSlug: 'spear', atributos: { forca: 12, destreza: 15, constituicao: 13, inteligencia: 12, sabedoria: 14, carisma: 9 }, maxHp: 17, level: 3 },
];

const REGION_FLAVOR: Record<string, { hook: string; tone: string }> = {
    'abismo-veio-arcano': { hook: 'cristais e vazios arcanos', tone: 'O ar vibra com magia instável' },
    'arquipelago-nove-ilhas': { hook: 'marés e contratos entre ilhas', tone: 'Salitre no ar e cordame rangendo' },
    aurathis: { hook: 'capital imperial e intriga urbana', tone: 'Luz de lampiões e vozes no mercado' },
    'bastiao-vigia-titanica': { hook: 'muralhas contra gigantes', tone: 'Vento gelado e passos pesados ao longe' },
    'bosque-lilas-perpetuo': { hook: 'flores lilás e fadas discretas', tone: 'Pólen brilhante paira ao entardecer' },
    'cidadela-do-aco-luz': { hook: 'aço abençoado e forjas sagradas', tone: 'Clarão de metal polido ao amanhecer' },
    'clareira-conclave-verde': { hook: 'círculo druida e tratados antigos', tone: 'Musgo macio e cantos em língua antiga' },
    'confederacao-ashari': { hook: 'clãs da selva e pactos verdes', tone: 'Folhas largas e tambores distantes' },
    'covil-obsidiano': { hook: 'cavernas de obsidiana e cultos', tone: 'Eco metálico e tochas vermelhas' },
    'deserto-coroa-dourada': { hook: 'dunas e caravanas da coroa', tone: 'Calor seco e sino de caravanas' },
    'dominio-valdar-elfico': { hook: 'torres élficas e memória longa', tone: 'Música distante em pedra cantante' },
    'fortaleza-vorngard': { hook: 'guarnição de fronteira nórdica', tone: 'Neve na bigorna e cânticos de guerra' },
    'fronteira-veu-titanico': { hook: 'névoa titanica na fronteira', tone: 'Horizonte encoberto e rochas gigantes' },
    'marches-ferro-norte': { hook: 'minas e ferro do norte', tone: 'Cheiro de carvão e martelos ritmados' },
    'mina-umbra-profunda': { hook: 'profundezas e sombras mineradoras', tone: 'Escuridão azulada e goteiras' },
    'miragem-zahir': { hook: 'oásis ilusórios do deserto', tone: 'Calor tremeluzente no horizonte' },
    'passagem-veu-partido': { hook: 'passagem planar instável', tone: 'Ar frio de outro plano em rajadas' },
    'planicie-corvos-geada': { hook: 'estepe gelada e corvos de gelo', tone: 'Grama quebradiça e vento uivante' },
    'porto-corsario': { hook: 'porto livre e corsários', tone: 'Cordas, rum e gaivotas briguentas' },
    'reino-sol-nascente': { hook: 'campos ao nascer do sol', tone: 'Luz dourada e grãos recém-colhidos' },
    'republica-nove-ancoras': { hook: 'marinha republicana e âncoras', tone: 'Madeira naval e ordens ao cais' },
    'selvas-de-myr': { hook: 'selva úmida de Myr', tone: 'Orvalho espesso e gritos de macacos' },
    'sultanato-areias-douradas': { hook: 'palácios e areias do sultão', tone: 'Incenso e seda ao vento' },
    'torre-de-aetheryn': { hook: 'torre arcana isolada', tone: 'Runas pulsando na pedra cinza' },
    'tumulos-reis-areia': { hook: 'tumbas reais no deserto', tone: 'Areia fina e silêncio respeitoso' },
    'valdarin-violeta': { hook: 'florestas violetas élficas', tone: 'Pétalas escuras e luz filtrada' },
    'vila-prata-lua': { hook: 'vila sob lua prateada', tone: 'Névoa leve e sinos noturnos' },
};

export function generateAutoRegionNpcPack(
    slug: string,
    regionName: string,
    reserved: Set<string>,
) {
    const flavor = REGION_FLAVOR[slug] ?? { hook: 'fronteira do mundo conhecido', tone: 'Ar de estrada e poeira' };
    const names = takeUniqueGivenNames(ROLE_PACK.length, reserved);

    const npcs = ROLE_PACK.map((r, i) => {
        const givenName = names[i]!;
        const desc = `${r.roleTitle} em ${regionName}: ${flavor.tone}; rotina ligada a ${flavor.hook}.`;
        const goal = `Prosperar em ${regionName} sem perder ${flavor.hook} para invasores ou burocratas.`;
        return { ...r, givenName, description: desc, goal };
    });

    return { regionName, npcs };
}
