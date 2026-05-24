// src/components/NewNarrativeLog.tsx
'use client';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { Dice5 } from 'lucide-react';
import { Button } from './ui/button';
import type { LogEntry as LogEntryType, ImageLogEntryContent } from '../types';
import { Swords, Wand, HeartPulse, Hand, Dice5, ChevronsRight, Sparkles, BrainCircuit, Volume2, Loader2, Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { useNarrationSpeech } from '@/hooks/useNarrationSpeech';
import { useToast } from '@/hooks/use-toast';
import { generateNarrationAudio, getSignedNarrationAudio } from '@/services/ttsService';
import { generateSceneImage, getSignedImageUrl } from '@/services/imageService';
import { useSettingsContext } from '@/contexts/SettingsContext';
import clsx from 'clsx';

const IMAGE_FEATURE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === 'true';

const extractEntryText = (value: any): string | null => {
    if (typeof value === 'string') {
        if (!value.trim()) return null;
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
                if (typeof parsed.content === 'string') return parsed.content;
                if (typeof parsed.text === 'string') return parsed.text;
            }
        } catch {
            // plain string
        }
        return value;
    }
    if (value && typeof value === 'object') {
        if (typeof value.content === 'string') return value.content;
        if (typeof value.text === 'string') return value.text;
    }
    return null;
};

const NARRATABLE_TYPES: LogEntryType['type'][] = ['narration', 'system', 'combat', 'insight', 'roll'];

const isNarratableEntry = (entry?: LogEntryType | null) =>
    Boolean(entry && NARRATABLE_TYPES.includes(entry.type));

const getEntryAudioUrl = (entry: LogEntryType, cache?: Record<string, string>): string | undefined => {
    if (entry.audioUrl) return entry.audioUrl;
    if (entry.content && typeof entry.content === 'object' && entry.content.audioUrl) {
        return entry.content.audioUrl;
    }
    if (cache) return cache[entry.id];
    return undefined;
};

const getEntryAudioKey = (entry: LogEntryType): string | undefined => {
    if (entry.audioKey) return entry.audioKey;
    if (entry.content && typeof entry.content === 'object' && entry.content.audioKey) {
        return entry.content.audioKey;
    }
    return undefined;
};

