/**
 * Resolve qual perícia D&D 5e faz sentido para a intenção narrada,
 * priorizando o objetivo da ação sobre o nome literal citado pelo jogador.
 */

export type SkillResolutionSource = 'intent' | 'explicit' | 'reconciled';

export type SkillResolution = {
    skillIndex: string;
    source: SkillResolutionSource;
    /** Perícia citada explicitamente no texto, se houver */
    explicitSkillIndex?: string;
    /** Mensagem curta para log do Mestre quando houve correção */
    resolutionNote?: string;
};

/** Verbos e construções que indicam tentativa mecânica (não conversa passiva). */
export const SKILL_ACTION_VERBS =
    /\b(tento|tentar|tenta|tentando|uso|usar|faço|fazer|faco|rolar|rolagem|teste|testar|investigo|investigar|persuado|persuadir|persuas|furtiv|escalar|escalo|arromb|decifro|decifrar|engan|mentir|blef|convenc|intimid|escond|infiltr|vasculh|examin|observ|perceb|ouvir|escut)\b/i;

/** Aliases PT → índice SRD (sem acentos na chave de busca). */
export const SKILL_ALIAS_TO_INDEX: Record<string, string> = {
    furtividade: 'stealth',
    atletismo: 'athletics',
    persuasao: 'persuasion',
    persuasão: 'persuasion',
    intimidacao: 'intimidation',
    intimidação: 'intimidation',
    percepcao: 'perception',
    percepção: 'perception',
    investigacao: 'investigation',
    investigação: 'investigation',
    arcanismo: 'arcana',
    religiao: 'religion',
    religião: 'religion',
    natureza: 'nature',
    historia: 'history',
    história: 'history',
    acrobacia: 'acrobatics',
    adestrar: 'animal-handling',
    medicina: 'medicine',
    prestidigitacao: 'sleight-of-hand',
    prestidigitação: 'sleight-of-hand',
    sobrevivencia: 'survival',
    sobrevivência: 'survival',
    enganacao: 'deception',
    enganação: 'deception',
    enganar: 'deception',
    atuacao: 'performance',
    atuação: 'performance',
    intuicao: 'insight',
    intuição: 'insight',
};

/** Ordem importa: intenções sociais/cognitivas antes de físicas. */
/** Raízes verbais PT — sem \\b no fim para aceitar conjugação (enganar, persuadir, …). */
const INTENT_RULES: Array<{ skillIndex: string; patterns: RegExp[] }> = [
    {
        skillIndex: 'deception',
        patterns: [/\b(engan\w*|mentir\w*|mentira|blef\w*|fingir\w*|dissimul\w*|engano|falsear\w*)/i],
    },
    {
        skillIndex: 'intimidation',
        patterns: [/\b(intimid\w*|ameac\w*|amedront\w*|coagir\w*|assustar\w*)/i],
    },
    {
        skillIndex: 'persuasion',
        patterns: [/\b(persuad\w*|convenc\w*|negoci\w*|argument\w*|charm\w*|seduz\w*)/i],
    },
    {
        skillIndex: 'insight',
        patterns: [
            /\b(intuic\w*|ler\s+(?:a\s+)?intenc|detectar\s+mentira|saber\s+se\s+ment)/i,
        ],
    },
    {
        skillIndex: 'performance',
        patterns: [/\b(atu\w*|apresent\w*|performance|tocar\s+(?:um\s+)?instrument|danc\w*)/i],
    },
    {
        skillIndex: 'stealth',
        patterns: [/\b(furtiv\w*|escond\w*|sorrateir\w*|infiltr\w*|passar\s+desperceb)/i],
    },
    {
        skillIndex: 'sleight-of-hand',
        patterns: [/\b(prestidig\w*|pickpocket|roubar\s+(?:sem|discret)|palma)/i],
    },
    {
        skillIndex: 'investigation',
        patterns: [
            /\b(investig\w*|vasculh\w*|examin\w*\s+(?:o\s+)?(?:local|corpo|cena|pista)|procurar\s+pista)/i,
        ],
    },
    {
        skillIndex: 'perception',
        patterns: [
            /\b(perceb\w*|percepc\w*|ouvir\w*|escut\w*|observ\w*|notar\w*|vigi\w*|espi\w*)/i,
        ],
    },
    {
        skillIndex: 'arcana',
        patterns: [/\b(arcan\w*|magia\s+antiga|decifr\w*\s+runas|ritual\s+arcano)/i],
    },
    {
        skillIndex: 'history',
        patterns: [/\b(historia\s+do|lore|conhecimento\s+historico)/i],
    },
    {
        skillIndex: 'religion',
        patterns: [/\b(religi\w*|simbolos?\s+sagrados|ritos?\s+divinos)/i],
    },
    {
        skillIndex: 'nature',
        patterns: [/\b(natureza|rastrear\s+animal|flora|fauna)/i],
    },
    {
        skillIndex: 'medicine',
        patterns: [/\b(medicin\w*|estabiliz\w*|tratar\s+feriment)/i],
    },
    {
        skillIndex: 'animal-handling',
        patterns: [/\b(adestr\w*|acalmar\s+(?:o\s+)?animal|montaria)/i],
    },
    {
        skillIndex: 'survival',
        patterns: [/\b(sobreviv\w*|rastrear\s+(?:na\s+)?mata|acamp\w*|orientar\s+na\s+floresta)/i],
    },
    {
        skillIndex: 'acrobatics',
        patterns: [/\b(acrob\w*|equilibr\w*|cambalh\w*|contorc\w*|desviar\s+de\s+golpe)/i],
    },
    {
        skillIndex: 'athletics',
        patterns: [
            /\b(atlet\w*|escal\w*|salt\w*|nad\w*|empurr\w*|quebrar\s+porta|forcar\s+porta|segurar\s+porta)/i,
        ],
    },
];

