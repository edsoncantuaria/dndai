/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import * as GameService from '@/services/gameService';
import type { Character, SessaoIA } from '@/types';
import {
  fetchRegions,
  updateRegionSpawnPool,
  requestRegionDraft,
  type RegionDTO,
  type RegionPoiDTO,
} from '@/services/regionClient';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Map as MapIcon,
  Loader2,
  Shield,
  Zap,
  Compass,
  Pin,
  Users,
} from 'lucide-react';

type RegionLayout = Record<string, { x: number; y: number }>;
type SessionWithCharacter = SessaoIA & { character?: Character };

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;
const NODE_WIDTH = 140;
const NODE_HEIGHT = 64;

const generateDefaultLayout = (index: number, total: number) => {
  if (!total) {
    return { x: CANVAS_WIDTH / 2 - NODE_WIDTH / 2, y: CANVAS_HEIGHT / 2 - NODE_HEIGHT / 2 };
  }
  const angle = (index / total) * Math.PI * 2;
  const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 - 80;
  return {
    x: CANVAS_WIDTH / 2 + Math.cos(angle) * radius - NODE_WIDTH / 2,
    y: CANVAS_HEIGHT / 2 + Math.sin(angle) * radius - NODE_HEIGHT / 2,
  };
};

const PremiumMapPage = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.id === 1;

  const [regions, setRegions] = useState<RegionDTO[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [regionPositions, setRegionPositions] = useState<RegionLayout>({});
  const [selectedRegionSlug, setSelectedRegionSlug] = useState<string | null>(null);
  const [isUpdatingSpawn, setIsUpdatingSpawn] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBaseRegion, setAiBaseRegion] = useState('');
  const [aiDraftResult, setAiDraftResult] = useState<string>('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  const [sessions, setSessions] = useState<SessaoIA[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionWithCharacter | null>(null);
  const [isLoadingSessionDetails, setIsLoadingSessionDetails] = useState(false);

  const regionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    regions.forEach(region => map.set(region.slug, region.name));
    return map;
  }, [regions]);

  const selectedRegion = useMemo(
    () => regions.find(region => region.slug === selectedRegionSlug) ?? regions[0] ?? null,
    [regions, selectedRegionSlug]
  );

  const loadRegions = async () => {
    setIsLoadingRegions(true);
    try {
      const data = await fetchRegions();
      setRegions(data);
      if (!selectedRegionSlug && data.length) {
        setSelectedRegionSlug(data[0].slug);
      }
      setRegionPositions(prev => {
        const next = { ...prev };
        let changed = false;
        data.forEach((region, index) => {
          if (!next[region.slug]) {
            next[region.slug] = generateDefaultLayout(index, data.length);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    } catch (error) {
      console.error('[premium-map] Falha ao carregar regiões', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível carregar o mapa de regiões.',
      });
    } finally {
      setIsLoadingRegions(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadRegions();
    }
  }, [isAuthenticated]);

  const loadSessions = async () => {
    if (!isAuthenticated) return;
    setIsLoadingSessions(true);
    try {
      const data = await GameService.getGameSessions();
      setSessions(data);
      if (data.length && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } catch (error) {
      console.error('[premium-map] Falha ao carregar sessões', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível carregar as sessões para a visão do jogador.',
      });
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSessionDetails = async (sessionId: number) => {
    setIsLoadingSessionDetails(true);
    try {
      const details = await GameService.getSessionDetails(sessionId);
      setSessionDetails(details as SessionWithCharacter);
    } catch (error) {
      console.error('[premium-map] Falha ao carregar detalhes da sessão', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível recuperar os detalhes da sessão selecionada.',
      });
    } finally {
      setIsLoadingSessionDetails(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedSessionId != null) {
      loadSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleSpawnToggle = async (region: RegionDTO) => {
    if (!isAdmin) return;
    setIsUpdatingSpawn(region.id);
    try {
      await updateRegionSpawnPool(region.id, !region.isSpawnPool);
      toast({
        description: `${region.name} ${region.isSpawnPool ? 'removida do' : 'adicionada ao'} spawn pool.`,
      });
      await loadRegions();
    } catch (error) {
      console.error('[premium-map] Falha ao atualizar spawn pool', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível atualizar o spawn pool. Tente novamente.',
      });
    } finally {
      setIsUpdatingSpawn(null);
    }
  };

  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingDraft(true);
    try {
      const draft = await requestRegionDraft({
        prompt: aiPrompt.trim(),
        baseRegionSlug: aiBaseRegion || undefined,
      });
      setAiDraftResult(JSON.stringify(draft, null, 2));
      toast({ description: 'Rascunho de região recebido da IA.' });
    } catch (error) {
      console.error('[premium-map] Falha ao gerar rascunho de região', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível gerar o rascunho com a IA.',
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handlePositionChange = (slug: string, pos: { x: number; y: number }) => {
    setRegionPositions(prev => ({ ...prev, [slug]: pos }));
  };

  const visitedRegions = (sessionDetails?.character?.worldState?.visitedRegions || []) as string[];
  const visitedPois = (sessionDetails?.character?.worldState?.visitedPois || []) as Array<{
    regionSlug: string;
    poiSlug: string;
    name?: string;
  }>;
  const npcLocations = (sessionDetails?.character?.worldState?.npcLocations || []) as Array<{
    npcId: string;
    name?: string;
    regionSlug?: string;
    poiSlug?: string;
    notes?: string;
  }>;

  const currentRegionSlug =
    sessionDetails?.character?.worldState?.regionSlug ??
    sessionDetails?.character?.worldState?.currentRegion ??
    null;

  return (
    <main className="flex flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <MapIcon className="w-6 h-6 text-primary" />
          Mapa Premium
        </h1>
        <p className="text-muted-foreground">
          Visualize o estado global do mundo, controle spawn pools e monitore a exploração dos jogadores.
        </p>
      </header>

      {!isAuthenticated ? (
        <section className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-muted-foreground">
          Faça login para acessar o mapa premium.
        </section>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-6">
            <AdminMapPanel
              isAdmin={!!isAdmin}
              regions={regions}
              isLoading={isLoadingRegions}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegionSlug}
              regionPositions={regionPositions}
              onPositionChange={handlePositionChange}
              onToggleSpawn={handleSpawnToggle}
              isUpdatingSpawn={isUpdatingSpawn}
            />

            {isAdmin && (
              <AiRegionHelper
                prompt={aiPrompt}
                baseRegion={aiBaseRegion}
                aiDraftResult={aiDraftResult}
                isGenerating={isGeneratingDraft}
                regions={regions}
                onPromptChange={setAiPrompt}
                onBaseRegionChange={setAiBaseRegion}
                onGenerate={handleAiDraft}
              />
            )}
          </div>

          <PlayerExplorationPanel
            sessions={sessions}
            isLoadingSessions={isLoadingSessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            sessionDetails={sessionDetails}
            isLoadingDetails={isLoadingSessionDetails}
            regionNameMap={regionNameMap}
            visitedRegions={visitedRegions}
            visitedPois={visitedPois}
            npcLocations={npcLocations}
            currentRegionSlug={currentRegionSlug}
          />
        </section>
      )}
    </main>
  );
};

type AdminMapPanelProps = {
  isAdmin: boolean;
  regions: RegionDTO[];
  isLoading: boolean;
  selectedRegion: RegionDTO | null;
  onSelectRegion: (slug: string) => void;
  regionPositions: RegionLayout;
  onPositionChange: (slug: string, pos: { x: number; y: number }) => void;
  onToggleSpawn: (region: RegionDTO) => Promise<void>;
  isUpdatingSpawn: number | null;
};

const AdminMapPanel = ({
  isAdmin,
  regions,
  isLoading,
  selectedRegion,
  onSelectRegion,
  regionPositions,
  onPositionChange,
  onToggleSpawn,
  isUpdatingSpawn,
}: AdminMapPanelProps) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDrag = (region: RegionDTO, event: React.PointerEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    event.preventDefault();
    const container = canvasRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = regionPositions[region.slug] ?? { x: rect.width / 2, y: rect.height / 2 };
    const offsetX = startX - (rect.left + initial.x);
    const offsetY = startY - (rect.top + initial.y);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextX = moveEvent.clientX - rect.left - offsetX;
      const nextY = moveEvent.clientY - rect.top - offsetY;
      onPositionChange(region.slug, {
        x: Math.max(0, Math.min(CANVAS_WIDTH - NODE_WIDTH, nextX)),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - NODE_HEIGHT, nextY)),
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Editor Administrativo</h2>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando regiões...
        </div>
      ) : (
        <>
          <RegionCanvas
            regions={regions}
            regionPositions={regionPositions}
            onPointerDrag={handlePointerDrag}
            onSelectRegion={onSelectRegion}
            selectedRegion={selectedRegion}
            isAdmin={isAdmin}
            canvasRef={canvasRef}
          />
          {selectedRegion && (
            <RegionDetailsCard
              region={selectedRegion}
              isAdmin={isAdmin}
              onToggleSpawn={() => onToggleSpawn(selectedRegion)}
              isUpdatingSpawn={isUpdatingSpawn === selectedRegion.id}
            />
          )}
        </>
      )}
    </div>
  );
};

type RegionCanvasProps = {
  regions: RegionDTO[];
  regionPositions: RegionLayout;
  selectedRegion: RegionDTO | null;
  onSelectRegion: (slug: string) => void;
  onPointerDrag: (region: RegionDTO, event: React.PointerEvent<HTMLDivElement>) => void;
  isAdmin: boolean;
  canvasRef: React.RefObject<HTMLDivElement>;
};

const RegionCanvas = ({
  regions,
  regionPositions,
  selectedRegion,
  onSelectRegion,
  onPointerDrag,
  isAdmin,
  canvasRef,
}: RegionCanvasProps) => {
  const edges = useMemo(() => {
    const list: Array<{ from: string; to: string }> = [];
    const seen = new Set<string>();
    regions.forEach(region => {
      region.neighbors?.forEach(neighbor => {
        const target = neighbor.targetRegionSlug;
        if (!target) return;
        const key = [region.slug, target].sort().join(':');
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ from: region.slug, to: target });
      });
    });
    return list;
  }, [regions]);

  const resolvePosition = (slug: string) => {
    return regionPositions[slug] ?? { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Compass className="w-4 h-4" />
        Arraste as cidades para reorganizar o panorama (somente admin).
      </div>
      <div
        ref={canvasRef}
        className="relative border rounded-lg bg-muted/30 overflow-hidden"
        style={{ width: CANVAS_WIDTH, maxWidth: '100%', height: CANVAS_HEIGHT }}
      >
        <svg className="absolute inset-0 pointer-events-none" width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          {edges.map(edge => {
            const from = resolvePosition(edge.from);
            const to = resolvePosition(edge.to);
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x + NODE_WIDTH / 2}
                y1={from.y + NODE_HEIGHT / 2}
                x2={to.x + NODE_WIDTH / 2}
                y2={to.y + NODE_HEIGHT / 2}
                stroke="rgba(59,130,246,0.35)"
                strokeWidth={2}
              />
            );
          })}
        </svg>
        {regions.map(region => {
          const position = resolvePosition(region.slug);
          const isSelected = selectedRegion?.slug === region.slug;
          return (
            <div
              key={region.slug}
              className={cn(
                'absolute px-3 py-2 rounded-md border shadow-sm bg-background/95 backdrop-blur cursor-pointer select-none',
                isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/60'
              )}
              style={{ left: position.x, top: position.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
              onPointerDown={event => {
                if (isAdmin) {
                  onPointerDrag(region, event);
                }
                onSelectRegion(region.slug);
              }}
            >
              <p className="text-sm font-semibold truncate">{region.name}</p>
              <p className="text-xs text-muted-foreground truncate">{region.type}</p>
              {region.isSpawnPool && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <Pin className="w-3 h-3" /> Spawn
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

type RegionDetailsProps = {
  region: RegionDTO;
  isAdmin: boolean;
  onToggleSpawn: () => void;
  isUpdatingSpawn: boolean;
};

const RegionDetailsCard = ({ region, isAdmin, onToggleSpawn, isUpdatingSpawn }: RegionDetailsProps) => (
  <div className="rounded-lg border p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">{region.name}</h3>
        <p className="text-sm text-muted-foreground">{region.summary || 'Sem resumo registrado.'}</p>
      </div>
      {isAdmin && (
        <Button
          variant={region.isSpawnPool ? 'secondary' : 'outline'}
          size="sm"
          disabled={isUpdatingSpawn}
          onClick={onToggleSpawn}
        >
          {isUpdatingSpawn && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {region.isSpawnPool ? 'Remover do spawn pool' : 'Adicionar ao spawn pool'}
        </Button>
      )}
    </div>
    {region.metadata && (
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {Object.entries(region.metadata).map(([key, value]) => (
          <span key={key} className="px-2 py-1 rounded-full bg-muted/60 border">
            {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
          </span>
        ))}
      </div>
    )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 className="font-semibold text-sm mb-2">Rotas</h4>
        <ul className="space-y-2 text-sm">
          {(region.neighbors ?? []).map(neighbor => (
            <li key={neighbor.id} className="flex items-center justify-between">
              <span>
                {neighbor.direction === 'outgoing' ? '→' : '←'} {neighbor.targetRegionName ?? neighbor.targetRegionSlug}
              </span>
              <span className="text-muted-foreground text-xs">
                {neighbor.travelMode} · {neighbor.travelTimeMinutes} min
              </span>
            </li>
          ))}
          {!region.neighbors?.length && <li className="text-muted-foreground text-sm">Sem rotas registradas.</li>}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-sm mb-2">POIs</h4>
        <PoiList pois={region.pointsOfInterest ?? []} />
      </div>
    </div>
  </div>
);

const PoiList = ({ pois }: { pois: RegionPoiDTO[] }) => {
  if (!pois.length) return <p className="text-sm text-muted-foreground">Nenhum ponto de interesse cadastrado.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {pois.map(poi => (
        <li key={poi.id} className="border rounded-md px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{poi.name}</span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{poi.type}</span>
          </div>
          <p className="text-xs text-muted-foreground">{poi.summary || 'Sem resumo.'}</p>
        </li>
      ))}
    </ul>
  );
};

type AiRegionHelperProps = {
  prompt: string;
  baseRegion: string;
  onPromptChange: (value: string) => void;
  onBaseRegionChange: (value: string) => void;
  onGenerate: () => void;
  aiDraftResult: string;
  regions: RegionDTO[];
  isGenerating: boolean;
};

const AiRegionHelper = ({
  prompt,
  baseRegion,
  onPromptChange,
  onBaseRegionChange,
  onGenerate,
  aiDraftResult,
  regions,
  isGenerating,
}: AiRegionHelperProps) => (
  <div className="rounded-lg border bg-card p-4 space-y-4">
    <div className="flex items-center gap-2">
      <Zap className="w-5 h-5 text-primary" />
      <h2 className="text-lg font-semibold">Helper IA</h2>
    </div>
    <div className="grid gap-3">
      <textarea
        value={prompt}
        onChange={event => onPromptChange(event.target.value)}
        className="w-full rounded-md border bg-background p-2 text-sm"
        placeholder="Descreva a região que deseja gerar..."
        rows={3}
      />
      <select
        value={baseRegion}
        onChange={event => onBaseRegionChange(event.target.value)}
        className="rounded-md border bg-background p-2 text-sm"
      >
        <option value="">Sem região base</option>
        {regions.map(region => (
          <option key={region.slug} value={region.slug}>
            {region.name}
          </option>
        ))}
      </select>
      <Button onClick={onGenerate} disabled={!prompt.trim() || isGenerating} className="w-full">
        {isGenerating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Gerar rascunho
      </Button>
    </div>
    {aiDraftResult && (
      <pre className="bg-muted/40 rounded-md p-3 text-xs overflow-auto border">{aiDraftResult}</pre>
    )}
  </div>
);

type PlayerPanelProps = {
  sessions: SessaoIA[];
  isLoadingSessions: boolean;
  selectedSessionId: number | null;
  onSelectSession: (id: number) => void;
  sessionDetails: SessionWithCharacter | null;
  isLoadingDetails: boolean;
  regionNameMap: Map<string, string>;
  visitedRegions: string[];
  visitedPois: Array<{ regionSlug: string; poiSlug: string; name?: string }>;
  npcLocations: Array<{ npcId: string; name?: string; regionSlug?: string; poiSlug?: string; notes?: string }>;
  currentRegionSlug: string | null;
};

const PlayerExplorationPanel = ({
  sessions,
  isLoadingSessions,
  selectedSessionId,
  onSelectSession,
  sessionDetails,
  isLoadingDetails,
  regionNameMap,
  visitedRegions,
  visitedPois,
  npcLocations,
  currentRegionSlug,
}: PlayerPanelProps) => {
  const currentRegionName = currentRegionSlug ? regionNameMap.get(currentRegionSlug) ?? currentRegionSlug : 'Desconhecido';

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Visão do Jogador</h2>
      </div>
      {isLoadingSessions ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Carregando sessões...
        </div>
      ) : !sessions.length ? (
        <p className="text-muted-foreground text-sm">Nenhuma sessão disponível.</p>
      ) : (
        <>
          <select
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={selectedSessionId ?? ''}
            onChange={event => onSelectSession(Number(event.target.value))}
          >
            {sessions.map(session => (
              <option key={session.id} value={session.id}>
                {session.nome} · #{session.id}
              </option>
            ))}
          </select>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Carregando detalhes da sessão...
            </div>
          ) : sessionDetails ? (
            <div className="space-y-4">
              <div className="rounded-md border px-3 py-2">
                <p className="text-sm font-semibold">Região atual</p>
                <p className="text-base">{currentRegionName}</p>
                {sessionDetails.character?.worldState?.poiName && (
                  <p className="text-sm text-muted-foreground">
                    Sublocal: {sessionDetails.character.worldState.poiName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <VisitedBadgeList
                  title="Regiões descobertas"
                  items={visitedRegions.map(slug => regionNameMap.get(slug) ?? slug)}
                  emptyMessage="Sem explorações registradas."
                />
                <VisitedBadgeList
                  title="POIs descobertos"
                  items={visitedPois.map(poi => poi.name || poi.poiSlug)}
                  emptyMessage="Nenhum POI registrado."
                />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Pin className="w-4 h-4 text-primary" />
                  NPCs rastreados
                </p>
                {npcLocations.length ? (
                  <ul className="space-y-2 text-sm">
                    {npcLocations.map(npc => (
                      <li key={npc.npcId} className="border rounded-md px-3 py-2">
                        <p className="font-medium">{npc.name ?? npc.npcId}</p>
                        <p className="text-muted-foreground text-xs">
                          {regionNameMap.get(npc.regionSlug ?? '') ?? npc.regionSlug ?? 'Região desconhecida'}
                          {npc.poiSlug ? ` · POI ${npc.poiSlug}` : ''}
                        </p>
                        {npc.notes && <p className="text-xs mt-1">{npc.notes}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum NPC marcado nesta sessão.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione uma sessão para visualizar o progresso.</p>
          )}
        </>
      )}
    </div>
  );
};

type VisitedBadgeListProps = {
  title: string;
  items: string[];
  emptyMessage: string;
};

const VisitedBadgeList = ({ title, items, emptyMessage }: VisitedBadgeListProps) => (
  <div className="rounded-md border px-3 py-2">
    <p className="text-sm font-semibold">{title}</p>
    {items.length ? (
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map(item => (
          <span
            key={item}
            className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    ) : (
      <p className="text-xs text-muted-foreground mt-1">{emptyMessage}</p>
    )}
  </div>
);

export default PremiumMapPage;
