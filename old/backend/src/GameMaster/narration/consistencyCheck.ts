import { detectMechanicalGrantInNarration } from '../locale/narrationGuard.js';

export type ConsistencyCheckInput = {
    narration: string;
    mechanical: Record<string, unknown>;
    regionSlug?: string | null;
};

export type ConsistencyCheckResult = {
    ok: boolean;
    issues: string[];
    remediatedText?: string;
    consistencyNote?: string;
};

const HP_MENTION =
    /\b(\d+)\s*(?:\/\s*(\d+))?\s*(?:pv|pontos de vida|de vida|hp)\b/i;

function readHeroHp(mechanical: Record<string, unknown>): { current: number; max: number } | null {
    const character = mechanical.character as Record<string, unknown> | undefined;
    if (!character) return null;
    const hp = character.hp as { current?: number; max?: number } | undefined;
    if (!hp || typeof hp.current !== 'number' || typeof hp.max !== 'number') return null;
    return { current: hp.current, max: hp.max };
}

function checkHpMention(text: string, mechanical: Record<string, unknown>): string | null {
    const heroHp = readHeroHp(mechanical);
    if (!heroHp) return null;
    const match = text.match(HP_MENTION);
    if (!match) return null;
    const mentionedCurrent = Number(match[1]);
    const mentionedMax = match[2] ? Number(match[2]) : mentionedCurrent;
    const tolerance = 1;
    if (
        Math.abs(mentionedCurrent - heroHp.current) > tolerance ||
        Math.abs(mentionedMax - heroHp.max) > tolerance
    ) {
        return `Narração cita PV ${mentionedCurrent}/${mentionedMax}; motor registra ${heroHp.current}/${heroHp.max}.`;
    }
    return null;
}

/** Heurística local — sem LLM; alinha prosa ao pack mecânico. */
export function checkNarrationConsistency(input: ConsistencyCheckInput): ConsistencyCheckResult {
    const issues: string[] = [];
    const text = input.narration.trim();

    if (detectMechanicalGrantInNarration(text)) {
        issues.push('Narração concede recurso mecânico (ouro/item/XP/nível).');
    }

    const hpIssue = checkHpMention(text, input.mechanical);
    if (hpIssue) issues.push(hpIssue);

    if (issues.length === 0) {
        return { ok: true, issues: [] };
    }

    const note = issues.join(' ');
    const remediatedText = `${text}\n\n[Mesa: ajuste narrativo — ${note}]`;

    return {
        ok: false,
        issues,
        remediatedText,
        consistencyNote: note,
    };
}
