import type { EntityTier } from '../database/entities/types/EntityTier.js';
import type { BootstrapNpcDraft } from './agents/worldBootstrapNpcAgent.js';
import { formatNpcDisplayName } from './npcDisplayName.js';
import { takeUniqueGivenNames } from './npcGlobalGivenNamePool.js';
import { archetypeFromRole, buildNpcSrdBuild, npcLevelForTier } from './npcSheet.js';
import { resolveMainWeapon } from './npcSheet.js';
import type { NpcAiSheetInput } from './npcAiSheet.js';

const CANON_NPC_TEMPLATES: Array<{ role: string; roleTitle: string; tier: EntityTier }> = [
    { role: 'guarda', roleTitle: 'Guarda do Portão', tier: 'INCIDENTAL' },
    { role: 'artesão', roleTitle: 'Mestre da Forja', tier: 'SECONDARY' },
    { role: 'comércio', roleTitle: 'Mercador de Especiarias', tier: 'SECONDARY' },
    { role: 'informante', roleTitle: 'Escriba da Guilda', tier: 'INCIDENTAL' },
    { role: 'taverneiro', roleTitle: 'Dona da Taverna', tier: 'SECONDARY' },
    { role: 'caçador', roleTitle: 'Caçador da Floresta', tier: 'INCIDENTAL' },
    { role: 'curandeiro', roleTitle: 'Curandeira do Bairro', tier: 'SECONDARY' },
    { role: 'capitão', roleTitle: 'Capitão da Milícia', tier: 'MAJOR' },
    { role: 'sacerdote', roleTitle: 'Sacerdotisa do Templo', tier: 'SECONDARY' },
    { role: 'ladino', roleTitle: 'Olheiro da Guilda', tier: 'INCIDENTAL' },
    { role: 'mago', roleTitle: 'Erudito Arcano', tier: 'SECONDARY' },
    { role: 'bardo', roleTitle: 'Menestrel Viajante', tier: 'INCIDENTAL' },
    { role: 'ferreiro', roleTitle: 'Ferreiro do Bairro', tier: 'SECONDARY' },
    { role: 'pescador', roleTitle: 'Pescador do Cais', tier: 'INCIDENTAL' },
    { role: 'cartógrafo', roleTitle: 'Cartógrafo da Cidade', tier: 'SECONDARY' },
    { role: 'guarda', roleTitle: 'Sentinela da Muralha', tier: 'INCIDENTAL' },
    { role: 'comércio', roleTitle: 'Tecelã de Seda', tier: 'SECONDARY' },
    { role: 'veterano', roleTitle: 'Veterano de Guerra', tier: 'MAJOR' },
    { role: 'acólito', roleTitle: 'Acólito do Santuário', tier: 'INCIDENTAL' },
    { role: 'batedor', roleTitle: 'Batedor dos Trilhos', tier: 'SECONDARY' },
];

function srdToAiSheet(
    srd: ReturnType<typeof buildNpcSrdBuild>,
    mainWeaponSlug: string | undefined,
): NpcAiSheetInput {
    return {
        atributos: { ...srd.atributos },
        level: srd.level,
        armorClass: srd.ac,
        characterClass: srd.characterClass,
        characterClassLabel: srd.characterClassLabel,
        isSpellcaster: srd.isSpellcaster,
        spells: [...srd.spells],
        mainWeaponSlug,
    };
}

/** NPCs canônicos com ficha SRD completa (sem Gemini) — seed em massa. */
export function generateServerCanonNpcDrafts(opts: {
    count: number;
    regionSlug: string;
    regionName: string;
    heroLevel: number;
    reserved: Set<string>;
    nameOffset?: number;
}): BootstrapNpcDraft[] {
    const count = Math.max(1, Math.min(200, opts.count));
    const names = takeUniqueGivenNames(count, opts.reserved);
    const drafts: BootstrapNpcDraft[] = [];

    for (let i = 0; i < count; i++) {
        const template = CANON_NPC_TEMPLATES[i % CANON_NPC_TEMPLATES.length]!;
        const givenName = names[i]!;
        const roleTitle = template.roleTitle;
        const displayName = formatNpcDisplayName(givenName, roleTitle);
        const tier = template.tier;
        const level = npcLevelForTier(opts.heroLevel, tier);
        const archetype = archetypeFromRole(template.role);
        const srd = buildNpcSrdBuild({ level, archetype, role: template.role });
        const weapon = resolveMainWeapon(template.role, tier);

        drafts.push({
            givenName,
            roleTitle,
            displayName,
            role: template.role,
            description: `Habitante de ${opts.regionName} ligado ao ofício de ${template.role}.`,
            goal: `Prosperar como ${template.role} em ${opts.regionName}.`,
            tier,
            maxHp: srd.maxHp,
            aiSheet: srdToAiSheet(srd, weapon.itemKey),
        });
    }

    return drafts;
}
