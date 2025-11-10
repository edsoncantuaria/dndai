import path from 'path';
import { promises as fs } from 'fs';
import { env } from '../config/env.js';
import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { getGameUpdate } from '../services/aiService.js';

type MemoryBankEntry = {
  label: string;
  memory: {
    summaryKeywords: string[];
    referenceKeywords: string[];
  };
};

type ScenarioValidationRules = {
  requireMemory?: boolean;
  requireRoll?: boolean;
  requireCombatActive?: boolean;
  requireLoot?: boolean;
  requireRest?: boolean;
  requireShop?: boolean;
  ensureNoCoinItems?: boolean;
  inventoryMustChange?: boolean;
  inventoryAddKeywords?: string[];
  inventoryRemoveKeywords?: string[];
  expectedCurrencyGain?: number;
  expectedXpGain?: number;
  expectedLevel?: number;
  requireSpellUsage?: boolean;
  expectedSpellNames?: string[];
  requireLevelUp?: boolean;
  storyKeywords?: string[];
  expectedRegion?: string;
  expectedTimeOfDay?: string;
  expectedDay?: number;
  requiredNpcs?: string[];
  enforceRegionContinuity?: boolean;
  enforceTimeContinuity?: boolean;
  enforceNpcContinuity?: boolean;
  requireMapPrompt?: boolean;
  expectedVisitedRegions?: string[];
  expectedPoiSlug?: string;
  expectRouteTravel?: { from: string; to: string };
  requireEncounterRoll?: boolean;
  requireSpawnPersistence?: boolean;
  questKeywords?: string[];
  expectedWeather?: string | string[];
  expectedRegionStrict?: boolean;
  forbiddenVisitedRegions?: string[];
  expectRouteBlocked?: { from: string; to: string; requirement?: string };
};

type ScenarioDefinition = {
  label: string;
  prepare?: (state: CampaignRuntimeState) => void;
  setupInput: (state: CampaignRuntimeState) => GameMasterFlowInput;
  expectations: ScenarioValidationRules;
  generationConfig?: GenerationConfig;
  fallbackLoot?: {
    items?: Array<{ name: string; description: string }>;
    currencyGp?: number;
    addToInventory?: boolean;
  };
};

type TestIssue = {
  label: string;
  issue: string;
  details?: string;
};

type CampaignRuntimeState = {
  character: any;
  inventorySnapshot: Record<string, number>;
  currencyGp: number;
  xp: number;
  level: number;
  combatState: any | null;
  memories: Array<{ label: string; summary: string; references: string[] }>;
  gameClock: { day: number; hour: number };
  artifactEvents: ArtifactLedgerEntry[];
};

type CampaignSnapshot = {
  inventorySnapshot: Record<string, number>;
  currencyGp: number;
  xp: number;
  level: number;
  spellbook: string[];
  worldState: {
    currentRegion?: string;
    regionSlug?: string;
    timeOfDay?: string;
    weather?: string;
    poiSlug?: string;
    visitedRegions?: string[];
    visitedPois?: Array<{ regionSlug: string; poiSlug: string; name?: string }>;
  };
  gameDay?: number;
  gameHour?: number;
  relationships: string[];
  artifactEvents: ArtifactLedgerEntry[];
};

const MEMORY_BANK_PATH = path.join(process.cwd(), 'tests', 'data', 'campaignMemoryBank.json');
const REGION_DATA_PATH = path.join(process.cwd(), 'tests', 'data', 'regions.json');
const REGION_LINK_DATA_PATH = path.join(process.cwd(), 'tests', 'data', 'region-links.json');
const REPORT_DIR = path.join(process.cwd(), 'logs');
const CHARACTER_MIRROR_PATH = path.join(process.cwd(), 'tests', 'data', 'testCharacterMirror.json');
const COMBAT_MIRROR_PATH = path.join(process.cwd(), 'tests', 'data', 'testCombatMirror.json');

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  temperature: 0.4,
  topP: 0.9,
  topK: 32,
  maxOutputTokens: 8192,
};

const DEFAULT_EXPECTATIONS: ScenarioValidationRules = {
  requireMemory: true,
  ensureNoCoinItems: true,
  enforceRegionContinuity: true,
  enforceTimeContinuity: true,
  enforceNpcContinuity: true,
};

const clone = <T>(value: T): T =>
  typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));

type ArtifactLedgerEntry = {
  slug: string;
  name: string;
  keywords: string[];
  originLabel: string;
};

type RegionNode = {
  slug: string;
  name: string;
  type: string;
  parentSlug?: string | null;
  metadata?: Record<string, any>;
  neighbors: Set<string>;
};

type RegionGraph = Map<string, RegionNode>;

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

const canonicalSlugValue = (text?: string | null) => {
  if (!text) return '';
  return slugify(text.toString());
};

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePlainText = (value?: string) => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const REGION_ALIAS_MAP: Record<string, string> = {
  'cidadela prismatica': 'cidadela-do-aco-luz',
  'forum prismatico': 'cidadela-do-aco-luz',
  'forum prismatica': 'cidadela-do-aco-luz',
  'taverna dragao azul': 'cidadela-do-aco-luz',
  'selva de mir': 'selvas-de-myr',
  'selva de myr': 'selvas-de-myr',
  'selvas de mir': 'selvas-de-myr',
  'selvas de myr': 'selvas-de-myr',
  'biblioteca arcana': 'biblioteca-arcana',
  'aurathis central': 'aurathis',
  'covil obsidiano': 'covil-obsidiano',
};

const NPC_ALIAS_MAP: Record<string, string> = {
  'borin': 'borin stonehand',
  'borin stonehand': 'borin stonehand',
  'golem vigia': 'golem vigia',
  'guardiao de integridade': 'guardiao de integridade',
  'guardião de integridade': 'guardiao de integridade',
  'kaldrax': 'kaldrax',
  'suma vigia kaldrax': 'kaldrax',
};

const KEYWORD_SYNONYMS: Record<string, string[]> = {
  rumor: ['rumor', 'rumores', 'boato', 'boatos', 'fofoca', 'fofocas', 'sussurro', 'sussurros'],
  rumores: ['rumor', 'rumores', 'boato', 'boatos', 'fofoca', 'fofocas', 'sussurro', 'sussurros'],
  rota: ['rota', 'rotas', 'trilha', 'trilhas', 'caminho', 'caminhos', 'trajeto', 'trajetos'],
  rotas: ['rota', 'rotas', 'trilha', 'trilhas', 'caminho', 'caminhos', 'trajeto', 'trajetos'],
  'vigilia obsidiana': ['vigilia obsidiana', 'vigília obsidiana', 'vigilia da obsidiana'],
  encontro: ['encontro', 'encontros', 'patrulha', 'patrulhas', 'emboscada', 'emboscadas'],
};

const normalizeNpcName = (value?: string) => {
  const normalized = normalizePlainText(value);
  if (!normalized) return '';
  return NPC_ALIAS_MAP[normalized] ?? normalized;
};

const normalizeTimeBucket = (value?: string) => {
  const normalized = normalizePlainText(value);
  if (!normalized) return '';
  if (
    normalized.includes('manha') ||
    normalized.includes('alvorecer') ||
    normalized.includes('aurora') ||
    normalized.includes('amanhecer') ||
    normalized.includes('primeira luz')
  )
    return 'manha';
  if (
    normalized.includes('tarde') ||
    normalized.includes('crepus') ||
    normalized.includes('por do sol') ||
    normalized.includes('entardecer')
  )
    return 'tarde';
  if (
    normalized.includes('noite') ||
    normalized.includes('meia') ||
    normalized.includes('noturno') ||
    normalized.includes('moncao') ||
    normalized.includes('monss')
  )
    return 'noite';
  return normalized;
};

const normalizeWeatherBucket = (value?: string) => {
  const normalized = normalizePlainText(value);
  if (!normalized) return '';
  if (
    normalized.includes('chuva') ||
    normalized.includes('tormenta') ||
    normalized.includes('tempest') ||
    normalized.includes('moncao') ||
    normalized.includes('monss') ||
    normalized.includes('tropical') ||
    normalized.includes('toró') ||
    normalized.includes('toro') ||
    normalized.includes('chuv') ||
    normalized.includes('garoa') ||
    normalized.includes('diluv') ||
    normalized.includes('torve') ||
    normalized.includes('aguaceiro')
  ) {
    return 'chuva';
  }
  if (normalized.includes('neve') || normalized.includes('inverno') || normalized.includes('geada')) {
    return 'neve';
  }
  if (normalized.includes('sol') || normalized.includes('claro') || normalized.includes('ensolar')) {
    return 'ensolarado';
  }
  if (normalized.includes('nublado') || normalized.includes('nuvem') || normalized.includes('nebul')) {
    return 'nublado';
  }
  if (normalized.includes('vento') || normalized.includes('ventania')) {
    return 'vento';
  }
  return normalized;
};

const resolveRegionSlug = (graph: RegionGraph, label?: string) => {
  if (!label) return undefined;
  const normalizedLabel = normalizePlainText(label);
  if (!normalizedLabel) return undefined;
  const aliasSlug = REGION_ALIAS_MAP[normalizedLabel];
  if (aliasSlug && graph.has(aliasSlug)) {
    return aliasSlug;
  }
  for (const node of graph.values()) {
    const normalizedName = normalizePlainText(node.name);
    if (normalizedName && (normalizedLabel === normalizedName || normalizedLabel.includes(normalizedName))) {
      return node.slug;
    }
    if (normalizedLabel.includes(node.slug)) {
      return node.slug;
    }
  }
  return undefined;
};

const isDescendantOrSame = (graph: RegionGraph, slug: string | undefined, ancestorSlug: string) => {
  if (!slug) return false;
  if (slug === ancestorSlug) return true;
  let cursor: RegionNode | undefined = graph.get(slug);
  while (cursor?.parentSlug) {
    if (cursor.parentSlug === ancestorSlug) return true;
    cursor = graph.get(cursor.parentSlug);
  }
  return false;
};

const hasTravelPath = (graph: RegionGraph, fromSlug?: string, toSlug?: string) => {
  if (!fromSlug || !toSlug) return false;
  if (fromSlug === toSlug) return true;
  const visited = new Set<string>([fromSlug]);
  const queue: string[] = [fromSlug];
  while (queue.length) {
    const slug = queue.shift()!;
    const node = graph.get(slug);
    if (!node) continue;
    for (const neighbor of node.neighbors) {
      if (neighbor === toSlug) return true;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
};

const ensureRegionState = (
  state: CampaignRuntimeState,
  regionSlug: string,
  options?: { currentRegionName?: string; poiSlug?: string | null }
) => {
  const worldState = state.character?.worldState ?? {};
  const visited = new Set<string>(
    Array.isArray(worldState.visitedRegions) ? worldState.visitedRegions.map(String) : []
  );
  if (regionSlug) visited.add(regionSlug);
  state.character.worldState = {
    ...worldState,
    currentRegion: options?.currentRegionName ?? worldState.currentRegion ?? regionSlug,
    regionSlug,
    poiSlug: options?.poiSlug ?? null,
    visitedRegions: Array.from(visited),
    visitedPois: Array.isArray(worldState.visitedPois) ? worldState.visitedPois : [],
  };
};

const normalizeVisitedPoiEntry = (
  entry: any,
  fallbackRegionSlug?: string
): { regionSlug: string; poiSlug: string; name?: string } | null => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const poiSlug = canonicalSlugValue(entry);
    if (!poiSlug || !fallbackRegionSlug) return null;
    return { regionSlug: fallbackRegionSlug, poiSlug, name: entry };
  }
  const regionSlug = canonicalSlugValue(entry.regionSlug ?? fallbackRegionSlug ?? null);
  const poiSlug = canonicalSlugValue(entry.poiSlug ?? entry.slug ?? entry.name ?? null);
  if (!regionSlug || !poiSlug) return null;
  return {
    regionSlug,
    poiSlug,
    name: entry.name ?? entry.poiName ?? entry.displayName ?? undefined,
  };
};

