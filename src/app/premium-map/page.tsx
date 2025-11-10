/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import * as GameService from '@/services/gameService';
import type { Character, SessaoIA } from '@/types';
import {
  fetchRegions,
  updateRegionSpawnPool,
  requestRegionDraft,
  exportRegionGraphPayload,
  importRegionGraphPayload,
  updateRegion,
  createPoi,
  updatePoi,
  deletePoi,
  createRegionLink,
  type CreateRegionLinkInput,
  POI_TYPES,
  type PoiType,
  listRegionSnapshots,
  createRegionSnapshot,
  restoreRegionSnapshot,
  deleteRegionSnapshot,
  type RegionSnapshotDTO,
  listPendingPois,
  approvePendingPoi,
  rejectPendingPoi,
  type PendingPoiDTO,
  type RegionDTO,
  type RegionPoiDTO,
  type RegionGraphPayload,
  uploadRegionBackground,
  deleteRegionBackground,
} from '@/services/regionClient';
import ActionModal from '@/components/ui/ActionModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Map as MapIcon,
  Loader2,
  Shield,
  Zap,
  Pin,
  Users,
} from 'lucide-react';
import type { WorldMapSnapshot } from '@/services/gameService';

type SessionWithCharacter = SessaoIA & { character?: Character };
type RegionTreeNode = {
  region: RegionDTO;
  children: RegionTreeNode[];
};

const collectDescendants = (node: RegionTreeNode, acc: RegionTreeNode[] = []) => {
  acc.push(node);
  node.children.forEach(child => collectDescendants(child, acc));
  return acc;
};

const getRegionTypeLabel = (type: RegionDTO['type']) => {
  switch (type) {
    case 'world':
      return 'continente';
    case 'city':
      return 'cidade';
    case 'dungeon':
      return 'masmorra';
    case 'wild':
      return 'selvagem';
    case 'instance':
      return 'instância';
    default:
      return type;
  }
};

const slugifyLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

const buildRegionHierarchy = (regions: RegionDTO[]): RegionTreeNode[] => {
  const nodeMap = new Map<string, RegionTreeNode>();
  regions.forEach(region =>
    nodeMap.set(region.slug, {
      region,
      children: [],
    })
  );

  const roots: RegionTreeNode[] = [];
  regions.forEach(region => {
    const node = nodeMap.get(region.slug);
    if (!node) return;
    if (region.parentSlug) {
      const parent = nodeMap.get(region.parentSlug);
      if (parent) {
        parent.children.push(node);
        parent.children.sort((a, b) => a.region.name.localeCompare(b.region.name));
        return;
      }
    }
    roots.push(node);
  });
  roots.sort((a, b) => a.region.name.localeCompare(b.region.name));
  return roots;
};