export function normalizeActionText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

export function playerActionImpliesSkillRoll(text: string): boolean {
    const t = text.trim();
    if (t.length < 4) return false;
    return SKILL_ACTION_VERBS.test(t);
}

export function detectIntentSkillIndex(normalizedText: string): string | null {
    for (const rule of INTENT_RULES) {
        if (rule.patterns.some(p => p.test(normalizedText))) {
            return rule.skillIndex;
        }
    }
    return null;
}

type SkillRef = { index: string; name: string };

/**
 * Perícia citada pelo jogador (nome SRD ou alias PT), sem inferir intenção.
 */
export function detectExplicitSkillIndex(
    normalizedText: string,
    skills: SkillRef[],
): string | null {
    const byName = [...skills].sort(
        (a, b) => normalizeActionText(b.name).length - normalizeActionText(a.name).length,
    );
    for (const skill of byName) {
        const ptName = normalizeActionText(skill.name);
        if (ptName.length >= 4 && normalizedText.includes(ptName)) {
            return skill.index;
        }
    }
    for (const [alias, index] of Object.entries(SKILL_ALIAS_TO_INDEX)) {
        const key = normalizeActionText(alias);
        if (key.length >= 4 && normalizedText.includes(key)) {
            return index;
        }
    }
    return null;
}

const SKILL_DISPLAY_PT: Record<string, string> = {
    deception: 'Enganação',
    intimidation: 'Intimidação',
    persuasion: 'Persuasão',
    insight: 'Intuição',
    performance: 'Atuação',
    stealth: 'Furtividade',
    'sleight-of-hand': 'Prestidigitação',
    investigation: 'Investigação',
    perception: 'Percepção',
    arcana: 'Arcanismo',
    history: 'História',
    religion: 'Religião',
    nature: 'Natureza',
    medicine: 'Medicina',
    'animal-handling': 'Adestrar Animais',
    survival: 'Sobrevivência',
    acrobatics: 'Acrobacia',
    athletics: 'Atletismo',
};

function skillLabel(index: string, skills: SkillRef[]): string {
    const found = skills.find(s => s.index === index);
    return found?.name ?? SKILL_DISPLAY_PT[index] ?? index;
}

/**
 * Combina intenção narrativa e menção explícita de perícia (D&D 5e).
 */
export function resolveSkillForPlayerAction(
    playerAction: string,
    skills: SkillRef[],
): SkillResolution | null {
    const normalizedText = normalizeActionText(playerAction);
    const intentSkill = detectIntentSkillIndex(normalizedText);
    const explicitSkill = detectExplicitSkillIndex(normalizedText, skills);

    if (!intentSkill && !explicitSkill) return null;

    if (intentSkill && explicitSkill && intentSkill !== explicitSkill) {
        const intended = skillLabel(intentSkill, skills);
        const cited = skillLabel(explicitSkill, skills);
        return {
            skillIndex: intentSkill,
            source: 'reconciled',
            explicitSkillIndex: explicitSkill,
            resolutionNote: `Perícia ajustada: "${cited}" → ${intended} (intenção da ação).`,
        };
    }

    if (intentSkill) {
        return { skillIndex: intentSkill, source: 'intent' };
    }

    return { skillIndex: explicitSkill!, source: 'explicit' };
}