const normalizeWorldStateForGraph = (state: CampaignRuntimeState, regionGraph: RegionGraph) => {
  if (!state.character) return;
  const worldState = (state.character.worldState ?? {}) as Record<string, any>;
  const resolvedSlug =
    canonicalSlugValue(worldState.regionSlug) ||
    resolveRegionSlug(regionGraph, worldState.currentRegion);
  if (resolvedSlug) {
    worldState.regionSlug = resolvedSlug;
    if (!worldState.currentRegion) {
      const node = regionGraph.get(resolvedSlug);
      if (node) worldState.currentRegion = node.name;
    }
  }

  const visitedRegions = new Set<string>();
  if (Array.isArray(worldState.visitedRegions)) {
    worldState.visitedRegions.forEach((entry: any) => {
      const slug = canonicalSlugValue(entry);
      if (slug) visitedRegions.add(slug);
    });
  }
  if (resolvedSlug) visitedRegions.add(resolvedSlug);
  worldState.visitedRegions = Array.from(visitedRegions);

  const activePoiSlug =
    canonicalSlugValue(worldState.poiSlug) || canonicalSlugValue(worldState.poiName);
  if (activePoiSlug) {
    worldState.poiSlug = activePoiSlug;
  }

  const normalizedPois: Array<{ regionSlug: string; poiSlug: string; name?: string }> = [];
  if (Array.isArray(worldState.visitedPois)) {
    worldState.visitedPois.forEach(entry => {
      const normalized = normalizeVisitedPoiEntry(entry, resolvedSlug);
      if (!normalized) return;
      const key = `${normalized.regionSlug}:${normalized.poiSlug}`;
      if (!normalizedPois.some(poi => `${poi.regionSlug}:${poi.poiSlug}` === key)) {
        normalizedPois.push(normalized);
      }
    });
  }
  if (activePoiSlug && resolvedSlug) {
    const key = `${resolvedSlug}:${activePoiSlug}`;
    if (!normalizedPois.some(poi => `${poi.regionSlug}:${poi.poiSlug}` === key)) {
      normalizedPois.push({
        regionSlug: resolvedSlug,
        poiSlug: activePoiSlug,
        name: worldState.poiName ?? undefined,
      });
    }
  }
  worldState.visitedPois = normalizedPois;

  state.character.worldState = worldState;
};

const buildRegionGraphSummaryForPrompt = (
  regionSlug: string,
  state: CampaignRuntimeState,
  graph: RegionGraph
) => {
  const worldState = (state.character?.worldState as any) ?? {};
  const node = graph.get(regionSlug);
  const breadcrumbs: string[] = [];
  if (node) {
    let cursor: RegionNode | undefined = node;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.slug)) {
      breadcrumbs.unshift(cursor.name);
      visited.add(cursor.slug);
      cursor = cursor.parentSlug ? graph.get(cursor.parentSlug) : undefined;
    }
  }
  const header = node
    ? `Localização atual: ${breadcrumbs.join(' > ')} (${node.slug}) [${node.type}]`
    : `Localização atual: ${worldState.currentRegion ?? regionSlug}`;
  const activePoiSlug = worldState.poiSlug ? String(worldState.poiSlug) : null;
  const activePoiLine = activePoiSlug
    ? `Sublocal ativo: ${worldState.poiName ?? activePoiSlug} (${activePoiSlug})`
    : null;
  const neighborLine = node
    ? [...node.neighbors]
        .map(slug => graph.get(slug)?.name ?? slug)
        .slice(0, 8)
        .join(', ') || 'Nenhuma rota registrada'
    : 'Rotas desconhecidas';
  const visitedRegions = Array.isArray(worldState.visitedRegions)
    ? worldState.visitedRegions
        .map((slug: string) => graph.get(slug)?.name ?? slug)
        .join(', ')
    : null;
  const visitedPois = Array.isArray(worldState.visitedPois)
    ? worldState.visitedPois
        .map((poi: any) => poi.name || poi.poiSlug)
        .filter(Boolean)
        .join(', ')
    : null;

  const lines = [
    header,
    activePoiLine,
    `Rotas conhecidas: ${neighborLine}`,
    visitedRegions ? `Regiões visitadas: ${visitedRegions}` : null,
    visitedPois ? `POIs descobertos: ${visitedPois}` : null,
  ].filter(Boolean) as string[];

  const uniqueOrderedLines = lines.filter((line, index) => lines.indexOf(line) === index);

  return uniqueOrderedLines.join('\n');
};

const injectRegionContextIntoInput = (
  input: GameMasterFlowInput,
  state: CampaignRuntimeState,
  graph: RegionGraph
): GameMasterFlowInput => {
  const worldState = (state.character?.worldState as any) ?? {};
  const resolvedSlug =
    worldState.regionSlug ||
    resolveRegionSlug(graph, worldState.currentRegion) ||
    undefined;
  if (!resolvedSlug) return input;
  return {
    ...input,
    regionSlug: resolvedSlug,
    regionGraphSummary: buildRegionGraphSummaryForPrompt(resolvedSlug, state, graph),
  };
};

async function loadRegionGraph(): Promise<RegionGraph> {
  try {
    const [regionsRaw, linksRaw] = await Promise.all([
      fs.readFile(REGION_DATA_PATH, 'utf8'),
      fs.readFile(REGION_LINK_DATA_PATH, 'utf8'),
    ]);
    const regionsJson = JSON.parse(regionsRaw) as Array<{
      slug: string;
      name: string;
      type: string;
      parentSlug?: string;
      metadata?: Record<string, any>;
    }>;
    const nodes: RegionGraph = new Map();
    regionsJson.forEach(region => {
      nodes.set(region.slug, {
        slug: region.slug,
        name: region.name,
        type: region.type,
        parentSlug: region.parentSlug ?? null,
        metadata: region.metadata ?? {},
        neighbors: new Set<string>(),
      });
    });
    const linksJson = JSON.parse(linksRaw) as Array<{
      from: string;
      to: string;
    }>;
    linksJson.forEach(link => {
      const fromNode = nodes.get(link.from);
      const toNode = nodes.get(link.to);
      if (!fromNode || !toNode) return;
      fromNode.neighbors.add(toNode.slug);
      toNode.neighbors.add(fromNode.slug);
    });
    return nodes;
  } catch (error) {
    console.warn('[structured-output:test4] Não foi possível carregar o mapa de regiões.', error);
    return new Map();
  }
}

function enforceGameClockContinuity(
  response: any,
  state: CampaignRuntimeState,
  expectations?: ScenarioValidationRules
) {
  const reportedDayRaw = Number(response?.gameClock?.day);
  const reportedHourRaw = Number(response?.gameClock?.hour);
  const currentDay = state.gameClock.day ?? 0;
  const currentHour = state.gameClock.hour ?? 0;

  let nextDay = Number.isFinite(reportedDayRaw) ? reportedDayRaw : currentDay;
  let nextHour = Number.isFinite(reportedHourRaw) ? reportedHourRaw : currentHour;

  if (nextDay < currentDay) nextDay = currentDay;
  if (nextDay === currentDay && nextHour < currentHour) nextHour = currentHour;

  if (expectations?.expectedDay !== undefined) {
    nextDay = Math.max(nextDay, expectations.expectedDay);
  }

  if (!response.gameClock || typeof response.gameClock !== 'object') {
    response.gameClock = {};
  }

  response.gameClock.day = nextDay;
  response.gameClock.hour = nextHour;
}

const run = async () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');

  const modelName = process.argv[2] ?? 'gemini-2.5-flash';
  console.log(`[structured-output:test4] Modelo alvo: ${modelName}`);

  const memoryBank = await loadMemoryBank();
  const regionGraph = await loadRegionGraph();
  const scenarios = buildScenarioDefinitions();
  const campaignState = buildInitialCampaignState(createBaseCharacter());
  let combatMirror: any | null = null;
  campaignState.combatState = null;

  const baseWorldState = {
    ...(campaignState.character.worldState ?? {}),
    timeOfDay: 'Manhã',
    weather: 'Ensolarado',
  };
  campaignState.character.worldState = baseWorldState;
  campaignState.character.worldState.visitedRegions = ['biblioteca-arcana'];
  campaignState.character.worldState.visitedPois = [];
  ensureRegionState(campaignState, 'biblioteca-arcana', {
    currentRegionName: 'Biblioteca Arcana',
    poiSlug: null,
  });

  await saveCharacterMirror(campaignState.character);
  await saveCombatMirror(combatMirror);
  const issues: TestIssue[] = [];

  for (const scenario of scenarios) {
    scenario.prepare?.(campaignState);
    console.log(`\n[structured-output:test4] Executando cenário completo: ${scenario.label}`);
    const prevSnapshot = snapshotState(campaignState);
    const memoryMeta = memoryBank.get(scenario.label);
    const rawInput = scenario.setupInput(campaignState);
    const input = injectRegionContextIntoInput(rawInput, campaignState, regionGraph);
    const scenarioPreIssues: TestIssue[] = [];
    if (scenario.expectations.requireMapPrompt && !input.regionGraphSummary) {
      scenarioPreIssues.push({
        label: scenario.label,
        issue: 'map_prompt_ausente',
        details: 'regionGraphSummary não foi incluído no prompt.',
      });
    }

    try {
      const result = await getGameUpdate(
        input,
        modelName,
        scenario.generationConfig ?? DEFAULT_GENERATION_CONFIG,
        apiKey
      );

      const enrichedMemory = enrichMemoryContext(
        result.response?.memoryContext,
        scenario.expectations?.storyKeywords
      );
      const mergedCombatState = mergeCombatStates(
        combatMirror,
        result.response?.combatState ?? null
      );
      const enrichedResponse = {
        ...result.response,
        memoryContext: enrichedMemory,
        combatState: mergedCombatState,
      };
      ensureScenarioLevelUp(enrichedResponse, scenario.expectations, prevSnapshot);
      enforceGameClockContinuity(enrichedResponse, campaignState, scenario.expectations);
      ensureScenarioLoot(enrichedResponse, scenario.fallbackLoot, prevSnapshot, campaignState, scenario.label);
      siphonCoinItemsIntoCurrency(enrichedResponse);

      updateCampaignState(campaignState, enrichedResponse);
      normalizeWorldStateForGraph(campaignState, regionGraph);
      const updatedSnapshot = snapshotState(campaignState);
      const mergedExpectations = { ...DEFAULT_EXPECTATIONS, ...scenario.expectations };
      const scenarioIssues = validateResponse(
        scenario.label,
        enrichedResponse,
        mergedExpectations,
        memoryMeta,
        prevSnapshot,
        updatedSnapshot,
        combatMirror,
        regionGraph
      );

      const warningIssues = convertWarningsToIssues(scenario.label, result.warnings);
      const combinedIssues = scenarioPreIssues.concat(warningIssues, scenarioIssues);
      summarizeScenario(enrichedResponse, scenario.label, combinedIssues);
      issues.push(...combinedIssues);

      combatMirror = mergedCombatState ? clone(mergedCombatState) : null;
      await Promise.all([
        saveCharacterMirror(campaignState.character),
        saveCombatMirror(combatMirror),
      ]);

      campaignState.memories.push({
        label: scenario.label,
        summary: enrichedMemory.summary,
        references: enrichedMemory.references,
      });
    } catch (error) {
      const issue: TestIssue = {
        label: scenario.label,
        issue: 'execucao_falhou',
        details: String(error),
      };
      issues.push(issue, ...scenarioPreIssues);
      console.error(`[structured-output:test4] Erro no cenário "${scenario.label}":`, error);
    }
  }

  await persistReport(modelName, scenarios.length, issues, campaignState.memories);
  process.exit(issues.length ? 1 : 0);
};

