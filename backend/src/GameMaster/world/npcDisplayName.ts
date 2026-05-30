/** Formato canônico de nome de NPC: "Uldric, Mestre da Forja". */

export function formatNpcDisplayName(givenName: string, roleTitle: string): string {
    const nome = givenName.trim();
    const titulo = roleTitle.trim();
    if (!nome) return titulo;
    if (!titulo) return nome;
    if (nome.toLowerCase() === titulo.toLowerCase()) return nome;
    if (nome.includes(',') && nome.toLowerCase().includes(titulo.toLowerCase())) return nome;
    return `${nome}, ${titulo}`;
}

export function parseNpcDisplayName(displayName: string): { givenName: string; roleTitle: string } {
    const raw = displayName.trim();
    const comma = raw.indexOf(',');
    if (comma > 0) {
        return {
            givenName: raw.slice(0, comma).trim(),
            roleTitle: raw.slice(comma + 1).trim(),
        };
    }
    return { givenName: raw, roleTitle: raw };
}

/** Aceita resposta LLM nova (givenName+roleTitle) ou legado (só displayName). */
export function normalizeBootstrapNpcIdentity(input: {
    givenName?: string;
    roleTitle?: string;
    displayName?: string;
}): { givenName: string; roleTitle: string; displayName: string } {
    let givenName = input.givenName?.trim() ?? '';
    let roleTitle = input.roleTitle?.trim() ?? '';
    const legacy = input.displayName?.trim() ?? '';

    if (givenName && roleTitle) {
        return {
            givenName,
            roleTitle,
            displayName: formatNpcDisplayName(givenName, roleTitle),
        };
    }

    if (legacy) {
        const parsed = parseNpcDisplayName(legacy);
        givenName = givenName || parsed.givenName;
        roleTitle = roleTitle || parsed.roleTitle;
        if (!roleTitle || givenName === roleTitle) {
            roleTitle = legacy;
        }
        return {
            givenName,
            roleTitle,
            displayName: formatNpcDisplayName(givenName, roleTitle),
        };
    }

    throw new Error('NPC sem givenName/roleTitle nem displayName');
}