const NarrationEntry: React.FC<{
  entry: LogEntryType;
  onPlayAudio?: (entry: LogEntryType) => void;
  onGenerateAudio?: (entry: LogEntryType) => void;
  isGenerating?: boolean;
  prefix?: React.ReactNode;
  textClassName?: string;
}> = ({ entry, onPlayAudio, onGenerateAudio, isGenerating, prefix, textClassName }) => {
    const textContent = extractEntryText(entry.content);
    if (!textContent) return null;
    const audioUrl = getEntryAudioUrl(entry);
    const hasAudio = Boolean(audioUrl || getEntryAudioKey(entry));
    return (
        <div className="flex items-start gap-2">
            {prefix ? <div className="flex-shrink-0 pt-1">{prefix}</div> : null}
            <p className={clsx("text-stone-300 leading-relaxed flex-grow font-sans", textClassName)}>
                {textContent}
            </p>
            {hasAudio ? (
              <button
                type="button"
                onClick={() => {
                    void onPlayAudio?.(entry);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-stone-200 hover:text-amber-200 hover:border-amber-300/60 transition"
                title="Ouvir esta narração"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            ) : (
              onGenerateAudio && (
                <button
                  type="button"
                  onClick={() => onGenerateAudio(entry)}
                  disabled={isGenerating}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-stone-200 hover:text-amber-200 hover:border-amber-300/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Gerar áudio para esta narração"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )
            )}
        </div>
    );
};


const RollEntry: React.FC<{ entry: LogEntryType }> = ({ entry }) => {
    if (!entry.rollResult) return null;
    const { description, dice, total, modifier, success, advantage, disadvantage, rolls, rollType, dc } = entry.rollResult;
    
    const isDamageRoll = rollType === 'damage';

    const palette = (() => {
        if (isDamageRoll) {
            return {
                badge: 'bg-rose-500/20 text-rose-200 border border-rose-300/30',
                border: 'border-rose-400/30',
                gradient: 'from-rose-900/50 via-rose-900/20 to-transparent',
                accent: 'text-rose-300'
            };
        }
        if (success === true) {
            return {
                badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-300/30',
                border: 'border-emerald-400/30',
                gradient: 'from-emerald-900/45 via-emerald-900/15 to-transparent',
                accent: 'text-emerald-300'
            };
        }
        if (success === false) {
            return {
                badge: 'bg-red-500/15 text-red-200 border border-red-300/30',
                border: 'border-red-400/30',
                gradient: 'from-red-900/45 via-red-900/15 to-transparent',
                accent: 'text-red-300'
            };
        }
        return {
            badge: 'bg-cyan-500/15 text-cyan-200 border border-cyan-300/30',
            border: 'border-cyan-400/30',
            gradient: 'from-slate-900/50 via-slate-900/15 to-transparent',
            accent: 'text-cyan-300'
        };
    })();

    const outcomeText = isDamageRoll
        ? `${total} de Dano`
        : success === true
            ? 'Sucesso'
            : success === false
                ? 'Falha'
                : 'Resultado';

    const advantageText = advantage ? "Vantagem" : disadvantage ? "Desvantagem" : null;
    const rollsText = rolls?.join(', ') || total - (modifier || 0);

    return (
         <div className={`relative overflow-hidden rounded-2xl border ${palette.border} bg-black/40 p-4 text-sm shadow-lg`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${palette.gradient} opacity-80 pointer-events-none`} />
            <div className="relative space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-stone-400">
                    <span className={`px-2 py-0.5 rounded-full ${palette.badge} font-semibold flex items-center gap-1`}>
                        <Dice5 className="h-3.5 w-3.5" /> {outcomeText}
                    </span>
                    {advantageText && (
                        <span className="px-2 py-0.5 rounded-full border border-white/10 text-stone-200">
                            {advantageText}
                        </span>
                    )}
                    {typeof dc === 'number' && (
                        <span className="px-2 py-0.5 rounded-full border border-white/10 text-stone-200">
                            CD {dc}
                        </span>
                    )}
                </div>
                <p className={`font-semibold text-base ${palette.accent}`}>{description}</p>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-3 font-mono text-stone-200">
                    <p>
                        {dice} ({rollsText}) {modifier ? (modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier || 0)}`) : ''} ={' '}
                        <span className="text-2xl font-bold">{total}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

const getActionIcon = (content: string) => {
    if (typeof content !== 'string') {
        return <ChevronsRight className="text-amber-400 font-bold h-4 w-4" aria-hidden="true" />;
    }
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('conjuro') || lowerContent.includes('magia')) {
        return <Wand className="h-4 w-4 text-purple-400" title="Ação de Magia" />;
    }
    if (lowerContent.includes('ataco') || lowerContent.includes('ataque') || lowerContent.includes('lutar')) {
        return <Swords className="h-4 w-4 text-red-400" title="Ação de Combate" />;
    }
    if (lowerContent.includes('descanso')) {
        return <HeartPulse className="h-4 w-4 text-blue-400" title="Ação de Descanso" />;
    }
    if (lowerContent.includes('pego') || lowerContent.includes('saio') || lowerContent.includes('converso') || lowerContent.includes('examinar') || lowerContent.includes('abro')) {
        return <Hand className="h-4 w-4 text-green-400" title="Ação de Interação" />;
    }
    if (lowerContent.includes('tento usar') || lowerContent.includes('uso') || lowerContent.includes('perícia')) {
        return <Dice5 className="h-4 w-4 text-cyan-400" title="Ação de Perícia" />;
    }
    if (lowerContent.includes('rolagem')) {
        return <Dice5 className="h-4 w-4 text-cyan-400" title="Rolagem de Dados" />;
    }

    return <ChevronsRight className="text-amber-400 font-bold h-4 w-4" aria-hidden="true" />;
};

const ImageEntry: React.FC<{
    entry: LogEntryType;
    onGenerateImage?: (entry: LogEntryType) => void;
    onRefreshImage?: (entry: LogEntryType) => void;
    isLoading?: boolean;
}> = ({ entry, onGenerateImage, onRefreshImage, isLoading }) => {
    if (entry.type !== 'image' || !entry.content || typeof entry.content !== 'object') return null;
    const content = entry.content as ImageLogEntryContent;
    const hasPrompt = Boolean(content.prompt && content.prompt.trim().length);
    const promptText = content.prompt ?? 'Cena sugerida pelo mestre.';
    const imageUrl = content.imageUrl ?? content.url;
    const status = content.status;
    const showImage = status === 'done' && Boolean(imageUrl);
    const canRefresh = Boolean(content.imageKey && onRefreshImage);
    const canGenerate = Boolean(onGenerateImage && hasPrompt);

    const statusBadge = (() => {
        switch (status) {
            case 'generating':
                return (
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-200">
                        Falhou
                    </span>
                );
            case 'done':
                return (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                        Concluída
                    </span>
                );
            default:
                return null;
        }
    })();

    return (
        <div className="rounded-2xl border border-white/10 bg-stone-950/70 p-4 space-y-4 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-400">
                        <ImageIcon className="h-4 w-4" />
                        Visual da Cena
                        {statusBadge}
                    </div>
                    <p className="text-sm text-stone-300">{promptText}</p>
                </div>
                <div className="flex gap-2">
                    {canGenerate && (
                        <button
                            type="button"
                            disabled={isLoading || status === 'generating'}
                            onClick={() => onGenerateImage?.(entry)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-stone-100 transition hover:border-amber-300/60 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Solicitar uma nova imagem para esta cena"
                        >
                            {isLoading && status === 'generating' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {status === 'done' ? 'Gerar novamente' : 'Gerar imagem'}
                        </button>
                    )}
                    {canRefresh && (
                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => onRefreshImage?.(entry)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-stone-100 transition hover:border-cyan-300/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Atualizar a URL assinada desta imagem"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                            Atualizar link
                        </button>
                    )}
                </div>
            </div>
            {status === 'failed' && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-200">
                    {content.error ?? 'Falha ao gerar a imagem.'}
                </div>
            )}
            {status === 'generating' && (
                <div className="flex items-center gap-2 text-sm text-amber-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando imagem com o Gemini...
                </div>
            )}
            {showImage && imageUrl && (
                <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-white/10 bg-black/60"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={promptText} className="w-full object-cover" loading="lazy" />
                </a>
            )}
            {status === 'done' && !imageUrl && (
                <p className="text-sm text-stone-400">
                    A URL temporária desta imagem expirou. Clique em &quot;Atualizar link&quot; para gerar outra.
                </p>
            )}
            {content.completedAt && (
                <p className="text-xs text-stone-500">
                    Gerado em {new Date(content.completedAt).toLocaleString()}
                </p>
            )}
        </div>
    );
};


const LogEntry = React.memo(function LogEntry({
    entry,
    onPlayAudio,
    onGenerateAudio,
    isGenerating,
    onGenerateImage,
    onRefreshImage,
    isImageLoading,
}: {
    entry: LogEntryType;
    onPlayAudio?: (entry: LogEntryType) => void;
    onGenerateAudio?: (entry: LogEntryType) => void;
    isGenerating?: boolean;
    onGenerateImage?: (entry: LogEntryType) => void;
    onRefreshImage?: (entry: LogEntryType) => void;
    isImageLoading?: boolean;
}) {
    let contentComponent;

    // Ação interna do sistema, não deve ser renderizada.
    if (entry.type === 'action' && typeof entry.content === 'string' && (entry.content.startsWith("Recarregar estado atual") || entry.content.startsWith("A aventura começa.") || entry.content.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades"))) {
        return null;
    }

    switch(entry.type) {
        case 'narration':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                />
            );
            break;
        case 'action': {
             const actionText = extractEntryText(entry.content);
             if (actionText && actionText.trim()) {
                 contentComponent = (
                    <div className="flex items-start gap-3 my-4 py-3 border-y-2 border-stone-700/50">
                        <div className="flex-shrink-0 pt-1">{getActionIcon(actionText)}</div>
                        <p className="text-amber-400 font-semibold">{actionText}</p>
                    </div>
                );
             } else {
                 contentComponent = null;
             }
            break;
        }
        case 'roll':
            contentComponent = <RollEntry entry={entry} />;
            break;
        case 'system':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    prefix={<Sparkles className="h-4 w-4 text-yellow-500/80" />}
                    textClassName="text-yellow-500/80 italic"
                />
            );
            break;
        case 'combat':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    prefix={<Swords className="h-4 w-4 text-red-400" />}
                    textClassName="text-red-300 font-semibold"
                />
            );
            break;
        case 'insight':
            contentComponent = (
                <NarrationEntry
                    entry={entry}
                    onPlayAudio={onPlayAudio}
                    onGenerateAudio={onGenerateAudio}
                    isGenerating={isGenerating}
                    prefix={<BrainCircuit className="h-4 w-4 text-purple-300" />}
                    textClassName="text-purple-200 italic"
                />
            );
            break;
        case 'image':
            contentComponent = (
                <ImageEntry
                    entry={entry}
                    onGenerateImage={onGenerateImage}
                    onRefreshImage={onRefreshImage}
                    isLoading={isImageLoading}
                />
            );
            break;
        default:
             contentComponent = null;
    }
    
    if(contentComponent === null) return null;

    const stateVersionBadge = typeof entry.stateVersion === 'number'
        ? (
            <span className="pointer-events-none absolute -bottom-1 left-0 text-[9px] uppercase tracking-[0.4em] text-stone-500/60">
                v{entry.stateVersion}
            </span>
        )
        : null;

    return (
        <div className="relative animate-fadeIn pb-4" style={{ animationDuration: '500ms' }}>
            {contentComponent}
            {stateVersionBadge}
        </div>
    );
});


const NpcRollDisplay: React.FC = () => {
    const { combatState, character } = useGameStateContext();

    const initiativeString = React.useMemo(() => {
        if (!combatState.isActive || !combatState.initiativeOrder || combatState.initiativeOrder.length === 0) return null;

        const order = combatState.initiativeOrder.map(entry => {
            const id = typeof entry === 'object' ? (entry as any).id : entry as string;
            const combatant = combatState.combatants.find(c => c.id === id || c.name === id);
            const name = combatant?.name || (id === character?.name ? character.name : id);
            const initiative = typeof entry === 'object' ? (entry as any).initiative : combatant?.initiative;
            return `${name} (${initiative ?? '?'})`;
        }).join(', ');

        return `A ordem de iniciativa é: ${order}.`;
    }, [combatState, character]);
    
    if (!combatState.isActive || !initiativeString) return null;
    
    return (
        <div className="bg-stone-900/60 p-3 my-2 rounded-md border border-stone-700 text-sm font-semibold">
            <p className="text-stone-300 font-mono">{initiativeString}</p>
        </div>
    );
};

const PendingRollBanner: React.FC = () => {
    const { isRollPending, playerRollRequest, actionPhaseLabel } = useGameStateContext();
    if (!isRollPending || !playerRollRequest) return null;

    const reason = playerRollRequest.reason || playerRollRequest.skillName || 'Teste pendente';

    return (
        <div className="sticky top-0 z-10 mb-4 rounded-lg border border-amber-500/50 bg-amber-950/80 px-4 py-3 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-amber-100">
                    <Dice5 className="h-5 w-5 shrink-0 mt-0.5 text-amber-300" />
                    <div>
                        <p className="font-semibold text-sm">Rolagem pendente</p>
                        <p className="text-xs text-amber-200/90 mt-0.5">{reason}</p>
                        {actionPhaseLabel && (
                            <p className="text-xs text-amber-300/70 mt-1">{actionPhaseLabel}</p>
                        )}
                    </div>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 border-amber-400/40 bg-amber-900/60 text-amber-50 hover:bg-amber-800"
                    onClick={() => window.dispatchEvent(new CustomEvent('game-focus-roll-modal'))}
                >
                    Abrir dados
                </Button>
            </div>
        </div>
    );
};

const NewNarrativeLog: React.FC = () => {
    const { log, setLog } = useGameStateContext();
    const { apiKey } = useSettingsContext();
    const logEndRef = useRef<HTMLDivElement>(null);
    const lastSpokenIdRef = useRef<string | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [generatingEntries, setGeneratingEntries] = useState<Record<string, boolean>>({});
    const [imageLoadingEntries, setImageLoadingEntries] = useState<Record<string, boolean>>({});
    const [audioUrlCache, setAudioUrlCache] = useState<Record<string, string>>({});
    const { autoSpeak } = useNarrationSpeech();
    const { toast } = useToast();

    const setEntryGenerating = useCallback((entryId: string, value: boolean) => {
        setGeneratingEntries(prev => {
            if (prev[entryId] === value) return prev;
            if (value) {
                return { ...prev, [entryId]: true };
            }
            const next = { ...prev };
            delete next[entryId];
            return next;
        });
    }, []);

    const setImageEntryLoading = useCallback((entryId: string, value: boolean) => {
        setImageLoadingEntries(prev => {
            if (value) {
                return { ...prev, [entryId]: true };
            }
            const next = { ...prev };
            delete next[entryId];
            return next;
        });
    }, []);

    const updateImageEntry = useCallback(
        (entryId: string, patch: Partial<ImageLogEntryContent>) => {
            setLog(prev =>
                prev.map(logEntry => {
                    if (logEntry.id !== entryId || logEntry.type !== 'image') return logEntry;
                    if (!logEntry.content || typeof logEntry.content !== 'object') return logEntry;
                    const nextContent: ImageLogEntryContent = {
                        ...(logEntry.content as ImageLogEntryContent),
                        ...patch,
                    };
                    return { ...logEntry, content: nextContent };
                })
            );
        },
        [setLog]
    );

    const updateEntryAudio = useCallback(
        (entryId: string, audioUrl: string, fallbackText: string, audioKey?: string) => {
            setLog(prev =>
                prev.map(logEntry => {
                    if (logEntry.id !== entryId) return logEntry;
                    const nextContent =
                        typeof logEntry.content === 'string'
                            ? { content: logEntry.content, audioUrl, audioKey: audioKey ?? getEntryAudioKey(logEntry) }
                            : logEntry.content && typeof logEntry.content === 'object'
                            ? { ...logEntry.content, audioUrl, audioKey: audioKey ?? (logEntry.content as any).audioKey }
                            : { content: fallbackText, audioUrl, audioKey };
                    return { ...logEntry, audioUrl, audioKey: audioKey ?? logEntry.audioKey, content: nextContent };
                })
            );
            setAudioUrlCache(prev => ({ ...prev, [entryId]: audioUrl }));
        },
        [setLog]
    );

    const requestEntryAudio = useCallback(
        async (entry: LogEntryType, { silent = false }: { silent?: boolean } = {}) => {
            if (!entry?.id || !isNarratableEntry(entry)) return null;
            const textContent = extractEntryText(entry.content);
            if (!textContent) {
                if (!silent) {
                    toast({
                        variant: 'destructive',
                        description: 'Não foi possível encontrar texto para sintetizar.',
                    });
                }
                return null;
            }
            if (!silent) {
                setEntryGenerating(entry.id, true);
            }
            try {
                const { audioUrl, audioKey } = await generateNarrationAudio(textContent);
                if (!audioUrl || !audioKey) {
                    throw new Error('Resposta sem URL de áudio');
                }
                updateEntryAudio(entry.id, audioUrl, textContent, audioKey);
                (entry as any).audioUrl = audioUrl;
                (entry as any).audioKey = audioKey;
                if (entry.content && typeof entry.content === 'object') {
                    (entry.content as any).audioUrl = audioUrl;
                    (entry.content as any).audioKey = audioKey;
                }
                if (!silent) {
                    toast({ description: 'Áudio gerado com sucesso.' });
                }
                return audioUrl;
            } catch (error) {
                console.error('[NewNarrativeLog] Falha ao gerar áudio de narração:', error);
                if (!silent) {
                    toast({
                        variant: 'destructive',
                        description: 'Não foi possível gerar o áudio agora. Tente novamente em instantes.',
                    });
                }
                return null;
            } finally {
                if (!silent) {
                    setEntryGenerating(entry.id, false);
                }
            }
        },
        [toast, setEntryGenerating, updateEntryAudio]
    );

    const fetchSignedAudioUrl = useCallback(
        async (entry: LogEntryType) => {
            const audioKey = getEntryAudioKey(entry);
            if (!audioKey) return null;
            if (audioUrlCache[entry.id]) return audioUrlCache[entry.id];
            try {
                const { audioUrl } = await getSignedNarrationAudio(audioKey);
                if (audioUrl) {
                    updateEntryAudio(entry.id, audioUrl, extractEntryText(entry.content) ?? '', audioKey);
                    return audioUrl;
                }
            } catch (error) {
                console.error('[NewNarrativeLog] Falha ao obter URL assinada de áudio:', error);
            }
            return null;
        },
        [audioUrlCache, updateEntryAudio]
    );

    const ensurePlayableAudio = useCallback(
        async (entry: LogEntryType, opts: { silent?: boolean } = {}) => {
            const audioKey = getEntryAudioKey(entry);
            const existingUrl = getEntryAudioUrl(entry, audioUrlCache);

            if (audioKey) {
                if (existingUrl) return existingUrl;
                return fetchSignedAudioUrl(entry);
            }

            // Sem audioKey: re-sintetiza para garantir URL fresca
            const regeneratedUrl = await requestEntryAudio(entry, { silent: opts.silent ?? true });
            if (regeneratedUrl) return regeneratedUrl;

            return existingUrl ?? null;
        },
        [audioUrlCache, fetchSignedAudioUrl, requestEntryAudio]
    );

    const ensureAudioForEntries = useCallback(
        async (entries: LogEntryType[]) => {
            for (const entry of entries) {
                if (!entry?.id || !isNarratableEntry(entry)) continue;
                const hasUrl = getEntryAudioUrl(entry, audioUrlCache);
                if (hasUrl) continue;
                if (!getEntryAudioKey(entry)) {
                    await requestEntryAudio(entry, { silent: true });
                }
                await fetchSignedAudioUrl(entry);
            }
        },
        [audioUrlCache, requestEntryAudio, fetchSignedAudioUrl]
    );

    const announceSpeechState = useCallback((active: boolean) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('narration-speech', { detail: { active } }));
        }
    }, []);

    const stopAudioPlayback = useCallback(() => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.src = '';
            audioElementRef.current = null;
        }
        setIsAudioPlaying(false);
        announceSpeechState(false);
    }, [announceSpeechState]);

    useEffect(() => () => stopAudioPlayback(), [stopAudioPlayback]);

    type AudioQueueOptions = {
        onAutoPlayBlocked?: () => void;
    };

    const playAudioQueue = useCallback(
        (urls: string[], options?: AudioQueueOptions) => {
            if (!urls.length) return false;
            stopAudioPlayback();

            const audio = new Audio();
            audioElementRef.current = audio;
            let index = 0;

            const playNext = () => {
                if (!audioElementRef.current) return;
                if (index >= urls.length) {
                    stopAudioPlayback();
                    return;
                }
                const nextUrl = urls[index++];
                audioElementRef.current.src = nextUrl;
                audioElementRef.current
                    .play()
                    .then(() => {
                        setIsAudioPlaying(true);
                        announceSpeechState(true);
                    })
                    .catch(error => {
                        if ((error as DOMException)?.name === 'NotAllowedError') {
                            stopAudioPlayback();
                            options?.onAutoPlayBlocked?.();
                        } else {
                            console.warn('[NewNarrativeLog] Falha ao reproduzir áudio de narração:', error);
                            playNext();
                        }
                    });
            };

            audio.onended = () => playNext();
            audio.onerror = () => playNext();

            playNext();
            return true;
        },
        [stopAudioPlayback, announceSpeechState]
    );

    const currentBlock = useMemo(() => {
        if (!log?.length) return [] as LogEntryType[];
        let lastActionIndex = -1;
        for (let i = log.length - 1; i >= 0; i--) {
            if (log[i]?.type === 'action') {
                lastActionIndex = i;
                break;
            }
        }
        return log.slice(lastActionIndex + 1).filter(entry => entry && entry.type !== 'action') as LogEntryType[];
    }, [log]);

    useEffect(() => {
        if (!autoSpeak || !currentBlock.length) return;
        const controller = { cancelled: false };

        (async () => {
            const lastEntryId = currentBlock[currentBlock.length - 1]?.id;
            if (!lastEntryId || lastSpokenIdRef.current === lastEntryId) return;
            await ensureAudioForEntries(currentBlock);
            if (controller.cancelled) return;
            const urls: string[] = [];
            for (const entry of currentBlock) {
                const url = await ensurePlayableAudio(entry);
                if (controller.cancelled) return;
                if (url) urls.push(url);
            }
            if (urls.length) {
                const started = playAudioQueue(urls);
                if (started) {
                    lastSpokenIdRef.current = lastEntryId;
                }
            }
        })();

        return () => {
            controller.cancelled = true;
        };
    }, [autoSpeak, currentBlock, ensureAudioForEntries, ensurePlayableAudio, playAudioQueue]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);

    const handlePlayEntry = useCallback(
        async (entry: LogEntryType) => {
            const audioUrl = await ensurePlayableAudio(entry, { silent: false });
            if (!audioUrl) {
                toast({
                    variant: 'destructive',
                    description: 'Não foi possível carregar o áudio desta narração.',
                });
                return;
            }
            playAudioQueue([audioUrl]);
            lastSpokenIdRef.current = entry.id;
        },
        [ensurePlayableAudio, playAudioQueue, toast]
    );

    const handlePlayCurrentBlock = useCallback(async () => {
        if (!currentBlock.length) return;
        await ensureAudioForEntries(currentBlock);
        const urls: string[] = [];
        for (const entry of currentBlock) {
            const url = await ensurePlayableAudio(entry);
            if (url) urls.push(url);
        }
        if (urls.length) {
            playAudioQueue(urls);
        }
        const lastEntryId = currentBlock[currentBlock.length - 1]?.id;
        if (lastEntryId) {
            lastSpokenIdRef.current = lastEntryId;
        }
    }, [currentBlock, ensureAudioForEntries, ensurePlayableAudio, playAudioQueue]);

    const handleStopNarration = useCallback(() => {
        stopAudioPlayback();
    }, [stopAudioPlayback]);

    useEffect(() => {
        const handlePlay = () => {
            void handlePlayCurrentBlock();
        };
        const handleStop = () => handleStopNarration();
        window.addEventListener('narration-play-request', handlePlay as EventListener);
        window.addEventListener('narration-stop-request', handleStop as EventListener);
        return () => {
            window.removeEventListener('narration-play-request', handlePlay as EventListener);
            window.removeEventListener('narration-stop-request', handleStop as EventListener);
        };
    }, [handlePlayCurrentBlock, handleStopNarration]);

    const handleGenerateAudio = useCallback(
        async (entry: LogEntryType) => {
            await requestEntryAudio(entry);
        },
        [requestEntryAudio]
    );

    const handleGenerateImageEntry = useCallback(
        async (entry: LogEntryType) => {
            if (!IMAGE_FEATURE_ENABLED) return;
            if (!entry?.id || entry.type !== 'image') return;
            const content = entry.content && typeof entry.content === 'object' ? (entry.content as ImageLogEntryContent) : null;
            const prompt = content?.prompt;
            if (!prompt) {
                toast({
                    variant: 'destructive',
                    description: 'Não há prompt disponível para gerar esta imagem.',
                });
                return;
            }
            const trimmedKey = apiKey?.trim();
            if (!trimmedKey) {
                toast({
                    variant: 'destructive',
                    title: 'Chave de API necessária',
                    description: 'Configure sua Google AI Studio API Key em Configurações para gerar imagens.',
                });
                return;
            }
            setImageEntryLoading(entry.id, true);
            updateImageEntry(entry.id, {
                status: 'generating',
                error: undefined,
                requestedAt: new Date().toISOString(),
            });
            try {
                const result = await generateSceneImage(prompt, trimmedKey);
                updateImageEntry(entry.id, {
                    status: 'done',
                    imageUrl: result.imageUrl,
                    url: result.imageUrl,
                    imageKey: result.imageKey,
                    size: result.size,
                    contentType: result.contentType,
                    completedAt: new Date().toISOString(),
                });
                toast({
                    title: 'Imagem gerada',
                    description: 'A nova ilustração foi adicionada ao diário.',
                });
            } catch (error) {
                console.warn('[NewNarrativeLog] Falha ao gerar imagem:', error);
                updateImageEntry(entry.id, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Falha ao gerar imagem.',
                });
                toast({
                    variant: 'destructive',
                    title: 'Erro ao gerar imagem',
                    description:
                        error instanceof Error
                            ? error.message
                            : 'O servidor não conseguiu gerar a imagem solicitada.',
                });
            } finally {
                setImageEntryLoading(entry.id, false);
            }
        },
        [apiKey, setImageEntryLoading, toast, updateImageEntry]
    );

    const handleRefreshImageEntry = useCallback(
        async (entry: LogEntryType) => {
            if (!IMAGE_FEATURE_ENABLED) return;
            if (!entry?.id || entry.type !== 'image') return;
            const content = entry.content && typeof entry.content === 'object' ? (entry.content as ImageLogEntryContent) : null;
            const key = content?.imageKey;
            if (!key) {
                toast({
                    variant: 'destructive',
                    description: 'Não foi possível atualizar o link desta imagem.',
                });
                return;
            }
            setImageEntryLoading(entry.id, true);
            try {
                const { imageUrl } = await getSignedImageUrl(key);
                updateImageEntry(entry.id, {
                    imageUrl,
                    url: imageUrl,
                });
                toast({
                    description: 'Link da imagem atualizado.',
                });
            } catch (error) {
                console.warn('[NewNarrativeLog] Falha ao renovar URL de imagem:', error);
                toast({
                    variant: 'destructive',
                    title: 'Erro ao atualizar link',
                    description:
                        error instanceof Error
                            ? error.message
                            : 'Não foi possível renovar a URL assinada desta imagem.',
                });
            } finally {
                setImageEntryLoading(entry.id, false);
            }
        },
        [setImageEntryLoading, toast, updateImageEntry]
    );

    if (!log || log.length === 0) {
        return (
            <div className="text-center text-stone-500 italic p-8">
                A aventura ainda não começou.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <PendingRollBanner />
            <NpcRollDisplay />

            {log.map((entry) => {
                if(!entry || !entry.id) return null;
                return (
                    <LogEntry
                        key={entry.id}
                        entry={entry}
                        onPlayAudio={(item) => { void handlePlayEntry(item); }}
                        onGenerateAudio={handleGenerateAudio}
                        isGenerating={Boolean(generatingEntries[entry.id])}
                        onGenerateImage={IMAGE_FEATURE_ENABLED ? handleGenerateImageEntry : undefined}
                        onRefreshImage={IMAGE_FEATURE_ENABLED ? handleRefreshImageEntry : undefined}
                        isImageLoading={IMAGE_FEATURE_ENABLED ? Boolean(imageLoadingEntries[entry.id]) : false}
                    />
                );
            })}
            <div ref={logEndRef} />
        </div>
    );
};

export default NewNarrativeLog;
