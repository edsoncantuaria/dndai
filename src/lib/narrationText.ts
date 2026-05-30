/** Remove parágrafo final redundante (ex.: sensoryAnchor colado na narração). */
export function dedupeSensoryTail(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;

    const parts = trimmed.split(/\n\n+/);
    if (parts.length < 2) return stripInlineSensoryTail(trimmed);

    const last = parts[parts.length - 1]!.trim();
    const body = parts.slice(0, -1).join('\n\n');
    if (!last || last.length > 160) return trimmed;

    const bodyLower = body.toLowerCase();
    const lastLower = last.toLowerCase();
    if (bodyLower.includes(lastLower)) {
        return body.trim();
    }

    const fragments = last
        .split(/[,;]/)
        .map(f => f.trim().toLowerCase())
        .filter(f => f.length >= 5);
    if (fragments.length >= 2) {
        const hits = fragments.filter(f => bodyLower.includes(f));
        if (hits.length >= Math.ceil(fragments.length * 0.66)) {
            return body.trim();
        }
    }

    return trimmed;
}

function stripInlineSensoryTail(text: string): string {
    const match = text.match(/^([\s\S]+?)\s+([^.!?]{8,120}[.!?]?)\s*$/);
    if (!match) return text;
    const body = match[1]!;
    const tail = match[2]!.trim();
    const fragments = tail
        .split(/[,;]/)
        .map(f => f.trim().toLowerCase())
        .filter(f => f.length >= 5);
    if (fragments.length < 2) return text;
    const bodyLower = body.toLowerCase();
    const hits = fragments.filter(f => bodyLower.includes(f));
    if (hits.length >= Math.ceil(fragments.length * 0.66)) {
        return body.trim();
    }
    return text;
}
