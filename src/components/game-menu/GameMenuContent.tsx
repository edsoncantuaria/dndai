// src/components/game-menu/GameMenuContent.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Beaker, Clock, CloudSun, Copy, Crown, Edit, FlaskConical, GitMerge, Languages, LogOut, MapPin, MoreVertical, Play, Plus, Settings, Shield, Sparkles, Sword, Trash2, User } from 'lucide-react';
import PremiumLoader from '@/components/ui/PremiumLoader';
import Game from '@/components/Game';
import HomebrewStore from '@/components/Homebrew/HomebrewStore';
import TranslationStudio from '@/components/Homebrew/TranslationStudio';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Character, SessaoIA } from '@/types';
import type { SessionFactsResponse } from '@/services/gameService';
import type { GameStage } from '@/types/gameStage';
import ActionModal from '../ui/ActionModal';

interface GameMenuContentProps {
    gameStage: GameStage;
    character: Character | null;
    sessions: SessaoIA[];
    characters: Character[];
    featuredSessionFacts: SessionFactsResponse | null;
    useAiHomebrew: boolean;
    isLoadingData: boolean;
    onSetStage: (stage: GameStage) => void;
    onReturnToMenu: () => void;
    onContinueGame: (sessionId: number) => void;
    onCharacterCreated: () => void;
    onStartFromVault: (character: Character) => void;
    onRequestDeleteCharacter: (character: Character) => void;
    onRequestDeleteSession: (session: SessaoIA) => void;
    onRequestRenameSession: (session: SessaoIA) => void;
    onRequestCloneSession: (session: SessaoIA) => void;
    onOpenSettings: () => void;
    onOpenSystemTests: () => void;
    onOpenArchitecture: () => void;
    onLogout: () => void;
    user: { id?: number } | null;
    isActionModalOpen: boolean;
    selectedSessionForAction: SessaoIA | null;
    handleActionModalClose: () => void;
    openSessionActionModal: (session: SessaoIA) => void;
}

