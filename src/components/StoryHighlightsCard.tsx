// src/components/StoryHighlightsCard.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { getSessionFacts, getSessionReplay, SessionReplayResponse } from '@/services/gameService';
import type { SessionFactsResponse } from '@/services/gameService'; // Corrigido a importação
import { Loader2, RefreshCw, MapPin, Users, CalendarClock, Bookmark, BookOpen, ChevronDown } from 'lucide-react';
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
    variant?: 'default' | 'compact' | 'v2';
}

const CollapsibleCardSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    hasContent: boolean;
    defaultOpen?: boolean;
}> = ({ title, icon, children, hasContent, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40">
            <button
                className="flex w-full items-center justify-between p-3 text-left"
                onClick={() => setIsOpen(!isOpen)}
                disabled={!hasContent}
            >
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 text-amber-300">
                        {icon}
                    </div>
                    <span className="text-sm font-semibold text-stone-200">{title}</span>
                </div>
                {hasContent && (
                    <ChevronDown
                        className={`h-5 w-5 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                )}
            </button>
            <AnimatePresence initial={false}>
                {isOpen && hasContent && (
                    <motion.div
                        key="content"
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{
                            open: { opacity: 1, height: 'auto' },
                            collapsed: { opacity: 0, height: 0 },
                        }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CompactSummary: React.FC<{ summary: string }> = ({ summary }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isLongText = summary.length > 200; // Define um limiar para mostrar o botão

    return (
        <div className="text-sm text-stone-200">
            <p className={`${!isExpanded && isLongText ? 'line-clamp-4' : ''}`}>
                {summary || 'Continue explorando para gerar novos fatos.'}
            </p>
            {isLongText && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 text-xs font-semibold text-amber-300 hover:text-amber-200"
                >
                    {isExpanded ? 'Mostrar menos' : 'Mostrar mais'}
                </button>
            )}
        </div>
    );
};


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
            .map(line => {
                const noteIndex = line.indexOf('(Notas:');
                return noteIndex !== -1 ? line.substring(0, noteIndex).trim() : line.trim();
            })
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

    const isCompact = variant === 'compact' || variant === 'v2';
    const isV2 = variant === 'v2';

    if (!sessionId) {
        return (
            <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-4 text-sm text-stone-400">
                Inicie ou carregue uma sessão para ver os fatos atualizados.
            </div>
        );
    }

    if (isCompact) {
         return (
            <div
              data-tour-id="facts"
              className={
                isV2
                  ? 'dnd-border-gold dnd-surface-glass space-y-3 rounded-lg p-4'
                  : 'rounded-lg border border-stone-700 bg-stone-900/80 p-4 shadow-inner space-y-3'
              }
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">Painel Vivo</p>
                        <h3 className="text-base font-bold text-amber-300">Flash da Sessão</h3>
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
                
                <CollapsibleCardSection title="Resumo" icon={<Bookmark className="h-4 w-4" />} hasContent={!!facts?.storySummary} defaultOpen>
                    <CompactSummary summary={facts?.storySummary || 'Continue explorando para gerar novos fatos.'} />
                </CollapsibleCardSection>

                <CollapsibleCardSection title="Fatos Recentes" icon={<CalendarClock className="h-4 w-4" />} hasContent={timelineLines.length > 0}>
                     <ul className="space-y-1 text-sm text-stone-300">
                        {timelineLines.map((line, idx) => (
                            <li key={idx} className="pl-4 relative">
                                <span className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {line}
                            </li>
                        ))}
                    </ul>
                </CollapsibleCardSection>

                <CollapsibleCardSection title="NPCs em Foco" icon={<Users className="h-4 w-4" />} hasContent={!!facts?.activeNPCs?.length}>
                    <div className="flex flex-wrap gap-1.5">
                        {facts?.activeNPCs?.map(npc => (
                            <span
                                key={npc.npcId ?? npc.name}
                                className="text-xs px-2 py-1 rounded-full bg-stone-800 border border-stone-700 text-stone-200"
                            >
                                {npc.name}
                            </span>
                        ))}
                    </div>
                </CollapsibleCardSection>

                {isV2 && facts?.activeQuests?.length ? (
                    <CollapsibleCardSection title="Missões" icon={<MapPin className="h-4 w-4" />} hasContent>
                        <ul className="space-y-1 text-sm text-stone-300">
                            {facts.activeQuests.map((quest) => (
                                <li key={quest.id}>
                                    <span className="font-medium text-stone-200">{quest.title}</span>
                                    <span className="text-stone-500"> — {quest.source}</span>
                                </li>
                            ))}
                        </ul>
                    </CollapsibleCardSection>
                ) : null}
            </div>
        );
    }

    return (
        <>
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

                <CollapsibleCardSection title="Resumo Atual" icon={<Bookmark className="h-4 w-4" />} hasContent={!!facts?.storySummary} defaultOpen>
                     <p className="text-sm text-stone-200 leading-relaxed">
                        {facts?.storySummary || 'Ainda não há um resumo consolidado desta jornada. Continue explorando para registrar acontecimentos.'}
                    </p>
                </CollapsibleCardSection>

                <CollapsibleCardSection title="Fatos Recentes" icon={<CalendarClock className="h-4 w-4" />} hasContent={timelineLines.length > 0}>
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
                </CollapsibleCardSection>

                <div className="grid gap-4 md:grid-cols-2">
                    <CollapsibleCardSection title="NPCs em Foco" icon={<Users className="h-4 w-4" />} hasContent={!!facts?.activeNPCs?.length}>
                         {facts?.activeNPCs?.length ? (
                            <ul className="space-y-2">
                                {facts.activeNPCs.map(npc => (
                                    <li key={npc.npcId ?? npc.name} className="rounded-md border border-stone-700/60 bg-stone-900/40 p-2">
                                        <div className="flex items-center justify-between text-sm font-semibold text-stone-200">
                                            <span>{npc.name}</span>
                                            <span className="text-xs text-stone-400">{npc.status}</span>
                                        </div>
                                        <div className="text-xs text-stone-500 mt-1">Afinidade: {npc.affinity}</div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-stone-500">Nenhum aliado ou ameaça em destaque.</p>
                        )}
                    </CollapsibleCardSection>

                    <CollapsibleCardSection title="Missões em Curso" icon={<MapPin className="h-4 w-4" />} hasContent={!!facts?.activeQuests?.length}>
                         {facts?.activeQuests?.length ? (
                            <ul className="space-y-2">
                                {facts.activeQuests.map(quest => (
                                    <li key={quest.id} className="rounded-md border border-stone-700/60 bg-stone-900/40 p-2">
                                        <p className="text-sm font-semibold text-stone-200">{quest.title}</p>
                                        <p className="text-xs text-stone-500 mt-1">Fonte: {quest.source}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-stone-500">Nenhuma missão ativa registrada.</p>
                        )}
                    </CollapsibleCardSection>
                </div>
            </div>
            <ActionModal
                isOpen={isPreviewOpen}
                title="Resumo da Sessão"
                onClose={() => setIsPreviewOpen(false)}
                actions={[
                    {
                        text: 'Fechar',
                        onClick: () => setIsPreviewOpen(false),
                        variant: 'primary',
                    },
                ]}
            >
                {replayPreview ? (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto rounded-md bg-stone-950/60 border border-stone-800 p-3 text-sm text-stone-200 font-mono">
                        {replayPreview.markdown.split('\n').map((line, index) => (
                            <p key={index} className={line.startsWith('#') ? 'font-bold text-amber-200' : ''}>
                                {line || <br />}
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
        </>
    );
};

export default StoryHighlightsCard;
