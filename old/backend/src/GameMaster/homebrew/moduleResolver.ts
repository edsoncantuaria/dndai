import { PenaiDataSource } from '../database/data-source.js';
import { SessionInstalledModule } from '../database/entities/SessionInstalledModule.js';
import { penaiEnv } from '../../config/penaiEnv.js';
import { validateModuleCompatibility } from './compatibilityMatrix.js';

const SRD_CLASS_INDICES = new Set([
    'barbarian',
    'bard',
    'cleric',
    'druid',
    'fighter',
    'monk',
    'paladin',
    'ranger',
    'rogue',
    'sorcerer',
    'warlock',
    'wizard',
]);

export async function listInstalledModules(sessionId: number): Promise<SessionInstalledModule[]> {
    return PenaiDataSource.getRepository(SessionInstalledModule).find({ where: { sessionId } });
}

export async function canInstallResourceModule(sessionId: number): Promise<boolean> {
    const modules = await listInstalledModules(sessionId);
    const resourceCount = modules.filter(m =>
        ['race', 'spellbook', 'rule_patch'].includes(m.kind),
    ).length;
    return resourceCount < penaiEnv.PENAI_MAX_RESOURCE_MODULES;
}

export async function validateModuleInstall(
    sessionId: number,
    candidate: { moduleId: string; version: string; kind?: string },
): Promise<{ ok: boolean; reason?: string }> {
    const modules = await listInstalledModules(sessionId);
    const refs = modules.map(m => ({
        moduleId: m.moduleId,
        version: m.version ?? '1.0.0',
        kind: m.kind,
    }));
    return validateModuleCompatibility(refs, candidate);
}

export async function assertResourceAllowedForSession(
    sessionId: number,
    resourceKind: 'class' | 'spell' | 'item' | 'race',
    resourceIndex: string,
): Promise<{ allowed: boolean; reason?: string }> {
    const index = resourceIndex.trim().toLowerCase();
    if (!index) return { allowed: true };

    if (resourceKind === 'class' && SRD_CLASS_INDICES.has(index)) {
        return { allowed: true };
    }
    if (resourceKind === 'race' && (index === 'human' || index.startsWith('srd-'))) {
        return { allowed: true };
    }

    const modules = await listInstalledModules(sessionId);
    const installed = modules.some(m => {
        if (m.moduleId.toLowerCase() === index) return true;
        const payload = (m.payload ?? {}) as Record<string, unknown>;
        const candidates = [
            payload.index,
            payload.classIndex,
            payload.spellIndex,
            payload.itemIndex,
            payload.raceIndex,
        ];
        return candidates.some(c => typeof c === 'string' && c.toLowerCase() === index);
    });

    if (!installed) {
        return {
            allowed: false,
            reason: `Recurso "${resourceIndex}" não está instalado nesta sessão (homebrew).`,
        };
    }
    return { allowed: true };
}
