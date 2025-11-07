// src/components/StoryHighlightsCard.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { getSessionFacts, getSessionReplay, SessionFactsResponse, SessionReplayResponse } from '@/services/gameService';
import { Loader2, RefreshCw, Download, MapPin, Users, CalendarClock, Bookmark, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ActionModal from '@/components/ui/ActionModal';

const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

interface StoryHighlightsCardProps {
    variant?: 'default' | 'compact';
}

const StoryHighlightsCard: React.FC<StoryHighlightsCardProps> = ({ variant = 'default' }) => {
    const { sessionId } = useGameStateContext();
    const { toast } = useToast();
    const [facts, setFacts] = useState<SessionFactsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [replayPreview, setReplayPreview] = useState<SessionReplayResponse | null>(null);

    const fetchFacts = useCallback(async () => {
        if (!sessionId) return;
        setIsLoading(true);
        try {
            const data = await getSessionFacts(sessionId);
            setFacts(data);
        } catch (error: any) {
            console.error('[StoryHighlightsCard] Falha ao carregar fatos:', error);
            toast({
                variant: 'destructive',
                title: 'Não foi possível carregar os fatos atuais.',
            });
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, toast]);

    useEffect(() => {
        if (sessionId) {
            fetchFacts();
        }
    }, [sessionId, fetchFacts]);

    const timelineLines = useMemo(() => {
        if (!facts?.timelineFacts) return [];
        return facts.timelineFacts
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
    }, [facts]);

    const handleOpenReplayPreview = useCallback(async () => {
        if (!sessionId) return;
        setIsPreviewLoading(true);
        try {
            const replay = await getSessionReplay(sessionId);
            setReplayPreview(replay);
            setIsPreviewOpen(true);
        } catch (error) {
            console.error('[StoryHighlightsCard] Falha ao carregar resumo da sessão:', error);
            toast({
                variant: 'destructive',
                title: 'Não foi possível carregar o resumo da sessão.',
            });
        } finally {
            setIsPreviewLoading(false);
        }
    }, [sessionId, toast]);

    const handleDownloadReplay = useCallback(async () => {
        if (!sessionId) return;
        try {
            const data = replayPreview ?? await getSessionReplay(sessionId);
            const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = data.fileName || `replay-${sessionId}.md`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[StoryHighlightsCard] Falha ao exportar resumo:', error);
            toast({
                variant: 'destructive',
                title: 'Não foi possível exportar o resumo da sessão.',
            });
        }
    }, [sessionId, replayPreview, toast]);

    const isCompact = variant === 'compact';

    if (!sessionId) {
        return (
            <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-4 text-sm text-stone-400">
                Inicie ou carregue uma sessão para ver os fatos atualizados.
            </div>
        );
    }

    if (isCompact) {
        const compactTimeline = facts?.recentEvents?.slice(-3)?.reverse() ?? [];
        const npcChips = facts?.activeNPCs?.slice(0, 3) ?? [];
        return (
            <div data-tour-id="facts" className="rounded-lg border border-stone-700 bg-stone-900/80 p-4 shadow-inner space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">Painel Vivo</p>
                        <h3 className="text-base font-bold text-amber-300">Flash de sessão</h3>
                    </div>
                    <button
                        onClick={fetchFacts}
                        disabled={isLoading}
                        className="text-xs text-stone-400 hover:text-amber-300 inline-flex items-center gap-1"
                    >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Atualizar
                    </button>
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">Resumo</p>
                    <p className="text-sm text-stone-200 line-clamp-3">
                        {facts?.storySummary || 'Continue explorando para gerar novos fatos.'}
                    </p>
                </div>

                {!!compactTimeline.length && (
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">Linha do tempo</p>
                        <ul className="space-y-1 text-xs text-stone-300">
                            {compactTimeline.map(event => (
                                <li key={`${event.turn}-${event.timestamp}`} className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    <span className="flex-1 truncate">
                                        <strong className="text-amber-200">T{event.turn}</strong> {event.summary}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {!!npcChips.length && (
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">NPCs em foco</p>
                        <div className="flex flex-wrap gap-1.5">
                            {npcChips.map(npc => (
                                <span
                                    key={npc.npcId ?? npc.name}
                                    className="text-xs px-2 py-1 rounded-full bg-stone-800 border border-stone-700 text-stone-200"
                                >
                                    {npc.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div data-tour-id="facts" className="rounded-lg border border-stone-700 bg-stone-900/60 p-4 shadow-inner space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Painel vivo</p>
                    <h3 className="text-lg font-bold text-amber-300">Fatos Atualizados</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchFacts}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 rounded-md border border-stone-700 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-stone-800 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Atualizar
                    </button>
                    <button
                        onClick={handleOpenReplayPreview}
                        disabled={isPreviewLoading}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-amber-600 disabled:opacity-50"
                    >
                        {isPreviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                        Visualizar
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                    <Bookmark className="h-3.5 w-3.5" /> Resumo Atual
                </p>
                <p className="text-sm text-stone-200 leading-relaxed">
                    {facts?.storySummary || 'Ainda não há um resumo consolidado desta jornada. Continue explorando para registrar acontecimentos.'}
                </p>
            </div>

            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Fatos Recentes
                </p>
                {timelineLines.length ? (
                    <ul className="space-y-1 text-sm text-stone-300">
                        {timelineLines.map((line, idx) => (
                            <li key={idx} className="pl-4 relative">
                                <span className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {line}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-stone-500">Sem destaques no momento.</p>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> NPCs em foco
                    </p>
                    {facts?.activeNPCs?.length ? (
                        <ul className="space-y-2">
                            {facts.activeNPCs.map(npc => (
                                <li key={npc.npcId ?? npc.name} className="rounded-md border border-stone-700/60 bg-stone-900/40 p-2">
                                    <div className="flex items-center justify-between text-sm font-semibold text-stone-200">
                                        <span>{npc.name}</span>
                                        <span className="text-xs text-stone-400">{npc.status}</span>
                                    </div>
                                    {npc.description && (
                                        <p className="text-xs text-stone-400 mt-1">{npc.description}</p>
                                    )}
                                    <div className="text-xs text-stone-500 mt-1">Afinidade: {npc.affinity}</div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-stone-500">Nenhum aliado ou ameaça em destaque.</p>
                    )}
                </div>

                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Missões em curso
                    </p>
                    {facts?.activeQuests?.length ? (
                        <ul className="space-y-2">
                            {facts.activeQuests.map(quest => (
                                <li key={quest.id} className="rounded-md border border-stone-700/60 bg-stone-900/40 p-2">
                                    <div className="flex items-center justify-between text-sm font-semibold text-stone-200">
                                        <span>{quest.title}</span>
                                        <span className="text-xs text-stone-400">{quest.status}</span>
                                    </div>
                                    <p className="text-xs text-stone-400 mt-1">{quest.summary || 'Objetivo desconhecido.'}</p>
                                    <div className="text-xs text-stone-500 mt-1">Fonte: {quest.source}</div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-stone-500">Nenhuma missão ativa registrada.</p>
                    )}
                </div>
            </div>

            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Linha do tempo
                </p>
                {facts?.recentEvents?.length ? (
                    <motion.ul
                        className="space-y-1 text-sm text-stone-300 max-h-48 overflow-y-auto pr-1"
                        layout
                    >
                        <AnimatePresence initial={false}>
                            {facts.recentEvents.map(event => (
                                <motion.li
                                    key={`${event.turn}-${event.timestamp}`}
                                    className="rounded-md border border-stone-800/70 bg-stone-900/30 p-2"
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    layout
                                >
                                    <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
                                        <span>Turno {event.turn}</span>
                                        <span>{formatDateTime(event.timestamp)}</span>
                                    </div>
                                    <p className="font-semibold text-stone-100">{event.summary}</p>
                                    {event.notes && <p className="text-xs text-stone-400 mt-1">{event.notes}</p>}
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </motion.ul>
                ) : (
                    <p className="text-sm text-stone-500">Aguardando novos acontecimentos.</p>
                )}
            </div>
            <ActionModal
                isOpen={isPreviewOpen}
                title="Resumo da Sessão"
                onClose={() => setIsPreviewOpen(false)}
                actions={[
                    {
                        text: 'Exportar Markdown',
                        onClick: handleDownloadReplay,
                        variant: 'primary',
                        icon: <Download className="h-4 w-4" />,
                    }
                ]}
            >
                {replayPreview ? (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto rounded-md bg-stone-950/60 border border-stone-800 p-3 text-sm text-stone-200 font-mono">
                        {replayPreview.markdown.split('\n').map((line, index) => (
                            <p key={index} className={line.startsWith('#') ? 'font-bold text-amber-200' : ''}>
                                {line}
                            </p>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-stone-400 py-4">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Carregando resumo...
                    </div>
                )}
            </ActionModal>
        </div>
    );
};

export default StoryHighlightsCard;
