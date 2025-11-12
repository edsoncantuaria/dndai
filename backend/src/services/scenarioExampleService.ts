import { AppDataSource } from '../database/data-source.js';
import { ScenarioExample } from '../entities/ScenarioExample.js';

type Focus = 'narrative' | 'state';

const cache = new Map<string, string[]>();
const keyFor = (scenario: string, focus: Focus) => `${scenario}::${focus}`;

const FALLBACK_SNIPPETS: Record<Focus, string> = {
    narrative: JSON.stringify({
        logEntries: [
            { type: 'narration', content: 'A sala cintila com runas instáveis enquanto o guardião observa.' },
            { type: 'system', content: 'Verificação de Arcana revela pistas adicionais.' },
        ],
        actionOptions: [
            { text: 'Examinar o foco das runas', action: 'examine', skill: 'arcana' },
            { text: 'Recuar e reposicionar', action: 'disengage' },
            { text: 'Dialogar com o guardião', action: 'talk', skill: 'persuasion' },
        ],
        systemLog: 'Descreva claramente quais verificações são esperadas.',
    }),
    state: JSON.stringify({
        combatState: { isActive: true, round: 2, turn: 1 },
        playerRollRequest: { reason: 'Teste de Arcana para estabilizar o arco', dice: '1d20', dc: 15, rollType: 'check' },
        xpEvents: [{ type: 'quest', xp: 450, description: 'Progresso na investigação do Arco Violeta.' }],
        progressionFeed: [{ type: 'xp_gain', summary: 'Ganhou 450 XP ao conter as distorções.', xp: 450 }],
        shopState: null,
        lootOffer: null,
    }),
};

const ensureRepo = () => {
    if (!AppDataSource.isInitialized) return null;
    return AppDataSource.getRepository(ScenarioExample);
};

const clampSnippet = (snippet: string): string =>
    snippet.length > 1800 ? `${snippet.slice(0, 1797)}...` : snippet;

const buildSnippet = (focus: Focus, response: any): string => {
    if (focus === 'narrative') {
        return clampSnippet(JSON.stringify({
            logEntries: response.logEntries ?? [],
            actionOptions: response.actionOptions ?? [],
            systemLog: response.systemLog ?? '',
        }));
    }
    return clampSnippet(JSON.stringify({
        combatState: response.combatState ?? null,
        playerRollRequest: response.playerRollRequest ?? null,
        xpEvents: response.xpEvents ?? [],
        progressionFeed: response.progressionFeed ?? [],
        shopState: response.shopState ?? null,
        lootOffer: response.lootOffer ?? null,
    }));
};

const pushCache = (scenario: string, focus: Focus, snippet: string) => {
    const key = keyFor(scenario, focus);
    const list = cache.get(key) ?? [];
    list.unshift(snippet);
    cache.set(key, list.slice(0, 3));
};

export const recordScenarioExample = async (
    scenarioLabel: string | undefined,
    focus: 'narrative' | 'state',
    response: any
): Promise<void> => {
    if (!scenarioLabel) return;
    const snippet = buildSnippet(focus, response);
    pushCache(scenarioLabel, focus, snippet);
    const repo = ensureRepo();
    if (!repo) return;
    const entity = repo.create({ scenarioLabel, focus, snippet });
    await repo.save(entity);
};

export const fetchScenarioExampleSnippet = async (
    scenarioLabel: string | undefined,
    focus: 'narrative' | 'state'
): Promise<string | null> => {
    if (!scenarioLabel) return null;
    const key = keyFor(scenarioLabel, focus);
    const cached = cache.get(key);
    if (cached?.length) {
        return cached[0];
    }
    const repo = ensureRepo();
    if (!repo) return null;
    const latest = await repo.findOne({
        where: { scenarioLabel, focus },
        order: { createdAt: 'DESC' },
    });
    if (!latest) {
        return FALLBACK_SNIPPETS[focus] ?? null;
    }
    pushCache(scenarioLabel, focus, latest.snippet);
    return latest.snippet;
};
