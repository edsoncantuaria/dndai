/**
 * Extrai texto parcial do campo "narration" enquanto o JSON ainda está incompleto.
 */
export function extractStreamingNarrationPreview(
    buffer: string,
    alreadyEmitted: number,
): { preview: string; emittedLength: number } {
    const keyMatch = buffer.match(/"narration"\s*:\s*"/);
    if (!keyMatch || keyMatch.index === undefined) {
        return { preview: '', emittedLength: alreadyEmitted };
    }

    let i = keyMatch.index + keyMatch[0].length;
    let decoded = '';
    while (i < buffer.length) {
        const ch = buffer[i];
        if (ch === '"') {
            break;
        }
        if (ch === '\\' && i + 1 < buffer.length) {
            const next = buffer[i + 1];
            if (next === 'n') decoded += '\n';
            else if (next === 't') decoded += '\t';
            else if (next === 'r') decoded += '\r';
            else if (next === '"') decoded += '"';
            else if (next === '\\') decoded += '\\';
            else decoded += next;
            i += 2;
            continue;
        }
        decoded += ch;
        i += 1;
    }

    if (decoded.length <= alreadyEmitted) {
        return { preview: '', emittedLength: alreadyEmitted };
    }

    const preview = decoded.slice(alreadyEmitted);
    return { preview, emittedLength: decoded.length };
}
