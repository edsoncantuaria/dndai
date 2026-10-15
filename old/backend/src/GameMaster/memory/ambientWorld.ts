import { projectSessionWorldState } from '../events/projector.js';
import { getOrCreateRegionState } from '../world/campaignState.js';

/**
 * Linhas de ambiente para o narrador — só lê estado projetado (sem tick / sem Gemini).
 */
export async function loadAmbientWorldLines(
    sessionId: number,
    regionSlug: string | null,
): Promise<string[]> {
    const projected = await projectSessionWorldState(sessionId);
    const lines: string[] = [];

    for (const rumor of projected.activeRumors.slice(0, 2)) {
        if (rumor.body?.trim()) {
            lines.push(`Rumor nas redondezas: ${rumor.body.trim().slice(0, 140)}`);
        }
    }

    for (const ev of projected.recentEvents) {
        if (ev.type === 'NPC_ROUTINE') {
            const name = String(ev.payload.displayName ?? '').trim();
            const desc = String(ev.payload.description ?? '').trim();
            const status = String(ev.payload.status ?? '');
            if (!name || !desc) continue;
            const verb = status === 'active' ? 'está fazendo' : 'acabou de';
            lines.push(`${name} ${verb}: ${desc.slice(0, 100)}`);
        }
        if (ev.type === 'TRAVEL_COMPLETED' && regionSlug) {
            lines.push(`Viagem recente deixou o grupo em ${regionSlug.replace(/-/g, ' ')}.`);
        }
    }

    if (regionSlug) {
        const rs = await getOrCreateRegionState(sessionId, regionSlug);
        if (rs.fear >= 55) lines.push('O clima social está tenso — medo alto na região.');
        if (rs.crime >= 50) lines.push('Crime e vigias nervosos nas ruas.');
        if (rs.prosperity >= 55 && rs.fear < 45) {
            lines.push('Comércio e movimento dão vida aos arredores.');
        }
    }

    return [...new Set(lines)].slice(0, 5);
}
