/**
 * Apresentação do pulso do mundo — 100% determinística (sem Gemini).
 * Transforma ticks de simulação + read models em texto cinematográfico curto.
 */

export type PulsePresentation = {
    headline: string;
    beats: string[];
    mood: 'ominous' | 'busy' | 'calm' | 'festive' | 'grim';
};

export type ComposePulseOpts = {
    regionSlug: string | null;
    regionMood?: { fear: number; prosperity: number; crime: number } | null;
    simulationLines: string[];
    rumorTitles?: string[];
    rumorBodies?: string[];
};

function inferMood(mood?: ComposePulseOpts['regionMood']): PulsePresentation['mood'] {
    if (!mood) return 'calm';
    if (mood.fear >= 65 || mood.crime >= 60) return 'ominous';
    if (mood.crime >= 45) return 'grim';
    if (mood.prosperity >= 60 && mood.fear < 40) return 'festive';
    if (mood.fear >= 45) return 'busy';
    return 'calm';
}

function regionLabel(slug: string | null): string {
    if (!slug) return 'estas terras';
    return slug.replace(/-/g, ' ');
}

function cleanLine(line: string): string {
    return line
        .replace(/^(Rumor|Evento):\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function composeWorldPulsePresentation(opts: ComposePulseOpts): PulsePresentation | null {
    const lines = opts.simulationLines.map(cleanLine).filter(Boolean);
    const rumors = (opts.rumorBodies ?? []).map(cleanLine).filter(Boolean);
    const beats: string[] = [];

    for (const line of lines.slice(0, 3)) {
        beats.push(line.endsWith('.') ? line : `${line}.`);
    }
    for (const r of rumors.slice(0, 2)) {
        if (!beats.some(b => b.includes(r.slice(0, 24)))) {
            beats.push(r.endsWith('.') ? r : `${r}.`);
        }
    }

    if (!beats.length && !(opts.rumorTitles ?? []).length) {
        return null;
    }

    const mood = inferMood(opts.regionMood);
    const place = regionLabel(opts.regionSlug);

    const moodHeadline: Record<PulsePresentation['mood'], string> = {
        ominous: `Algo pesado paira sobre ${place}.`,
        grim: `${place} segue de guarda alta.`,
        busy: `${place} não para — vozes e passos em todo canto.`,
        festive: `Há movimento e conversa viva em ${place}.`,
        calm: `O ritmo de ${place} continua, mesmo quando você não age.`,
    };

    let headline = moodHeadline[mood];
    const firstNpc = beats.find(b => /^.+\s(inicia|conclui):/i.test(b) || /:/.test(b));
    if (firstNpc) {
        const short = firstNpc.length > 90 ? `${firstNpc.slice(0, 87)}…` : firstNpc;
        headline = short.replace(/^(Ao fundo,\s*)?/i, '');
    } else if (rumors[0]) {
        headline = rumors[0].length > 100 ? `${rumors[0].slice(0, 97)}…` : rumors[0];
    }

    return {
        headline,
        beats: beats.slice(0, 4),
        mood,
    };
}
