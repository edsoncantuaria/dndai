import type { NarrativeContextPack, NpcCastEntry } from '../memory/narrativePack.js';
import type { PenaiSceneMode } from './promptComposer.js';

/** Brief compartilhado entre árbitro → narrador → summarizer (coordenação leve). */
export type TurnOrchestrationBrief = {
    sceneMode: PenaiSceneMode;
    agentNotes: string[];
    npcFocus?: string;
};

export function buildTurnOrchestrationBrief(opts: {
    pack: NarrativeContextPack;
    sceneMode: PenaiSceneMode;
    intentType?: string;
    arbiterNote?: string;
}): TurnOrchestrationBrief {
    const agentNotes: string[] = [];

    if (opts.arbiterNote?.trim()) {
        agentNotes.push(`Árbitro: ${opts.arbiterNote.trim().slice(0, 140)}`);
    }
    if (opts.pack.narrativeSummary?.trim()) {
        agentNotes.push('Resumo de campanha recente — mantenha continuidade.');
    }
    if (opts.pack.regionMood && opts.pack.regionMood.fear >= 55) {
        agentNotes.push('Ambiente tenso: medo alto na região.');
    }
    if (opts.intentType === 'travel') {
        agentNotes.push('Viagem: marque passagem de tempo e paisagem.');
    }
    if (opts.intentType === 'social') {
        agentNotes.push('Social: NPCs falam em linha própria com voz distinta.');
    }

    for (const line of (opts.pack.ambientWorld ?? []).slice(0, 2)) {
        agentNotes.push(`Mundo: ${line.slice(0, 120)}`);
    }

    const travelQuest = (opts.pack.activeQuests ?? []).find(q => q.kind === 'travel' && !q.isHere);
    if (travelQuest) {
        agentNotes.push(
            `Missão em ${travelQuest.regionName ?? 'outra região'}: ${travelQuest.title.slice(0, 60)}.`,
        );
    }
    if (opts.pack.worldPulse?.headline) {
        agentNotes.push(`Pulso recente: ${opts.pack.worldPulse.headline.slice(0, 100)}`);
    }

    const leadNpc = pickLeadNpc(opts.pack.npcCast);
    const npcFocus = leadNpc
        ? `${leadNpc.name}${leadNpc.voiceTone ? ` (${leadNpc.voiceTone})` : ''}`
        : undefined;

    if (npcFocus && (opts.sceneMode === 'social' || opts.intentType === 'social')) {
        agentNotes.push(`Destaque: ${npcFocus} — diálogo direto, não só descrição.`);
    }

    return {
        sceneMode: opts.sceneMode,
        agentNotes: agentNotes.slice(0, 4),
        npcFocus,
    };
}

function pickLeadNpc(cast: NpcCastEntry[] | undefined): NpcCastEntry | undefined {
    if (!cast?.length) return undefined;
    return cast.find(n => n.activeGoal) ?? cast[0];
}

export function orchestrationToPayload(
    brief: TurnOrchestrationBrief,
): Record<string, unknown> {
    return {
        cena: brief.sceneMode,
        notas: brief.agentNotes,
        npcDestaque: brief.npcFocus ?? null,
    };
}
