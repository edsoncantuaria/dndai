export const stripSuffix = (value: string, suffix: string): string =>
    value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;

export const stripCodeFences = (text: string): string => {
    if (!text) return '';
    let result = text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1');
    result = result.replace(/^\s*json\s*:/i, '');
    result = result.replace(/^\s*resposta\s*:/i, '');
    return result.trim();
};

export const softTailRepair = (input: string): string | null => {
    if (!input) return null;
    const sanitized = input.replace(/[\u0000]+$/g, '').trimEnd();
    const lastBrace = Math.max(sanitized.lastIndexOf('}'), sanitized.lastIndexOf(']'));
    if (lastBrace === -1) return null;
    return sanitized.slice(0, lastBrace + 1);
};

export const trimAfterLastClosingBracket = (input: string): string | null => {
    if (!input) return null;
    let inString = false;
    let escape = false;
    const stack: string[] = [];
    let lastClosingIndex = -1;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{' || char === '[') {
            stack.push(char);
            continue;
        }
        if (char === '}' || char === ']') {
            if (stack.length) {
                stack.pop();
            }
            lastClosingIndex = i;
        }
    }

    if (lastClosingIndex === -1) return null;
    return input.slice(0, lastClosingIndex + 1);
};

export const attemptJsonRepair = (input: string): string | null => {
    if (!input || typeof input !== 'string') return null;
    let result = input.trim();
    if (!result) return null;

    result = result.replace(/[\u0000]+$/g, '').trimEnd();
    result = result.replace(/,\s*([\]}])/g, '$1');
    result = result.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, (_, prefix, key) => `${prefix}"${key}":`);

    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < result.length; i++) {
        const char = result[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }

        switch (char) {
            case '"':
                inString = true;
                break;
            case '{':
            case '[':
                stack.push(char);
                break;
            case '}':
            case ']':
                if (stack.length === 0) {
                    result = result.slice(0, i) + result.slice(i + 1);
                    i -= 1;
                } else {
                    const last = stack[stack.length - 1];
                    const matches = (last === '{' && char === '}') || (last === '[' && char === ']');
                    if (matches) {
                        stack.pop();
                    } else {
                        result = result.slice(0, i) + result.slice(i + 1);
                        i -= 1;
                    }
                }
                break;
            case ',':
                const tail = result.slice(i);
                const trailingMatch = tail.match(/^,\s*([}\]])/);
                if (trailingMatch) {
                    result = result.slice(0, i) + trailingMatch[1] + result.slice(i + trailingMatch[0].length);
                    i -= 1;
                }
                break;
            default:
                break;
        }
    }

    if (inString) {
        result += '"';
        inString = false;
    }

    while (stack.length) {
        const opener = stack.pop();
        result += opener === '{' ? '}' : ']';
    }
    result = result.replace(/,\s*([\]}])/g, '$1');
    result = result.replace(/,\s*$/g, '');
    if (/\[[^\]]*$/.test(result)) {
        result += ']';
    }
    if (/\{[^\}]*$/.test(result)) {
        result += '}';
    }

    return result;
};

export const buildContinuationSnippet = (input: string): string => {
    const sanitized = input.replace(/[\u0000]+$/g, '').trim();
    return sanitized.length > 4000 ? sanitized.slice(-4000) : sanitized;
};
