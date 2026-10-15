export type ModuleCompatibilityRule = {
    moduleId: string;
    version: string;
    conflictsWith?: string[];
    requires?: string[];
};

export const MODULE_COMPATIBILITY: ModuleCompatibilityRule[] = [
    {
        moduleId: 'srd-ptbr-core',
        version: '1.0.0',
        conflictsWith: [],
    },
    {
        moduleId: 'race-custom-a',
        version: '1.0.0',
        conflictsWith: ['race-custom-b'],
    },
    {
        moduleId: 'race-custom-b',
        version: '1.0.0',
        conflictsWith: ['race-custom-a'],
    },
];

export function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
    if (!m) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function isVersionCompatible(installed: string, required: string): boolean {
    const a = parseSemver(installed);
    const b = parseSemver(required);
    if (!a || !b) return installed === required;
    return a.major === b.major && (a.minor > b.minor || (a.minor === b.minor && a.patch >= b.patch));
}

export type InstalledModuleRef = { moduleId: string; version: string; kind?: string };

export function validateModuleCompatibility(
    installed: InstalledModuleRef[],
    candidate: InstalledModuleRef,
): { ok: boolean; reason?: string } {
    const rule = MODULE_COMPATIBILITY.find(
        r => r.moduleId.toLowerCase() === candidate.moduleId.toLowerCase(),
    );

    for (const mod of installed) {
        if (mod.moduleId.toLowerCase() === candidate.moduleId.toLowerCase()) {
            return { ok: false, reason: `Módulo "${candidate.moduleId}" já instalado.` };
        }
        const modRule = MODULE_COMPATIBILITY.find(
            r => r.moduleId.toLowerCase() === mod.moduleId.toLowerCase(),
        );
        const conflicts = rule?.conflictsWith ?? modRule?.conflictsWith ?? [];
        if (conflicts.some(c => c.toLowerCase() === mod.moduleId.toLowerCase())) {
            return {
                ok: false,
                reason: `Conflito: "${candidate.moduleId}" não combina com "${mod.moduleId}".`,
            };
        }
    }

    if (rule?.requires?.length) {
        for (const req of rule.requires) {
            const has = installed.some(i => i.moduleId.toLowerCase() === req.toLowerCase());
            if (!has) {
                return { ok: false, reason: `Módulo "${candidate.moduleId}" requer "${req}".` };
            }
        }
    }

    if (candidate.version && rule?.version && !isVersionCompatible(candidate.version, rule.version)) {
        return {
            ok: false,
            reason: `Versão ${candidate.version} incompatível com ${rule.version}.`,
        };
    }

    return { ok: true };
}
