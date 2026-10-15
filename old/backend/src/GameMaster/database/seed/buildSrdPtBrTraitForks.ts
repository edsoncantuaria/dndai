/**
 * Overlays PT para traços raciais SRD (`traits` resource).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { requireSnapshotDir } from '../../../utils/srdSnapshotPaths.js';
import { TRANSLATIONS_BASE } from '../../../../data/TranslatorPTBR.js';
import { TRANSLATIONS_TRAIT_DESC } from '../../../../data/TranslatorTraits.js';

export type SrdPtBrTraitForkRow = {
    type: 'trait';
    name: string;
    content: Record<string, unknown>;
    sourceIndex: string;
    sourceResource: string;
};

function buildNameMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const category of Object.values(TRANSLATIONS_BASE)) {
        for (const [en, pt] of Object.entries(category)) {
            map.set(en, pt);
        }
    }
    return map;
}

export function buildSrdPtBrTraitForks(): SrdPtBrTraitForkRow[] {
    const nameMap = buildNameMap();
    const traits = JSON.parse(
        readFileSync(join(requireSnapshotDir(), 'traits.json'), 'utf-8'),
    ) as Record<string, unknown>[];

    return traits
        .map(trait => {
            const index = String(trait.index ?? '').trim();
            if (!index) return null;

            const enName = String(trait.name ?? index);
            const ptMeta = TRANSLATIONS_TRAIT_DESC[index];
            const ptName = ptMeta?.name ?? nameMap.get(enName) ?? enName;
            const enDesc = Array.isArray(trait.desc) ? trait.desc.join('\n\n') : String(trait.desc ?? '');
            const ptDesc = ptMeta?.desc ?? enDesc;

            return {
                type: 'trait' as const,
                name: ptName,
                content: {
                    ...trait,
                    index,
                    official_index: index,
                    name: ptName,
                    desc: ptDesc.includes('\n') ? ptDesc.split(/\n\n+/).filter(Boolean) : [ptDesc],
                } as Record<string, unknown>,
                sourceIndex: index,
                sourceResource: 'traits',
            };
        })
        .filter((row): row is SrdPtBrTraitForkRow => row != null);
}