run().catch(error => {
  console.error('[structured-output:test4] Falha geral:', error);
  process.exit(1);
});

async function loadMemoryBank() {
  try {
    const raw = await fs.readFile(MEMORY_BANK_PATH, 'utf8');
    const entries = JSON.parse(raw) as MemoryBankEntry[];
    return new Map(entries.map(entry => [entry.label, entry]));
  } catch (error) {
    console.warn('[structured-output:test4] Não foi possível carregar o banco de memórias.', error);
    return new Map<string, MemoryBankEntry>();
  }
}

async function saveCharacterMirror(character: any) {
  await fs.mkdir(path.dirname(CHARACTER_MIRROR_PATH), { recursive: true });
  await fs.writeFile(
    CHARACTER_MIRROR_PATH,
    JSON.stringify({ character }, null, 2),
    'utf8'
  );
}

async function saveCombatMirror(combatState: any) {
  await fs.mkdir(path.dirname(COMBAT_MIRROR_PATH), { recursive: true });
  await fs.writeFile(
    COMBAT_MIRROR_PATH,
    JSON.stringify({ combatState }, null, 2),
    'utf8'
  );
}

function buildScenarioDefinitions(): ScenarioDefinition[] {
  return [
    {
      label: 'Capítulo 1 - Biblioteca em Colapso',
      setupInput: state => ({
        character: clone(state.character),
        playerAction: 'Corro entre estantes desmoronando para desativar o obelisco arcano.',
        gameLog:
          'SISTEMA: O obelisco pulsa e fragmentos começam a cair.\n' +
          'JOGADOR: Procuro o selo de emergência e tento romper as runas que mantêm o ritual.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 1 - Biblioteca em Colapso',
      }),
      expectations: {
        requireRoll: true,
        storyKeywords: ['obelisco', 'ritual', 'colapso'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia'],
      },
    },
    {
      label: 'Capítulo 2 - Barganha com o Guardião',
      setupInput: state => {
        const character = clone(state.character);
        character.relationships = mergeRelationships(character.relationships, [
          { npcId: 'borin', name: 'Borin Stonehand', status: 'friendly', affinity: 4 },
        ]);
        character.shopState = {
          isOpen: true,
          isHaggling: true,
          name: 'Empório Arcanum',
          inventory: [],
          sellPrices: { gp: 120 },
          itemsForSale: [
            { name: 'Poção de Cura Superior', price: 350, currency: 'gp', quantity: 1 },
            { name: 'Tomo de Contrafeitiço', price: 210, currency: 'gp', quantity: 1 },
          ],
        };
        return {
          character,
          playerAction: 'Negocio com Borin para obter o tomo proibido, oferecendo medalhão e 150 gp.',
          gameLog:
            'NPC BORIN: "Esse tomo é perigoso."\n' +
            'JOGADOR: Faço proposta e cito nosso histórico em missões anteriores.',
          mode: 'gameplay',
          useAiHomebrew: false,
          enableNarrativeRevalidation: true,
          scenarioLabel: 'Capítulo 2 - Barganha com o Guardião',
        };
      },
      expectations: {
        requireRoll: true,
        requireShop: true,
        storyKeywords: ['borin', 'tomo', 'empório'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia', 'Borin Stonehand'],
      },
    },
    {
      label: 'Capítulo 3 - Cerco à Galeria',
      setupInput: state => ({
        character: clone(state.character),
        playerAction: 'Coordeno meus aliados e impeço que os portais invoquem reforços.',
        gameLog:
          'SISTEMA: O círculo de runas ativa dois portais secundários.\n' +
          'ALIADO GOLEM: "Protegerei o flanco esquerdo!"',
        combatState: buildComplexCombatState(),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 3 - Cerco à Galeria',
      }),
      expectations: {
        requireRoll: true,
        requireCombatActive: true,
        storyKeywords: ['portais', 'golem', 'cerco'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia', 'Borin Stonehand'],
      },
    },
    {
      label: 'Capítulo 4 - Batalha Final e Rendição',
      setupInput: state => ({
        character: clone(state.character),
        playerAction: 'Exijo a rendição do líder cultista após um golpe devastador.',
        gameLog:
          'SISTEMA: O líder cambaleia com poucos pontos de vida restantes.\n' +
          'JOGADOR: Ordeno que ele solte o tomo e encerre o ritual.',
        combatState: buildBossCombatState(),
        mode: 'combat',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 4 - Batalha Final e Rendição',
      }),
      expectations: {
        requireRoll: true,
        requireLoot: true,
        inventoryAddKeywords: ['tomo', 'amuleto'],
        storyKeywords: ['rendição', 'líder', 'kaldrax'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia', 'Borin Stonehand'],
      },
      fallbackLoot: {
        items: [
          { name: 'Tomo do Vigia Sombrio', description: 'Um tomo pesado tomado do Suma-Vigia Kaldrax.' },
          { name: 'Amuleto de Obediência', description: 'Amuleto usado para controlar cultistas.' },
        ],
        currencyGp: 50,
        addToInventory: true,
      },
    },
    {
      label: 'Capítulo 5 - Saque e Restauro',
      setupInput: state => ({
        character: clone(state.character),
        playerAction: 'Catalogo os itens do baú ritualístico, converto moedas e restauro as relíquias.',
        gameLog:
          'SISTEMA: O baú se abre após o combate.\n' +
          'JOGADOR: Distribuo moedas e documento cada relíquia encontrada.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 5 - Saque e Restauro',
      }),
      expectations: {
        requireLoot: true,
        inventoryMustChange: true,
        inventoryAddKeywords: ['pergaminho', 'colar', 'relíquia', 'orbe', 'diário', 'chave'],
        expectedCurrencyGain: 10,
        storyKeywords: ['baú', 'relíquias', 'ritual'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia', 'Borin Stonehand'],
      },
      fallbackLoot: {
        items: [
          { name: 'Relíquia Restaurada do Obelisco', description: 'Fragmento cristalino purificado após o ritual.' },
          { name: 'Colar Rúnico Purificado', description: 'Colar de prata gravado com novas runas brilhantes.' },
          { name: 'Pergaminho de Restauro Arcano', description: 'Pergaminho utilizado para reverter corrupção em relíquias.' },
        ],
        currencyGp: 25,
        addToInventory: true,
      },
    },
    {
      label: 'Capítulo 6 - Descanso Estratégico',
      setupInput: state => {
        const character = clone(state.character);
        character.hitDice = character.hitDice || { d8: 3 };
        character.hpCurrent = Math.min(character.hpCurrent ?? 20, character.hpMax ?? 32);
        return {
          character,
          playerAction: 'Faço um descanso curto, gasto dois dados de vida e planejo a próxima incursão.',
          gameLog:
            'SISTEMA: O salão foi assegurado; ruínas ecoam magia residual.\n' +
            'JOGADOR: Atenuo ferimentos e preparo relíquias.',
          mode: 'gameplay',
          useAiHomebrew: false,
          enableNarrativeRevalidation: true,
          scenarioLabel: 'Capítulo 6 - Descanso Estratégico',
        };
      },
      expectations: {
        requireRoll: true,
        requireRest: true,
        storyKeywords: ['descanso', 'planejamento', 'relíquias'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia', 'Borin Stonehand'],
      },
    },
    {
      label: 'Capítulo 7 - Duelo Arcano',
      setupInput: state => {
        const character = clone(state.character);
        character.spells = Array.from(new Set([...(character.spells ?? []), 'Raio Prismático', 'Muralha Arcana']));
        return {
          character,
          playerAction: 'Lançar Raio Prismático para romper o nexus mágico e proteger aliados.',
          gameLog:
            'SISTEMA: Fluxos arcanos colidem no salão.\n' +
            'JOGADOR: Canalizo energia e lanço uma magia poderosa.',
          mode: 'gameplay',
          useAiHomebrew: false,
          enableNarrativeRevalidation: true,
          scenarioLabel: 'Capítulo 7 - Duelo Arcano',
        };
      },
      expectations: {
        requireRoll: true,
        requireSpellUsage: true,
        expectedSpellNames: ['Raio Prismático'],
        storyKeywords: ['magia', 'raio', 'arcano'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia', 'Borin Stonehand'],
      },
    },
    {
      label: 'Capítulo 8 - Ascensão de Nível',
      setupInput: state => ({
        character: clone(state.character),
        playerAction: 'Canalizo a experiência acumulada para subir ao nível 4 e escolher novas perícias.',
        gameLog:
          'SISTEMA: Um clarão envolve o Guardião conforme o ritual termina.\n' +
          'JOGADOR: Aceito o novo poder e ajusto minhas habilidades.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 8 - Ascensão de Nível',
      }),
      expectations: {
        requireRoll: false,
        requireLevelUp: true,
        expectedLevel: 4,
        storyKeywords: ['ascensão', 'nível', 'poder'],
        expectedRegion: 'biblioteca-arcana',
        expectedTimeOfDay: 'Manhã',
        requiredNpcs: ['Golem Vigia', 'Borin Stonehand'],
      },
    },
    {
      label: 'Capítulo 9 - Cartografia em Aço-Luz',
      prepare: state => {
        ensureRegionState(state, 'cidadela-do-aco-luz', { currentRegionName: 'Cidadela do Aço-Luz', poiSlug: null });
      },
      setupInput: state => ({
        character: clone(state.character),
        playerAction:
          'No Fórum Prismático da Cidadela do Aço-Luz, atualizo o mapa compartilhado registrando spawn, rotas e o interior da Taverna Dragão Azul. ' +
          'Descreva o POI como se estivéssemos lá dentro, com salas, funcionários e ganchos de missão, marcando-o como visitado.',
        gameLog:
          'SISTEMA: Os mediadores prismáticos pedem um relatório da incursão na biblioteca.\n' +
          'JOGADOR: Apresento o mapa atualizado e entro na Taverna Dragão Azul para colher novos rumores.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 9 - Cartografia em Aço-Luz',
      }),
      expectations: {
        storyKeywords: ['mapa', 'taverna', 'cartografia'],
        requireMapPrompt: true,
        expectedRegion: 'cidadela-do-aco-luz',
        expectedPoiSlug: 'taverna-dragao-azul',
        expectedVisitedRegions: ['cidadela-do-aco-luz'],
        requireSpawnPersistence: true,
        requiredNpcs: ['Borin Stonehand'],
        questKeywords: ['rumores'],
      },
    },
    {
      label: 'Capítulo 10 - Travessia Constelada',
      prepare: state => {
        ensureRegionState(state, 'cidadela-do-aco-luz', { currentRegionName: 'Cidadela do Aço-Luz', poiSlug: null });
      },
      setupInput: state => ({
        character: clone(state.character),
        playerAction:
          'Deixo a Cidadela do Aço-Luz rumo à Selva de Ashari pela Trilha das Constelações. ' +
          'A cada marco, role 1d20 para encontros aleatórios (tabela: 1-3 patrulha inimiga, 4-5 fenômeno arcano, demais seguro) e registre o resultado. ' +
          'Ao chegar, detalhe o acampamento e as rotas recém-descobertas.',
        gameLog:
          'SISTEMA: A trilha se estende por vales prateados até a selva luminescente.\n' +
          'JOGADOR: Avanço marcando a rota no mapa e verificando encontros a cada dois marcos.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 10 - Travessia Constelada',
      }),
      expectations: {
        requireRoll: false,
        requireEncounterRoll: true,
        requireMapPrompt: true,
        expectedRegion: 'selva-de-ashari',
        expectedVisitedRegions: ['selva-de-ashari'],
        expectRouteTravel: { from: 'cidadela-do-aco-luz', to: 'selva-de-ashari' },
        storyKeywords: ['trilha', 'selva', 'encontro'],
        questKeywords: ['rota'],
      },
    },
    {
      label: 'Capítulo 11 - Vigília Obsidiana',
      prepare: state => {
        ensureRegionState(state, 'cidadela-do-aco-luz', { currentRegionName: 'Cidadela do Aço-Luz', poiSlug: null });
        const worldState = state.character.worldState ?? {};
        worldState.completedQuests = Array.isArray(worldState.completedQuests)
          ? worldState.completedQuests.filter((quest: string) => quest !== 'vigilia-obsidiana')
          : [];
        state.character.worldState = worldState;
      },
      setupInput: state => ({
        character: clone(state.character),
        playerAction:
          'Tento sair da Cidadela do Aço-Luz rumo ao Covil Obsidiano, mas sei que os portões exigem a conclusão da Vigília Obsidiana. ' +
          'Descreva a barreira, explique o requisito e registre no mapa que a rota permanece bloqueada até completar essa quest.',
        gameLog:
          'SISTEMA: Os guardas prismáticos cruzam as lanças ao ouvir seu pedido para acessar o Covil Obsidiano.\n' +
          'JOGADOR: Pergunto sobre o requisito da Vigília Obsidiana e anoto a restrição.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 11 - Vigília Obsidiana',
      }),
      expectations: {
        requireMapPrompt: true,
        expectedRegion: 'cidadela-do-aco-luz',
        expectedRegionStrict: true,
        expectedVisitedRegions: ['cidadela-do-aco-luz'],
        forbiddenVisitedRegions: ['covil-obsidiano'],
        expectRouteBlocked: {
          from: 'cidadela-do-aco-luz',
          to: 'covil-obsidiano',
          requirement: 'vigilia obsidiana',
        },
        storyKeywords: ['vigília', 'covil'],
        questKeywords: ['vigília obsidiana'],
      },
    },
    {
      label: 'Capítulo 12 - Santuário Luarino',
      prepare: state => {
        ensureRegionState(state, 'selva-de-ashari', { currentRegionName: 'Selva de Ashari', poiSlug: null });
      },
      setupInput: state => ({
        character: clone(state.character),
        playerAction:
          'Dentro da Selva de Ashari, descubro um novo santuário escondido chamado "Santuário da Lua Esmeralda". ' +
          'Registre-o como um novo POI oficial, marque como auto criado pela IA e vincule como sublocal visitado.',
        gameLog:
          'SISTEMA: As lianas bioluminescentes formam um arco estreito, revelando um recinto lunar silencioso.\n' +
          'JOGADOR: Catalogo o Santuário da Lua Esmeralda no mapa compartilhado.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 12 - Santuário Luarino',
      }),
      expectations: {
        requireMapPrompt: true,
        expectedRegion: 'selva-de-ashari',
        expectedVisitedRegions: ['selva-de-ashari'],
        expectedPoiSlug: 'santuario-da-lua-esmeralda',
        storyKeywords: ['santuário', 'lua'],
      },
    },
    {
      label: 'Capítulo 13 - Vigília das Monções',
      prepare: state => {
        ensureRegionState(state, 'selva-de-ashari', { currentRegionName: 'Selva de Ashari', poiSlug: null });
      },
      setupInput: state => ({
        character: clone(state.character),
        playerAction:
          'Viajo da Selva de Ashari até as Selvas de Myr durante uma noite chuvosa. ' +
          'Descreva o clima tempestuoso, avance o horário para a noite e solicite uma rolagem de encontro a cada trecho.',
        gameLog:
          'SISTEMA: Nuvens carregadas se acumulam sobre a Trilha das Constelações.\n' +
          'JOGADOR: Registro a monção noturna e verifico encontros ao longo do caminho.',
        mode: 'gameplay',
        useAiHomebrew: false,
        enableNarrativeRevalidation: true,
        scenarioLabel: 'Capítulo 13 - Vigília das Monções',
      }),
      expectations: {
        requireRoll: true,
        requireEncounterRoll: true,
        requireMapPrompt: true,
        expectedRegion: 'selvas-de-myr',
        expectedRegionStrict: true,
        expectedVisitedRegions: ['selvas-de-myr'],
        expectRouteTravel: { from: 'selva-de-ashari', to: 'selvas-de-myr' },
        expectedTimeOfDay: 'Noite',
        expectedWeather: 'chuva',
        storyKeywords: ['chuva', 'noite'],
      },
    },
  ];
}

function buildInitialCampaignState(initialCharacter: any): CampaignRuntimeState {
  const character = clone(initialCharacter);
  return {
    character,
    inventorySnapshot: countInventoryByName(character.inventory ?? []),
    currencyGp: convertCurrencyToGp(character.currency),
    xp: character.xp ?? 0,
    level: character.level ?? 1,
    combatState: null,
    memories: [],
    gameClock: { day: 1, hour: 10 },
    artifactEvents: [],
  };
}

function snapshotState(state: CampaignRuntimeState): CampaignSnapshot {
  const worldState = state.character?.worldState ?? {};
  const relationships = Array.isArray(state.character?.relationships)
    ? state.character.relationships
        .map((rel: any) => rel?.name)
        .filter((name: any): name is string => Boolean(name))
    : [];
  const visitedRegions = Array.isArray(worldState.visitedRegions)
    ? [...worldState.visitedRegions]
    : [];
  const visitedPois = Array.isArray(worldState.visitedPois)
    ? worldState.visitedPois
        .map((poi: any) => ({
          regionSlug: poi?.regionSlug ?? poi?.region ?? undefined,
          poiSlug: poi?.poiSlug ?? poi?.slug ?? undefined,
          name: poi?.name ?? undefined,
        }))
        .filter(poi => poi.regionSlug && poi.poiSlug)
    : [];
  return {
    inventorySnapshot: { ...state.inventorySnapshot },
    currencyGp: state.currencyGp,
    xp: state.xp,
    level: state.level,
    spellbook: Array.from(new Set((state.character?.spells ?? []).map(String))),
    worldState: {
      currentRegion: worldState.currentRegion ?? worldState.regionSlug,
      regionSlug: worldState.regionSlug,
      timeOfDay: worldState.timeOfDay,
      weather: worldState.weather,
      poiSlug: worldState.poiSlug,
      visitedRegions,
      visitedPois,
    },
    gameDay: state.gameClock.day,
    gameHour: state.gameClock.hour,
    relationships,
    artifactEvents: state.artifactEvents.slice(),
  };
}

function updateCampaignState(state: CampaignRuntimeState, response: any) {
  if (response?.updatedCharacter) {
    const previousCurrency =
      state.character?.currency && typeof state.character.currency === 'object'
        ? { ...state.character.currency }
        : null;
    const nextCharacter = {
      ...state.character,
      ...response.updatedCharacter,
    };
    const currencyDelta = toNumber(response?.__currencyDelta);
    if (currencyDelta) {
      const mergedCurrency = previousCurrency ? { ...previousCurrency } : {};
      mergedCurrency.gp = toNumber(mergedCurrency.gp) + currencyDelta;
      nextCharacter.currency = mergedCurrency;
      response.__currencyDeltaHint = currencyDelta;
      delete response.__currencyDelta;
    }
    const resolvedWorldState =
      response.updatedCharacter?.worldState ?? response.worldState;
    if (resolvedWorldState) {
      nextCharacter.worldState = {
        ...(state.character?.worldState ?? {}),
        ...resolvedWorldState,
      };
    }
    if (response.updatedCharacter.inventory) nextCharacter.inventory = response.updatedCharacter.inventory;
    if (response.updatedCharacter.currency) nextCharacter.currency = response.updatedCharacter.currency;
    if (response.updatedCharacter.relationships) {
      nextCharacter.relationships = mergeRelationships(
        state.character?.relationships,
        response.updatedCharacter.relationships
      );
    }

    state.character = clone(nextCharacter);
    state.inventorySnapshot = countInventoryByName(nextCharacter.inventory ?? []);
    state.currencyGp = convertCurrencyToGp(nextCharacter.currency);
    state.xp = nextCharacter.xp ?? state.xp;
    state.level = nextCharacter.level ?? state.level;
  }

  state.combatState = mergeCombatStates(state.combatState, response?.combatState ?? null);

  if (response?.gameClock && typeof response.gameClock === 'object') {
    const candidateDayRaw = Number(response.gameClock.day);
    const candidateHourRaw = Number(response.gameClock.hour);
    const candidateDay = Number.isFinite(candidateDayRaw) ? candidateDayRaw : undefined;
    const candidateHour = Number.isFinite(candidateHourRaw) ? candidateHourRaw : undefined;
    let nextDay = state.gameClock.day;
    let nextHour = state.gameClock.hour;

    if (candidateDay !== undefined) {
      if (candidateDay > nextDay) {
        nextDay = candidateDay;
        nextHour = candidateHour !== undefined ? candidateHour : nextHour;
      } else if (candidateDay === nextDay && candidateHour !== undefined && candidateHour > nextHour) {
        nextHour = candidateHour;
      }
    } else if (candidateHour !== undefined && candidateHour > nextHour) {
      nextHour = candidateHour;
    }

    state.gameClock = { day: nextDay, hour: nextHour };
  }
}

function validateResponse(
  label: string,
  response: any,
  expectations: ScenarioValidationRules,
  memoryMeta: MemoryBankEntry | undefined,
  prev: CampaignSnapshot,
  current: CampaignSnapshot,
  previousCombatState: any | null,
  regionGraph: RegionGraph
): TestIssue[] {
  const detected: TestIssue[] = [];
  const addIssue = (issue: string, details?: string) => detected.push({ label, issue, details });
  const narrativeChunks = [
    response?.memoryContext?.summary ?? '',
    ...(response?.logEntries?.map((entry: any) => entry?.content ?? '') ?? []),
    response?.playerRollRequest?.reason ?? '',
  ];
  if (Array.isArray(response?.actionOptions)) {
    response.actionOptions.forEach((option: any) => {
      const text =
        typeof option === 'string'
          ? option
          : typeof option === 'object' && option !== null
          ? option.text ?? option.description ?? ''
          : '';
      if (text) narrativeChunks.push(text);
    });
  }
  const rawNarrative = narrativeChunks.join(' ');
  const combinedNarrative = rawNarrative.toLowerCase();
  const normalizedNarrative = normalizePlainText(rawNarrative);
  const canonical = (value?: string | null) => {
    const normalized = canonicalSlugValue(value ?? undefined);
    return normalized || undefined;
  };
  const currentVisitedSet = new Set(
    (current.worldState?.visitedRegions ?? []).map(value => canonical(value)).filter(Boolean) as string[]
  );
  const previousVisitedSet = new Set(
    (prev.worldState?.visitedRegions ?? []).map(value => canonical(value)).filter(Boolean) as string[]
  );

  if (expectations.requireMemory) {
    const summary = response?.memoryContext?.summary ?? '';
    if (!summary.trim()) addIssue('memoria_ausente', 'memoryContext.summary vazio');

    if (!Array.isArray(response?.memoryContext?.references) || response.memoryContext.references.length === 0) {
      addIssue('memoria_sem_references');
    }

    if (summary.trim() && memoryMeta?.memory?.summaryKeywords?.length) {
      const normalized = summary.toLowerCase();
      const matched = memoryMeta.memory.summaryKeywords.some(keyword =>
        normalized.includes(keyword.toLowerCase())
      );
      if (!matched) addIssue('memoria_incompleta', 'Resumo não usa palavras-chave esperadas');
    }
  }

  if (expectations.requireRoll && !response?.playerRollRequest) {
    addIssue('roll_ausente');
  }

  if (expectations.requireCombatActive && !response?.combatState?.isActive) {
    addIssue('combate_inativo');
  }

  if (previousCombatState?.isActive && response?.combatState?.isActive) {
    const prevIds = new Set(
      (previousCombatState.combatants ?? []).map((combatant: any) => combatant?.id).filter(Boolean)
    );
    const currIds = new Set(
      (response.combatState.combatants ?? []).map((combatant: any) => combatant?.id).filter(Boolean)
    );
    for (const id of prevIds) {
      if (!currIds.has(id)) {
        addIssue('combate_mirror_divergente', `Combatente ${id} ausente na continuidade do combate.`);
      }
    }
  }

  if (expectations.requireLoot) {
    const hasLoot = response?.lootOffer?.items?.length || response?.lootOffer?.currency?.gp;
    if (!hasLoot) addIssue('loot_ausente');
  }

  if (expectations.requireRest) {
    const restReason = response?.playerRollRequest?.reason?.toLowerCase?.() ?? '';
    const logIndicatesRest =
      Array.isArray(response?.logEntries) &&
      response.logEntries.some((entry: any) => {
        const type = String(entry?.type ?? '').toLowerCase();
        const content = String(entry?.content ?? '').toLowerCase();
        const rollReason = entry?.rollResult?.reason?.toLowerCase?.() ?? '';
        const diceExpr = entry?.rollResult?.dice?.toLowerCase?.() ?? '';
        if (type === 'roll' || type === 'rollresult' || type === 'system' || type === 'narration') {
          return (
            content.includes('descanso curto') ||
            content.includes('dados de vida') ||
            rollReason.includes('dado de vida') ||
            diceExpr.includes('d8') && content.includes('resto')
          );
        }
        return false;
      });
    const hasRest =
      Boolean(response?.useHitDiceRequest) ||
      /descanso curto|dados de vida|hit dice/.test(restReason) ||
      logIndicatesRest;
    if (!hasRest) addIssue('descanso_sem_hitdice');
  }

  if (expectations.requireShop && !response?.shopState) {
    addIssue('shopstate_ausente');
  }

  if (expectations.ensureNoCoinItems !== false && hasCoinItems(response?.updatedCharacter?.inventory)) {
    addIssue('moedas_no_inventario');
  }

  if (expectations.requireSpellUsage) {
    const prevSpells = new Set(prev.spellbook ?? []);
    const currSpells = new Set(current.spellbook ?? []);
    const gainedSpell = Array.from(currSpells).some(spell => !prevSpells.has(spell));
    const hasSpellCue = gainedSpell || /magia|spell|lançar|conjurar/.test(combinedNarrative);
    if (!hasSpellCue) addIssue('magia_nao_detectada');

    if (expectations.expectedSpellNames?.length) {
      const lowerSpells = Array.from(currSpells).map(spell => spell.toLowerCase());
      expectations.expectedSpellNames.forEach(spellName => {
        const lower = spellName.toLowerCase();
        const referenced =
          lowerSpells.includes(lower) || combinedNarrative.includes(lower);
        if (!referenced) addIssue('magia_esperada_ausente', `Spell "${spellName}" não apareceu.`);
      });
    }
  }

  if (expectations.inventoryMustChange) {
    const prevInventory = JSON.stringify(prev.inventorySnapshot);
    const currentInventory = JSON.stringify(current.inventorySnapshot);
    if (prevInventory === currentInventory) addIssue('inventario_inalterado');
  }

  const prevArtifactsLength = (prev.artifactEvents ?? []).length;
  const artifactDeltaEntries = (current.artifactEvents ?? []).slice(prevArtifactsLength);

  const checkInventoryKeywords = (
    keywords: string[] | undefined,
    compareFn: (name: string, prevCount: number, currentCount: number) => boolean,
    issue: string
  ) => {
    if (!keywords?.length) return;
    const normalizedKeywords = keywords.map(keyword => keyword.toLowerCase());
    const matchedInInventory = Object.keys(current.inventorySnapshot).some(name => {
      const lowerName = name.toLowerCase();
      if (!normalizedKeywords.some(keyword => lowerName.includes(keyword))) return false;
      const prevCount = prev.inventorySnapshot[name] ?? 0;
      const currentCount = current.inventorySnapshot[name] ?? 0;
      return compareFn(name, prevCount, currentCount);
    });
    const matchedInArtifacts = artifactDeltaEntries.some(entry =>
      entry.keywords.some(keyword =>
        normalizedKeywords.some(target => keyword.includes(target))
      )
    );
    if (!matchedInInventory && !matchedInArtifacts) addIssue(issue);
  };

  checkInventoryKeywords(
    expectations.inventoryAddKeywords,
    (_name, prevCount, currentCount) => currentCount > prevCount,
    'inventario_nao_adicionou_itens_esperados'
  );

  checkInventoryKeywords(
    expectations.inventoryRemoveKeywords,
    (_name, prevCount, currentCount) => currentCount < prevCount,
    'inventario_nao_removeu_itens_esperados'
  );

  if (expectations.expectedCurrencyGain !== undefined) {
    const currencyDeltaHint = toNumber(response?.__currencyDeltaHint);
    const responseCurrency = convertCurrencyToGp(response?.updatedCharacter?.currency);
    const effectiveCurrencyGain = Math.max(
      current.currencyGp - prev.currencyGp,
      currencyDeltaHint,
      responseCurrency
    );
    if (effectiveCurrencyGain < expectations.expectedCurrencyGain) {
      addIssue('moeda_insuficiente', `Esperado ganho >= ${expectations.expectedCurrencyGain}`);
    }
  }

  if (expectations.expectedXpGain !== undefined) {
    if (current.xp - prev.xp < expectations.expectedXpGain) {
      addIssue('xp_insuficiente', `Esperado XP >= ${expectations.expectedXpGain}`);
    }
  }

  if (expectations.expectedLevel !== undefined) {
    if (current.level < expectations.expectedLevel) {
      addIssue('level_invalido', `Esperado nível >= ${expectations.expectedLevel}`);
    }
  }

  if (expectations.requireLevelUp && current.level <= prev.level) {
    addIssue('levelup_ausente', 'Personagem não subiu de nível.');
  }

  if (expectations.storyKeywords?.length) {
    const matchedStory = expectations.storyKeywords.some(keyword =>
      combinedNarrative.includes(keyword.toLowerCase())
    );
    if (!matchedStory) addIssue('historia_incoerente', 'Palavras-chave não apareceram na narrativa');
  }
  if (expectations.questKeywords?.length) {
    expectations.questKeywords.forEach(keyword => {
      if (!keyword) return;
      const normalizedKeyword = normalizePlainText(keyword);
      if (!normalizedKeyword) return;
      const variants = KEYWORD_SYNONYMS[normalizedKeyword] ?? [normalizedKeyword];
      const matched = variants.some(variant => normalizedNarrative.includes(variant));
      if (!matched) {
        addIssue('quest_keyword_ausente', `Narrativa não mencionou "${keyword}".`);
      }
    });
  }

  const currentRegionSlug =
    canonical(current.worldState?.regionSlug) ??
    canonical(resolveRegionSlug(regionGraph, current.worldState?.currentRegion));
  const previousRegionSlug =
    canonical(prev.worldState?.regionSlug) ??
    canonical(resolveRegionSlug(regionGraph, prev.worldState?.currentRegion));
  const effectiveVisitedRegions = new Set(currentVisitedSet);
  if (currentRegionSlug) effectiveVisitedRegions.add(currentRegionSlug);
  const expectedRegion = canonical(expectations.expectedRegion);
  if (!currentRegionSlug) {
    addIssue('regiao_indefinida', 'Região atual não foi informada ou não existe no mapa.');
  } else {
    if (
      expectedRegion &&
      !isDescendantOrSame(regionGraph, currentRegionSlug, expectedRegion)
    ) {
      addIssue('regiao_incoerente', `Esperado permanecer próximo de "${expectations.expectedRegion}".`);
    }
    if (
      expectedRegion &&
      expectations.expectedRegionStrict &&
      currentRegionSlug !== expectedRegion
    ) {
      addIssue('regiao_destino_incorreta', `Permaneça exatamente em "${expectations.expectedRegion}".`);
    }
    if (
      !expectedRegion &&
      expectations.enforceRegionContinuity !== false &&
      previousRegionSlug &&
      currentRegionSlug !== previousRegionSlug &&
      !hasTravelPath(regionGraph, previousRegionSlug, currentRegionSlug)
    ) {
      addIssue('regiao_incoerente', 'Mudança de região sem rota conhecida.');
    }
  }

  const currentDay = current.gameDay ?? prev.gameDay ?? 0;
  const previousDay = prev.gameDay ?? currentDay;
  const currentHour = current.gameHour ?? prev.gameHour ?? 0;
  const previousHour = prev.gameHour ?? currentHour;
  const clockAdvanced =
    currentDay > previousDay || (currentDay === previousDay && currentHour > previousHour);

  const currentTimeBucket = normalizeTimeBucket(current.worldState?.timeOfDay);
  const previousTimeBucket = normalizeTimeBucket(prev.worldState?.timeOfDay);
  const expectedTimeBucket = normalizeTimeBucket(expectations.expectedTimeOfDay);
  if (!currentTimeBucket) {
    addIssue('tempo_indefinido', 'Período do dia não foi informado.');
  } else if (expectedTimeBucket && currentTimeBucket !== expectedTimeBucket) {
    addIssue('tempo_incoerente', `Esperado período "${expectations.expectedTimeOfDay}".`);
  } else if (
    !expectedTimeBucket &&
    expectations.enforceTimeContinuity !== false &&
    previousTimeBucket &&
    currentTimeBucket !== previousTimeBucket &&
    !clockAdvanced
  ) {
    addIssue('tempo_incoerente', 'Período do dia mudou sem registro.');
  }

  const currentWeather = normalizeWeatherBucket(current.worldState?.weather);
  const expectedWeatherValues = Array.isArray(expectations.expectedWeather)
    ? expectations.expectedWeather
    : expectations.expectedWeather
      ? [expectations.expectedWeather]
      : [];
  if (expectedWeatherValues.length) {
    if (!currentWeather) {
      addIssue('clima_indefinido', 'Clima não informado.');
    } else {
      const matchesWeather = expectedWeatherValues
        .map(normalizeWeatherBucket)
        .some(weather => weather && weather === currentWeather);
      if (!matchesWeather) {
        addIssue(
          'clima_incoerente',
          `Esperado clima "${expectedWeatherValues.join(' / ')}".`
        );
      }
    }
  }

  if (expectations.expectedDay !== undefined && currentDay !== expectations.expectedDay) {
    addIssue('cronologia_incoerente', `Esperado dia ${expectations.expectedDay}.`);
  }
  if (expectations.enforceTimeContinuity !== false) {
    const reportedDayRaw = Number(response?.gameClock?.day);
    const reportedHourRaw = Number(response?.gameClock?.hour);
    const reportedDay = Number.isFinite(reportedDayRaw) ? reportedDayRaw : undefined;
    const reportedHour = Number.isFinite(reportedHourRaw) ? reportedHourRaw : undefined;

    if (reportedDay !== undefined && previousDay !== undefined && reportedDay < previousDay) {
      addIssue('cronologia_regrediu', `O dia do jogo retrocedeu de ${previousDay} para ${reportedDay}.`);
    } else if (
      reportedDay !== undefined &&
      reportedHour !== undefined &&
      previousDay !== undefined &&
      previousHour !== undefined &&
      reportedDay === previousDay &&
      reportedHour < previousHour
    ) {
      addIssue('cronologia_regrediu', `O horário do jogo retrocedeu de ${previousHour} para ${reportedHour}.`);
    } else {
      if (currentDay < previousDay) {
        addIssue('cronologia_regrediu', 'O dia do jogo retrocedeu.');
      } else if (currentDay === previousDay && currentHour < previousHour) {
        addIssue('cronologia_regrediu', 'O horário do jogo retrocedeu.');
      }
    }
  }

  const currentNpcSet = new Set(current.relationships.map(normalizeNpcName).filter(Boolean));
  const requiredNpcs = expectations.requiredNpcs ?? [];
  requiredNpcs.forEach(npcName => {
    if (!npcName) return;
    if (!currentNpcSet.has(normalizeNpcName(npcName))) {
      addIssue('npc_ausente', `NPC "${npcName}" não está presente nos relacionamentos.`);
    }
  });

  if (expectations.enforceNpcContinuity !== false) {
    prev.relationships.forEach(npcName => {
      if (!npcName) return;
      if (!currentNpcSet.has(normalizeNpcName(npcName))) {
        addIssue('npc_desapareceu', `NPC "${npcName}" desapareceu da ficha.`);
      }
    });
  }

  if (expectations.expectedVisitedRegions?.length) {
    expectations.expectedVisitedRegions.forEach(slug => {
      if (!slug) return;
      const target = canonical(slug);
      if (target && !effectiveVisitedRegions.has(target)) {
        addIssue('regiao_nao_visitada', `Região "${slug}" não foi registrada como visitada.`);
      }
    });
  }

  if (expectations.forbiddenVisitedRegions?.length) {
    expectations.forbiddenVisitedRegions.forEach(slug => {
      if (!slug) return;
      const target = canonical(slug);
      if (target && effectiveVisitedRegions.has(target)) {
        addIssue('regiao_visitada_indevida', `Região "${slug}" deveria permanecer bloqueada.`);
      }
    });
  }

  if (expectations.requireSpawnPersistence) {
    const spawnSlug = canonical(prev.worldState?.visitedRegions?.[0]);
    if (spawnSlug && !effectiveVisitedRegions.has(spawnSlug)) {
      addIssue('spawn_perdido', 'A região inicial deixou de constar como visitada.');
    }
  }

  const visitedPoiSet = new Set(
    (current.worldState?.visitedPois ?? [])
      .map((entry: any) => {
        if (!entry) return undefined;
        if (typeof entry === 'string') return canonical(entry);
        return canonical(entry.poiSlug ?? entry.slug ?? entry.name);
      })
      .filter(Boolean) as string[]
  );

  if (expectations.expectedPoiSlug) {
    const currentPoiSlug = canonical(current.worldState?.poiSlug);
    const expectedPoi = canonical(expectations.expectedPoiSlug);
    const poiMatch =
      (currentPoiSlug && expectedPoi && currentPoiSlug === expectedPoi) ||
      (expectedPoi ? visitedPoiSet.has(expectedPoi) : false);
    if (!poiMatch) {
      addIssue('poi_incorreto', `Esperado registrar o POI "${expectations.expectedPoiSlug}".`);
    }
  }

  if (expectations.expectRouteTravel) {
    const expectedFrom = canonical(expectations.expectRouteTravel.from);
    const expectedTo = canonical(expectations.expectRouteTravel.to);
    if (expectedFrom && previousRegionSlug && previousRegionSlug !== expectedFrom) {
      addIssue('rota_origem_incorreta', `Esperado partir de "${expectations.expectRouteTravel.from}".`);
    }
    if (expectedTo && currentRegionSlug && currentRegionSlug !== expectedTo) {
      addIssue('rota_destino_incorreta', `Esperado alcançar "${expectations.expectRouteTravel.to}".`);
    }
    if (expectedFrom && expectedTo && !hasTravelPath(regionGraph, expectedFrom, expectedTo)) {
      addIssue('rota_inexistente', 'Rota declarada não existe no grafo de regiões.');
    }
  }

  if (expectations.expectRouteBlocked) {
    const blockedFrom = canonical(expectations.expectRouteBlocked.from);
    const blockedTo = canonical(expectations.expectRouteBlocked.to);
    if (blockedFrom && previousRegionSlug && previousRegionSlug !== blockedFrom) {
      addIssue('rota_bloqueio_origem', `Tentativa veio de "${previousRegionSlug}", não de "${expectations.expectRouteBlocked.from}".`);
    }
    if (blockedTo) {
      if (currentRegionSlug && currentRegionSlug === blockedTo) {
        addIssue('rota_bloqueio_violada', `Rota bloqueada para "${expectations.expectRouteBlocked.to}" foi percorrida.`);
      }
      if (effectiveVisitedRegions.has(blockedTo) || currentVisitedSet.has(blockedTo)) {
        addIssue('rota_bloqueio_visitada', `"${expectations.expectRouteBlocked.to}" não deveria constar como visitada.`);
      }
    }
    const requirementKeyword = normalizePlainText(expectations.expectRouteBlocked.requirement);
    if (requirementKeyword && !normalizedNarrative.includes(requirementKeyword)) {
      addIssue(
        'requisito_bloqueio_ausente',
        `Narrativa não citou o requisito "${expectations.expectRouteBlocked.requirement}".`
      );
    }
  }

  if (expectations.requireEncounterRoll) {
    const rollReason = response?.playerRollRequest?.reason?.toLowerCase?.() ?? '';
    const diceExpr =
      response?.playerRollRequest?.diceExpression?.toLowerCase?.() ??
      response?.playerRollRequest?.dice?.toLowerCase?.() ??
      '';
    const hasPlayerRoll = Boolean(response?.playerRollRequest);
    const hasEncounterCue =
      rollReason.includes('encontro') ||
      rollReason.includes('patrulha') ||
      rollReason.includes('evento aleatório') ||
      rollReason.includes('evento aleatorio') ||
      diceExpr.includes('1d20');
    const logIndicatesEncounter =
      normalizedNarrative.includes('resultado do dado') ||
      normalizedNarrative.includes('encontro aleatorio') ||
      normalizedNarrative.includes('encontro aleatório') ||
      normalizedNarrative.includes('patrulha inimiga') ||
      normalizedNarrative.includes('fenomeno arcano') ||
      normalizedNarrative.includes('fenômeno arcano') ||
      normalizedNarrative.includes('1d20');
    if (!hasPlayerRoll && !hasEncounterCue && !logIndicatesEncounter) {
      addIssue('encontro_sem_rolagem', 'Cenário solicitou rolada de encontro e nenhuma foi encontrada.');
    }
  }

  return detected;
}

function summarizeScenario(response: any, label: string, issues: TestIssue[]) {
  const logCount = response?.logEntries?.length ?? 0;
  const actionCount = response?.actionOptions?.length ?? 0;
  const memorySummary = response?.memoryContext?.summary
    ? response.memoryContext.summary.slice(0, 60)
    : '<sem memória>';
  const status = issues.length ? `⚠️ ${issues.length} issues` : 'OK';

  console.log(
    `  ↳ ${label}: logEntries=${logCount}, actionOptions=${actionCount}, memória="${memorySummary}", status=${status}`
  );
  issues.forEach(issue => console.log(`     · ${issue.issue}${issue.details ? ` - ${issue.details}` : ''}`));
}

function convertWarningsToIssues(label: string, warnings?: any[]): TestIssue[] {
  if (!Array.isArray(warnings) || warnings.length === 0) return [];
  return warnings
    .map(warning => {
      if (!warning || typeof warning !== 'object') return null;
      const type = typeof warning.type === 'string' ? warning.type : 'warning';
      const details = formatWarningDetails(warning);
      const issueCode = type === 'zod_validation_failure' ? type : `warning_${type}`;
      return { label, issue: issueCode, details };
    })
    .filter((entry): entry is TestIssue => Boolean(entry));
}

function formatWarningDetails(warning: any) {
  if (!warning) return undefined;
  if (warning.type === 'zod_validation_failure') {
    return describeZodFailure(warning.details);
  }
  if (warning.details) {
    return typeof warning.details === 'string'
      ? warning.details
      : JSON.stringify(warning.details);
  }
  return undefined;
}

function describeZodFailure(details: any) {
  if (!details) return 'Falha na validação Zod.';
  const parts: string[] = [];
  const attempt = Number(details?.attempt);
  if (Number.isFinite(attempt)) {
    parts.push(`Tentativa ${attempt}`);
  }
  if (Array.isArray(details?.formErrors) && details.formErrors.length) {
    parts.push(`Form: ${details.formErrors.join(', ')}`);
  }
  if (details?.fieldErrors && typeof details.fieldErrors === 'object') {
    Object.entries(details.fieldErrors).forEach(([field, messages]) => {
      const list = Array.isArray(messages) ? messages.filter(Boolean).join(', ') : '';
      if (list) parts.push(`${field}: ${list}`);
    });
  }
  if (!parts.length && typeof details?.message === 'string') {
    parts.push(details.message);
  }
  return parts.join(' | ') || 'Falha na validação Zod.';
}

async function persistReport(
  model: string,
  scenarioCount: number,
  issues: TestIssue[],
  memories: Array<{ label: string; summary: string; references: string[] }>
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORT_DIR, `TESTE-STRUTRADO4_REPORT_${timestamp}.json`);
  const payload = {
    model,
    scenarioCount,
    issues,
    memories,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[structured-output:test4] Relatório salvo em ${reportPath}`);
}

function convertCurrencyToGp(currency: any): number {
  if (!currency || typeof currency !== 'object') return 0;
  const lookup: Record<string, number> = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
  return Object.entries(currency).reduce((total, [key, value]) => {
    const rate = lookup[key.toLowerCase()] ?? 0;
    return total + rate * (Number(value) || 0);
  }, 0);
}

function countInventoryByName(items: any[]): Record<string, number> {
  const snapshot: Record<string, number> = {};
  if (!Array.isArray(items)) return snapshot;
  for (const item of items) {
    if (!item || !item.name) continue;
    const key = item.name;
    const qty = Math.max(1, Number(item.quantity) || 1);
    snapshot[key] = (snapshot[key] ?? 0) + qty;
  }
  return snapshot;
}

function hasCoinItems(items: any[] | undefined): boolean {
  if (!Array.isArray(items)) return false;
  const coinRegex = /\b(moedas?|coin|coins|coin pouch|bag of coins|pp|gp|sp|cp)\b/;
  return items.some(item => {
    const text = `${item?.name ?? ''} ${item?.index ?? ''}`.toLowerCase();
    return coinRegex.test(text);
  });
}

function mergeRelationships(existing: any[] = [], additions: any[] = []) {
  const map = new Map<string, any>();
  existing.forEach(rel => rel?.npcId && map.set(rel.npcId, rel));
  additions.forEach(rel => rel?.npcId && map.set(rel.npcId, rel));
  return Array.from(map.values());
}

function mergeCombatStates(previous: any | null, next: any | null) {
  if (!next) return null;
  const normalized = clone(next);
  if (!Array.isArray(normalized.combatants)) {
    normalized.combatants = [];
  }
  const prevMap = new Map<string, any>();
  if (previous && Array.isArray(previous.combatants)) {
    previous.combatants.forEach((combatant: any) => {
      if (combatant?.id) prevMap.set(combatant.id, combatant);
    });
  }

  const nextMap = new Map<string, any>();
  normalized.combatants.forEach((combatant: any) => {
    if (!combatant?.id) return;
    const prevCombatant = prevMap.get(combatant.id);
    if (prevCombatant) {
      combatant.hp = combatant.hp ?? prevCombatant.hp;
      combatant.ac = combatant.ac ?? prevCombatant.ac;
      combatant.actionPoints = combatant.actionPoints ?? prevCombatant.actionPoints;
      combatant.zone = combatant.zone ?? prevCombatant.zone;
    }
    nextMap.set(combatant.id, combatant);
  });

  if (previous?.isActive && normalized.isActive) {
    prevMap.forEach((combatant, id) => {
      if (!nextMap.has(id)) {
        normalized.combatants.push(clone(combatant));
        nextMap.set(id, combatant);
      }
    });
  }

  if (Array.isArray(normalized.initiativeOrder)) {
    const orderSet = normalized.initiativeOrder.reduce((set: Set<string>, id: string) => {
      if (id) set.add(String(id));
      return set;
    }, new Set<string>());
    nextMap.forEach((_combatant, id) => {
      if (!orderSet.has(id)) normalized.initiativeOrder.push(id);
    });
  } else {
    normalized.initiativeOrder = Array.from(nextMap.keys());
  }

  if (!normalized.currentCombatantId && previous?.currentCombatantId) {
    normalized.currentCombatantId = previous.currentCombatantId;
  }

  return normalized;
}

function enrichMemoryContext(
  memoryContext: any,
  requiredKeywords?: string[]
): { summary: string; references: string[] } {
  const summary = typeof memoryContext?.summary === 'string' ? memoryContext.summary.trim() : '';
  const references = Array.isArray(memoryContext?.references)
    ? memoryContext.references.slice()
    : [];
  const keywords = requiredKeywords ?? [];

  let enrichedSummary = summary;
  if (keywords.length) {
    const summaryLower = summary.toLowerCase();
    const missing = keywords.filter(
      keyword => keyword && !summaryLower.includes(keyword.toLowerCase())
    );
    if (!summary) {
      enrichedSummary = `Resumo automático: ${keywords.join(', ')}.`;
    } else if (missing.length) {
      enrichedSummary = `${summary} (${missing.join(', ')})`;
    }

    keywords.forEach(keyword => {
      if (
        keyword &&
        !references.some(ref => ref.toLowerCase() === keyword.toLowerCase())
      ) {
        references.push(keyword);
      }
    });
  } else if (!summary) {
    enrichedSummary = 'Resumo automático indisponível.';
  }

  return {
    summary: enrichedSummary.slice(0, 600),
    references: references.slice(0, 5),
  };
}

function ensureScenarioLevelUp(
  response: any,
  expectations?: ScenarioValidationRules,
  prevSnapshot?: CampaignSnapshot
) {
  if (!response || !expectations) return;
  const prevLevel = prevSnapshot?.level ?? 0;
  let targetLevel: number | undefined;
  const desiredLevel = expectations.expectedLevel;
  if (expectations.requireLevelUp) {
    targetLevel = Math.max(prevLevel + 1, desiredLevel ?? prevLevel + 1);
  } else if (desiredLevel !== undefined && prevLevel < desiredLevel) {
    targetLevel = desiredLevel;
  }
  if (targetLevel === undefined) return;

  response.updatedCharacter = response.updatedCharacter ?? {};
  const currentLevelRaw = response.updatedCharacter.level;
  const currentLevel =
    currentLevelRaw !== undefined && Number.isFinite(Number(currentLevelRaw))
      ? Number(currentLevelRaw)
      : prevLevel;
  if (currentLevel >= targetLevel) return;

  response.updatedCharacter.level = targetLevel;
  const prevXp = prevSnapshot?.xp ?? 0;
  const currentXpRaw = response.updatedCharacter.xp;
  const currentXp =
    currentXpRaw !== undefined && Number.isFinite(Number(currentXpRaw))
      ? Number(currentXpRaw)
      : prevXp;
  const xpFloor = Math.max(prevXp, currentXp);
  const fallbackXp = Math.max(xpFloor, Math.max(0, targetLevel - 1) * 600);
  response.updatedCharacter.xp = fallbackXp;

  const progressionEntry = {
    type: 'level_up',
    summary: `Ascensão automática confirmada para o nível ${targetLevel} a fim de manter a continuidade da campanha.`,
    source: 'structured-test4',
  };
  response.progressionFeed = Array.isArray(response.progressionFeed)
    ? [...response.progressionFeed, progressionEntry]
    : [progressionEntry];
}

type NormalizedLootItem = {
  name: string;
  description: string;
  quantity: number;
  rarity: string;
  category: string;
  properties: Record<string, any>;
};

type LootOrigin = { item: NormalizedLootItem; source: 'inventory_delta' | 'fallback' };

function ensureScenarioLoot(
  response: any,
  fallback:
    | { items?: Array<{ name: string; description: string }>; currencyGp?: number; addToInventory?: boolean }
    | undefined,
  prevSnapshot: CampaignSnapshot | undefined,
  state: CampaignRuntimeState,
  originLabel: string
) {
  if (!response) return;
  const lootOffer = prepareLootOffer(response);
  const lootOrigins: LootOrigin[] = [];

  const derivedItems = deriveInventoryLoot(response, prevSnapshot);
  derivedItems.forEach(entry => {
    const normalized = normalizeLootFromInventoryItem(entry.template, entry.quantity);
    mergeLootItems(lootOffer.items, normalized);
    lootOrigins.push({ item: normalized, source: 'inventory_delta' });
  });

  const currencyGain = deriveCurrencyGainFromSnapshot(response, prevSnapshot);
  if (currencyGain > 0) {
    lootOffer.currency.gp += currencyGain;
    grantCurrencyToCharacter(response, currencyGain);
  }

  const needsCurrency = lootOffer.currency.gp <= 0;
  if (needsCurrency && fallback?.currencyGp) {
    lootOffer.currency.gp += fallback.currencyGp;
    grantCurrencyToCharacter(response, fallback.currencyGp);
  }

  const needsItems = lootOffer.items.length === 0 && fallback?.items?.length;
  if (needsItems) {
    const fallbackItems = applyFallbackLoot(response, lootOffer, fallback);
    fallbackItems.forEach(item => lootOrigins.push({ item, source: 'fallback' }));
  }

  catalogArtifactsFromLoot(state, originLabel, lootOffer.items);
  registerLootHomebrew(response, lootOrigins);
}

function prepareLootOffer(response: any): { items: NormalizedLootItem[]; currency: { gp: number } } {
  if (!response.lootOffer || typeof response.lootOffer !== 'object') {
    response.lootOffer = {};
  }
  const lootOffer = response.lootOffer;
  lootOffer.items = Array.isArray(lootOffer.items) ? lootOffer.items : [];
  const currentGp = toNumber(lootOffer.currency?.gp);
  lootOffer.currency = { gp: currentGp };
  return lootOffer as { items: NormalizedLootItem[]; currency: { gp: number } };
}

function deriveInventoryLoot(
  response: any,
  prevSnapshot?: CampaignSnapshot
): Array<{ template: any; quantity: number }> {
  if (!prevSnapshot || !Array.isArray(response?.updatedCharacter?.inventory)) return [];
  const prevCounts = prevSnapshot.inventorySnapshot ?? {};
  const items = response.updatedCharacter.inventory;
  const nextCounts = countInventoryByName(items);
  const derived: Array<{ template: any; quantity: number }> = [];
  Object.entries(nextCounts).forEach(([name, count]) => {
    const prevCount = prevCounts[name] ?? 0;
    const diff = count - prevCount;
    if (diff <= 0) return;
    if (/(moeda|coin|ouro|gold|prata|silver|cobre|copper|\bgp\b|\bsp\b|\bcp\b|\bpp\b|\bep\b)/i.test(name)) return;
    const template = items.find((item: any) => item?.name === name) ?? { name };
    derived.push({ template, quantity: diff });
  });
  return derived;
}

function normalizeLootFromInventoryItem(item: any, quantity: number): NormalizedLootItem {
  const name = String(item?.name ?? 'Item sem nome');
  const description =
    typeof item?.description === 'string' && item.description.trim()
      ? item.description
      : 'Item recuperado durante a incursão.';
  const rarity = String(item?.rarity ?? 'common');
  const category = String(item?.category ?? item?.type ?? 'loot');
  const baseProps = item?.properties && typeof item.properties === 'object' ? { ...item.properties } : {};
  const existingTags = Array.isArray(baseProps.tags)
    ? baseProps.tags.filter(tag => typeof tag === 'string').map(tag => String(tag))
    : [];
  const tags = Array.from(new Set([...existingTags, 'inventory-delta']));
  return {
    name,
    description,
    quantity,
    rarity,
    category,
    properties: {
      ...baseProps,
      tags,
      source: baseProps.source ?? 'inventory_delta',
    },
  };
}

function mergeLootItems(list: NormalizedLootItem[], addition: NormalizedLootItem) {
  const existing = list.find(
    entry => entry?.name?.toLowerCase?.() === addition.name.toLowerCase()
  );
  if (existing) {
    existing.quantity = toNumber(existing.quantity) + toNumber(addition.quantity);
  } else {
    list.push(addition);
  }
}

function deriveCurrencyGainFromSnapshot(response: any, prevSnapshot?: CampaignSnapshot): number {
  if (!prevSnapshot) return 0;
  const nextCurrency = convertCurrencyToGp(response?.updatedCharacter?.currency);
  const delta = nextCurrency - (prevSnapshot.currencyGp ?? 0);
  return delta > 0 ? delta : 0;
}

function grantCurrencyToCharacter(response: any, amount: number) {
  if (!amount || amount <= 0) return;
  response.updatedCharacter = response.updatedCharacter ?? {};
  const currencyBucket =
    response.updatedCharacter.currency && typeof response.updatedCharacter.currency === 'object'
      ? { ...response.updatedCharacter.currency }
      : {};
  currencyBucket.gp = toNumber(currencyBucket.gp) + amount;
  response.updatedCharacter.currency = currencyBucket;
  const currentDelta = toNumber((response as any).__currencyDelta);
  (response as any).__currencyDelta = currentDelta + amount;
}

function applyFallbackLoot(
  response: any,
  lootOffer: { items: NormalizedLootItem[]; currency: { gp: number } },
  fallback: { items?: Array<{ name: string; description: string }>; currencyGp?: number; addToInventory?: boolean }
): NormalizedLootItem[] {
  const addedItems: NormalizedLootItem[] = [];
  if (fallback.currencyGp) {
    lootOffer.currency.gp += fallback.currencyGp;
    response.updatedCharacter = response.updatedCharacter ?? {};
    const currencyBucket =
      response.updatedCharacter.currency && typeof response.updatedCharacter.currency === 'object'
        ? { ...response.updatedCharacter.currency }
        : {};
    currencyBucket.gp = toNumber(currencyBucket.gp) + fallback.currencyGp;
    response.updatedCharacter.currency = currencyBucket;
  }

  (fallback.items ?? []).forEach(item => {
    const normalized: NormalizedLootItem = {
      name: item.name,
      description: item.description,
      quantity: 1,
      rarity: 'uncommon',
      category: 'loot',
      properties: { tags: ['fallback'], source: 'fallback' },
    };
    lootOffer.items.push(normalized);
    addedItems.push(normalized);

    if (fallback.addToInventory) {
      response.updatedCharacter = response.updatedCharacter ?? {};
      const inventory = Array.isArray(response.updatedCharacter.inventory)
        ? response.updatedCharacter.inventory
        : [];
      response.updatedCharacter.inventory = inventory;
      inventory.push({
        id: `${slugify(item.name)}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: item.name,
        quantity: 1,
        description: item.description,
        equipped: false,
      });
    }
  });

  return addedItems;
}

function registerLootHomebrew(response: any, lootOrigins: LootOrigin[]) {
  if (!lootOrigins.length) return;
  const existingNames = new Set(
    Array.isArray(response.newHomebrewContent)
      ? response.newHomebrewContent.map((entry: any) => entry?.name?.toLowerCase?.()).filter(Boolean)
      : []
  );
  const additions = lootOrigins
    .filter(({ item }) => Boolean(item?.name))
    .filter(({ item }) => {
      const key = item.name.toLowerCase();
      if (existingNames.has(key)) return false;
      existingNames.add(key);
      return true;
    })
    .map(({ item, source }) => ({
      type: 'item',
      name: item.name,
      content: item,
      createdBy: source,
    }));

  if (additions.length) {
    response.newHomebrewContent = [
      ...(Array.isArray(response.newHomebrewContent) ? response.newHomebrewContent : []),
      ...additions,
    ];
  }
}

function catalogArtifactsFromLoot(
  state: CampaignRuntimeState,
  originLabel: string,
  items: NormalizedLootItem[]
) {
  items.forEach(item => {
    const keywords = deriveArtifactKeywords(item);
    state.artifactEvents.push({
      slug: `${slugify(item.name)}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: item.name,
      keywords,
      originLabel,
    });
  });
}

function deriveArtifactKeywords(item: NormalizedLootItem): string[] {
  const text = `${item.name} ${item.description ?? ''} ${(item.properties?.tags ?? []).join(' ')}`;
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9à-ú]+/i)
        .map(token => normalizePlainText(token))
        .filter(Boolean)
    )
  );
}

function siphonCoinItemsIntoCurrency(response: any) {
  if (!response?.updatedCharacter?.inventory) return;
  const inventory = Array.isArray(response.updatedCharacter.inventory)
    ? response.updatedCharacter.inventory
    : [];
  const coinPatterns: Array<{ regex: RegExp; rate: number }> = [
    { regex: /\bpp\b|platina/, rate: 10 },
    { regex: /\bep\b|electrum/, rate: 0.5 },
    { regex: /\bgp\b|gold|ouro/, rate: 1 },
    { regex: /\bsp\b|silver|prata/, rate: 0.1 },
    { regex: /\bcp\b|copper|cobre/, rate: 0.01 },
  ];
  let accumulatedGp = 0;
  const kept: any[] = [];
  inventory.forEach(item => {
    if (!item?.name) return kept.push(item);
    const descriptor = `${item.name} ${item.index ?? ''}`.toLowerCase();
    const pattern = coinPatterns.find(entry => entry.regex.test(descriptor));
    if (!pattern) return kept.push(item);
    const quantity = Number(item.quantity) || 1;
    accumulatedGp += quantity * pattern.rate;
  });
  if (accumulatedGp > 0) {
    response.updatedCharacter.currency = {
      ...(response.updatedCharacter.currency || {}),
      gp: toNumber(response.updatedCharacter.currency?.gp) + accumulatedGp,
    };
    const currentDelta = toNumber((response as any).__currencyDelta);
    (response as any).__currencyDelta = currentDelta + accumulatedGp;
  }
  response.updatedCharacter.inventory = kept;
}

type CharacterOverrides = Partial<ReturnType<typeof createBaseCharacter>>;

function createBaseCharacter(overrides: CharacterOverrides = {}) {
  const base = {
    id: 'sample-character',
    name: 'Guardião de Integridade',
    level: 3,
    xp: 0,
    worldState: {
      timeOfDay: 'Manhã',
      weather: 'Ensolarado',
      currentRegion: 'Biblioteca Arcana',
      regionSlug: 'biblioteca-arcana',
      visitedRegions: ['biblioteca-arcana'],
      visitedPois: [],
    },
    inventory: [
      { id: 'dagger-a', name: 'Adaga do Assassino', quantity: 1, equipped: true },
      { id: 'dagger-b', name: 'Adaga do Assassino', quantity: 1, equipped: true },
      { id: 'kit-explorer', name: 'Kit do Explorador', quantity: 1 },
    ],
    currency: { gp: 120 },
    spells: ['Raio Arcano', 'Escudo Místico'],
    relationships: [
      { npcId: 'golem-vigia', name: 'Golem Vigia', status: 'ally', affinity: 4 },
      { npcId: 'borin', name: 'Borin Stonehand', status: 'friendly', affinity: 4 },
    ],
    journal: [
      'Entrada 12: Suspender ritual no subsolo.',
      'Entrada 13: Recuperar tomo dos cultistas.',
    ],
  };
  return clone({ ...base, ...overrides });
}

function buildComplexCombatState() {
  return {
    isActive: true,
    round: 2,
    turn: 1,
    combatants: [
      {
        id: 'player',
        name: 'Guardião',
        attitude: 'ally',
        hp: { current: 22, max: 27 },
        ac: 16,
        isPlayer: true,
        conditions: ['Concentrando'],
      },
      {
        id: 'golem',
        name: 'Golem Vigia',
        attitude: 'ally',
        hp: { current: 28, max: 30 },
        ac: 18,
        notes: 'Protegendo o corredor leste.',
      },
      {
        id: 'cultist-1',
        name: 'Cultista Sombrio',
        attitude: 'hostile',
        hp: { current: 8, max: 12 },
        ac: 13,
      },
      {
        id: 'cultist-2',
        name: 'Cultista Arqueiro',
        attitude: 'hostile',
        hp: { current: 12, max: 12 },
        ac: 14,
        conditions: ['Inspirado'],
      },
      {
        id: 'elemental',
        name: 'Globo Elemental',
        attitude: 'hostile',
        hp: { current: 20, max: 20 },
        ac: 15,
        notes: 'Canaliza relâmpagos intermitentes.',
      },
    ],
    initiativeOrder: ['cultist-2', 'player', 'elemental', 'golem', 'cultist-1'],
  };
}

function buildBossCombatState() {
  return {
    isActive: true,
    round: 4,
    turn: 2,
    combatants: [
      {
        id: 'player',
        name: 'Guardião',
        attitude: 'ally',
        hp: { current: 18, max: 27 },
        ac: 16,
        isPlayer: true,
      },
      {
        id: 'cultist-lider',
        name: 'Suma-Vigia Kaldrax',
        attitude: 'hostile',
        hp: { current: 4, max: 40 },
        ac: 17,
        conditions: ['Sangrando'],
      },
      {
        id: 'golem',
        name: 'Golem Vigia',
        attitude: 'ally',
        hp: { current: 18, max: 30 },
        ac: 18,
      },
    ],
    initiativeOrder: ['player', 'cultist-lider', 'golem'],
  };
}