const GameMenuContent: React.FC<GameMenuContentProps> = ({
    gameStage,
    character,
    sessions,
    characters,
    featuredSessionFacts,
    useAiHomebrew,
    isLoadingData,
    onSetStage,
    onReturnToMenu,
    onContinueGame,
    onCharacterCreated,
    onStartFromVault,
    onRequestDeleteCharacter,
    onRequestDeleteSession,
    onRequestRenameSession,
    onRequestCloneSession,
    onOpenSettings,
    onOpenSystemTests,
    onOpenArchitecture,
    onLogout,
    user,
    isActionModalOpen,
    selectedSessionForAction,
    handleActionModalClose,
    openSessionActionModal,
}) => {
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

    const featuredSession = sessions[0];
    const hasSessions = sessions.length > 0;
    const heroMetrics = useMemo(() => ([
        { label: 'Sessões Ativas', value: sessions.length, detail: 'crônicas salvas' },
        { label: 'Heróis Prontos', value: characters.length, detail: 'personagens jogáveis' },
        { label: 'Homebrews', value: useAiHomebrew ? 'IA + Manual' : 'Manual', detail: 'fontes habilitadas' },
    ]), [sessions.length, characters.length, useAiHomebrew]);

    const menuActions = [
        {
            title: 'Continuar aventura',
            description: hasSessions ? 'Retome instantaneamente a crônica mais recente.' : 'Crie um herói antes de continuar.',
            icon: BookOpen,
            gradient: 'from-amber-500/20 via-amber-300/5 to-transparent',
            accent: 'text-amber-300',
            disabled: !hasSessions,
            action: () => {
                if (featuredSession) {
                    onContinueGame(featuredSession.id);
                } else {
                    onSetStage('session_list');
                }
            },
            cta: hasSessions ? 'Retomar agora' : 'Escolher crônica'
        },
        {
            title: 'Nova jornada',
            description: 'Clone um herói e gere um cenário inédito em segundos.',
            icon: Sword,
            gradient: 'from-emerald-500/15 via-emerald-300/5 to-transparent',
            accent: 'text-emerald-300',
            action: () => onSetStage('character_vault'),
            cta: 'Abrir cofre'
        },
        {
            title: 'Oficina homebrew',
            description: 'Gerencie criaturas, itens e pacotes personalizados.',
            icon: FlaskConical,
            gradient: 'from-purple-500/20 via-purple-300/5 to-transparent',
            accent: 'text-purple-300',
            action: () => onSetStage('homebrew_store'),
            cta: 'Entrar'
        },
    ];

    if (gameStage === 'playing' && !character) {
        return <PremiumLoader onCancel={onReturnToMenu} />;
    }

    if (gameStage === 'playing' && character) {
        return (
            <Game
                onCharacterCreated={onCharacterCreated}
                returnToMenu={onReturnToMenu}
                gameStage={gameStage}
            />
        );
    }

    if ((gameStage === 'loading' || isLoadingData) && gameStage !== 'playing') {
        return (
            <PremiumLoader
                title="Abrindo o salão principal"
                subtitle="Sincronizando personagens, crônicas e trilhas sonoras."
                description="Buscando cofres, sessões salvas e recursos premium..."
                actionLabel="Voltar ao menu"
                onAction={() => onSetStage('main_menu')}
            />
        );
    }

    if (gameStage === 'session_list') {
        return (
            <>
                <TooltipProvider>
                    <div className="relative isolate min-h-full w-full overflow-y-auto bg-[#030812]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),transparent_60%)]" />
                        <div className="absolute -bottom-32 right-0 h-96 w-96 bg-emerald-500/20 blur-[160px]" />
                        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 md:py-16">
                            <header className="space-y-3 text-center sm:text-left">
                                <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Continuar</p>
                                <h1 className="text-4xl font-semibold text-white">Retome uma crônica</h1>
                                <p className="text-sm text-stone-400">
                                    Todas as sessões ficam guardadas aqui. Continue do ponto exato onde parou.
                                </p>
                            </header>

                            <div className="grid gap-4">
                                {sessions.length > 0 ? (
                                    sessions.map(session => {
                                        const updatedDate = new Date(session.updatedAt).toLocaleDateString();
                                        return (
                                            <article
                                                key={session.id}
                                                className="relative rounded-3xl border border-white/5 bg-white/5 p-5 backdrop-blur-md shadow-xl"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex-grow">
                                                        <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Sessão</p>
                                                        <h2 className="text-2xl font-semibold text-white">{session.nome}</h2>
                                                        <p className="text-sm text-stone-300">
                                                            Herói: {session.character?.name} — Último acesso em {updatedDate}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => onContinueGame(session.id)}
                                                            className="inline-flex items-center gap-2 rounded-full bg-amber-400/90 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-amber-300 transition"
                                                        >
                                                            <Play className="h-4 w-4" /> Retomar
                                                        </button>
                                                        <button
                                                            onClick={() => openSessionActionModal(session)}
                                                            className="rounded-full border border-white/20 p-2 text-stone-200 hover:text-amber-200"
                                                        >
                                                            <MoreVertical className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-stone-300">
                                        <p className="text-sm">Nenhuma aventura em andamento. Crie um herói e inicie o primeiro capítulo.</p>
                                        <button
                                            onClick={() => onSetStage('character_vault')}
                                            className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition"
                                        >
                                            <Plus className="h-4 w-4" /> Abrir cofres
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap justify-between gap-3">
                                <button
                                    onClick={() => onSetStage('main_menu')}
                                    className="inline-flex items-center gap-2 text-sm text-stone-300 hover:text-amber-200 transition"
                                >
                                    <ArrowLeft className="h-4 w-4" /> Voltar ao menu premium
                                </button>
                                <button
                                    onClick={() => onSetStage('character_vault')}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-amber-200/60 transition"
                                >
                                    <User className="h-4 w-4" /> Cofre de heróis
                                </button>
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
                {isActionModalOpen && selectedSessionForAction && (
                    <ActionModal
                        isOpen={isActionModalOpen}
                        title={`Ações para "${selectedSessionForAction.nome}"`}
                        onClose={handleActionModalClose}
                        actions={[
                            { text: "Renomear", onClick: () => { onRequestRenameSession(selectedSessionForAction); handleActionModalClose(); }, variant: 'secondary', icon: <Edit className="h-4 w-4"/> },
                            { text: "Clonar", onClick: () => { onRequestCloneSession(selectedSessionForAction); handleActionModalClose(); }, variant: 'secondary', icon: <Copy className="h-4 w-4"/> },
                            { text: "Excluir", onClick: () => { onRequestDeleteSession(selectedSessionForAction); handleActionModalClose(); }, variant: 'destructive', icon: <Trash2 className="h-4 w-4"/> },
                        ]}
                    >
                       <p className="text-stone-300">Escolha uma ação de gerenciamento para esta sessão. Tenha cuidado, pois algumas ações não podem ser desfeitas.</p>
                    </ActionModal>
                )}
            </>
        );
    }

    if (gameStage === 'character_vault') {
        const vaultStats = [
            { label: 'Heróis forjados', value: characters.length || '0' },
            {
                label: 'Última atualização',
                value: characters[0]?.updatedAt ? new Date(characters[0].updatedAt).toLocaleDateString() : '--/--',
            },
            { label: 'Sessões salvas', value: sessions.length || '0' },
        ];

        return (
            <div className="relative isolate min-h-full w-full overflow-y-auto bg-[#04070f]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),transparent_60%)]" />
                <div className="absolute -top-32 right-0 h-96 w-96 bg-rose-500/20 blur-[180px]" />
                <div className="absolute bottom-0 left-0 h-72 w-72 bg-emerald-500/15 blur-[160px]" />

                <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 md:py-16">
                    <header className="flex flex-col gap-4 text-center sm:text-left">
                        <div className="inline-flex items-center gap-2 self-center rounded-full border border-amber-400/40 px-4 py-1 text-[11px] uppercase tracking-[0.4em] text-amber-200 sm:self-start">
                            Cofre de Heróis
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-4xl font-semibold text-white sm:text-5xl">Escolha o protagonista da próxima saga</h1>
                            <p className="text-sm text-stone-400">
                                Reviva crônicas antigas ou crie um herói inédito para desbloquear narrativas exclusivas com IA.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                            <button
                                onClick={() => onSetStage('creating_character')}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400/90 px-5 py-3 text-sm font-semibold text-stone-900 hover:bg-amber-300 transition"
                            >
                                <Plus className="h-4 w-4" /> Criar novo herói
                            </button>
                            <button
                                onClick={() => onSetStage('main_menu')}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-stone-100 hover:border-amber-200/60 transition"
                            >
                                <ArrowLeft className="h-4 w-4" /> Voltar ao menu
                            </button>
                        </div>
                    </header>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {characters.map(char => (
                            <article key={char.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-xl">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.25em] text-amber-200">Herói</p>
                                        <h2 className="text-2xl font-semibold text-white">{char.name}</h2>
                                        <p className="text-sm text-stone-300">{char.race} — Nível {char.level}</p>
                                    </div>
                                    <button
                                        onClick={() => onRequestDeleteCharacter(char)}
                                        className="rounded-full border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10 transition"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-400">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
                                        <Shield className="h-3 w-3" /> CA {char.ac?.value ?? 10}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
                                        <Crown className="h-3 w-3" /> Classe {char.characterClass}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
                                        <Sparkles className="h-3 w-3" /> Última atualização {new Date(char.updatedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        onClick={() => onStartFromVault(char)}
                                        className="inline-flex items-center gap-2 rounded-full bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-emerald-300 transition"
                                    >
                                        <Play className="h-4 w-4" /> Iniciar jornada
                                    </button>
                                    <button
                                        onClick={() => onSetStage('session_list')}
                                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-emerald-200/40 transition"
                                    >
                                        <BookOpen className="h-4 w-4" /> Ver sessões
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>

                    {characters.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-stone-300">
                            <p className="text-sm">Nenhum herói registrado ainda. Clique em “Criar novo herói” para começar.</p>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-3">
                        {vaultStats.map(stat => (
                            <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/5 p-4 text-center">
                                <p className="text-xs uppercase tracking-wide text-stone-400">{stat.label}</p>
                                <p className="text-2xl font-semibold text-white mt-1">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if(gameStage === 'creating_character') {
        return (
            <Game
                onCharacterCreated={onCharacterCreated}
                returnToMenu={onReturnToMenu}
                gameStage={gameStage}
            />
        );
    }

    if (gameStage === 'homebrew_store') {
        return <HomebrewStore returnToMenu={() => onSetStage('main_menu')} />;
    }

    if (gameStage === 'translation_studio') {
        return <TranslationStudio onCancel={() => onSetStage('main_menu')} />;
    }

    // Default: main menu
    return (
        <div className="relative min-h-full flex flex-col overflow-x-hidden overflow-y-auto bg-[#02060d]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_55%)]" />
            <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent blur-3xl" />
            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-12 flex flex-col flex-grow gap-12 min-w-0">
                <div className="space-y-6 md:hidden">
                    <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-300">Mestre virtual</p>
                        <h1 className="text-3xl font-bold text-white font-serif leading-tight">Crônicas de Aventuras</h1>
                        <p className="text-stone-300 text-sm leading-relaxed">
                            Campanhas cinematográficas, combate estratégico e gerenciamento automatizado em um hub premium.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {heroMetrics.map(metric => (
                            <div key={metric.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-wide text-stone-400">{metric.label}</p>
                                <p className="text-2xl font-semibold text-white mt-1">{metric.value}</p>
                                <p className="text-[11px] text-stone-500">{metric.detail}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur-md shadow-xl space-y-3">
                        {featuredSession ? (
                            <>
                                <div className="space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-amber-200">Última crônica</p>
                                    <h3 className="text-xl font-semibold text-white">{featuredSession.nome}</h3>
                                    <p className="text-sm text-stone-300">Herói: {featuredSession.character?.name}</p>
                                    <p className="text-[11px] uppercase tracking-wide text-stone-500">Atualizado em {new Date(featuredSession.updatedAt).toLocaleDateString()}</p>

                                    {featuredSessionFacts?.storySummary && (
                                        <div className="pt-3 border-t border-white/10">
                                            <p className={cn("text-sm text-stone-300 transition-all duration-300", !isSummaryExpanded && "line-clamp-3")}>
                                                {featuredSessionFacts.storySummary}
                                            </p>
                                            <button onClick={() => setIsSummaryExpanded(!isSummaryExpanded)} className="text-xs font-semibold text-amber-300 hover:text-amber-200 mt-2">
                                                {isSummaryExpanded ? 'Mostrar menos' : 'Mostrar mais'}
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-stone-400">
                                        {featuredSession?.character?.worldState?.currentRegion && (
                                            <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {featuredSession.character.worldState.currentRegion}</span>
                                        )}
                                        {featuredSession?.character?.worldState?.timeOfDay && (
                                            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {featuredSession.character.worldState.timeOfDay}</span>
                                        )}
                                        {featuredSession?.character?.worldState?.weather && (
                                            <span className="flex items-center gap-1.5"><CloudSun className="h-3 w-3" /> {featuredSession.character.worldState.weather}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => onContinueGame(featuredSession.id)}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400/90 px-4 py-3 text-base font-semibold text-stone-900 hover:bg-amber-300 transition-colors"
                                    >
                                        <Sparkles className="h-5 w-5" /> Retomar agora
                                    </button>
                                    <button
                                        onClick={() => onSetStage('session_list')}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-base font-semibold text-stone-100 hover:border-amber-200/60 transition-colors"
                                    >
                                        <BookOpen className="h-5 w-5" /> Ver crônicas
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2 text-stone-300">
                                <p className="text-xs uppercase tracking-wide text-stone-500">Sem sessões recentes</p>
                                <h3 className="text-xl font-semibold text-white">Inicie sua primeira mesa</h3>
                                <p className="text-sm text-stone-400">Crie um herói no Cofre e gere um capítulo totalmente novo com a IA.</p>
                                <button
                                    onClick={() => onSetStage('character_vault')}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400/90 px-4 py-3 text-base font-semibold text-stone-900 hover:bg-amber-300 transition-colors"
                                >
                                    <Plus className="h-5 w-5" /> Criar herói
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-md">
                        <header className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.35em] text-stone-400">Ações rápidas</p>
                            <h2 className="text-xl font-semibold text-white">Selecione o próximo ritual</h2>
                        </header>
                        <div className="space-y-3">
                            {menuActions.map((action) => (
                                <button
                                    key={action.title}
                                    onClick={() => !action.disabled && action.action()}
                                    disabled={action.disabled}
                                    className={cn(
                                        'w-full rounded-2xl border border-white/5 bg-white/5 p-4 text-left transition hover:border-amber-200/50 disabled:cursor-not-allowed disabled:opacity-60',
                                        action.gradient
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={cn('rounded-full border border-white/10 bg-black/30 p-2', action.accent)}>
                                            <action.icon className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-semibold text-white">{action.title}</h3>
                                    </div>
                                    <p className="mt-2 text-sm text-stone-300">{action.description}</p>
                                    {action.cta && <span className="mt-3 inline-flex text-sm font-semibold text-amber-200">{action.cta}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <section className="hidden md:grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-stretch">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Hub Cinemático</p>
                            <div className="flex items-center gap-3">
                                <div className="rounded-full border border-white/10 bg-white/5 p-3">
                                    <Crown className="h-6 w-6 text-amber-300" />
                                </div>
                                <div>
                                    <h1 className="text-5xl font-semibold text-white font-serif">Crônicas de Aventuras</h1>
                                    <p className="text-stone-300 text-sm">Campanhas premium com automação inteligente.</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {heroMetrics.map(metric => (
                                <div key={metric.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-stone-400">{metric.label}</p>
                                    <p className="text-3xl font-semibold text-white mt-1">{metric.value}</p>
                                    <p className="text-[11px] text-stone-500">{metric.detail}</p>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/10 to-transparent p-6 shadow-2xl backdrop-blur-md">
                            <div className="flex flex-col gap-3">
                                <p className="text-xs uppercase tracking-[0.35em] text-stone-400">Sessão destaque</p>
                                {featuredSession ? (
                                    <>
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm text-stone-300">Agora com {featuredSession.character?.name}</p>
                                                <h3 className="text-2xl font-semibold text-white">{featuredSession.nome}</h3>
                                                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Atualizado em {new Date(featuredSession.updatedAt).toLocaleDateString()}</p>
                                            </div>
                                            <button
                                                onClick={() => onContinueGame(featuredSession.id)}
                                                className="inline-flex items-center gap-2 rounded-full bg-amber-400/90 px-5 py-3 text-sm font-semibold text-stone-900 hover:bg-amber-300 transition"
                                            >
                                                <Sparkles className="h-4 w-4" /> Retomar agora
                                            </button>
                                        </div>
                                        {featuredSessionFacts?.storySummary && (
                                            <div className="space-y-2 border-t border-white/10 pt-3">
                                                <p className={cn("text-sm text-stone-300 transition-all duration-300", !isSummaryExpanded && "line-clamp-3")}>
                                                    {featuredSessionFacts.storySummary}
                                                </p>
                                                <button onClick={() => setIsSummaryExpanded(!isSummaryExpanded)} className="text-xs font-semibold text-amber-300 hover:text-amber-200">
                                                    {isSummaryExpanded ? 'Mostrar menos' : 'Mostrar mais'}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="space-y-2 text-stone-300">
                                        <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Sem sessões recentes</p>
                                        <h3 className="text-xl font-semibold text-white">Crie sua primeira saga</h3>
                                        <p className="text-sm text-stone-400">Clone um personagem favorito ou comece do zero com a IA guiando.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6 shadow-2xl backdrop-blur-md">
                        <header className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.35em] text-stone-400">Ações rápidas</p>
                            <h2 className="text-2xl font-semibold text-white">Selecione o próximo ritual</h2>
                        </header>
                        <div className="grid gap-4">
                            {menuActions.map((action, idx) => (
                                <button
                                    key={action.title}
                                    onClick={() => !action.disabled && action.action()}
                                    disabled={action.disabled}
                                    className={cn(
                                        'relative flex flex-col items-start gap-2 rounded-2xl border border-white/5 bg-white/5 p-5 text-left transition hover:border-amber-200/50 disabled:opacity-60 disabled:cursor-not-allowed',
                                        action.gradient
                                    )}
                                >
                                    <div className={cn('rounded-full border border-white/10 bg-black/30 p-2', action.accent)}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{action.title}</h3>
                                        <p className="text-sm text-stone-300">{action.description}</p>
                                    </div>
                                    {action.cta && (
                                        <span className="text-sm font-semibold text-amber-200 mt-auto">{action.cta}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </aside>
                </section>

                <footer className="w-full rounded-3xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm mt-auto">
                    <div className="flex flex-wrap gap-3 justify-between">
                        <button
                            onClick={onOpenSettings}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                        >
                            <Settings className="h-4 w-4" /> Configurações
                        </button>
                        <button
                            onClick={onOpenArchitecture}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                        >
                            <GitMerge className="h-4 w-4" /> Arquitetura
                        </button>
                        <button
                            onClick={onOpenSystemTests}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                        >
                            <Beaker className="h-4 w-4" /> Testes
                        </button>
                        {user?.id === 1 && (
                            <button
                                onClick={() => onSetStage('translation_studio')}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                            >
                                <Languages className="h-4 w-4" /> Traduções
                            </button>
                        )}
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-red-300 hover:border-red-400 transition-colors"
                        >
                            <LogOut className="h-4 w-4" /> Sair
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default GameMenuContent;