const PremiumMapPage = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.id === 1;

  const [regions, setRegions] = useState<RegionDTO[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [selectedRegionSlug, setSelectedRegionSlug] = useState<string | null>(null);
  const [isUpdatingSpawn, setIsUpdatingSpawn] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBaseRegion, setAiBaseRegion] = useState('');
  const [aiDraftResult, setAiDraftResult] = useState<string>('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isExportingGraph, setIsExportingGraph] = useState(false);
  const [isImportingGraph, setIsImportingGraph] = useState(false);

  const [sessions, setSessions] = useState<SessaoIA[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionWithCharacter | null>(null);
  const [isLoadingSessionDetails, setIsLoadingSessionDetails] = useState(false);
  const [snapshots, setSnapshots] = useState<RegionSnapshotDTO[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [pendingPois, setPendingPois] = useState<PendingPoiDTO[]>([]);
  const [isLoadingPendingPois, setIsLoadingPendingPois] = useState(false);
  const [isWorldMapOpen, setIsWorldMapOpen] = useState(false);
  const [isWorldMapLoading, setIsWorldMapLoading] = useState(false);
  const [worldMapSessionId, setWorldMapSessionId] = useState<number | null>(null);
  const [worldMapSnapshots, setWorldMapSnapshots] = useState<Map<number, WorldMapSnapshot>>(new Map());

  const currentWorldMapSnapshot = useMemo(
    () => (worldMapSessionId != null ? worldMapSnapshots.get(worldMapSessionId) ?? null : null),
    [worldMapSessionId, worldMapSnapshots]
  );

  const handleOpenWorldMap = async () => {
    if (!selectedSessionId) return;
    setIsWorldMapOpen(true);
    setWorldMapSessionId(selectedSessionId);
    if (worldMapSnapshots.has(selectedSessionId)) return;
    setIsWorldMapLoading(true);
    try {
      const snapshot = await GameService.getWorldMapSnapshot(selectedSessionId);
      setWorldMapSnapshots(prev => {
        const next = new Map(prev);
        next.set(selectedSessionId, snapshot);
        return next;
      });
    } catch (error) {
      console.error('[premium-map] Falha ao carregar o mapa mundi', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível carregar o mapa mundi desta sessão.',
      });
    } finally {
      setIsWorldMapLoading(false);
    }
  };

  const handleCloseWorldMap = () => setIsWorldMapOpen(false);

  const regionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    regions.forEach(region => map.set(region.slug, region.name));
    return map;
  }, [regions]);
  const regionHierarchy = useMemo(() => buildRegionHierarchy(regions), [regions]);
  const isWorldMapLoadingForSelectedSession =
    !!selectedSessionId &&
    isWorldMapLoading &&
    worldMapSessionId === selectedSessionId &&
    !worldMapSnapshots.has(selectedSessionId);

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

  const loadSnapshotsData = async () => {
    if (!isAuthenticated || !isAdmin) return;
    setIsLoadingSnapshots(true);
    try {
      const data = await listRegionSnapshots();
      setSnapshots(data);
    } catch (error) {
      console.error('[premium-map] Falha ao carregar snapshots', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível carregar os snapshots do mapa.',
      });
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  const loadPendingPoisData = async () => {
    if (!isAuthenticated || !isAdmin) return;
    setIsLoadingPendingPois(true);
    try {
      const data = await listPendingPois();
      setPendingPois(data);
    } catch (error) {
      console.error('[premium-map] Falha ao carregar POIs pendentes', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível carregar os POIs pendentes.',
      });
    } finally {
      setIsLoadingPendingPois(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadSnapshotsData();
      loadPendingPoisData();
    }
  }, [isAuthenticated, isAdmin]);

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

  const handleExportGraph = async () => {
    setIsExportingGraph(true);
    try {
      const payload = await exportRegionGraphPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `regionsSeed-${timestamp}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({
        description: 'Mapa exportado. Salve o arquivo para reimportar ou substituir o seed.',
      });
    } catch (error) {
      console.error('[premium-map] Falha ao exportar o mapa', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível exportar o mapa. Tente novamente.',
      });
    } finally {
      setIsExportingGraph(false);
    }
  };

  const handleImportGraph = async (file: File, options: { clearExisting: boolean }) => {
    const { clearExisting } = options;
    setIsImportingGraph(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as RegionGraphPayload;
      if (!payload?.regions || !payload?.links || !payload?.pois) {
        throw new Error('Arquivo inválido. Esperado um payload com regions, links e pois.');
      }
      await importRegionGraphPayload({ ...payload, clearExisting });
      toast({
        description: 'Mapa importado com sucesso.',
      });
      await loadRegions();
    } catch (error) {
      console.error('[premium-map] Falha ao importar mapa', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível importar o mapa. Verifique o arquivo e tente novamente.',
      });
    } finally {
      setIsImportingGraph(false);
    }
  };

  const handleRegionMetadataUpdate = async (regionId: number, metadata: Record<string, any>) => {
    try {
      await updateRegion(regionId, { metadata });
      toast({ description: 'Metadados da região atualizados.' });
      await loadRegions();
    } catch (error) {
      console.error('[premium-map] Falha ao atualizar metadados da região', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível atualizar os metadados.',
      });
    }
  };

  const handlePersistMapLayout = async (
    region: RegionDTO,
    payload: LayoutSnapshot
  ) => {
    if (!region) return;
    try {
      const nextMetadata = {
        ...(region.metadata || {}),
        mapLayout: {
          ...(region.metadata?.mapLayout || {}),
          nodes: payload.nodes,
          canvas: payload.canvas,
          updatedAt: new Date().toISOString(),
        },
      };
      await updateRegion(region.id, { metadata: nextMetadata });
      toast({ description: 'Layout do mini-mapa salvo no grafo.' });
      await loadRegions();
    } catch (error) {
      console.error('[premium-map] Falha ao salvar layout do mini-mapa', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível salvar o layout das rotas.',
      });
    }
  };

  const handlePoiUpsert = async (
    payload: {
      id?: number;
      regionSlug: string;
      name: string;
      slug: string;
      type: PoiType;
      summary?: string;
      description?: string;
      metadata?: Record<string, any>;
      isLocked?: boolean;
      allowAiExpansion?: boolean;
    }
  ) => {
    try {
      if (payload.id) {
        await updatePoi(payload);
      } else {
        await createPoi(payload);
      }
      toast({ description: `POI ${payload.id ? 'atualizado' : 'criado'} com sucesso.` });
      await loadRegions();
    } catch (error) {
      console.error('[premium-map] Falha ao salvar POI', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível salvar o ponto de interesse.',
      });
    }
  };

  const handlePoiDelete = async (poiId: number) => {
    try {
      await deletePoi(poiId);
      toast({ description: 'POI removido.' });
      await loadRegions();
    } catch (error) {
      console.error('[premium-map] Falha ao remover POI', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível remover o ponto de interesse.',
      });
    }
  };

  const handleCreateRoute = async (payload: CreateRegionLinkInput) => {
    try {
      await createRegionLink(payload);
      toast({ description: 'Rota criada com sucesso.' });
      await loadRegions();
    } catch (error) {
      console.error('[premium-map] Falha ao criar rota', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível criar a rota.',
      });
    }
  };

  const handleCreateSnapshot = async (label: string) => {
    try {
      await createRegionSnapshot(label.trim() || undefined);
      toast({ description: 'Snapshot criado com sucesso.' });
      await loadSnapshotsData();
    } catch (error) {
      console.error('[premium-map] Falha ao criar snapshot', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível criar o snapshot.',
      });
    }
  };

  const handleRestoreSnapshot = async (snapshotId: number) => {
    if (!window.confirm('Restaurar esse snapshot irá substituir o mapa atual. Continuar?')) return;
    try {
      await restoreRegionSnapshot(snapshotId);
      toast({ description: 'Mapa restaurado a partir do snapshot.' });
      await Promise.all([loadRegions(), loadSnapshotsData()]);
    } catch (error) {
      console.error('[premium-map] Falha ao restaurar snapshot', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível restaurar o snapshot.',
      });
    }
  };

  const handleDeleteSnapshot = async (snapshotId: number) => {
    if (!window.confirm('Deseja remover este snapshot?')) return;
    try {
      await deleteRegionSnapshot(snapshotId);
      toast({ description: 'Snapshot removido.' });
      await loadSnapshotsData();
    } catch (error) {
      console.error('[premium-map] Falha ao remover snapshot', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível remover o snapshot.',
      });
    }
  };

  const handleApprovePendingPoi = async (poiId: number) => {
    try {
      await approvePendingPoi(poiId);
      toast({ description: 'POI aprovado e promovido ao mapa.' });
      await Promise.all([loadPendingPoisData(), loadRegions()]);
    } catch (error) {
      console.error('[premium-map] Falha ao aprovar POI', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível aprovar o POI.',
      });
    }
  };

  const handleRejectPendingPoi = async (poiId: number) => {
    try {
      await rejectPendingPoi(poiId);
      toast({ description: 'POI removido.' });
      await loadPendingPoisData();
    } catch (error) {
      console.error('[premium-map] Falha ao remover POI', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível remover o POI.',
      });
    }
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
          Visualize o estado global dos continentes, controle spawn pools e monitore a exploração dos jogadores.
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
              regionHierarchy={regionHierarchy}
              isLoading={isLoadingRegions}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegionSlug}
              onToggleSpawn={handleSpawnToggle}
              isUpdatingSpawn={isUpdatingSpawn}
              onUpdateMetadata={handleRegionMetadataUpdate}
              onUpsertPoi={handlePoiUpsert}
              onDeletePoi={handlePoiDelete}
              onCreateRoute={handleCreateRoute}
              onPersistLayout={handlePersistMapLayout}
              onRefreshRegions={loadRegions}
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
                onExportGraph={handleExportGraph}
                onImportGraph={handleImportGraph}
                isExportingGraph={isExportingGraph}
                isImportingGraph={isImportingGraph}
              />
            )}

            {isAdmin && (
              <>
                <SnapshotManager
                  snapshots={snapshots}
                  isLoading={isLoadingSnapshots}
                  onCreate={handleCreateSnapshot}
                  onRestore={handleRestoreSnapshot}
                  onDelete={handleDeleteSnapshot}
                />
                <AutoPoiAudit
                  pendingPois={pendingPois}
                  isLoading={isLoadingPendingPois}
                  onApprove={handleApprovePendingPoi}
                  onReject={handleRejectPendingPoi}
                />
              </>
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
            onOpenWorldMap={handleOpenWorldMap}
            isWorldMapLoading={isWorldMapLoadingForSelectedSession}
          />
        </section>
      )}
      <WorldMapModal
        isOpen={isWorldMapOpen}
        onClose={handleCloseWorldMap}
        snapshot={currentWorldMapSnapshot}
        isLoading={isWorldMapLoading && !currentWorldMapSnapshot}
      />
    </main>
  );
};

type AdminMapPanelProps = {
  isAdmin: boolean;
  regions: RegionDTO[];
  regionHierarchy: RegionTreeNode[];
  isLoading: boolean;
  selectedRegion: RegionDTO | null;
  onSelectRegion: (slug: string) => void;
  onToggleSpawn: (region: RegionDTO) => Promise<void>;
  isUpdatingSpawn: number | null;
  onUpdateMetadata: (regionId: number, metadata: Record<string, any>) => void;
  onUpsertPoi: (payload: {
    id?: number;
    regionSlug: string;
    name: string;
    slug: string;
    type: PoiType;
    summary?: string;
    description?: string;
    metadata?: Record<string, any>;
    isLocked?: boolean;
    allowAiExpansion?: boolean;
  }) => void;
  onDeletePoi: (poiId: number) => void;
  onCreateRoute: (payload: CreateRegionLinkInput) => void;
  onPersistLayout: (region: RegionDTO, snapshot: LayoutSnapshot) => void;
  onRefreshRegions: () => Promise<void>;
};

const AdminMapPanel = ({
  isAdmin,
  regions,
  regionHierarchy,
  isLoading,
  selectedRegion,
  onSelectRegion,
  onToggleSpawn,
  isUpdatingSpawn,
  onUpdateMetadata,
  onUpsertPoi,
  onDeletePoi,
  onCreateRoute,
  onPersistLayout,
  onRefreshRegions,
}: AdminMapPanelProps) => {
  const [miniMapFocus, setMiniMapFocus] = useState(() => regionHierarchy[0]?.region.slug ?? '');

  useEffect(() => {
    if (!regionHierarchy.length) {
      setMiniMapFocus('');
      return;
    }
    if (!miniMapFocus) {
      setMiniMapFocus(regionHierarchy[0].region.slug);
      return;
    }
    const exists = regionHierarchy.some(node => node.region.slug === miniMapFocus);
    if (!exists) {
      setMiniMapFocus(regionHierarchy[0].region.slug);
    }
  }, [miniMapFocus, regionHierarchy]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Editor Administrativo</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Visualização hierárquica: continentes, cidades e sublocais aparecem aninhados, refletindo o vínculo pai &rarr; filho.
          Clique em qualquer cartão para editar spawn, rotas e POIs.
        </p>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando regiões...
        </div>
      ) : (
        <>
          <RegionGraphMiniMap
            regions={regions}
            hierarchy={regionHierarchy}
            focusSlug={miniMapFocus}
            onFocusChange={setMiniMapFocus}
            onPersistLayout={onPersistLayout}
            isAdmin={isAdmin}
            onRefreshRegions={onRefreshRegions}
          />
          <RegionHierarchyView
            hierarchy={regionHierarchy}
            selectedSlug={selectedRegion?.slug ?? null}
            onSelectRegion={onSelectRegion}
          />
          {selectedRegion && (
            <RegionDetailsCard
              allRegions={regions}
              region={selectedRegion}
              isAdmin={isAdmin}
              onToggleSpawn={() => onToggleSpawn(selectedRegion)}
              isUpdatingSpawn={isUpdatingSpawn === selectedRegion.id}
              onUpdateMetadata={onUpdateMetadata}
              onUpsertPoi={onUpsertPoi}
              onDeletePoi={onDeletePoi}
              onCreateRoute={onCreateRoute}
            />
          )}
        </>
      )}
    </div>
  );
};

type RegionHierarchyViewProps = {
  hierarchy: RegionTreeNode[];
  selectedSlug: string | null;
  onSelectRegion: (slug: string) => void;
};

const RegionHierarchyView = ({
  hierarchy,
  selectedSlug,
  onSelectRegion,
}: RegionHierarchyViewProps) => {
  if (!hierarchy.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma região cadastrada.</p>;
  }
  return (
    <div className="space-y-4">
      {hierarchy.map(node => (
        <div key={node.region.slug} className="rounded-xl border bg-background/80 p-3 space-y-3">
          <button
            type="button"
            className={cn(
              'w-full text-left flex items-center justify-between gap-3 border-b pb-2',
              node.region.slug === selectedSlug ? 'text-primary' : ''
            )}
            onClick={() => onSelectRegion(node.region.slug)}
          >
            <div>
              <p className="text-base font-semibold">Continente: {node.region.name}</p>
              <p className="text-xs text-muted-foreground">
                {node.children.length
                  ? `${node.children.length} cidades/sublocais`
                  : 'Nenhuma cidade cadastrada'}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {(node.region.neighbors?.filter(n => n.direction === 'outgoing') ?? []).length} rotas
            </span>
          </button>
          {node.children.length ? (
            <div className="space-y-2">
              {node.children.map(child => (
                <RegionTreeBranch
                  key={child.region.slug}
                  node={child}
                  depth={1}
                  selectedSlug={selectedSlug}
                  onSelectRegion={onSelectRegion}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma cidade ou sublocal neste continente.</p>
          )}
        </div>
      ))}
    </div>
  );
};

type RegionGraphMiniMapProps = {
  regions: RegionDTO[];
  hierarchy: RegionTreeNode[];
  focusSlug: string;
  onFocusChange: (slug: string) => void;
  onPersistLayout?: (region: RegionDTO, snapshot: LayoutSnapshot) => void;
  isAdmin?: boolean;
  onRefreshRegions?: () => Promise<void>;
};

const DEFAULT_CANVAS_DIMENSIONS = { width: 1920, height: 1080 };
type LayoutSnapshot = {
  nodes: Record<string, { x: number; y: number }>;
  canvas: { width: number; height: number };
};

const RegionGraphMiniMap = ({
  regions,
  hierarchy,
  focusSlug,
  onFocusChange,
  onPersistLayout,
  isAdmin = false,
  onRefreshRegions,
}: RegionGraphMiniMapProps) => {
  const { toast } = useToast();
  const regionMap = useMemo(() => {
    const map = new Map<string, RegionDTO>();
    regions.forEach(region => map.set(region.slug, region));
    return map;
  }, [regions]);

  const focusNode = useMemo(
    () => hierarchy.find(node => node.region.slug === focusSlug) ?? hierarchy[0],
    [hierarchy, focusSlug]
  );
  const focusRegion = focusNode?.region ?? null;
  const focusRoots = useMemo(() => (focusNode ? [focusNode] : []), [focusNode]);
  const visibleRegions = useMemo(() => (focusNode ? collectDescendants(focusNode) : []), [focusNode]);
  const filteredRegions = useMemo(
    () => visibleRegions.filter(node => node.region.type !== 'world'),
    [visibleRegions]
  );
  const visibleSet = useMemo(
    () => new Set(filteredRegions.map(node => node.region.slug)),
    [filteredRegions]
  );

  const layout = useMemo(
    () => (focusRoots.length ? computeHierarchyLayout(focusRoots) : {}),
    [focusRoots]
  );
  const edges = useMemo(() => {
    const list: Array<{
      from: string;
      to: string;
      metadata?: Record<string, any>;
      isLocked?: boolean;
    }> = [];
    regions.forEach(region => {
      if (!visibleSet.has(region.slug)) return;
      region.neighbors
        ?.filter(neighbor => neighbor.direction === 'outgoing')
        ?.forEach(neighbor => {
          if (!neighbor.targetRegionSlug) return;
          if (!visibleSet.has(neighbor.targetRegionSlug)) return;
          list.push({
            from: region.slug,
            to: neighbor.targetRegionSlug,
            metadata: neighbor.metadata,
            isLocked: neighbor.isLocked,
          });
        });
    });
    return list;
  }, [regions, visibleSet]);

  const entries = Object.entries(layout);
  const renderableEntries = entries.filter(([slug]) => visibleSet.has(slug) && slug !== focusRegion?.slug);
  const hasRenderable = Boolean(focusRegion && renderableEntries.length);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<{ slug: string; offsetX: number; offsetY: number } | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundUrlInput, setBackgroundUrlInput] = useState('');
  const [backgroundSourceLabel, setBackgroundSourceLabel] = useState('');
  const [isPersistingLayout, setIsPersistingLayout] = useState(false);
  const [canvasSize, setCanvasSize] = useState(DEFAULT_CANVAS_DIMENSIONS);
  const [zoom, setZoom] = useState(0.75);
  const [exportScale, setExportScale] = useState(1);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);

  const layoutStorageKey = focusRegion ? `mapLayout:${focusRegion.slug}` : null;

  useEffect(() => {
    if (!focusRegion) return;
    setZoom(0.75);
    let initialNodes: Record<string, { x: number; y: number }> =
      focusRegion.metadata?.mapLayout?.nodes ?? {};
    let initialCanvas = focusRegion.metadata?.mapLayout?.canvas ?? DEFAULT_CANVAS_DIMENSIONS;
    if (typeof window !== 'undefined' && layoutStorageKey) {
      const stored = localStorage.getItem(layoutStorageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.nodes) {
            initialNodes = parsed.nodes;
            if (parsed.canvas) initialCanvas = parsed.canvas;
          } else {
            initialNodes = parsed;
          }
        } catch {
          localStorage.removeItem(layoutStorageKey);
        }
      }
    }
    setNodePositions(initialNodes);
    setCanvasSize({
      width: initialCanvas.width,
      height: initialCanvas.height,
    });
  }, [focusRegion?.slug, focusRegion?.metadata?.mapLayout?.updatedAt, layoutStorageKey]);

  useEffect(() => {
    if (!focusRegion) return;
    const backgroundMeta = focusRegion.metadata?.mapBackground;
    setBackgroundImage(backgroundMeta?.url ?? null);
    setBackgroundSourceLabel(backgroundMeta?.originalName ?? backgroundMeta?.url ?? '');
    setBackgroundUrlInput('');
  }, [focusRegion?.slug, focusRegion?.metadata?.mapBackground?.updatedAt]);

  const mergedPositions = useCallback(
    (slug: string) => nodePositions[slug] ?? layout[slug],
    [nodePositions, layout]
  );

  const viewWidth = useMemo(() => {
    if (!hasRenderable) return 720 * zoom;
    return canvasSize.width * zoom;
  }, [canvasSize.width, hasRenderable, zoom]);

  const viewHeight = useMemo(() => {
    if (!hasRenderable) return 420 * zoom;
    return canvasSize.height * zoom;
  }, [canvasSize.height, hasRenderable, zoom]);

  const clampPosition = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const handlePointerDown = (slug: string, event: React.PointerEvent<SVGCircleElement>) => {
    if (!focusRegion) return;
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const { x, y } = point.matrixTransform(svg.getScreenCTM()?.inverse());
    const current = mergedPositions(slug);
    setDragging({
      slug,
      offsetX: x - current.x,
      offsetY: y - current.y,
    });
    svg.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const { x, y } = point.matrixTransform(svg.getScreenCTM()?.inverse());
    setNodePositions(prev => ({
      ...prev,
      [dragging.slug]: {
        x: clampPosition(x - dragging.offsetX, 60, canvasSize.width - 60),
        y: clampPosition(y - dragging.offsetY, 60, canvasSize.height - 60),
      },
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (svg) svg.releasePointerCapture(event.pointerId);
    setDragging(null);
  };

  const buildLayoutSnapshot = useCallback((): LayoutSnapshot => {
    const nodes: LayoutSnapshot['nodes'] = {};
    renderableEntries.forEach(([slug]) => {
      const pos = mergedPositions(slug);
      if (pos) nodes[slug] = pos;
    });
    return {
      nodes,
      canvas: { width: canvasSize.width, height: canvasSize.height },
    };
  }, [renderableEntries, mergedPositions, canvasSize]);

  const persistLayoutLocally = () => {
    if (!focusRegion || !layoutStorageKey) return;
    const snapshot = buildLayoutSnapshot();
    localStorage.setItem(layoutStorageKey, JSON.stringify(snapshot));
    setNodePositions(snapshot.nodes);
    toast({
      description: 'Layout salvo localmente. Clique em "Publicar" para incluí-lo nas exportações.',
    });
  };

  const handlePersistLayout = async () => {
    if (!focusRegion || !onPersistLayout) return;
    setIsPersistingLayout(true);
    try {
      const snapshot = buildLayoutSnapshot();
      await onPersistLayout(focusRegion, snapshot);
      if (layoutStorageKey) {
        localStorage.setItem(layoutStorageKey, JSON.stringify(snapshot));
      }
    } finally {
      setIsPersistingLayout(false);
    }
  };

  const resetLayout = () => {
    if (!focusRegion) return;
    const persistedNodes = focusRegion.metadata?.mapLayout?.nodes ?? {};
    const persistedCanvas = focusRegion.metadata?.mapLayout?.canvas ?? DEFAULT_CANVAS_DIMENSIONS;
    setNodePositions(persistedNodes);
    setCanvasSize({
      width: persistedCanvas.width,
      height: persistedCanvas.height,
    });
    if (layoutStorageKey) {
      localStorage.removeItem(layoutStorageKey);
    }
    toast({ description: 'Layout restaurado para o padrão salvo.' });
  };

  const readBlobAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!focusRegion || !event.target.files?.length) return;
    const file = event.target.files[0];
    setIsUploadingBackground(true);
    try {
      const dataUrl = await readBlobAsDataUrl(file);
      setBackgroundImage(dataUrl);
      const response = await uploadRegionBackground(focusRegion.slug, {
        dataUrl,
        fileName: file.name,
      });
      setBackgroundImage(response.url ?? dataUrl);
      setBackgroundSourceLabel(response.originalName ?? file.name ?? '');
      setBackgroundUrlInput('');
      toast({ description: 'Overlay salvo e compartilhado com todos os jogadores.' });
      await onRefreshRegions?.();
    } catch (error) {
      console.error('[premium-map] Falha ao enviar overlay para o MinIO', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível salvar a imagem do mapa.',
      });
    } finally {
      setIsUploadingBackground(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = '';
    }
  };

  const handleApplyBackgroundUrl = async () => {
    if (!focusRegion || !backgroundUrlInput.trim()) return;
    setIsUploadingBackground(true);
    try {
      const response = await fetch(backgroundUrlInput.trim());
      if (!response.ok) throw new Error('Falha ao baixar imagem.');
      const blob = await response.blob();
      const dataUrl = await readBlobAsDataUrl(blob);
      setBackgroundImage(dataUrl);
      const uploadResult = await uploadRegionBackground(focusRegion.slug, {
        dataUrl,
        fileName: backgroundUrlInput.trim(),
      });
      setBackgroundImage(uploadResult.url ?? dataUrl);
      setBackgroundSourceLabel(uploadResult.originalName ?? backgroundUrlInput.trim());
      setBackgroundUrlInput('');
      toast({ description: 'URL capturada e salva no bucket do mapa.' });
      await onRefreshRegions?.();
    } catch (error) {
      console.error('[premium-map] Falha ao aplicar URL de fundo', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível processar a imagem remota.',
      });
    } finally {
      setIsUploadingBackground(false);
    }
  };

  const handleDeleteBackground = async () => {
    if (!focusRegion) return;
    setIsUploadingBackground(true);
    try {
      await deleteRegionBackground(focusRegion.slug);
      setBackgroundImage(null);
      setBackgroundSourceLabel('');
      setBackgroundUrlInput('');
      toast({ description: 'Overlay removido do mapa.' });
      await onRefreshRegions?.();
    } catch (error) {
      console.error('[premium-map] Falha ao remover overlay', error);
      toast({
        variant: 'destructive',
        description: 'Não foi possível remover a imagem do mapa.',
      });
    } finally {
      setIsUploadingBackground(false);
    }
  };

  const serializeSvg = () => {
    if (!svgRef.current) return null;
    const cloned = svgRef.current.cloneNode(true) as SVGSVGElement;
    const targetWidth = canvasSize.width * exportScale;
    const targetHeight = canvasSize.height * exportScale;
    cloned.setAttribute('width', `${targetWidth}`);
    cloned.setAttribute('height', `${targetHeight}`);
    cloned.setAttribute('viewBox', `0 0 ${canvasSize.width} ${canvasSize.height}`);
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    return serializer.serializeToString(cloned);
  };

  const exportSvg = () => {
    if (!focusRegion) return;
    const source = serializeSvg();
    if (!source) return;
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${focusRegion.slug}-rotas.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPng = () => {
    if (!focusRegion) return;
    const source = serializeSvg();
    if (!source) return;
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize.width * exportScale;
      canvas.height = canvasSize.height * exportScale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return;
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `${focusRegion.slug}-rotas.png`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
        });
      }
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const handleCanvasDimensionChange = (dimension: 'width' | 'height', rawValue: string) => {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return;
    const bounded = clampPosition(numeric, 600, 8000);
    if (bounded === canvasSize[dimension]) return;
    const snapshot = buildLayoutSnapshot();
    const ratio = bounded / canvasSize[dimension];
    const scaledNodes = Object.entries(snapshot.nodes).reduce<LayoutSnapshot['nodes']>((acc, [slug, pos]) => {
      acc[slug] = {
        x: dimension === 'width' ? pos.x * ratio : pos.x,
        y: dimension === 'height' ? pos.y * ratio : pos.y,
      };
      return acc;
    }, {});
    setNodePositions(scaledNodes);
    setCanvasSize(prev => ({
      ...prev,
      [dimension]: bounded,
    }));
  };

  if (!focusRegion || !hasRenderable) {
    return (
      <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
        Selecione um continente com cidades e sublocais para visualizar o mini-mapa.
      </div>
    );
  }

  const nodeLegend = [
    { label: 'Cidade', color: '#0ea5e9' },
    { label: 'Sublocal / POI', color: '#10b981' },
    { label: 'Dungeon / ameaça', color: '#f97316' },
  ];

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Mini-mapa de rotas</p>
          {hierarchy.length > 1 && (
            <select
              className="rounded-md border bg-background px-2 py-1 text-xs"
              value={focusRegion.slug}
              onChange={event => onFocusChange(event.target.value)}
            >
              {hierarchy.map(node => (
                <option key={node.region.slug} value={node.region.slug}>
                  {node.region.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Continente focado: <span className="text-primary font-semibold">{focusRegion.name}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {nodeLegend.map(entry => (
            <span key={entry.label} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-[2px] bg-sky-500 inline-block" /> Livre
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-[2px] bg-amber-500 inline-block" /> Requer quest
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-[2px] bg-rose-500 inline-block" /> Bloqueada
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-slate-700/60 bg-slate-900/40 px-3 py-2 text-xs">
        <label className="flex items-center gap-2">
          Zoom
          <input
            type="range"
            min={0.4}
            max={2.5}
            step={0.1}
            value={zoom}
            onChange={event => setZoom(Number(event.target.value))}
          />
          <span className="w-12 text-right font-semibold">{Math.round(zoom * 100)}%</span>
        </label>
        <label className="flex items-center gap-2">
          Canvas
          <input
            type="number"
            min={600}
            max={8000}
            value={canvasSize.width}
            className="w-20 rounded border bg-background px-2 py-0.5"
            onChange={event => handleCanvasDimensionChange('width', event.target.value)}
          />
          ×
          <input
            type="number"
            min={600}
            max={8000}
            value={canvasSize.height}
            className="w-20 rounded border bg-background px-2 py-0.5"
            onChange={event => handleCanvasDimensionChange('height', event.target.value)}
          />
          px
        </label>
        <label className="flex items-center gap-2">
          Export scale
          <select
            className="rounded border bg-background px-2 py-0.5"
            value={exportScale}
            onChange={event => setExportScale(Number(event.target.value))}
          >
            {[0.5, 1, 1.5, 2, 3, 4].map(scale => (
              <option key={scale} value={scale}>
                {scale.toFixed(1)}x
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">
            ({Math.round(canvasSize.width * exportScale)} × {Math.round(canvasSize.height * exportScale)} px)
          </span>
        </label>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border bg-slate-900/60">
        <svg
          ref={svgRef}
          width={viewWidth}
          height={viewHeight}
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          className="select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <defs>
            <linearGradient id="mapGrid" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(148, 163, 184, 0.15)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0.2)" />
            </linearGradient>
            <pattern id="miniGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={canvasSize.width} height={canvasSize.height} fill="url(#mapGrid)" />
          <rect width={canvasSize.width} height={canvasSize.height} fill="url(#miniGrid)" />
          {backgroundImage && (
            <image
              href={backgroundImage}
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
              preserveAspectRatio="xMidYMid slice"
              opacity={0.9}
            />
          )}
          {edges.map(edge => {
            const fromPos = mergedPositions(edge.from);
            const toPos = mergedPositions(edge.to);
            if (!fromPos || !toPos) return null;
            const color = edge.isLocked
              ? '#f43f5e'
              : edge.metadata?.requiredQuest
                ? '#fbbf24'
                : '#38bdf8';
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={edge.metadata?.requiredQuest ? '6 4' : undefined}
                opacity={0.85}
              />
            );
          })}
          {renderableEntries.map(([slug]) => {
            const pos = mergedPositions(slug);
            if (!pos) return null;
            const region = regionMap.get(slug);
            const label = region?.name ?? slug;
            const isCity = region?.type === 'city';
            const fill = isCity ? '#0ea5e9' : region?.type === 'wild' ? '#10b981' : '#f97316';
            const stroke = region?.isSpawnPool ? '#facc15' : '#0f172a';
            const radius = isCity ? 16 : 12;
            return (
              <g
                key={slug}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-grab active:cursor-grabbing"
              >
                <circle
                  r={radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={region?.isSpawnPool ? 3 : 2}
                  onPointerDown={event => handlePointerDown(slug, event)}
                />
                <text
                  x={0}
                  y={radius + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#e2e8f0"
                >
                  {label.length > 18 ? `${label.slice(0, 15)}…` : label}
                </text>
                <title>
                  {region?.name ?? slug}
                  {region?.summary ? ` • ${region.summary}` : ''}
                </title>
              </g>
            );
          })}
          <text x={24} y={canvasSize.height - 28} fontSize={12} fill="#94a3b8">
            Arraste as cidades, salve e exporte o SVG/PNG para usar como base no Inkarnate.
          </text>
        </svg>
      </div>

      {isAdmin && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            {backgroundSourceLabel
              ? `Overlay atual (compartilhado): ${backgroundSourceLabel}`
              : 'Sem overlay compartilhado para este continente.'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleBackgroundUpload}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => backgroundInputRef.current?.click()}
              disabled={isUploadingBackground}
            >
              Upload de imagem
            </Button>
            <input
              type="text"
              className="w-56 rounded-md border bg-background px-2 py-1 text-xs"
              placeholder="URL para sobrepor (opcional)"
              value={backgroundUrlInput}
              onChange={event => setBackgroundUrlInput(event.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApplyBackgroundUrl}
              disabled={!backgroundUrlInput.trim() || isUploadingBackground}
            >
              Aplicar URL
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteBackground}
              disabled={!backgroundImage || isUploadingBackground}
            >
              Remover imagem
            </Button>
            {isUploadingBackground && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                sincronizando overlay...
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={persistLayoutLocally}>
          Salvar rascunho local
        </Button>
        {isAdmin && (
          <Button
            variant="default"
            size="sm"
            onClick={handlePersistLayout}
            disabled={!onPersistLayout || isPersistingLayout}
          >
            {isPersistingLayout && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Publicar layout
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={resetLayout}>
          Restaurar padrão
        </Button>
        <Button variant="outline" size="sm" onClick={exportSvg}>
          Exportar SVG
        </Button>
        <Button variant="outline" size="sm" onClick={exportPng}>
          Exportar PNG
        </Button>
      </div>
    </div>
  );
};

const computeHierarchyLayout = (roots: RegionTreeNode[]) => {
  const widthMap = new Map<string, number>();

  const measure = (node: RegionTreeNode): number => {
    if (!node.children.length) {
      widthMap.set(node.region.slug, 1);
      return 1;
    }
    const total = node.children.map(measure).reduce((sum, value) => sum + value, 0);
    widthMap.set(node.region.slug, total);
    return total;
  };

  roots.forEach(measure);

  const positions = new Map<string, { x: number; y: number }>();
  const assign = (node: RegionTreeNode, depth: number, offset: number) => {
    const width = widthMap.get(node.region.slug) ?? 1;
    const center = offset + width / 2;
    positions.set(node.region.slug, {
      x: center * 140,
      y: depth * 120 + 40,
    });
    let cursor = offset;
    node.children.forEach(child => {
      const childWidth = widthMap.get(child.region.slug) ?? 1;
      assign(child, depth + 1, cursor);
      cursor += childWidth;
    });
  };

  let start = 0;
  roots.forEach(root => {
    const width = widthMap.get(root.region.slug) ?? 1;
    assign(root, 0, start);
    start += width + 1;
  });

  return Array.from(positions.entries()).reduce<Record<string, { x: number; y: number }>>(
    (acc, [slug, pos]) => {
      acc[slug] = pos;
      return acc;
    },
    {}
  );
};

type RegionTreeNodeCardProps = {
  node: RegionTreeNode;
  depth: number;
  selectedSlug: string | null;
  onSelectRegion: (slug: string) => void;
};

const RegionTreeBranch = ({
  node,
  depth,
  selectedSlug,
  onSelectRegion,
}: RegionTreeNodeCardProps) => {
  const { region, children } = node;
  const isSelected = region.slug === selectedSlug;
  const label = getRegionTypeLabel(region.type);
  return (
    <div
      className={cn(
        'rounded-lg border bg-background/70 p-3 transition-shadow flex flex-col gap-2',
        isSelected ? 'border-primary shadow-[0_0_0_2px_rgba(59,130,246,0.25)]' : 'border-border'
      )}
      style={{ marginLeft: depth * 12 }}
    >
      <button
        type="button"
        className="w-full text-left flex items-center justify-between gap-3"
        onClick={() => onSelectRegion(region.slug)}
      >
        <div>
          <p className="text-sm font-semibold">{region.name}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {label}
            {region.parentName ? ` • filho de ${region.parentName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {region.isSpawnPool && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              <Pin className="w-3 h-3" />
              Spawn
            </span>
          )}
          <span className="text-muted-foreground">
            {(region.neighbors?.filter(n => n.direction === 'outgoing') ?? []).length} rotas
          </span>
        </div>
      </button>
      {children.length > 0 && (
        <div className="space-y-2 border-l border-dashed border-muted pl-4">
          {children.map(child => (
            <RegionTreeBranch
              key={child.region.slug}
              node={child}
              depth={depth + 1}
              selectedSlug={selectedSlug}
              onSelectRegion={onSelectRegion}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type RegionDetailsProps = {
  region: RegionDTO;
  allRegions: RegionDTO[];
  isAdmin: boolean;
  onToggleSpawn: () => void;
  isUpdatingSpawn: boolean;
  onUpdateMetadata: (regionId: number, metadata: Record<string, any>) => void;
  onUpsertPoi: (payload: {
    id?: number;
    regionSlug: string;
    name: string;
    slug: string;
    type: PoiType;
    summary?: string;
    description?: string;
    metadata?: Record<string, any>;
    isLocked?: boolean;
    allowAiExpansion?: boolean;
  }) => void;
  onDeletePoi: (poiId: number) => void;
  onCreateRoute: (payload: CreateRegionLinkInput) => void;
};

const RegionDetailsCard = ({
  region,
  allRegions,
  isAdmin,
  onToggleSpawn,
  isUpdatingSpawn,
  onUpdateMetadata,
  onUpsertPoi,
  onDeletePoi,
  onCreateRoute,
}: RegionDetailsProps) => (
  <div className="rounded-lg border p-4 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
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

    <RegionMetadataForm region={region} onUpdateMetadata={onUpdateMetadata} isEditable={isAdmin} />

    <RouteCreationForm
      region={region}
      allRegions={allRegions}
      onCreateRoute={onCreateRoute}
      isEditable={isAdmin}
    />

    <PoiManager
      region={region}
      onUpsertPoi={onUpsertPoi}
      onDeletePoi={onDeletePoi}
      isEditable={isAdmin}
    />
  </div>
);

type RegionMetadataFormProps = {
  region: RegionDTO;
  onUpdateMetadata: (regionId: number, metadata: Record<string, any>) => void;
  isEditable: boolean;
};

const RegionMetadataForm = ({ region, onUpdateMetadata, isEditable }: RegionMetadataFormProps) => {
  const [form, setForm] = useState({
    levelRange: '',
    danger: '',
    planeAnchors: false,
  });

  useEffect(() => {
    setForm({
      levelRange: String(region.metadata?.levelRange ?? ''),
      danger: String(region.metadata?.danger ?? ''),
      planeAnchors: Boolean(region.metadata?.planeAnchors ?? false),
    });
  }, [region.id, region.metadata]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onUpdateMetadata(region.id, {
      ...(region.metadata || {}),
      ...(form.levelRange ? { levelRange: form.levelRange } : { levelRange: undefined }),
      ...(form.danger ? { danger: form.danger } : { danger: undefined }),
      planeAnchors: form.planeAnchors,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Metadados</p>
        {isEditable && (
          <Button type="submit" size="sm">
            Salvar metadados
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs uppercase">Faixa de nível</span>
          <input
            type="text"
            value={form.levelRange}
            onChange={event => setForm(prev => ({ ...prev, levelRange: event.target.value }))}
            className="rounded-md border bg-background px-2 py-1"
            placeholder="ex: 12-18"
            disabled={!isEditable}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs uppercase">Perigo</span>
          <input
            type="text"
            value={form.danger}
            onChange={event => setForm(prev => ({ ...prev, danger: event.target.value }))}
            className="rounded-md border bg-background px-2 py-1"
            placeholder="ex: alta"
            disabled={!isEditable}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="rounded border-muted"
            checked={form.planeAnchors}
            onChange={event => setForm(prev => ({ ...prev, planeAnchors: event.target.checked }))}
            disabled={!isEditable}
          />
          Possui âncoras planares
        </label>
      </div>
    </form>
  );
};

type RouteCreationFormProps = {
  region: RegionDTO;
  allRegions: RegionDTO[];
  onCreateRoute: (payload: CreateRegionLinkInput) => void;
  isEditable: boolean;
};

const RouteCreationForm = ({
  region,
  allRegions,
  onCreateRoute,
  isEditable,
}: RouteCreationFormProps) => {
  const [form, setForm] = useState({
    fromRegionSlug: region.slug,
    toRegionSlug: '',
    travelMode: 'walk' as CreateRegionLinkInput['travelMode'],
    travelTimeMinutes: 10,
    difficulty: '',
    notes: '',
    isLocked: false,
    requiredQuest: '',
    requiredFlag: '',
  });

  useEffect(() => {
    setForm(prev => ({ ...prev, fromRegionSlug: region.slug }));
  }, [region.slug]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.toRegionSlug) return;
    const metadata: Record<string, any> = {};
    if (form.requiredQuest) metadata.requiredQuest = form.requiredQuest;
    if (form.requiredFlag) metadata.requiredFlag = form.requiredFlag;
    onCreateRoute({
      fromRegionSlug: region.slug,
      toRegionSlug: form.toRegionSlug,
      travelMode: form.travelMode,
      travelTimeMinutes: Number(form.travelTimeMinutes) || 0,
      difficulty: form.difficulty || undefined,
      notes: form.notes || undefined,
      isLocked: form.isLocked,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });
    setForm(prev => ({
      ...prev,
      toRegionSlug: '',
      travelTimeMinutes: 10,
      difficulty: '',
      notes: '',
      isLocked: false,
      requiredQuest: '',
      requiredFlag: '',
    }));
  };

  const availableTargets = allRegions.filter(r => r.slug !== region.slug);

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Rotas</p>
        {isEditable && (
          <Button type="submit" size="sm" disabled={!form.toRegionSlug}>
            Criar rota
          </Button>
        )}
      </div>
      {!isEditable && (
        <p className="text-xs text-muted-foreground">
          Rotas existentes: {(region.neighbors || []).filter(n => n.direction === 'outgoing').length}
        </p>
      )}
      {isEditable && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={form.toRegionSlug}
            onChange={event => setForm(prev => ({ ...prev, toRegionSlug: event.target.value }))}
          >
            <option value="">Destino</option>
            {availableTargets.map(target => (
              <option key={target.slug} value={target.slug}>
                {target.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={form.travelMode}
            onChange={event =>
              setForm(prev => ({ ...prev, travelMode: event.target.value as CreateRegionLinkInput['travelMode'] }))
            }
          >
            <option value="walk">Caminhada</option>
            <option value="mount">Montaria</option>
            <option value="airship">Aeronavio</option>
            <option value="portal">Portal</option>
            <option value="ship">Navio</option>
            <option value="teleport">Teleporte</option>
          </select>
          <input
            type="number"
            min={0}
            className="rounded-md border bg-background px-2 py-1"
            value={form.travelTimeMinutes}
            onChange={event => setForm(prev => ({ ...prev, travelTimeMinutes: Number(event.target.value) }))}
            placeholder="Tempo (min)"
          />
          <input
            type="text"
            className="rounded-md border bg-background px-2 py-1"
            value={form.difficulty}
            onChange={event => setForm(prev => ({ ...prev, difficulty: event.target.value }))}
            placeholder="Dificuldade"
          />
          <input
            type="text"
            className="rounded-md border bg-background px-2 py-1"
            value={form.notes}
            onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
            placeholder="Notas"
          />
          <input
            type="text"
            className="rounded-md border bg-background px-2 py-1"
            value={form.requiredQuest}
            onChange={event => setForm(prev => ({ ...prev, requiredQuest: event.target.value }))}
            placeholder="Quest necessária"
          />
          <input
            type="text"
            className="rounded-md border bg-background px-2 py-1"
            value={form.requiredFlag}
            onChange={event => setForm(prev => ({ ...prev, requiredFlag: event.target.value }))}
            placeholder="Flag necessária"
          />
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-muted"
              checked={form.isLocked}
              onChange={event => setForm(prev => ({ ...prev, isLocked: event.target.checked }))}
            />
            Bloquear rota
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        {(region.neighbors ?? [])
          .filter(neighbor => neighbor.direction === 'outgoing')
          .map(neighbor => (
            <div key={neighbor.id} className="border rounded-md px-3 py-2 text-xs">
              <p className="font-semibold">{neighbor.targetRegionName ?? neighbor.targetRegionSlug}</p>
              <p className="text-muted-foreground">
                {neighbor.travelMode} · {neighbor.travelTimeMinutes} min
                {neighbor.difficulty ? ` • ${neighbor.difficulty}` : ''}
              </p>
              {neighbor.metadata?.requiredQuest && (
                <p className="text-amber-600">Requer quest: {neighbor.metadata.requiredQuest}</p>
              )}
              {neighbor.metadata?.requiredFlag && (
                <p className="text-amber-600">Requer flag: {neighbor.metadata.requiredFlag}</p>
              )}
              {neighbor.isLocked && <p className="text-rose-600">Rota bloqueada.</p>}
            </div>
          ))}
        {!region.neighbors?.length && (
          <p className="text-xs text-muted-foreground">Nenhuma rota cadastrada para esta região.</p>
        )}
      </div>
    </form>
  );
};

type PoiManagerProps = {
  region: RegionDTO;
  onUpsertPoi: (payload: {
    id?: number;
    regionSlug: string;
    name: string;
    slug: string;
    type: PoiType;
    summary?: string;
    description?: string;
    metadata?: Record<string, any>;
    isLocked?: boolean;
    allowAiExpansion?: boolean;
  }) => void;
  onDeletePoi: (poiId: number) => void;
  isEditable: boolean;
};

const PoiManager = ({ region, onUpsertPoi, onDeletePoi, isEditable }: PoiManagerProps) => {
  const emptyForm = {
    id: undefined as number | undefined,
    name: '',
    slug: '',
    type: 'landmark' as PoiType,
    summary: '',
    description: '',
    levelRange: '',
    danger: '',
    planeAnchors: false,
    isLocked: false,
    allowAiExpansion: true,
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setForm(emptyForm);
  }, [region.id]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const metadata = {
      ...(form.levelRange ? { levelRange: form.levelRange } : {}),
      ...(form.danger ? { danger: form.danger } : {}),
      planeAnchors: form.planeAnchors,
    };
    onUpsertPoi({
      id: form.id,
      regionSlug: region.slug,
      name: form.name.trim(),
      slug: form.slug.trim() || slugifyLabel(form.name),
      type: form.type,
      summary: form.summary,
      description: form.description,
      metadata,
      isLocked: form.isLocked,
      allowAiExpansion: form.allowAiExpansion,
    });
    setForm(emptyForm);
  };

  const handleEdit = (poi: RegionPoiDTO) => {
    setForm({
      id: poi.id,
      name: poi.name,
      slug: poi.slug,
      type: poi.type as PoiType,
      summary: poi.summary ?? '',
      description: poi.description ?? '',
      levelRange: String(poi.metadata?.levelRange ?? ''),
      danger: String(poi.metadata?.danger ?? ''),
      planeAnchors: Boolean(poi.metadata?.planeAnchors ?? false),
      isLocked: poi.isLocked,
      allowAiExpansion: poi.allowAiExpansion,
    });
  };

  const poiList = region.pointsOfInterest ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Pontos de interesse</p>
        {isEditable && (
          <Button type="button" variant="outline" size="sm" onClick={() => setForm(emptyForm)}>
            Novo POI
          </Button>
        )}
      </div>

      {poiList.length ? (
        <ul className="space-y-2 text-sm">
          {poiList.map(poi => (
            <li key={poi.id} className="border rounded-md px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{poi.name}</p>
                  <p className="text-xs text-muted-foreground uppercase">{poi.type}</p>
                </div>
                {isEditable && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(poi)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => onDeletePoi(poi.id)}
                    >
                      Remover
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{poi.summary || 'Sem resumo.'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum POI cadastrado nesta região.</p>
      )}

      {isEditable && (
        <form onSubmit={handleSubmit} className="space-y-2 border rounded-md p-3 bg-muted/30 text-sm">
          <p className="font-semibold text-sm">{form.id ? 'Editar POI' : 'Novo POI'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              className="rounded-md border bg-background px-2 py-1"
              placeholder="Nome"
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            />
            <input
              type="text"
              className="rounded-md border bg-background px-2 py-1"
              placeholder="Slug"
              value={form.slug}
              onChange={event => setForm(prev => ({ ...prev, slug: event.target.value }))}
            />
            <select
              className="rounded-md border bg-background px-2 py-1"
              value={form.type}
              onChange={event => setForm(prev => ({ ...prev, type: event.target.value as PoiType }))}
            >
              {POI_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="rounded-md border bg-background px-2 py-1"
              placeholder="Resumo"
              value={form.summary}
              onChange={event => setForm(prev => ({ ...prev, summary: event.target.value }))}
            />
            <textarea
              className="rounded-md border bg-background px-2 py-1 md:col-span-2"
              rows={2}
              placeholder="Descrição"
              value={form.description}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <input
              type="text"
              className="rounded-md border bg-background px-2 py-1"
              placeholder="Faixa de nível"
              value={form.levelRange}
              onChange={event => setForm(prev => ({ ...prev, levelRange: event.target.value }))}
            />
            <input
              type="text"
              className="rounded-md border bg-background px-2 py-1"
              placeholder="Perigo"
              value={form.danger}
              onChange={event => setForm(prev => ({ ...prev, danger: event.target.value }))}
            />
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-muted"
                checked={form.planeAnchors}
                onChange={event => setForm(prev => ({ ...prev, planeAnchors: event.target.checked }))}
              />
              Plano âncora
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-muted"
                checked={form.isLocked}
                onChange={event => setForm(prev => ({ ...prev, isLocked: event.target.checked }))}
              />
              Fechado
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-muted"
                checked={form.allowAiExpansion}
                onChange={event => setForm(prev => ({ ...prev, allowAiExpansion: event.target.checked }))}
              />
              IA pode expandir
            </label>
          </div>
          <div className="flex justify-end gap-2">
            {form.id && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(emptyForm)}>
                Cancelar
              </Button>
            )}
            <Button type="submit" size="sm">
              {form.id ? 'Atualizar POI' : 'Criar POI'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

type SnapshotManagerProps = {
  snapshots: RegionSnapshotDTO[];
  isLoading: boolean;
  onCreate: (label: string) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
};

const SnapshotManager = ({
  snapshots,
  isLoading,
  onCreate,
  onRestore,
  onDelete,
}: SnapshotManagerProps) => {
  const [label, setLabel] = useState('');
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Snapshots do mapa</h2>
        <form
          className="flex items-center gap-2"
          onSubmit={event => {
            event.preventDefault();
            onCreate(label);
            setLabel('');
          }}
        >
          <input
            type="text"
            value={label}
            onChange={event => setLabel(event.target.value)}
            placeholder="Nome do snapshot"
            className="rounded-md border bg-background px-2 py-1 text-sm"
          />
          <Button type="submit" size="sm">
            Criar
          </Button>
        </form>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Carregando snapshots...
        </div>
      ) : snapshots.length ? (
        <ul className="space-y-2 text-sm">
          {snapshots.map(snapshot => (
            <li
              key={snapshot.id}
              className="border rounded-md px-3 py-2 flex items-center justify-between flex-wrap gap-2"
            >
              <div>
                <p className="font-semibold">{snapshot.label}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(snapshot.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => onRestore(snapshot.id)}>
                  Restaurar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(snapshot.id)}
                >
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum snapshot salvo.</p>
      )}
    </div>
  );
};

type AutoPoiAuditProps = {
  pendingPois: PendingPoiDTO[];
  isLoading: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
};

const AutoPoiAudit = ({ pendingPois, isLoading, onApprove, onReject }: AutoPoiAuditProps) => (
  <div className="rounded-lg border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">POIs sugeridos pela IA</h2>
      <p className="text-xs text-muted-foreground">
        Aprove ou descarte os pontos de interesse criados automaticamente durante as sessões.
      </p>
    </div>
    {isLoading ? (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Carregando POIs pendentes...
      </div>
    ) : pendingPois.length ? (
      <ul className="space-y-2 text-sm">
        {pendingPois.map(poi => (
          <li key={poi.id} className="border rounded-md px-3 py-2 space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold">{poi.name}</p>
                <p className="text-xs text-muted-foreground">
                  {poi.regionName || poi.regionSlug} • {poi.type}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => onApprove(poi.id)}>
                  Aprovar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject(poi.id)}
                >
                  Remover
                </Button>
              </div>
            </div>
            {poi.summary && <p className="text-xs text-muted-foreground">{poi.summary}</p>}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">Nenhum POI pendente no momento.</p>
    )}
  </div>
);

type AiRegionHelperProps = {
  prompt: string;
  baseRegion: string;
  onPromptChange: (value: string) => void;
  onBaseRegionChange: (value: string) => void;
  onGenerate: () => void;
  aiDraftResult: string;
  regions: RegionDTO[];
  isGenerating: boolean;
  onExportGraph: () => void;
  onImportGraph: (file: File, options: { clearExisting: boolean }) => Promise<void>;
  isExportingGraph: boolean;
  isImportingGraph: boolean;
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
  onExportGraph,
  onImportGraph,
  isExportingGraph,
  isImportingGraph,
}: AiRegionHelperProps) => (
  <AiRegionHelperContent
    prompt={prompt}
    baseRegion={baseRegion}
    onPromptChange={onPromptChange}
    onBaseRegionChange={onBaseRegionChange}
    onGenerate={onGenerate}
    aiDraftResult={aiDraftResult}
    regions={regions}
    isGenerating={isGenerating}
    onExportGraph={onExportGraph}
    onImportGraph={onImportGraph}
    isExportingGraph={isExportingGraph}
    isImportingGraph={isImportingGraph}
  />
);

const AiRegionHelperContent = ({
  prompt,
  baseRegion,
  onPromptChange,
  onBaseRegionChange,
  onGenerate,
  aiDraftResult,
  regions,
  isGenerating,
  onExportGraph,
  onImportGraph,
  isExportingGraph,
  isImportingGraph,
}: AiRegionHelperProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleImportClick = async () => {
    if (!selectedFile) return;
    await onImportGraph(selectedFile, { clearExisting });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Helper IA &amp; Backup</h2>
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

      <div className="space-y-3 border-t pt-4">
        <p className="text-sm font-semibold">Importar / Exportar mapa completo</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExportGraph} disabled={isExportingGraph}>
            {isExportingGraph && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Exportar JSON
          </Button>
          <div className="inline-flex items-center gap-2 text-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={event => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" onClick={handleFilePick}>
              Selecionar arquivo
            </Button>
            {selectedFile && (
              <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                {selectedFile.name}
              </span>
            )}
          </div>
          <Button onClick={handleImportClick} disabled={!selectedFile || isImportingGraph}>
            {isImportingGraph && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Importar mapa
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="rounded border-muted"
            checked={clearExisting}
            onChange={event => setClearExisting(event.target.checked)}
          />
          Substituir completamente o mapa existente
        </label>
        <p className="text-xs text-muted-foreground">
          O JSON exportado possui o mesmo formato do arquivo `backend/src/data/regionsSeed.json`. Guarde-o
          como backup e, quando quiser aplicar em outro ambiente, basta importá-lo ou substituir esse seed e
          executar `npm run seedRegion`.
        </p>
      </div>
    </div>
  );
};

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
  onOpenWorldMap: () => void;
  isWorldMapLoading: boolean;
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
  onOpenWorldMap,
  isWorldMapLoading,
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

              <div className="rounded-md border px-3 py-2 flex flex-col gap-2">
                <p className="text-sm font-semibold">Exploração global</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenWorldMap}
                  disabled={!selectedSessionId || isWorldMapLoading}
                >
                  {isWorldMapLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                  Ver mapa mundi
                </Button>
                <p className="text-xs text-muted-foreground">
                  Abre o mapa completo com neblina de guerra, mostrando somente as rotas já conhecidas.
                </p>
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

type WorldMapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  snapshot: WorldMapSnapshot | null;
  isLoading: boolean;
};

type MarkerFilters = {
  player: boolean;
  npc: boolean;
  quest: boolean;
};

const markerFilterOptions: Array<{ key: keyof MarkerFilters; label: string }> = [
  { key: 'player', label: 'Você' },
  { key: 'npc', label: 'NPCs' },
  { key: 'quest', label: 'Missões' },
];

const WorldMapModal = ({ isOpen, onClose, snapshot, isLoading }: WorldMapModalProps) => {
  const [markerFilters, setMarkerFilters] = useState<MarkerFilters>({
    player: true,
    npc: true,
    quest: true,
  });
  const hierarchy = useMemo(
    () => (snapshot ? buildRegionHierarchy(snapshot.regions as RegionDTO[]) : []),
    [snapshot]
  );
  const toggleMarkerFilter = (key: keyof MarkerFilters) =>
    setMarkerFilters(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <ActionModal
      isOpen={isOpen}
      onClose={onClose}
      title="Mapa Mundi"
      actions={[
        {
          text: 'Fechar',
          onClick: onClose,
          variant: 'secondary',
        },
      ]}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Carregando mapa mundi...
        </div>
      ) : snapshot && hierarchy.length ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs mb-3">
            {markerFilterOptions.map(option => (
              <Button
                key={option.key}
                variant={markerFilters[option.key] ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleMarkerFilter(option.key)}
              >
                {markerFilters[option.key] ? '●' : '○'} {option.label}
              </Button>
            ))}
          </div>
          <WorldMapCanvas snapshot={snapshot} hierarchy={hierarchy} markerFilters={markerFilters} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Selecione uma sessão para visualizar o mapa mundi.</p>
      )}
    </ActionModal>
  );
};

type WorldLayoutResult = {
  nodePositions: Map<string, { x: number; y: number }>;
  continentBounds: Array<{ slug: string; name: string; x: number; y: number; width: number; height: number }>;
  width: number;
  height: number;
};

const buildWorldLayoutPositions = (roots: RegionTreeNode[]): WorldLayoutResult => {
  const nodePositions = new Map<string, { x: number; y: number }>();
  const continentBounds: WorldLayoutResult['continentBounds'] = [];
  if (!roots.length) {
    return {
      nodePositions,
      continentBounds,
      width: 1280,
      height: 860,
    };
  }

  const margin = 140;
  const gapBetweenContinents = 320;
  let offsetX = margin;
  let maxHeight = 0;

  const resolveLayoutForRoot = (root: RegionTreeNode) => {
    const stored = root.region.metadata?.mapLayout?.nodes as Record<string, { x: number; y: number }> | undefined;
    if (stored && Object.keys(stored).length) {
      return stored;
    }
    return computeHierarchyLayout([root]);
  };

  roots.forEach(root => {
    const layout = resolveLayoutForRoot(root);
    const entries = Object.entries(layout);
    if (!entries.length) return;

    const xs = entries.map(([, pos]) => pos.x);
    const ys = entries.map(([, pos]) => pos.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX + margin * 2;
    const height = maxY - minY + margin * 2;

    entries.forEach(([slug, pos]) => {
      nodePositions.set(slug, {
        x: offsetX + (pos.x - minX) + margin,
        y: (pos.y - minY) + margin,
      });
    });

    continentBounds.push({
      slug: root.region.slug,
      name: root.region.name,
      x: offsetX - margin * 0.6,
      y: margin * 0.25,
      width,
      height: Math.max(height, 420),
    });

    offsetX += width + gapBetweenContinents;
    maxHeight = Math.max(maxHeight, height + margin);
  });

  return {
    nodePositions,
    continentBounds,
    width: Math.max(offsetX, 1400),
    height: Math.max(maxHeight, 900),
  };
};

type WorldMapCanvasProps = {
  hierarchy: RegionTreeNode[];
  snapshot: WorldMapSnapshot;
  markerFilters: MarkerFilters;
};

const WorldMapCanvas = ({ hierarchy, snapshot, markerFilters }: WorldMapCanvasProps) => {
  const { nodePositions, continentBounds, width, height } = useMemo(
    () => buildWorldLayoutPositions(hierarchy),
    [hierarchy]
  );
  const fallbackPositions = useMemo(() => {
    const fallback = computeHierarchyLayout(hierarchy);
    return new Map<string, { x: number; y: number }>(Object.entries(fallback));
  }, [hierarchy]);
  const getPosition = useCallback(
    (slug: string) => nodePositions.get(slug) ?? fallbackPositions.get(slug),
    [nodePositions, fallbackPositions]
  );
  const currentPos = snapshot.currentRegionSlug ? getPosition(snapshot.currentRegionSlug) : null;
  const fogGradientId = useMemo(() => `fog-gradient-${Math.random().toString(36).slice(2)}`, []);
  const fogMaskId = useMemo(() => `fog-mask-${Math.random().toString(36).slice(2)}`, []);
  const renderableRegions = useMemo(
    () => snapshot.regions.filter(region => region.type !== 'world'),
    [snapshot.regions]
  );
  const visibleMarkers = useMemo(
    () =>
      (snapshot.markers ?? []).filter(marker => markerFilters[marker.type] !== false),
    [snapshot.markers, markerFilters]
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="worldGrid" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(148,163,184,0.08)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.25)" />
            </linearGradient>
            <pattern id="worldGridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(71,85,105,0.15)" strokeWidth="1" />
            </pattern>
            <radialGradient id={fogGradientId}>
              <stop offset="0%" stopColor="black" stopOpacity="0" />
              <stop offset="60%" stopColor="black" stopOpacity="0.4" />
              <stop offset="100%" stopColor="black" stopOpacity="1" />
            </radialGradient>
            <mask id={fogMaskId}>
              <rect width={width} height={height} fill="white" />
              {currentPos && (
                <circle cx={currentPos.x} cy={currentPos.y} r={520} fill={`url(#${fogGradientId})`} />
              )}
            </mask>
          </defs>
          <rect width={width} height={height} fill="url(#worldGrid)" />
          <rect width={width} height={height} fill="url(#worldGridPattern)" />
          <rect width={width} height={height} fill="rgba(2,6,23,0.82)" mask={`url(#${fogMaskId})`} />

          {continentBounds.map(bound => (
            <g key={bound.slug}>
              <rect
                x={bound.x}
                y={bound.y}
                width={bound.width}
                height={bound.height}
                fill="rgba(8,47,73,0.15)"
                stroke="rgba(56,189,248,0.2)"
                strokeDasharray="12 8"
              />
              <text
                x={bound.x + 16}
                y={bound.y + 28}
                fontSize={14}
                fill="#38bdf8"
                className="uppercase tracking-[0.3em]"
              >
                {bound.name}
              </text>
            </g>
          ))}

          {snapshot.links
            .filter(link => link.discovered)
            .map(link => {
              const fromPos = getPosition(link.fromSlug);
              const toPos = getPosition(link.toSlug);
              if (!fromPos || !toPos) return null;
              const color = link.isLocked ? '#f87171' : '#38bdf8';
              return (
                <line
                  key={`${link.fromSlug}-${link.toSlug}`}
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.9}
                  strokeDasharray={link.isLocked ? '8 6' : undefined}
                />
              );
            })}

          {renderableRegions.map(region => {
            const pos = getPosition(region.slug);
            if (!pos) return null;
            const isDiscovered = Boolean(region.isDiscovered);
            const radius = region.type === 'city' ? 14 : 10;
            const fill = !isDiscovered
              ? '#1f2937'
              : region.type === 'city'
                ? '#22d3ee'
                : region.type === 'dungeon'
                  ? '#f97316'
                  : '#a855f7';
            const stroke = region.isCurrent ? '#facc15' : isDiscovered ? '#e2e8f0' : '#0f172a';
            const opacity = isDiscovered ? 1 : 0.35;
            const label = region.name;

            return (
              <g key={region.slug} transform={`translate(${pos.x}, ${pos.y})`}>
                {region.isCurrent && (
                  <circle
                    r={radius + 10}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={3}
                    className="animate-ping"
                  />
                )}
                <circle r={radius} fill={fill} stroke={stroke} strokeWidth={2} opacity={opacity} />
                {isDiscovered && (
                  <text
                    x={0}
                    y={radius + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#e2e8f0"
                  >
                    {label.length > 18 ? `${label.slice(0, 15)}…` : label}
                  </text>
                )}
                <title>
                  {label}
                  {region.isCurrent ? ' (posição atual)' : ''}
                </title>
              </g>
            );
          })}
          {visibleMarkers.map(marker => {
            const pos = getPosition(marker.regionSlug);
            if (!pos) return null;
            const opacity = marker.isDiscovered ? 1 : 0.3;
            const label = marker.label;
            const description = marker.description
              ? ` • ${marker.description}`
              : marker.status
                ? ` (${marker.status})`
                : '';
            return (
              <g key={marker.id} transform={`translate(${pos.x}, ${pos.y - 6})`} opacity={opacity}>
                {marker.type === 'player' ? (
                  <>
                    <circle r={16} fill="none" stroke="#fef08a" strokeWidth={2} />
                    <circle r={10} fill="#facc15" stroke="#b45309" strokeWidth={2} />
                  </>
                ) : marker.type === 'npc' ? (
                  <rect
                    x={-8}
                    y={-8}
                    width={16}
                    height={16}
                    fill="#34d399"
                    stroke="#065f46"
                    strokeWidth={2}
                    transform="rotate(45)"
                  />
                ) : (
                  <rect
                    x={-7}
                    y={-7}
                    width={14}
                    height={14}
                    fill="#fb7185"
                    stroke="#7f1d1d"
                    strokeWidth={2}
                    rx={2}
                  />
                )}
                <text
                  x={0}
                  y={marker.type === 'player' ? 26 : 22}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#e2e8f0"
                >
                  {label.length > 18 ? `${label.slice(0, 15)}…` : label}
                </text>
                <title>
                  {label}
                  {description}
                </title>
              </g>
            );
          })}
          <text x={24} y={canvasSize.height - 28} fontSize={12} fill="#94a3b8">
            Rotas só aparecem após exploradas; use os filtros acima para destacar NPCs e missões.
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#22d3ee]" />
          Cidade explorada
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#f97316]" />
          Dungeon / ameaça
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#a855f7]" />
          Região selvagem / sublocal
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#1f2937]" />
          Não explorado
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-[2px] bg-[#38bdf8]" />
          Rotas conhecidas
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#facc15]" />
          Você / grupo
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block"
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#34d399',
              transform: 'rotate(45deg)',
            }}
          />
          NPCs rastreados
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-[#fb7185]" />
          Missões em aberto
        </div>
      </div>
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
